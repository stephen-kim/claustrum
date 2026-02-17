import {
  Prisma,
  IntegrationProvider,
  ImportSource,
  ImportStatus,
  ProjectRole,
  RawEventType,
  ResolutionKind,
  WorkspaceRole,
  type PrismaClient,
} from '@prisma/client';
import {
  createMemorySchema,
  createProjectMappingSchema,
  createProjectSchema,
  memorySourceSchema,
  memoryStatusSchema,
  memoryTypeSchema,
  resolveProjectSchema,
  updateProjectMappingSchema,
  workspaceSettingsSchema,
  type ListMemoriesQuery,
} from '@claustrum/shared';
import type { AuthContext } from './auth.js';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { NotionClientAdapter } from './integrations/notion-client.js';
import { JiraClientAdapter } from './integrations/jira-client.js';
import { ConfluenceClientAdapter } from './integrations/confluence-client.js';
import { LinearClientAdapter } from './integrations/linear-client.js';
import type {
  SlackAuditNotifier,
  SlackDeliveryConfig,
} from './integrations/audit-slack-notifier.js';
import { AuditReasoner } from './integrations/audit-reasoner.js';
import {
  buildStagedCandidate,
  createMemorySnippet,
  getStringFromJson,
  parseSourceFile,
} from './service/import-utils.js';
import { diffFields, normalizeReason, withAutoReason } from './service/audit-utils.js';
import {
  getConfigBoolean,
  getConfigSlackRoutes,
  getConfigSlackSeverityRules,
  getConfigString,
  getConfigStringArray,
  normalizeIntegrationConfig,
  toIntegrationProvider,
  toIntegrationSummary,
  toJsonObject,
} from './service/integration-utils.js';
import {
  buildGitAutoWriteContent,
  buildGitAutoWriteTitle,
  shouldAutoWriteForGitEvent,
} from './service/git-autowrite-utils.js';
import {
  assertProjectAccess,
  assertRawAccess,
  assertWorkspaceAccess,
  assertWorkspaceAdmin,
  isWorkspaceAdminRole,
} from './service/access-control.js';
import { getEffectiveAuditReasonerConfig, getEnvAuditReasonerConfigAsJson, hasEnvAuditReasonerPreference, type AuditReasonerEnvConfig } from './service/audit-reasoner-config.js';
import { AuthorizationError, NotFoundError, ValidationError } from './service/errors.js';
import {
  buildGithubExternalIdCandidates,
  composeMonorepoProjectKey,
  getEffectiveWorkspaceSettings,
  normalizeGithubSelector,
  parseResolutionOrder,
  resolveMonorepoSubpath,
  toGithubMappingExternalId,
} from './service/workspace-resolution.js';

export { AuthorizationError, NotFoundError, ValidationError } from './service/errors.js';

export class MemoryCoreService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notionClient?: NotionClientAdapter,
    private readonly notionWriteEnabled = false,
    private readonly jiraClient?: JiraClientAdapter,
    private readonly confluenceClient?: ConfluenceClientAdapter,
    private readonly linearClient?: LinearClientAdapter,
    private readonly auditSlackNotifier?: SlackAuditNotifier,
    private readonly auditReasoner?: AuditReasoner,
    private readonly integrationLockedProviders: ReadonlySet<IntegrationProvider> = new Set(),
    private readonly auditReasonerEnvConfig: AuditReasonerEnvConfig = {
      enabled: false,
      preferEnv: false,
      providerOrder: [],
      providers: {},
    }
  ) {}

  async selectSession(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
  }): Promise<{ workspace_key: string; project_key: string; ok: true }> {
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await assertProjectAccess(this.prisma, args.auth, project.workspaceId, project.id);
    return { workspace_key: args.workspaceKey, project_key: args.projectKey, ok: true };
  }

  async resolveProject(args: {
    auth: AuthContext;
    input: unknown;
  }): Promise<{
    workspace_key: string;
    project: { key: string; id: string; name: string };
    resolution: ResolutionKind;
    matched_mapping_id?: string;
    created?: boolean;
  }> {
    const parsed = resolveProjectSchema.safeParse(args.input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const input = parsed.data;
    const workspace = await this.getWorkspaceByKey(input.workspace_key);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const settings = await getEffectiveWorkspaceSettings(this.prisma, workspace.id);

    for (const kind of settings.resolutionOrder) {
      if (kind === ResolutionKind.github_remote) {
        const github = normalizeGithubSelector(input);
        if (!github) {
          continue;
        }
        const monorepoEnabled =
          settings.enableMonorepoResolution && input.monorepo?.enabled !== false;
        const monorepoSubpath = monorepoEnabled
          ? resolveMonorepoSubpath(input, {
              monorepoMode: settings.monorepoMode,
              monorepoWorkspaceGlobs: settings.monorepoWorkspaceGlobs,
              monorepoMaxDepth: settings.monorepoMaxDepth,
            })
          : null;
        const repoExternalCandidates = buildGithubExternalIdCandidates(github, null);
        const subprojectExternalCandidates = monorepoSubpath
          ? buildGithubExternalIdCandidates(github, monorepoSubpath, { includeBase: false })
          : [];

        const subprojectMapping = monorepoSubpath
          ? await this.prisma.projectMapping.findFirst({
              where: {
                workspaceId: workspace.id,
                kind: ResolutionKind.github_remote,
                externalId: { in: subprojectExternalCandidates },
                isEnabled: true,
              },
              orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
              include: { project: true },
            })
          : null;
        if (subprojectMapping) {
          await assertProjectAccess(
            this.prisma,
            args.auth,
            subprojectMapping.project.workspaceId,
            subprojectMapping.project.id
          );
          return {
            workspace_key: workspace.key,
            project: {
              key: subprojectMapping.project.key,
              id: subprojectMapping.project.id,
              name: subprojectMapping.project.name,
            },
            resolution: ResolutionKind.github_remote,
            matched_mapping_id: subprojectMapping.id,
          };
        }

        const mapping = await this.prisma.projectMapping.findFirst({
          where: {
            workspaceId: workspace.id,
            kind: ResolutionKind.github_remote,
            externalId: { in: repoExternalCandidates },
            isEnabled: true,
          },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          include: { project: true },
        });
        if (
          mapping &&
          monorepoSubpath &&
          settings.autoCreateProject &&
          settings.autoCreateProjectSubprojects
        ) {
          const projectKey = composeMonorepoProjectKey(
            mapping.project.key,
            monorepoSubpath,
            settings.monorepoMode
          );
          const createdSubproject = await this.createProjectAndMapping({
            workspaceId: workspace.id,
            kind: ResolutionKind.github_remote,
            externalId: toGithubMappingExternalId(github.normalized, monorepoSubpath),
            projectKey,
            projectName: `${mapping.project.name} / ${monorepoSubpath}`,
          });
          await assertProjectAccess(
            this.prisma,
            args.auth,
            workspace.id,
            createdSubproject.project.id
          );
          return {
            workspace_key: workspace.key,
            project: {
              key: createdSubproject.project.key,
              id: createdSubproject.project.id,
              name: createdSubproject.project.name,
            },
            resolution: ResolutionKind.github_remote,
            matched_mapping_id: createdSubproject.mapping.id,
            created: createdSubproject.created,
          };
        }
        if (mapping) {
          await assertProjectAccess(this.prisma, args.auth, mapping.project.workspaceId, mapping.project.id);
          return {
            workspace_key: workspace.key,
            project: {
              key: mapping.project.key,
              id: mapping.project.id,
              name: mapping.project.name,
            },
            resolution: ResolutionKind.github_remote,
            matched_mapping_id: mapping.id,
          };
        }

        if (settings.autoCreateProject) {
          const repoProject = await this.createProjectAndMapping({
            workspaceId: workspace.id,
            kind: ResolutionKind.github_remote,
            externalId: toGithubMappingExternalId(github.normalized),
            projectKey: `${settings.githubKeyPrefix}${github.normalized}`,
            projectName: github.normalized,
          });
          if (monorepoSubpath && settings.autoCreateProjectSubprojects) {
            const subprojectKey = composeMonorepoProjectKey(
              repoProject.project.key,
              monorepoSubpath,
              settings.monorepoMode
            );
            const subproject = await this.createProjectAndMapping({
              workspaceId: workspace.id,
              kind: ResolutionKind.github_remote,
              externalId: toGithubMappingExternalId(github.normalized, monorepoSubpath),
              projectKey: subprojectKey,
              projectName: `${github.normalized} / ${monorepoSubpath}`,
            });
            await assertProjectAccess(this.prisma, args.auth, workspace.id, subproject.project.id);
            return {
              workspace_key: workspace.key,
              project: {
                key: subproject.project.key,
                id: subproject.project.id,
                name: subproject.project.name,
              },
              resolution: ResolutionKind.github_remote,
              matched_mapping_id: subproject.mapping.id,
              created: subproject.created || repoProject.created,
            };
          }
          await assertProjectAccess(this.prisma, args.auth, workspace.id, repoProject.project.id);
          return {
            workspace_key: workspace.key,
            project: {
              key: repoProject.project.key,
              id: repoProject.project.id,
              name: repoProject.project.name,
            },
            resolution: ResolutionKind.github_remote,
            matched_mapping_id: repoProject.mapping.id,
            created: repoProject.created,
          };
        }
      }

      if (kind === ResolutionKind.repo_root_slug) {
        const slug = (input.repo_root_slug || '').trim();
        if (!slug) {
          continue;
        }

        const mapping = await this.prisma.projectMapping.findFirst({
          where: {
            workspaceId: workspace.id,
            kind: ResolutionKind.repo_root_slug,
            externalId: slug,
            isEnabled: true,
          },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          include: { project: true },
        });
        if (mapping) {
          await assertProjectAccess(this.prisma, args.auth, mapping.project.workspaceId, mapping.project.id);
          return {
            workspace_key: workspace.key,
            project: {
              key: mapping.project.key,
              id: mapping.project.id,
              name: mapping.project.name,
            },
            resolution: ResolutionKind.repo_root_slug,
            matched_mapping_id: mapping.id,
          };
        }

        if (settings.autoCreateProject) {
          const created = await this.createProjectAndMapping({
            workspaceId: workspace.id,
            kind: ResolutionKind.repo_root_slug,
            externalId: slug,
            projectKey: `${settings.localKeyPrefix}${slug}`,
            projectName: slug,
          });
          await assertProjectAccess(this.prisma, args.auth, workspace.id, created.project.id);
          return {
            workspace_key: workspace.key,
            project: {
              key: created.project.key,
              id: created.project.id,
              name: created.project.name,
            },
            resolution: ResolutionKind.repo_root_slug,
            matched_mapping_id: created.mapping.id,
            created: created.created,
          };
        }
      }

      if (kind === ResolutionKind.manual) {
        const manualKey = (input.manual_project_key || '').trim();
        if (!manualKey) {
          continue;
        }
        const project = await this.prisma.project.findUnique({
          where: {
            workspaceId_key: {
              workspaceId: workspace.id,
              key: manualKey,
            },
          },
        });
        if (!project) {
          throw new NotFoundError(`Project not found for manual selection: ${manualKey}`);
        }
        await assertProjectAccess(this.prisma, args.auth, workspace.id, project.id);
        const mapping = await this.ensureProjectMapping({
          workspaceId: workspace.id,
          projectId: project.id,
          kind: ResolutionKind.manual,
          externalId: manualKey,
        });
        return {
          workspace_key: workspace.key,
          project: {
            key: project.key,
            id: project.id,
            name: project.name,
          },
          resolution: ResolutionKind.manual,
          matched_mapping_id: mapping.id,
        };
      }
    }

    throw new NotFoundError('Could not resolve project from provided selectors.');
  }

  async listProjects(args: { auth: AuthContext; workspaceKey: string }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const membership = await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const projectScope =
      args.auth.projectAccessBypass ||
      args.auth.user.envAdmin ||
      isWorkspaceAdminRole(membership.role)
        ? {
            workspaceId: workspace.id,
          }
        : {
            workspaceId: workspace.id,
            members: {
              some: {
                userId: args.auth.user.id,
              },
            },
          };

    const projects = await this.prisma.project.findMany({
      where: projectScope,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        key: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { workspace_key: workspace.key, projects };
  }

  async createProject(args: {
    auth: AuthContext;
    input: unknown;
  }) {
    const parsed = createProjectSchema.safeParse(args.input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const workspace = await this.getWorkspaceByKey(parsed.data.workspace_key);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);

    const project = await this.prisma.project.upsert({
      where: {
        workspaceId_key: {
          workspaceId: workspace.id,
          key: parsed.data.key,
        },
      },
      update: {
        name: parsed.data.name,
      },
      create: {
        workspaceId: workspace.id,
        key: parsed.data.key,
        name: parsed.data.name,
      },
    });

    if (!args.auth.projectAccessBypass && !args.auth.user.envAdmin) {
      await this.prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: args.auth.user.id,
          },
        },
        update: { role: ProjectRole.ADMIN },
        create: {
          projectId: project.id,
          userId: args.auth.user.id,
          role: ProjectRole.ADMIN,
        },
      });
    }

    return project;
  }

  async createMemory(args: { auth: AuthContext; input: unknown }) {
    const parsed = createMemorySchema.safeParse(args.input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const project = await this.getProjectByKeys(parsed.data.workspace_key, parsed.data.project_key);
    await assertProjectAccess(this.prisma, args.auth, project.workspaceId, project.id);

    const created = await this.prisma.memory.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: parsed.data.type,
        content: parsed.data.content,
        status: parsed.data.status ? memoryStatusSchema.parse(parsed.data.status) : undefined,
        source: parsed.data.source ? memorySourceSchema.parse(parsed.data.source) : undefined,
        confidence:
          typeof parsed.data.confidence === 'number'
            ? Math.min(Math.max(parsed.data.confidence, 0), 1)
            : undefined,
        evidence: (parsed.data.evidence as Prisma.InputJsonValue | undefined) ?? undefined,
        metadata: (parsed.data.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        createdBy: args.auth.user.id,
      },
      select: {
        id: true,
        type: true,
        content: true,
        status: true,
        source: true,
        confidence: true,
        evidence: true,
        metadata: true,
        createdBy: true,
        createdAt: true,
        project: {
          select: {
            key: true,
            workspace: {
              select: { key: true },
            },
          },
        },
      },
    });
    await this.updateMemoryEmbedding(created.id, created.content);
    return created;
  }

  async listMemories(args: { auth: AuthContext; query: ListMemoriesQuery }) {
    const workspace = await this.getWorkspaceByKey(args.query.workspace_key);
    const settings = await getEffectiveWorkspaceSettings(this.prisma, workspace.id);
    const defaultLimit = Math.min(Math.max(settings.searchDefaultLimit || 20, 1), 500);
    const limit = Math.min(Math.max(args.query.limit || defaultLimit, 1), 500);
    const membership = await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);

    let projectId: string | undefined;
    if (args.query.project_key) {
      const project = await this.getProjectByKeys(args.query.workspace_key, args.query.project_key);
      await assertProjectAccess(this.prisma, args.auth, project.workspaceId, project.id);
      projectId = project.id;
    }

    const type = args.query.type ? memoryTypeSchema.parse(args.query.type) : undefined;
    const status = args.query.status ? memoryStatusSchema.parse(args.query.status) : undefined;
    const source = args.query.source ? memorySourceSchema.parse(args.query.source) : undefined;
    const confidenceMin =
      typeof args.query.confidence_min === 'number'
        ? Math.min(Math.max(args.query.confidence_min, 0), 1)
        : undefined;
    const confidenceMax =
      typeof args.query.confidence_max === 'number'
        ? Math.min(Math.max(args.query.confidence_max, 0), 1)
        : undefined;

    const where: Prisma.MemoryWhereInput = {};
    let allowedProjectIds: string[] | null = null;
    if (projectId) {
      where.projectId = projectId;
      where.workspaceId = workspace.id;
      allowedProjectIds = [projectId];
    } else if (
      args.auth.projectAccessBypass ||
      args.auth.user.envAdmin ||
      isWorkspaceAdminRole(membership.role)
    ) {
      where.workspaceId = workspace.id;
      allowedProjectIds = null;
    } else {
      const memberships = await this.prisma.projectMember.findMany({
        where: {
          userId: args.auth.user.id,
          project: {
            workspaceId: workspace.id,
          },
        },
        select: {
          projectId: true,
        },
      });
      const projectIds = memberships.map((item) => item.projectId);
      if (projectIds.length === 0) {
        return [];
      }
      where.workspaceId = workspace.id;
      where.projectId = { in: projectIds };
      allowedProjectIds = projectIds;
    }
    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }
    if (source) {
      where.source = source;
    }
    if (confidenceMin !== undefined || confidenceMax !== undefined) {
      where.confidence = {
        gte: confidenceMin,
        lte: confidenceMax,
      };
    }
    if (args.query.since) {
      where.createdAt = {
        gte: new Date(args.query.since),
      };
    }
    const mode = (args.query.mode ||
      settings.searchDefaultMode ||
      'hybrid') as 'hybrid' | 'keyword' | 'semantic';
    const q = (args.query.q || '').trim();
    if (!q) {
      return this.prisma.memory.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: {
          id: true,
          type: true,
          content: true,
          status: true,
          source: true,
          confidence: true,
          evidence: true,
          metadata: true,
          createdBy: true,
          createdAt: true,
          project: {
            select: {
              key: true,
              name: true,
              workspace: {
                select: {
                  key: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    }

    const keywordCandidates = await this.searchMemoryCandidateScores({
      workspaceId: workspace.id,
      q,
      projectIds: allowedProjectIds,
      type,
      status,
      source,
      since: args.query.since,
      confidenceMin,
      confidenceMax,
      limit: Math.max(limit * 10, 200),
      mode: 'keyword',
    });
    let rankedIds: string[] = [];
    if (mode === 'keyword') {
      rankedIds = keywordCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.id);
    } else {
      const semanticCandidates = await this.searchMemoryCandidateScores({
        workspaceId: workspace.id,
        q,
        projectIds: allowedProjectIds,
        type,
        status,
        source,
        since: args.query.since,
        confidenceMin,
        confidenceMax,
        limit: Math.max(limit * 10, 200),
        mode: 'semantic',
      });
      if (mode === 'semantic') {
        rankedIds = semanticCandidates
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((item) => item.id);
      } else {
        const combined = new Map<string, number>();
        for (const candidate of keywordCandidates) {
          combined.set(candidate.id, (combined.get(candidate.id) || 0) + settings.searchHybridBeta * candidate.score);
        }
        for (const candidate of semanticCandidates) {
          combined.set(
            candidate.id,
            (combined.get(candidate.id) || 0) + settings.searchHybridAlpha * candidate.score
          );
        }
        rankedIds = [...combined.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([id]) => id);
      }
    }
    if (rankedIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.memory.findMany({
      where: {
        id: { in: rankedIds },
      },
      select: {
        id: true,
        type: true,
        content: true,
        status: true,
        source: true,
        confidence: true,
        evidence: true,
        metadata: true,
        createdBy: true,
        createdAt: true,
        project: {
          select: {
            key: true,
            name: true,
            workspace: {
              select: {
                key: true,
                name: true,
              },
            },
          },
        },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return rankedIds.map((id) => byId.get(id)).filter(Boolean);
  }

  async listWorkspaces(args: { auth: AuthContext }) {
    if (args.auth.projectAccessBypass || args.auth.user.envAdmin) {
      return this.prisma.workspace.findMany({
        orderBy: [{ createdAt: 'asc' }],
      });
    }

    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: args.auth.user.id,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async createWorkspace(args: {
    auth: AuthContext;
    key: string;
    name: string;
  }) {
    if (!args.auth.projectAccessBypass && !args.auth.user.envAdmin) {
      throw new AuthorizationError('Only admin API keys can create workspaces in this build.');
    }

    return this.prisma.workspace.upsert({
      where: { key: args.key },
      update: { name: args.name },
      create: { key: args.key, name: args.name },
    });
  }

  async listUsers(args: { auth: AuthContext }) {
    if (!args.auth.projectAccessBypass && !args.auth.user.envAdmin) {
      throw new AuthorizationError('Only admin API keys can list users.');
    }
    return this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  }

  async createUser(args: {
    auth: AuthContext;
    email: string;
    name?: string;
  }) {
    if (!args.auth.projectAccessBypass && !args.auth.user.envAdmin) {
      throw new AuthorizationError('Only admin API keys can create users.');
    }

    return this.prisma.user.upsert({
      where: { email: args.email },
      update: { name: args.name ?? null },
      create: { email: args.email, name: args.name ?? null },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  async addProjectMember(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    email: string;
    role: ProjectRole;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);

    const user = await this.prisma.user.findUnique({
      where: { email: args.email },
    });
    if (!user) {
      throw new NotFoundError(`User not found: ${args.email}`);
    }

    const [member] = await this.prisma.$transaction([
      this.prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: user.id,
          },
        },
        update: { role: args.role },
        create: {
          projectId: project.id,
          userId: user.id,
          role: args.role,
        },
        include: {
          user: { select: { email: true, name: true } },
        },
      }),
      this.prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceRole.MEMBER,
        },
      }),
    ]);

    return member;
  }

  async listProjectMembers(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
  }) {
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await assertProjectAccess(this.prisma, args.auth, project.workspaceId, project.id);

    return this.prisma.projectMember.findMany({
      where: { projectId: project.id },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async getWorkspaceSettings(args: { auth: AuthContext; workspaceKey: string }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const effective = await getEffectiveWorkspaceSettings(this.prisma, workspace.id);
    return {
      workspace_key: workspace.key,
      resolution_order: effective.resolutionOrder,
      auto_create_project: effective.autoCreateProject,
      auto_create_project_subprojects: effective.autoCreateProjectSubprojects,
      auto_switch_repo: effective.autoSwitchRepo,
      auto_switch_subproject: effective.autoSwitchSubproject,
      allow_manual_pin: effective.allowManualPin,
      enable_git_events: effective.enableGitEvents,
      enable_commit_events: effective.enableCommitEvents,
      enable_merge_events: effective.enableMergeEvents,
      enable_checkout_events: effective.enableCheckoutEvents,
      checkout_debounce_seconds: effective.checkoutDebounceSeconds,
      checkout_daily_limit: effective.checkoutDailyLimit,
      enable_auto_extraction: effective.enableAutoExtraction,
      auto_extraction_mode: effective.autoExtractionMode,
      auto_confirm_min_confidence: effective.autoConfirmMinConfidence,
      auto_confirm_allowed_event_types: effective.autoConfirmAllowedEventTypes,
      auto_confirm_keyword_allowlist: effective.autoConfirmKeywordAllowlist,
      auto_confirm_keyword_denylist: effective.autoConfirmKeywordDenylist,
      auto_extraction_batch_size: effective.autoExtractionBatchSize,
      search_default_mode: effective.searchDefaultMode,
      search_hybrid_alpha: effective.searchHybridAlpha,
      search_hybrid_beta: effective.searchHybridBeta,
      search_default_limit: effective.searchDefaultLimit,
      github_key_prefix: effective.githubKeyPrefix,
      local_key_prefix: effective.localKeyPrefix,
      enable_monorepo_resolution: effective.enableMonorepoResolution,
      monorepo_detection_level: effective.monorepoDetectionLevel,
      monorepo_mode: effective.monorepoMode,
      monorepo_root_markers: effective.monorepoRootMarkers,
      monorepo_workspace_globs: effective.monorepoWorkspaceGlobs,
      monorepo_exclude_globs: effective.monorepoExcludeGlobs,
      monorepo_max_depth: effective.monorepoMaxDepth,
    };
  }

  async updateWorkspaceSettings(args: {
    auth: AuthContext;
    workspaceKey: string;
    input: unknown;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const current = await getEffectiveWorkspaceSettings(this.prisma, workspace.id);
    const rawInput = (args.input || {}) as Record<string, unknown>;
    const reason = normalizeReason(rawInput.reason);
    const parsed = workspaceSettingsSchema.safeParse({
      workspace_key: args.workspaceKey,
      resolution_order: rawInput.resolution_order ?? current.resolutionOrder,
      auto_create_project: rawInput.auto_create_project ?? current.autoCreateProject,
      auto_create_project_subprojects:
        rawInput.auto_create_project_subprojects ?? current.autoCreateProjectSubprojects,
      auto_switch_repo: rawInput.auto_switch_repo ?? current.autoSwitchRepo,
      auto_switch_subproject:
        rawInput.auto_switch_subproject ?? current.autoSwitchSubproject,
      allow_manual_pin: rawInput.allow_manual_pin ?? current.allowManualPin,
      enable_git_events: rawInput.enable_git_events ?? current.enableGitEvents,
      enable_commit_events: rawInput.enable_commit_events ?? current.enableCommitEvents,
      enable_merge_events: rawInput.enable_merge_events ?? current.enableMergeEvents,
      enable_checkout_events: rawInput.enable_checkout_events ?? current.enableCheckoutEvents,
      checkout_debounce_seconds:
        rawInput.checkout_debounce_seconds ?? current.checkoutDebounceSeconds,
      checkout_daily_limit: rawInput.checkout_daily_limit ?? current.checkoutDailyLimit,
      enable_auto_extraction:
        rawInput.enable_auto_extraction ?? current.enableAutoExtraction,
      auto_extraction_mode: rawInput.auto_extraction_mode ?? current.autoExtractionMode,
      auto_confirm_min_confidence:
        rawInput.auto_confirm_min_confidence ?? current.autoConfirmMinConfidence,
      auto_confirm_allowed_event_types:
        rawInput.auto_confirm_allowed_event_types ?? current.autoConfirmAllowedEventTypes,
      auto_confirm_keyword_allowlist:
        rawInput.auto_confirm_keyword_allowlist ?? current.autoConfirmKeywordAllowlist,
      auto_confirm_keyword_denylist:
        rawInput.auto_confirm_keyword_denylist ?? current.autoConfirmKeywordDenylist,
      auto_extraction_batch_size:
        rawInput.auto_extraction_batch_size ?? current.autoExtractionBatchSize,
      search_default_mode: rawInput.search_default_mode ?? current.searchDefaultMode,
      search_hybrid_alpha: rawInput.search_hybrid_alpha ?? current.searchHybridAlpha,
      search_hybrid_beta: rawInput.search_hybrid_beta ?? current.searchHybridBeta,
      search_default_limit: rawInput.search_default_limit ?? current.searchDefaultLimit,
      github_key_prefix: rawInput.github_key_prefix ?? current.githubKeyPrefix,
      local_key_prefix: rawInput.local_key_prefix ?? current.localKeyPrefix,
      enable_monorepo_resolution:
        rawInput.enable_monorepo_resolution ?? current.enableMonorepoResolution,
      monorepo_detection_level:
        rawInput.monorepo_detection_level ?? current.monorepoDetectionLevel,
      monorepo_mode: rawInput.monorepo_mode ?? current.monorepoMode,
      monorepo_root_markers: rawInput.monorepo_root_markers ?? current.monorepoRootMarkers,
      monorepo_workspace_globs:
        rawInput.monorepo_workspace_globs ?? current.monorepoWorkspaceGlobs,
      monorepo_exclude_globs:
        rawInput.monorepo_exclude_globs ?? current.monorepoExcludeGlobs,
      monorepo_max_depth: rawInput.monorepo_max_depth ?? current.monorepoMaxDepth,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const settings = await this.prisma.workspaceSettings.upsert({
      where: { workspaceId: workspace.id },
      update: {
        resolutionOrder: parsed.data.resolution_order,
        autoCreateProject: parsed.data.auto_create_project,
        autoCreateProjectSubprojects: parsed.data.auto_create_project_subprojects,
        autoSwitchRepo: parsed.data.auto_switch_repo,
        autoSwitchSubproject: parsed.data.auto_switch_subproject,
        allowManualPin: parsed.data.allow_manual_pin,
        enableGitEvents: parsed.data.enable_git_events,
        enableCommitEvents: parsed.data.enable_commit_events,
        enableMergeEvents: parsed.data.enable_merge_events,
        enableCheckoutEvents: parsed.data.enable_checkout_events,
        checkoutDebounceSeconds: parsed.data.checkout_debounce_seconds,
        checkoutDailyLimit: parsed.data.checkout_daily_limit,
        enableAutoExtraction: parsed.data.enable_auto_extraction,
        autoExtractionMode: parsed.data.auto_extraction_mode,
        autoConfirmMinConfidence: parsed.data.auto_confirm_min_confidence,
        autoConfirmAllowedEventTypes: parsed.data.auto_confirm_allowed_event_types,
        autoConfirmKeywordAllowlist: parsed.data.auto_confirm_keyword_allowlist,
        autoConfirmKeywordDenylist: parsed.data.auto_confirm_keyword_denylist,
        autoExtractionBatchSize: parsed.data.auto_extraction_batch_size,
        searchDefaultMode: parsed.data.search_default_mode,
        searchHybridAlpha: parsed.data.search_hybrid_alpha,
        searchHybridBeta: parsed.data.search_hybrid_beta,
        searchDefaultLimit: parsed.data.search_default_limit,
        githubKeyPrefix: parsed.data.github_key_prefix,
        localKeyPrefix: parsed.data.local_key_prefix,
        enableMonorepoResolution: parsed.data.enable_monorepo_resolution,
        monorepoDetectionLevel: parsed.data.monorepo_detection_level,
        monorepoMode: parsed.data.monorepo_mode,
        monorepoRootMarkers: parsed.data.monorepo_root_markers,
        monorepoWorkspaceGlobs: parsed.data.monorepo_workspace_globs,
        monorepoExcludeGlobs: parsed.data.monorepo_exclude_globs,
        monorepoMaxDepth: parsed.data.monorepo_max_depth,
      },
      create: {
        workspaceId: workspace.id,
        resolutionOrder: parsed.data.resolution_order,
        autoCreateProject: parsed.data.auto_create_project,
        autoCreateProjectSubprojects: parsed.data.auto_create_project_subprojects,
        autoSwitchRepo: parsed.data.auto_switch_repo,
        autoSwitchSubproject: parsed.data.auto_switch_subproject,
        allowManualPin: parsed.data.allow_manual_pin,
        enableGitEvents: parsed.data.enable_git_events,
        enableCommitEvents: parsed.data.enable_commit_events,
        enableMergeEvents: parsed.data.enable_merge_events,
        enableCheckoutEvents: parsed.data.enable_checkout_events,
        checkoutDebounceSeconds: parsed.data.checkout_debounce_seconds,
        checkoutDailyLimit: parsed.data.checkout_daily_limit,
        enableAutoExtraction: parsed.data.enable_auto_extraction,
        autoExtractionMode: parsed.data.auto_extraction_mode,
        autoConfirmMinConfidence: parsed.data.auto_confirm_min_confidence,
        autoConfirmAllowedEventTypes: parsed.data.auto_confirm_allowed_event_types,
        autoConfirmKeywordAllowlist: parsed.data.auto_confirm_keyword_allowlist,
        autoConfirmKeywordDenylist: parsed.data.auto_confirm_keyword_denylist,
        autoExtractionBatchSize: parsed.data.auto_extraction_batch_size,
        searchDefaultMode: parsed.data.search_default_mode,
        searchHybridAlpha: parsed.data.search_hybrid_alpha,
        searchHybridBeta: parsed.data.search_hybrid_beta,
        searchDefaultLimit: parsed.data.search_default_limit,
        githubKeyPrefix: parsed.data.github_key_prefix,
        localKeyPrefix: parsed.data.local_key_prefix,
        enableMonorepoResolution: parsed.data.enable_monorepo_resolution,
        monorepoDetectionLevel: parsed.data.monorepo_detection_level,
        monorepoMode: parsed.data.monorepo_mode,
        monorepoRootMarkers: parsed.data.monorepo_root_markers,
        monorepoWorkspaceGlobs: parsed.data.monorepo_workspace_globs,
        monorepoExcludeGlobs: parsed.data.monorepo_exclude_globs,
        monorepoMaxDepth: parsed.data.monorepo_max_depth,
      },
    });

    const nextSettings = {
      resolution_order: parseResolutionOrder(settings.resolutionOrder),
      auto_create_project: settings.autoCreateProject,
      auto_create_project_subprojects: settings.autoCreateProjectSubprojects,
      auto_switch_repo: settings.autoSwitchRepo,
      auto_switch_subproject: settings.autoSwitchSubproject,
      allow_manual_pin: settings.allowManualPin,
      enable_git_events: settings.enableGitEvents,
      enable_commit_events: settings.enableCommitEvents,
      enable_merge_events: settings.enableMergeEvents,
      enable_checkout_events: settings.enableCheckoutEvents,
      checkout_debounce_seconds: settings.checkoutDebounceSeconds,
      checkout_daily_limit: settings.checkoutDailyLimit,
      enable_auto_extraction: settings.enableAutoExtraction,
      auto_extraction_mode: settings.autoExtractionMode,
      auto_confirm_min_confidence: settings.autoConfirmMinConfidence,
      auto_confirm_allowed_event_types: settings.autoConfirmAllowedEventTypes,
      auto_confirm_keyword_allowlist: settings.autoConfirmKeywordAllowlist,
      auto_confirm_keyword_denylist: settings.autoConfirmKeywordDenylist,
      auto_extraction_batch_size: settings.autoExtractionBatchSize,
      search_default_mode: settings.searchDefaultMode,
      search_hybrid_alpha: settings.searchHybridAlpha,
      search_hybrid_beta: settings.searchHybridBeta,
      search_default_limit: settings.searchDefaultLimit,
      github_key_prefix: settings.githubKeyPrefix,
      local_key_prefix: settings.localKeyPrefix,
      enable_monorepo_resolution: settings.enableMonorepoResolution,
      monorepo_detection_level: settings.monorepoDetectionLevel,
      monorepo_mode: settings.monorepoMode,
      monorepo_root_markers: settings.monorepoRootMarkers,
      monorepo_workspace_globs: settings.monorepoWorkspaceGlobs,
      monorepo_exclude_globs: settings.monorepoExcludeGlobs,
      monorepo_max_depth: settings.monorepoMaxDepth,
    };
    const changedFields = diffFields(
      {
        resolution_order: current.resolutionOrder,
        auto_create_project: current.autoCreateProject,
        auto_create_project_subprojects: current.autoCreateProjectSubprojects,
        auto_switch_repo: current.autoSwitchRepo,
        auto_switch_subproject: current.autoSwitchSubproject,
        allow_manual_pin: current.allowManualPin,
        enable_git_events: current.enableGitEvents,
        enable_commit_events: current.enableCommitEvents,
        enable_merge_events: current.enableMergeEvents,
        enable_checkout_events: current.enableCheckoutEvents,
        checkout_debounce_seconds: current.checkoutDebounceSeconds,
        checkout_daily_limit: current.checkoutDailyLimit,
        enable_auto_extraction: current.enableAutoExtraction,
        auto_extraction_mode: current.autoExtractionMode,
        auto_confirm_min_confidence: current.autoConfirmMinConfidence,
        auto_confirm_allowed_event_types: current.autoConfirmAllowedEventTypes,
        auto_confirm_keyword_allowlist: current.autoConfirmKeywordAllowlist,
        auto_confirm_keyword_denylist: current.autoConfirmKeywordDenylist,
        auto_extraction_batch_size: current.autoExtractionBatchSize,
        search_default_mode: current.searchDefaultMode,
        search_hybrid_alpha: current.searchHybridAlpha,
        search_hybrid_beta: current.searchHybridBeta,
        search_default_limit: current.searchDefaultLimit,
        github_key_prefix: current.githubKeyPrefix,
        local_key_prefix: current.localKeyPrefix,
        enable_monorepo_resolution: current.enableMonorepoResolution,
        monorepo_detection_level: current.monorepoDetectionLevel,
        monorepo_mode: current.monorepoMode,
        monorepo_root_markers: current.monorepoRootMarkers,
        monorepo_workspace_globs: current.monorepoWorkspaceGlobs,
        monorepo_exclude_globs: current.monorepoExcludeGlobs,
        monorepo_max_depth: current.monorepoMaxDepth,
      },
      nextSettings
    );
    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'workspace_settings.update',
      target: {
        workspace_key: workspace.key,
        reason,
        changed_fields: changedFields,
        before: {
          resolution_order: current.resolutionOrder,
          auto_create_project: current.autoCreateProject,
          auto_create_project_subprojects: current.autoCreateProjectSubprojects,
          auto_switch_repo: current.autoSwitchRepo,
          auto_switch_subproject: current.autoSwitchSubproject,
          allow_manual_pin: current.allowManualPin,
          enable_git_events: current.enableGitEvents,
          enable_commit_events: current.enableCommitEvents,
          enable_merge_events: current.enableMergeEvents,
          enable_checkout_events: current.enableCheckoutEvents,
          checkout_debounce_seconds: current.checkoutDebounceSeconds,
          checkout_daily_limit: current.checkoutDailyLimit,
          enable_auto_extraction: current.enableAutoExtraction,
          auto_extraction_mode: current.autoExtractionMode,
          auto_confirm_min_confidence: current.autoConfirmMinConfidence,
          auto_confirm_allowed_event_types: current.autoConfirmAllowedEventTypes,
          auto_confirm_keyword_allowlist: current.autoConfirmKeywordAllowlist,
          auto_confirm_keyword_denylist: current.autoConfirmKeywordDenylist,
          auto_extraction_batch_size: current.autoExtractionBatchSize,
          search_default_mode: current.searchDefaultMode,
          search_hybrid_alpha: current.searchHybridAlpha,
          search_hybrid_beta: current.searchHybridBeta,
          search_default_limit: current.searchDefaultLimit,
          github_key_prefix: current.githubKeyPrefix,
          local_key_prefix: current.localKeyPrefix,
          enable_monorepo_resolution: current.enableMonorepoResolution,
          monorepo_detection_level: current.monorepoDetectionLevel,
          monorepo_mode: current.monorepoMode,
          monorepo_root_markers: current.monorepoRootMarkers,
          monorepo_workspace_globs: current.monorepoWorkspaceGlobs,
          monorepo_exclude_globs: current.monorepoExcludeGlobs,
          monorepo_max_depth: current.monorepoMaxDepth,
        },
        after: nextSettings,
      },
    });

    return {
      workspace_key: workspace.key,
      ...nextSettings,
    };
  }

  async listProjectMappings(args: {
    auth: AuthContext;
    workspaceKey: string;
    kind?: ResolutionKind;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const mappings = await this.prisma.projectMapping.findMany({
      where: {
        workspaceId: workspace.id,
        kind: args.kind,
      },
      orderBy: [{ kind: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        project: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    return mappings.map((mapping) => ({
      id: mapping.id,
      kind: mapping.kind,
      external_id: mapping.externalId,
      priority: mapping.priority,
      is_enabled: mapping.isEnabled,
      project: mapping.project,
      created_at: mapping.createdAt,
      updated_at: mapping.updatedAt,
    }));
  }

  async createProjectMapping(args: {
    auth: AuthContext;
    input: unknown;
  }) {
    const rawInput = (args.input || {}) as Record<string, unknown>;
    const reason = normalizeReason(rawInput.reason);
    const parsed = createProjectMappingSchema.safeParse(args.input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(', '));
    }
    const workspace = await this.getWorkspaceByKey(parsed.data.workspace_key);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const project = await this.prisma.project.findUnique({
      where: {
        workspaceId_key: {
          workspaceId: workspace.id,
          key: parsed.data.project_key,
        },
      },
    });
    if (!project) {
      throw new NotFoundError(`Project not found: ${parsed.data.project_key}`);
    }

    const priority =
      parsed.data.priority ??
      (await this.getNextMappingPriority({
        workspaceId: workspace.id,
        kind: parsed.data.kind,
      }));

    const mapping = await this.prisma.projectMapping.upsert({
      where: {
        workspaceId_kind_externalId: {
          workspaceId: workspace.id,
          kind: parsed.data.kind,
          externalId: parsed.data.external_id,
        },
      },
      update: {
        projectId: project.id,
        priority,
        isEnabled: parsed.data.is_enabled ?? true,
      },
      create: {
        workspaceId: workspace.id,
        projectId: project.id,
        kind: parsed.data.kind,
        externalId: parsed.data.external_id,
        priority,
        isEnabled: parsed.data.is_enabled ?? true,
      },
      include: {
        project: {
          select: { id: true, key: true, name: true },
        },
      },
    });

    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'project_mapping.create',
      target: {
        workspace_key: workspace.key,
        reason,
        mapping_id: mapping.id,
        kind: mapping.kind,
        external_id: mapping.externalId,
        priority: mapping.priority,
        is_enabled: mapping.isEnabled,
        project_key: mapping.project.key,
        changed_fields: ['kind', 'external_id', 'project_key', 'priority', 'is_enabled'],
      },
    });

    return {
      id: mapping.id,
      kind: mapping.kind,
      external_id: mapping.externalId,
      priority: mapping.priority,
      is_enabled: mapping.isEnabled,
      project: mapping.project,
    };
  }

  async updateProjectMapping(args: {
    auth: AuthContext;
    input: unknown;
  }) {
    const rawInput = (args.input || {}) as Record<string, unknown>;
    const reason = normalizeReason(rawInput.reason);
    const parsed = updateProjectMappingSchema.safeParse(args.input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const current = await this.prisma.projectMapping.findUnique({
      where: { id: parsed.data.id },
      include: { workspace: true },
    });
    if (!current) {
      throw new NotFoundError(`Project mapping not found: ${parsed.data.id}`);
    }

    await assertWorkspaceAdmin(this.prisma, args.auth, current.workspaceId);

    let projectId: string | undefined;
    if (parsed.data.project_key) {
      const project = await this.prisma.project.findUnique({
        where: {
          workspaceId_key: {
            workspaceId: current.workspaceId,
            key: parsed.data.project_key,
          },
        },
      });
      if (!project) {
        throw new NotFoundError(`Project not found: ${parsed.data.project_key}`);
      }
      projectId = project.id;
    }

    const mapping = await this.prisma.projectMapping.update({
      where: { id: parsed.data.id },
      data: {
        priority: parsed.data.priority,
        isEnabled: parsed.data.is_enabled,
        externalId: parsed.data.external_id,
        projectId,
      },
      include: {
        project: {
          select: { id: true, key: true, name: true },
        },
      },
    });

    const before = {
      external_id: current.externalId,
      priority: current.priority,
      is_enabled: current.isEnabled,
      project_id: current.projectId,
    };
    const after = {
      external_id: mapping.externalId,
      priority: mapping.priority,
      is_enabled: mapping.isEnabled,
      project_id: mapping.projectId,
    };
    const changedFields = diffFields(before, after);
    await this.recordAudit({
      workspaceId: current.workspaceId,
      workspaceKey: current.workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'project_mapping.update',
      target: {
        workspace_key: current.workspace.key,
        reason,
        mapping_id: mapping.id,
        kind: mapping.kind,
        project_key: mapping.project.key,
        changed_fields: changedFields,
        before,
        after,
      },
    });

    return {
      id: mapping.id,
      kind: mapping.kind,
      external_id: mapping.externalId,
      priority: mapping.priority,
      is_enabled: mapping.isEnabled,
      project: mapping.project,
    };
  }

  async createImportUpload(args: {
    auth: AuthContext;
    workspaceKey: string;
    source: ImportSource;
    fileName: string;
    fileBuffer: Buffer;
    projectKey?: string;
  }): Promise<{ import_id: string }> {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);

    let projectId: string | undefined;
    if (args.projectKey) {
      const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
      await assertProjectAccess(this.prisma, args.auth, workspace.id, project.id);
      projectId = project.id;
    }

    const importId = randomUUID();
    const importDir = path.join(tmpdir(), 'claustrum-imports');
    await mkdir(importDir, { recursive: true });
    const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const filePath = path.join(importDir, `${importId}-${safeName}`);
    await writeFile(filePath, args.fileBuffer);

    const record = await this.prisma.importRecord.create({
      data: {
        id: importId,
        workspaceId: workspace.id,
        createdBy: args.auth.user.id,
        source: args.source,
        status: ImportStatus.uploaded,
        fileName: args.fileName,
        filePath,
        stats: {
          bytes: args.fileBuffer.length,
          project_key: args.projectKey ?? null,
          project_id: projectId ?? null,
        },
      },
      select: { id: true },
    });

    return { import_id: record.id };
  }

  async listImports(args: {
    auth: AuthContext;
    workspaceKey: string;
    limit?: number;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const limit = Math.min(Math.max(args.limit || 30, 1), 100);
    return this.prisma.importRecord.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        source: true,
        status: true,
        fileName: true,
        stats: true,
        error: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async parseImport(args: {
    auth: AuthContext;
    importId: string;
  }) {
    const record = await this.getImportRecordById(args.importId);
    await assertWorkspaceAccess(this.prisma, args.auth, record.workspaceId);

    if (!record.filePath) {
      throw new ValidationError('Import file path is missing.');
    }

    let fileText = '';
    try {
      fileText = await readFile(record.filePath, 'utf8');
    } catch (error) {
      await this.prisma.importRecord.update({
        where: { id: record.id },
        data: {
          status: ImportStatus.failed,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    const parsed = parseSourceFile({
      source: record.source,
      text: fileText,
      fallbackSessionId: record.id,
      fallbackTitle: record.fileName,
    });

    const projectFromStats = getStringFromJson(record.stats, 'project_id');
    const session = await this.prisma.$transaction(async (tx) => {
      const rawSession = await tx.rawSession.upsert({
        where: {
          workspaceId_source_sourceSessionId: {
            workspaceId: record.workspaceId,
            source: record.source,
            sourceSessionId: parsed.session.sourceSessionId,
          },
        },
        update: {
          projectId: projectFromStats || null,
          title: parsed.session.title,
          startedAt: parsed.session.startedAt,
          endedAt: parsed.session.endedAt,
          metadata: parsed.session.metadata as Prisma.InputJsonValue,
          createdBy: record.createdBy,
          importId: record.id,
        },
        create: {
          workspaceId: record.workspaceId,
          projectId: projectFromStats || null,
          source: record.source,
          sourceSessionId: parsed.session.sourceSessionId,
          title: parsed.session.title,
          startedAt: parsed.session.startedAt,
          endedAt: parsed.session.endedAt,
          metadata: parsed.session.metadata as Prisma.InputJsonValue,
          createdBy: record.createdBy,
          importId: record.id,
        },
      });

      await tx.rawMessage.deleteMany({
        where: { rawSessionId: rawSession.id },
      });

      if (parsed.messages.length > 0) {
        await tx.rawMessage.createMany({
          data: parsed.messages.map((message) => ({
            rawSessionId: rawSession.id,
            role: message.role,
            content: message.content,
            metadata: (message.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
            createdAt: message.createdAt ?? undefined,
          })),
        });
      }

      await tx.importRecord.update({
        where: { id: record.id },
        data: {
          status: ImportStatus.parsed,
          error: null,
          stats: {
            ...(record.stats as Record<string, unknown> | null),
            message_count: parsed.messages.length,
            session_source_id: parsed.session.sourceSessionId,
            source: record.source,
          },
        },
      });

      return rawSession;
    });

    return {
      import_id: record.id,
      status: ImportStatus.parsed,
      raw_session_id: session.id,
      message_count: parsed.messages.length,
    };
  }

  async extractImport(args: {
    auth: AuthContext;
    importId: string;
  }) {
    const record = await this.getImportRecordById(args.importId);
    await assertWorkspaceAccess(this.prisma, args.auth, record.workspaceId);

    const sessions = await this.prisma.rawSession.findMany({
      where: { importId: record.id },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    const candidates = sessions.flatMap((session) =>
      session.messages
        .map((message) => buildStagedCandidate(session.projectId, message.content, message.role))
        .filter((item): item is NonNullable<typeof item> => item !== null)
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.stagedMemory.deleteMany({
        where: { importId: record.id },
      });

      if (candidates.length > 0) {
        await tx.stagedMemory.createMany({
          data: candidates.map((candidate) => ({
            importId: record.id,
            workspaceId: record.workspaceId,
            projectId: candidate.projectId ?? null,
            type: candidate.type,
            content: candidate.content,
            metadata: candidate.metadata as Prisma.InputJsonValue,
            isSelected: true,
          })),
        });
      }

      await tx.importRecord.update({
        where: { id: record.id },
        data: {
          status: ImportStatus.extracted,
          error: null,
          stats: {
            ...(record.stats as Record<string, unknown> | null),
            staged_count: candidates.length,
          },
        },
      });
    });

    const refreshedImport = await this.prisma.importRecord.findUnique({
      where: { id: record.id },
      select: {
        id: true,
        stats: true,
        workspaceId: true,
      },
    });
    const statsObject = toJsonObject(refreshedImport?.stats);
    if (statsObject.auto_decision_extracted !== true) {
      const settings = await getEffectiveWorkspaceSettings(this.prisma, record.workspaceId);
      if (settings.enableAutoExtraction) {
        const decisionCandidates = candidates
          .filter((candidate) => candidate.type === 'decision')
          .slice(0, settings.autoExtractionBatchSize);
        const created: Array<{ id: string; content: string }> = [];
        for (const candidate of decisionCandidates) {
          const text = candidate.content.toLowerCase();
          const allowHit = settings.autoConfirmKeywordAllowlist.some((keyword) =>
            text.includes(keyword.toLowerCase())
          );
          const denyHit = settings.autoConfirmKeywordDenylist.some((keyword) =>
            text.includes(keyword.toLowerCase())
          );
          let confidence = 0.55 + (allowHit ? 0.2 : 0) - (denyHit ? 0.25 : 0);
          confidence = Math.min(Math.max(confidence, 0), 1);
          const status =
            settings.autoExtractionMode === 'auto_confirm' &&
            allowHit &&
            !denyHit &&
            confidence >= settings.autoConfirmMinConfidence
              ? 'confirmed'
              : 'draft';
          const projectId = candidate.projectId ?? getStringFromJson(record.stats, 'project_id');
          if (!projectId) {
            continue;
          }
          const memory = await this.prisma.memory.create({
            data: {
              workspaceId: record.workspaceId,
              projectId,
              type: 'decision',
              content: candidate.content,
              source: 'import',
              status,
              confidence,
              evidence: {
                import_id: record.id,
                raw_session_ids: sessions.map((session) => session.id),
              } as Prisma.InputJsonValue,
              metadata: {
                extraction: {
                  version: 'import-rule-v1',
                },
              } as Prisma.InputJsonValue,
              createdBy: args.auth.user.id,
            },
            select: {
              id: true,
              content: true,
            },
          });
          created.push(memory);
        }
        for (const item of created) {
          await this.updateMemoryEmbedding(item.id, item.content);
        }
        await this.prisma.importRecord.update({
          where: { id: record.id },
          data: {
            stats: {
              ...(record.stats as Record<string, unknown> | null),
              auto_decision_extracted: true,
              auto_decision_count: created.length,
            },
          },
        });
      }
    }

    return {
      import_id: record.id,
      status: ImportStatus.extracted,
      staged_count: candidates.length,
    };
  }

  async listStagedMemories(args: {
    auth: AuthContext;
    importId: string;
  }) {
    const record = await this.getImportRecordById(args.importId);
    await assertWorkspaceAccess(this.prisma, args.auth, record.workspaceId);
    return this.prisma.stagedMemory.findMany({
      where: { importId: record.id },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        type: true,
        content: true,
        metadata: true,
        isSelected: true,
        project: {
          select: {
            key: true,
            name: true,
          },
        },
      },
    });
  }

  async commitImport(args: {
    auth: AuthContext;
    importId: string;
    stagedIds?: string[];
    projectKey?: string;
  }) {
    const record = await this.getImportRecordById(args.importId);
    await assertWorkspaceAccess(this.prisma, args.auth, record.workspaceId);

    let overrideProjectId: string | undefined;
    if (args.projectKey) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: record.workspaceId },
      });
      if (!workspace) {
        throw new NotFoundError('Workspace not found for import.');
      }
      const project = await this.getProjectByKeys(workspace.key, args.projectKey);
      await assertProjectAccess(this.prisma, args.auth, record.workspaceId, project.id);
      overrideProjectId = project.id;
    }

    const where: Prisma.StagedMemoryWhereInput = {
      importId: record.id,
      ...(args.stagedIds && args.stagedIds.length > 0
        ? { id: { in: args.stagedIds } }
        : { isSelected: true }),
    };
    const staged = await this.prisma.stagedMemory.findMany({ where });
    if (staged.length === 0) {
      throw new ValidationError('No staged memories selected for commit.');
    }

    let committed = 0;
    const createdForEmbedding: Array<{ id: string; content: string }> = [];
    await this.prisma.$transaction(async (tx) => {
      for (const candidate of staged) {
        const targetProjectId =
          overrideProjectId || candidate.projectId || getStringFromJson(record.stats, 'project_id');
        if (!targetProjectId) {
          continue;
        }
        const created = await tx.memory.create({
          data: {
            workspaceId: record.workspaceId,
            projectId: targetProjectId,
            type: candidate.type,
            content: candidate.content,
            source: 'import',
            status: 'confirmed',
            confidence: 1.0,
            evidence: {
              import_id: record.id,
              staged_memory_id: candidate.id,
            } as Prisma.InputJsonValue,
            metadata: candidate.metadata ?? undefined,
            createdBy: args.auth.user.id,
          },
          select: {
            id: true,
            content: true,
          },
        });
        createdForEmbedding.push(created);
        committed += 1;
      }

      await tx.importRecord.update({
        where: { id: record.id },
        data: {
          status: ImportStatus.committed,
          error: null,
          stats: {
            ...(record.stats as Record<string, unknown> | null),
            committed_count: committed,
          },
        },
      });
    });
    for (const item of createdForEmbedding) {
      await this.updateMemoryEmbedding(item.id, item.content);
    }

    return {
      import_id: record.id,
      status: ImportStatus.committed,
      committed_count: committed,
    };
  }

  async rawSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey?: string;
    q: string;
    limit?: number;
    maxChars?: number;
  }) {
    const q = args.q.trim();
    if (!q) {
      throw new ValidationError('q is required');
    }

    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const limit = Math.min(Math.max(args.limit || 10, 1), 20);
    const maxChars = Math.min(Math.max(args.maxChars || 500, 50), 1500);

    let projectId: string | undefined;
    if (args.projectKey) {
      const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
      await assertRawAccess(this.prisma, args.auth, workspace.id, project.id);
      projectId = project.id;
    } else {
      await assertRawAccess(this.prisma, args.auth, workspace.id, undefined);
    }

    const matches = await this.prisma.$queryRaw<
      Array<{
        message_id: string;
        raw_session_id: string;
        source: ImportSource;
        source_session_id: string | null;
        role: string;
        content: string;
        created_at: Date;
        project_key: string | null;
      }>
    >(Prisma.sql`
      SELECT
        rm.id AS message_id,
        rs.id AS raw_session_id,
        rs.source AS source,
        rs.source_session_id AS source_session_id,
        rm.role AS role,
        rm.content AS content,
        rm.created_at AS created_at,
        p.key AS project_key
      FROM raw_messages rm
      JOIN raw_sessions rs ON rs.id = rm.raw_session_id
      LEFT JOIN projects p ON p.id = rs.project_id
      WHERE
        rs.workspace_id = ${workspace.id}
        AND (${projectId ?? null}::text IS NULL OR rs.project_id = ${projectId ?? null})
        AND (
          to_tsvector('simple', coalesce(rm.content, '')) @@ plainto_tsquery('simple', ${q})
          OR rm.content ILIKE ${`%${q}%`}
        )
      ORDER BY rm.created_at DESC
      LIMIT ${limit}
    `);

    const result = matches.map((row) => ({
      raw_session_id: row.raw_session_id,
      source: row.source,
      source_session_id: row.source_session_id,
      message_id: row.message_id,
      role: row.role,
      snippet: createMemorySnippet(row.content, q, maxChars),
      created_at: row.created_at,
      project_key: row.project_key || undefined,
    }));

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'raw.search',
      target: {
        query: q,
        limit,
        project_key: args.projectKey ?? null,
        message_ids: result.map((item) => item.message_id),
      },
    });

    return { matches: result };
  }

  async viewRawMessage(args: {
    auth: AuthContext;
    messageId: string;
    maxChars?: number;
  }) {
    const maxChars = Math.min(Math.max(args.maxChars || 500, 50), 1500);
    const message = await this.prisma.rawMessage.findUnique({
      where: { id: args.messageId },
      include: {
        rawSession: {
          include: {
            workspace: true,
            project: true,
          },
        },
      },
    });
    if (!message) {
      throw new NotFoundError(`Raw message not found: ${args.messageId}`);
    }

    await assertRawAccess(this.prisma, 
      args.auth,
      message.rawSession.workspaceId,
      message.rawSession.projectId || undefined
    );

    const snippet = createMemorySnippet(message.content, '', maxChars);
    await this.recordAudit({
      workspaceId: message.rawSession.workspaceId,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'raw.view',
      target: {
        message_id: message.id,
        raw_session_id: message.rawSession.id,
      },
    });

    return {
      message_id: message.id,
      raw_session_id: message.rawSession.id,
      role: message.role,
      snippet,
      created_at: message.createdAt,
      source: message.rawSession.source,
      source_session_id: message.rawSession.sourceSessionId,
      project_key: message.rawSession.project?.key,
    };
  }

  async notionSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    query: string;
    limit?: number;
  }) {
    const q = args.query.trim();
    if (!q) {
      throw new ValidationError('q is required');
    }
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const notionConfig = await this.getNotionClientForWorkspace(workspace.id);
    const limit = Math.min(Math.max(args.limit || 10, 1), 20);
    const pages = await notionConfig.client.searchPages(q, limit);

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'notion.search',
      target: {
        query: q,
        limit,
        page_ids: pages.map((page) => page.id),
      },
    });

    return { pages };
  }

  async notionRead(args: {
    auth: AuthContext;
    workspaceKey: string;
    pageId: string;
    maxChars?: number;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const notionConfig = await this.getNotionClientForWorkspace(workspace.id);
    const maxChars = Math.min(Math.max(args.maxChars || 4000, 200), 20000);
    const page = await notionConfig.client.readPage(args.pageId, maxChars);

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'notion.read',
      target: {
        page_id: page.id,
        max_chars: maxChars,
      },
    });

    return page;
  }

  async notionWrite(args: {
    auth: AuthContext;
    workspaceKey: string;
    title: string;
    content: string;
    pageId?: string;
    parentPageId?: string;
  }) {
    const title = args.title.trim();
    const content = args.content.trim();
    if (!title) {
      throw new ValidationError('title is required');
    }
    if (!content) {
      throw new ValidationError('content is required');
    }

    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const notionConfig = await this.getNotionClientForWorkspace(workspace.id);
    if (!notionConfig.writeEnabled) {
      throw new AuthorizationError(
        'Notion write is disabled. Configure write_enabled in workspace integration or set MEMORY_CORE_NOTION_WRITE_ENABLED=true.'
      );
    }
    const result = await notionConfig.client.upsertPage({
      title,
      content,
      pageId: args.pageId,
      parentPageId: args.parentPageId,
    });

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'notion.write',
      target: {
        mode: result.mode,
        page_id: result.id,
        parent_page_id: args.parentPageId ?? null,
      },
    });

    return result;
  }

  async jiraSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    query: string;
    limit?: number;
  }) {
    const q = args.query.trim();
    if (!q) {
      throw new ValidationError('q is required');
    }
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const jira = await this.getJiraClientForWorkspace(workspace.id);
    const limit = Math.min(Math.max(args.limit || 10, 1), 20);
    const issues = await jira.searchIssues(q, limit);

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'jira.search',
      target: {
        query: q,
        limit,
        issue_keys: issues.map((issue) => issue.key),
      },
    });

    return { issues };
  }

  async jiraRead(args: {
    auth: AuthContext;
    workspaceKey: string;
    issueKey: string;
    maxChars?: number;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const jira = await this.getJiraClientForWorkspace(workspace.id);
    const maxChars = Math.min(Math.max(args.maxChars || 4000, 200), 20000);
    const issue = await jira.readIssue(args.issueKey, maxChars);

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'jira.read',
      target: {
        issue_key: issue.key,
        max_chars: maxChars,
      },
    });

    return issue;
  }

  async confluenceSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    query: string;
    limit?: number;
  }) {
    const q = args.query.trim();
    if (!q) {
      throw new ValidationError('q is required');
    }
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const confluence = await this.getConfluenceClientForWorkspace(workspace.id);
    const limit = Math.min(Math.max(args.limit || 10, 1), 20);
    const pages = await confluence.searchPages(q, limit);

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'confluence.search',
      target: {
        query: q,
        limit,
        page_ids: pages.map((page) => page.id),
      },
    });

    return { pages };
  }

  async confluenceRead(args: {
    auth: AuthContext;
    workspaceKey: string;
    pageId: string;
    maxChars?: number;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const confluence = await this.getConfluenceClientForWorkspace(workspace.id);
    const maxChars = Math.min(Math.max(args.maxChars || 4000, 200), 20000);
    const page = await confluence.readPage(args.pageId, maxChars);

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'confluence.read',
      target: {
        page_id: page.id,
        max_chars: maxChars,
      },
    });

    return page;
  }

  async linearSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    query: string;
    limit?: number;
  }) {
    const q = args.query.trim();
    if (!q) {
      throw new ValidationError('q is required');
    }
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const linear = await this.getLinearClientForWorkspace(workspace.id);
    const limit = Math.min(Math.max(args.limit || 10, 1), 20);
    const issues = await linear.searchIssues(q, limit);

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'linear.search',
      target: {
        query: q,
        limit,
        issue_ids: issues.map((issue) => issue.id),
        issue_keys: issues.map((issue) => issue.identifier),
      },
    });

    return { issues };
  }

  async linearRead(args: {
    auth: AuthContext;
    workspaceKey: string;
    issueKey: string;
    maxChars?: number;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const linear = await this.getLinearClientForWorkspace(workspace.id);
    const maxChars = Math.min(Math.max(args.maxChars || 4000, 200), 20000);
    const issue = await linear.readIssue(args.issueKey, maxChars);

    await this.recordAudit({
      workspaceId: workspace.id,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'linear.read',
      target: {
        issue_id: issue.id,
        issue_key: issue.identifier,
        max_chars: maxChars,
      },
    });

    return issue;
  }

  async getWorkspaceIntegrations(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);

    const rows = await this.prisma.workspaceIntegration.findMany({
      where: {
        workspaceId: workspace.id,
        provider: {
          in: [
            IntegrationProvider.notion,
            IntegrationProvider.jira,
            IntegrationProvider.confluence,
            IntegrationProvider.linear,
            IntegrationProvider.slack,
            IntegrationProvider.audit_reasoner,
          ],
        },
      },
    });
    const byProvider = new Map<IntegrationProvider, (typeof rows)[number]>();
    for (const row of rows) {
      byProvider.set(row.provider, row);
    }
    const reasonerEnvPreferred = hasEnvAuditReasonerPreference(this.auditReasonerEnvConfig);

    return {
      workspace_key: workspace.key,
      integrations: {
        notion: toIntegrationSummary({
          provider: IntegrationProvider.notion,
          row: byProvider.get(IntegrationProvider.notion),
          configuredFromEnv: Boolean(this.notionClient),
          notionWriteEnabled: this.notionWriteEnabled,
          locked: this.isIntegrationLocked(IntegrationProvider.notion),
        }),
        jira: toIntegrationSummary({
          provider: IntegrationProvider.jira,
          row: byProvider.get(IntegrationProvider.jira),
          configuredFromEnv: Boolean(this.jiraClient),
          notionWriteEnabled: this.notionWriteEnabled,
          locked: this.isIntegrationLocked(IntegrationProvider.jira),
        }),
        confluence: toIntegrationSummary({
          provider: IntegrationProvider.confluence,
          row: byProvider.get(IntegrationProvider.confluence),
          configuredFromEnv: Boolean(this.confluenceClient),
          notionWriteEnabled: this.notionWriteEnabled,
          locked: this.isIntegrationLocked(IntegrationProvider.confluence),
        }),
        linear: toIntegrationSummary({
          provider: IntegrationProvider.linear,
          row: byProvider.get(IntegrationProvider.linear),
          configuredFromEnv: Boolean(this.linearClient),
          notionWriteEnabled: this.notionWriteEnabled,
          locked: this.isIntegrationLocked(IntegrationProvider.linear),
        }),
        slack: toIntegrationSummary({
          provider: IntegrationProvider.slack,
          row: byProvider.get(IntegrationProvider.slack),
          configuredFromEnv: this.auditSlackNotifier?.isEnabled() || false,
          notionWriteEnabled: this.notionWriteEnabled,
          locked: this.isIntegrationLocked(IntegrationProvider.slack),
        }),
        audit_reasoner: toIntegrationSummary({
          provider: IntegrationProvider.audit_reasoner,
          row: reasonerEnvPreferred ? undefined : byProvider.get(IntegrationProvider.audit_reasoner),
          configuredFromEnv: reasonerEnvPreferred,
          notionWriteEnabled: this.notionWriteEnabled,
          locked: this.isIntegrationLocked(IntegrationProvider.audit_reasoner),
          envConfig: getEnvAuditReasonerConfigAsJson(this.auditReasonerEnvConfig),
        }),
      },
    };
  }

  async upsertWorkspaceIntegration(args: {
    auth: AuthContext;
    workspaceKey: string;
    provider: 'notion' | 'jira' | 'confluence' | 'linear' | 'slack' | 'audit_reasoner';
    enabled?: boolean;
    config?: Record<string, unknown>;
    reason?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);

    const provider = toIntegrationProvider(args.provider);
    if (this.isIntegrationLocked(provider)) {
      throw new AuthorizationError(
        `Integration provider "${args.provider}" is locked by environment policy and cannot be modified from Admin UI.`
      );
    }
    const existing = await this.prisma.workspaceIntegration.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId: workspace.id,
          provider,
        },
      },
    });

    const currentConfig = toJsonObject(existing?.config);
    const patch = normalizeIntegrationConfig(provider, args.config || {});
    const mergedConfig = { ...currentConfig };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        delete mergedConfig[key];
      } else {
        mergedConfig[key] = value;
      }
    }

    const saved = await this.prisma.workspaceIntegration.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: workspace.id,
          provider,
        },
      },
      update: {
        isEnabled: args.enabled ?? existing?.isEnabled ?? true,
        config: mergedConfig as Prisma.InputJsonValue,
      },
      create: {
        workspaceId: workspace.id,
        provider,
        isEnabled: args.enabled ?? true,
        config: mergedConfig as Prisma.InputJsonValue,
      },
    });

    const before = {
      enabled: existing?.isEnabled ?? null,
      config_keys: Object.keys(currentConfig),
    };
    const after = {
      enabled: saved.isEnabled,
      config_keys: Object.keys(mergedConfig),
    };
    const changedFields = diffFields(before, after);
    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'integration.update',
      target: {
        provider: args.provider,
        workspace_key: workspace.key,
        reason: normalizeReason(args.reason),
        changed_fields: changedFields,
        before,
        after,
      },
    });

    const reasonerEnvPreferred =
      provider === IntegrationProvider.audit_reasoner
        ? hasEnvAuditReasonerPreference(this.auditReasonerEnvConfig)
        : false;
    return {
      workspace_key: workspace.key,
      provider: args.provider,
      integration: toIntegrationSummary({
        provider,
        row: reasonerEnvPreferred ? undefined : saved,
        configuredFromEnv: reasonerEnvPreferred,
        notionWriteEnabled: this.notionWriteEnabled,
        envConfig:
          provider === IntegrationProvider.audit_reasoner
            ? getEnvAuditReasonerConfigAsJson(this.auditReasonerEnvConfig)
            : undefined,
      }),
    };
  }

  async listAuditLogs(args: {
    auth: AuthContext;
    workspaceKey: string;
    limit?: number;
    actionPrefix?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const limit = Math.min(Math.max(args.limit || 50, 1), 200);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        workspaceId: workspace.id,
        action: args.actionPrefix
          ? {
              startsWith: args.actionPrefix,
            }
          : undefined,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        target: true,
        createdAt: true,
      },
    });
    return { logs };
  }

  async captureRawEvent(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    eventType: RawEventType | 'post_commit' | 'post_merge' | 'post_checkout';
    branch?: string;
    fromBranch?: string;
    toBranch?: string;
    commitSha?: string;
    commitMessage?: string;
    changedFiles?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await assertProjectAccess(this.prisma, args.auth, workspace.id, project.id);
    const settings = await getEffectiveWorkspaceSettings(this.prisma, workspace.id);
    const eventType = args.eventType as RawEventType;
    const { repoKey, subprojectKey } = this.splitProjectKey(project.key);
    const metadata = args.metadata || {};

    if (!settings.enableGitEvents) {
      return {
        ok: true as const,
        skipped: true as const,
        skip_reason: 'git_events_disabled',
        workspace_key: workspace.key,
        project_key: project.key,
        event_type: eventType,
      };
    }
    if (eventType === RawEventType.post_commit && !settings.enableCommitEvents) {
      return {
        ok: true as const,
        skipped: true as const,
        skip_reason: 'commit_events_disabled',
        workspace_key: workspace.key,
        project_key: project.key,
        event_type: eventType,
      };
    }
    if (eventType === RawEventType.post_merge && !settings.enableMergeEvents) {
      return {
        ok: true as const,
        skipped: true as const,
        skip_reason: 'merge_events_disabled',
        workspace_key: workspace.key,
        project_key: project.key,
        event_type: eventType,
      };
    }
    if (eventType === RawEventType.post_checkout && !settings.enableCheckoutEvents) {
      return {
        ok: true as const,
        skipped: true as const,
        skip_reason: 'checkout_events_disabled',
        workspace_key: workspace.key,
        project_key: project.key,
        event_type: eventType,
      };
    }

    if (eventType === RawEventType.post_checkout) {
      const lastCheckout = await this.prisma.rawEvent.findFirst({
        where: {
          projectId: project.id,
          eventType: RawEventType.post_checkout,
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      if (lastCheckout && args.branch && lastCheckout.branch === args.branch) {
        return {
          ok: true as const,
          skipped: true as const,
          skip_reason: 'checkout_same_branch',
          workspace_key: workspace.key,
          project_key: project.key,
          event_type: eventType,
        };
      }

      if (lastCheckout && settings.checkoutDebounceSeconds > 0) {
        const elapsed = Date.now() - lastCheckout.createdAt.getTime();
        if (elapsed < settings.checkoutDebounceSeconds * 1000) {
          return {
            ok: true as const,
            skipped: true as const,
            skip_reason: 'checkout_debounced',
            workspace_key: workspace.key,
            project_key: project.key,
            event_type: eventType,
          };
        }
      }

      const startOfDayUtc = new Date();
      startOfDayUtc.setUTCHours(0, 0, 0, 0);
      const todayCount = await this.prisma.rawEvent.count({
        where: {
          projectId: project.id,
          eventType: RawEventType.post_checkout,
          createdAt: {
            gte: startOfDayUtc,
          },
        },
      });
      if (todayCount >= settings.checkoutDailyLimit) {
        return {
          ok: true as const,
          skipped: true as const,
          skip_reason: 'checkout_daily_limit_reached',
          workspace_key: workspace.key,
          project_key: project.key,
          event_type: eventType,
        };
      }
    }

    const row = await this.prisma.rawEvent.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        eventType,
        repoKey,
        subprojectKey,
        branch: args.branch || null,
        fromBranch: args.fromBranch || null,
        toBranch: args.toBranch || null,
        commitSha: args.commitSha || null,
        commitMessage: args.commitMessage || null,
        changedFiles:
          args.changedFiles && args.changedFiles.length > 0
            ? (args.changedFiles as Prisma.InputJsonValue)
            : undefined,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    const event =
      eventType === RawEventType.post_commit
        ? 'commit'
        : eventType === RawEventType.post_merge
          ? 'merge'
          : 'checkout';
    const action =
      event === 'commit' ? 'git.commit' : event === 'merge' ? 'git.merge' : 'git.checkout';

    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action,
      target: {
        workspace_key: workspace.key,
        project_key: project.key,
        event_type: eventType,
        branch: args.branch || null,
        from_branch: args.fromBranch || null,
        to_branch: args.toBranch || null,
        commit_sha: args.commitSha || null,
        commit_message: args.commitMessage || null,
        changed_files_count: args.changedFiles?.length || 0,
        raw_event_id: row.id,
        metadata,
      },
    });

    const autoWrites = await this.runIntegrationAutoWrites({
      auth: args.auth,
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      projectKey: project.key,
      event,
      branch: args.branch,
      commitHash: args.commitSha,
      message: args.commitMessage,
      metadata,
    });

    if (settings.enableAutoExtraction) {
      setTimeout(() => {
        void this.runDecisionExtractionFromRawEvent({
          rawEventId: row.id,
          actorUserId: args.auth.user.id,
        }).catch((error) => {
          console.error('[memory-core] auto extraction failed', error);
        });
      }, 0);
    }

    return {
      ok: true as const,
      workspace_key: workspace.key,
      project_key: project.key,
      event_type: eventType,
      raw_event_id: row.id,
      auto_writes: autoWrites,
    };
  }

  async handleGitEvent(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    event: 'commit' | 'merge' | 'checkout';
    branch?: string;
    commitHash?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }) {
    const eventType =
      args.event === 'commit'
        ? RawEventType.post_commit
        : args.event === 'merge'
          ? RawEventType.post_merge
          : RawEventType.post_checkout;
    return this.captureRawEvent({
      auth: args.auth,
      workspaceKey: args.workspaceKey,
      projectKey: args.projectKey,
      eventType,
      branch: args.branch,
      commitSha: args.commitHash,
      commitMessage: args.message,
      metadata: args.metadata,
    });
  }

  async listRawEvents(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey?: string;
    eventType?: RawEventType | 'post_commit' | 'post_merge' | 'post_checkout';
    commitSha?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const limit = Math.min(Math.max(args.limit || 100, 1), 500);

    let projectId: string | undefined;
    if (args.projectKey) {
      const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
      await assertProjectAccess(this.prisma, args.auth, workspace.id, project.id);
      projectId = project.id;
    } else {
      await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    }

    const rows = await this.prisma.rawEvent.findMany({
      where: {
        workspaceId: workspace.id,
        projectId,
        eventType: args.eventType as RawEventType | undefined,
        commitSha: args.commitSha
          ? {
              contains: args.commitSha,
              mode: 'insensitive',
            }
          : undefined,
        createdAt:
          args.from || args.to
            ? {
                gte: args.from ? new Date(args.from) : undefined,
                lte: args.to ? new Date(args.to) : undefined,
              }
            : undefined,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      include: {
        project: {
          select: {
            key: true,
            name: true,
          },
        },
      },
    });

    return {
      events: rows.map((row) => ({
        id: row.id,
        event_type: row.eventType,
        workspace_key: workspace.key,
        project_key: row.project.key,
        project_name: row.project.name,
        repo_key: row.repoKey,
        subproject_key: row.subprojectKey,
        branch: row.branch,
        from_branch: row.fromBranch,
        to_branch: row.toBranch,
        commit_sha: row.commitSha,
        commit_message: row.commitMessage,
        changed_files: row.changedFiles,
        metadata: row.metadata,
        created_at: row.createdAt,
      })),
    };
  }

  async handleCiEvent(args: {
    auth: AuthContext;
    workspaceKey: string;
    status: 'success' | 'failure';
    provider: 'github_actions' | 'generic';
    projectKey?: string;
    workflowName?: string;
    workflowRunId?: string;
    workflowRunUrl?: string;
    repository?: string;
    branch?: string;
    sha?: string;
    eventName?: string;
    jobName?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);

    let project: { key: string; id: string } | null = null;
    if (args.projectKey) {
      const resolvedProject = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
      await assertProjectAccess(this.prisma, args.auth, workspace.id, resolvedProject.id);
      project = {
        key: resolvedProject.key,
        id: resolvedProject.id,
      };
    }

    const action = args.status === 'success' ? 'ci.success' : 'ci.failure';
    const target = {
      workspace_key: workspace.key,
      project_key: project?.key || null,
      status: args.status,
      provider: args.provider,
      workflow_name: args.workflowName || null,
      workflow_run_id: args.workflowRunId || null,
      workflow_run_url: args.workflowRunUrl || null,
      repository: args.repository || null,
      branch: args.branch || null,
      sha: args.sha || null,
      event_name: args.eventName || null,
      job_name: args.jobName || null,
      message: args.message || null,
      metadata: args.metadata || {},
    };

    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action,
      target,
    });

    return {
      ok: true as const,
      workspace_key: workspace.key,
      project_key: project?.key,
      status: args.status,
      action,
    };
  }

  async updateMemory(args: {
    auth: AuthContext;
    memoryId: string;
    input: {
      content?: string;
      status?: 'draft' | 'confirmed' | 'rejected';
      source?: 'auto' | 'human' | 'import';
      confidence?: number;
      metadata?: Record<string, unknown> | null;
      evidence?: Record<string, unknown> | null;
    };
  }) {
    const existing = await this.prisma.memory.findUnique({
      where: { id: args.memoryId },
      include: {
        project: true,
      },
    });
    if (!existing) {
      throw new NotFoundError(`Memory not found: ${args.memoryId}`);
    }
    await assertProjectAccess(this.prisma, args.auth, existing.workspaceId, existing.projectId);

    const nextContent =
      typeof args.input.content === 'string' ? args.input.content.trim() : existing.content;
    if (!nextContent) {
      throw new ValidationError('content cannot be empty');
    }
    const updated = await this.prisma.memory.update({
      where: { id: existing.id },
      data: {
        content: nextContent,
        status: args.input.status ? memoryStatusSchema.parse(args.input.status) : undefined,
        source: args.input.source ? memorySourceSchema.parse(args.input.source) : undefined,
        confidence:
          typeof args.input.confidence === 'number'
            ? Math.min(Math.max(args.input.confidence, 0), 1)
            : undefined,
        metadata:
          args.input.metadata === null
            ? Prisma.DbNull
            : (args.input.metadata as Prisma.InputJsonValue | undefined),
        evidence:
          args.input.evidence === null
            ? Prisma.DbNull
            : (args.input.evidence as Prisma.InputJsonValue | undefined),
      },
      select: {
        id: true,
        type: true,
        content: true,
        status: true,
        source: true,
        confidence: true,
        evidence: true,
        metadata: true,
        createdBy: true,
        createdAt: true,
        project: {
          select: {
            key: true,
            name: true,
            workspace: {
              select: {
                key: true,
                name: true,
              },
            },
          },
        },
      },
    });
    if (updated.content !== existing.content) {
      await this.updateMemoryEmbedding(updated.id, updated.content);
    }
    return updated;
  }

  private async searchMemoryCandidateScores(args: {
    workspaceId: string;
    q: string;
    projectIds: string[] | null;
    type?: string;
    status?: 'draft' | 'confirmed' | 'rejected';
    source?: 'auto' | 'human' | 'import';
    since?: string;
    confidenceMin?: number;
    confidenceMax?: number;
    limit: number;
    mode: 'keyword' | 'semantic';
  }): Promise<Array<{ id: string; score: number }>> {
    const clauses: string[] = ['m.workspace_id = $1'];
    const params: unknown[] = [args.workspaceId];
    let index = 2;

    if (args.projectIds && args.projectIds.length > 0) {
      clauses.push(`m.project_id = ANY($${index}::text[])`);
      params.push(args.projectIds);
      index += 1;
    }
    if (args.type) {
      clauses.push(`m.type = $${index}`);
      params.push(args.type);
      index += 1;
    }
    if (args.status) {
      clauses.push(`m.status = $${index}::"MemoryStatus"`);
      params.push(args.status);
      index += 1;
    }
    if (args.source) {
      clauses.push(`m.source = $${index}::"MemorySource"`);
      params.push(args.source);
      index += 1;
    }
    if (args.since) {
      clauses.push(`m.created_at >= $${index}::timestamptz`);
      params.push(args.since);
      index += 1;
    }
    if (typeof args.confidenceMin === 'number') {
      clauses.push(`m.confidence >= $${index}`);
      params.push(args.confidenceMin);
      index += 1;
    }
    if (typeof args.confidenceMax === 'number') {
      clauses.push(`m.confidence <= $${index}`);
      params.push(args.confidenceMax);
      index += 1;
    }

    if (args.mode === 'keyword') {
      const tsQueryIndex = index;
      const ilikeIndex = index + 1;
      const limitIndex = index + 2;
      const sql = `
        SELECT
          m.id::text AS id,
          GREATEST(ts_rank_cd(m.content_tsv, plainto_tsquery('simple', $${tsQueryIndex})), 0)::float8 AS score
        FROM memories m
        WHERE ${clauses.join(' AND ')}
          AND (
            m.content_tsv @@ plainto_tsquery('simple', $${tsQueryIndex})
            OR m.content ILIKE $${ilikeIndex}
          )
        ORDER BY score DESC, m.created_at DESC
        LIMIT $${limitIndex}
      `;
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; score: number }>>(
        sql,
        ...params,
        args.q,
        `%${args.q}%`,
        Math.min(Math.max(args.limit, 1), 500)
      );
      return rows;
    }

    try {
      const vectorLiteral = toVectorLiteral(buildLocalEmbedding(args.q));
      const vectorIndex = index;
      const limitIndex = index + 1;
      const sql = `
        SELECT
          m.id::text AS id,
          GREATEST(1 - (m.embedding <=> $${vectorIndex}::vector), 0)::float8 AS score
        FROM memories m
        WHERE ${clauses.join(' AND ')}
          AND m.embedding IS NOT NULL
        ORDER BY m.embedding <=> $${vectorIndex}::vector ASC
        LIMIT $${limitIndex}
      `;
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; score: number }>>(
        sql,
        ...params,
        vectorLiteral,
        Math.min(Math.max(args.limit, 1), 500)
      );
      return rows;
    } catch (error) {
      console.error('[memory-core] semantic search fallback to keyword', error);
      return [];
    }
  }

  private async updateMemoryEmbedding(memoryId: string, content: string): Promise<void> {
    try {
      const vectorLiteral = toVectorLiteral(buildLocalEmbedding(content));
      await this.prisma.$executeRawUnsafe(
        'UPDATE memories SET embedding = $1::vector WHERE id = $2',
        vectorLiteral,
        memoryId
      );
    } catch (error) {
      console.error('[memory-core] embedding update failed', error);
    }
  }

  private async runDecisionExtractionFromRawEvent(args: {
    rawEventId: string;
    actorUserId: string;
  }): Promise<void> {
    const event = await this.prisma.rawEvent.findUnique({
      where: { id: args.rawEventId },
      include: {
        workspace: true,
        project: true,
      },
    });
    if (!event) {
      return;
    }

    const settings = await getEffectiveWorkspaceSettings(this.prisma, event.workspaceId);
    if (!settings.enableAutoExtraction) {
      return;
    }

    const existingMeta = toJsonObject(event.metadata);
    if (existingMeta.auto_extraction_processed === true) {
      return;
    }

    const commitMessage = (event.commitMessage || '').trim();
    if (!commitMessage) {
      await this.prisma.rawEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...existingMeta,
            auto_extraction_processed: true,
            auto_extraction_result: 'no_commit_message',
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const allowlist = settings.autoConfirmKeywordAllowlist.map((item) => item.toLowerCase());
    const denylist = settings.autoConfirmKeywordDenylist.map((item) => item.toLowerCase());
    const normalizedMessage = commitMessage.toLowerCase();
    const allowHit = allowlist.find((keyword) => normalizedMessage.includes(keyword));
    const denyHit = denylist.find((keyword) => normalizedMessage.includes(keyword));
    const changedFiles = Array.isArray(event.changedFiles)
      ? (event.changedFiles as unknown[]).map((item) => String(item)).filter(Boolean)
      : [];

    let confidence = 0.35;
    if (event.eventType === RawEventType.post_merge) {
      confidence += 0.25;
    } else if (event.eventType === RawEventType.post_commit) {
      confidence += 0.2;
    } else {
      confidence += 0.05;
    }
    if (allowHit) {
      confidence += 0.25;
    }
    if (denyHit) {
      confidence -= 0.3;
    }
    if (changedFiles.length >= 3) {
      confidence += 0.15;
    } else if (changedFiles.length >= 1) {
      confidence += 0.08;
    }
    confidence = Math.min(Math.max(confidence, 0), 1);

    const shouldCreate = Boolean(allowHit) || (event.eventType === RawEventType.post_merge && !denyHit);
    if (!shouldCreate) {
      await this.prisma.rawEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...existingMeta,
            auto_extraction_processed: true,
            auto_extraction_result: 'no_decision_signal',
            auto_extraction_confidence: confidence,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const autoConfirmAllowed = settings.autoConfirmAllowedEventTypes.includes(event.eventType);
    const autoConfirm =
      settings.autoExtractionMode === 'auto_confirm' &&
      autoConfirmAllowed &&
      Boolean(allowHit) &&
      !Boolean(denyHit) &&
      confidence >= settings.autoConfirmMinConfidence;
    const status = autoConfirm ? 'confirmed' : 'draft';

    const content = [
      `Summary: ${commitMessage}`,
      `Reason: ${allowHit ? `detected keyword "${allowHit}" in commit message` : 'merge event heuristic'}.`,
      `Evidence: commit_sha=${event.commitSha || 'n/a'}; event_id=${event.id}; files=${changedFiles.slice(0, 20).join(', ') || 'n/a'}`,
    ].join('\n');
    const evidence = {
      raw_event_ids: [event.id],
      commit_sha: event.commitSha || null,
      event_type: event.eventType,
      changed_files: changedFiles,
      branch: event.branch || null,
    };

    const memory = await this.prisma.memory.create({
      data: {
        workspaceId: event.workspaceId,
        projectId: event.projectId,
        type: 'decision',
        content,
        status,
        source: 'auto',
        confidence,
        evidence: evidence as Prisma.InputJsonValue,
        metadata: {
          extraction: {
            version: 'rule-v1',
            allow_keyword: allowHit || null,
            deny_keyword: denyHit || null,
            event_type: event.eventType,
          },
        } as Prisma.InputJsonValue,
        createdBy: args.actorUserId,
      },
      select: {
        id: true,
        content: true,
      },
    });
    await this.updateMemoryEmbedding(memory.id, memory.content);

    await this.prisma.rawEvent.update({
      where: { id: event.id },
      data: {
        metadata: {
          ...existingMeta,
          auto_extraction_processed: true,
          auto_extraction_result: autoConfirm ? 'confirmed' : 'draft',
          auto_extraction_confidence: confidence,
          extracted_memory_id: memory.id,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async getWorkspaceByKey(workspaceKey: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { key: workspaceKey },
    });
    if (!workspace) {
      throw new NotFoundError(`Workspace not found: ${workspaceKey}`);
    }
    return workspace;
  }

  private async getProjectByKeys(workspaceKey: string, projectKey: string) {
    const workspace = await this.getWorkspaceByKey(workspaceKey);
    const project = await this.prisma.project.findUnique({
      where: {
        workspaceId_key: {
          workspaceId: workspace.id,
          key: projectKey,
        },
      },
    });
    if (!project) {
      throw new NotFoundError(`Project not found: ${workspaceKey}/${projectKey}`);
    }
    return project;
  }

  private splitProjectKey(projectKey: string): {
    repoKey: string;
    subprojectKey: string | null;
  } {
    const hashIndex = projectKey.indexOf('#');
    if (hashIndex > 0 && hashIndex < projectKey.length - 1) {
      return {
        repoKey: projectKey.slice(0, hashIndex),
        subprojectKey: projectKey.slice(hashIndex + 1),
      };
    }

    const schemeIndex = projectKey.indexOf(':');
    const secondColon = schemeIndex >= 0 ? projectKey.indexOf(':', schemeIndex + 1) : -1;
    if (secondColon > 0 && secondColon < projectKey.length - 1) {
      return {
        repoKey: projectKey.slice(0, secondColon),
        subprojectKey: projectKey.slice(secondColon + 1),
      };
    }

    return {
      repoKey: projectKey,
      subprojectKey: null,
    };
  }

  private getNotionClient(): NotionClientAdapter {
    if (!this.notionClient) {
      throw new ValidationError(
        'Notion integration is not configured. Set MEMORY_CORE_NOTION_TOKEN to enable.'
      );
    }
    return this.notionClient;
  }

  private getJiraClient(): JiraClientAdapter {
    if (!this.jiraClient) {
      throw new ValidationError(
        'Jira integration is not configured. Set MEMORY_CORE_JIRA_BASE_URL, MEMORY_CORE_JIRA_EMAIL, and MEMORY_CORE_JIRA_API_TOKEN.'
      );
    }
    return this.jiraClient;
  }

  private getConfluenceClient(): ConfluenceClientAdapter {
    if (!this.confluenceClient) {
      throw new ValidationError(
        'Confluence integration is not configured. Set MEMORY_CORE_CONFLUENCE_BASE_URL, MEMORY_CORE_CONFLUENCE_EMAIL, and MEMORY_CORE_CONFLUENCE_API_TOKEN.'
      );
    }
    return this.confluenceClient;
  }

  private getLinearClient(): LinearClientAdapter {
    if (!this.linearClient) {
      throw new ValidationError(
        'Linear integration is not configured. Set MEMORY_CORE_LINEAR_API_KEY (and optionally MEMORY_CORE_LINEAR_API_URL).'
      );
    }
    return this.linearClient;
  }

  private async runIntegrationAutoWrites(args: {
    auth: AuthContext;
    workspaceId: string;
    workspaceKey: string;
    projectKey: string;
    event: 'commit' | 'merge' | 'checkout';
    branch?: string;
    commitHash?: string;
    message?: string;
    metadata: Record<string, unknown>;
  }) {
    if (args.event === 'checkout') {
      return [];
    }

    const rows = await this.prisma.workspaceIntegration.findMany({
      where: {
        workspaceId: args.workspaceId,
        isEnabled: true,
        provider: {
          in: [
            IntegrationProvider.notion,
            IntegrationProvider.jira,
            IntegrationProvider.confluence,
            IntegrationProvider.linear,
          ],
        },
      },
      orderBy: [{ provider: 'asc' }],
    });

    const results: Array<{ provider: string; status: 'success' | 'skipped' | 'failed'; detail: string }> = [];

    for (const row of rows) {
      if (this.isIntegrationLocked(row.provider)) {
        continue;
      }
      const config = toJsonObject(row.config);
      if (!shouldAutoWriteForGitEvent(config, args.event)) {
        continue;
      }

      if (row.provider !== IntegrationProvider.notion) {
        const detail = 'auto-write is not implemented for this provider yet';
        results.push({
          provider: row.provider,
          status: 'skipped',
          detail,
        });
        await this.recordAudit({
          workspaceId: args.workspaceId,
          workspaceKey: args.workspaceKey,
          actorUserId: args.auth.user.id,
          actorUserEmail: args.auth.user.email,
          action: 'integration.autowrite',
          target: {
            workspace_key: args.workspaceKey,
            project_key: args.projectKey,
            provider: row.provider,
            trigger: args.event,
            status: 'skipped',
            detail,
          },
        });
        continue;
      }

      try {
        const notion = await this.getNotionClientForWorkspace(args.workspaceId);
        if (!notion.writeEnabled) {
          const detail = 'notion write is disabled';
          results.push({
            provider: row.provider,
            status: 'skipped',
            detail,
          });
          await this.recordAudit({
            workspaceId: args.workspaceId,
            workspaceKey: args.workspaceKey,
            actorUserId: args.auth.user.id,
            actorUserEmail: args.auth.user.email,
            action: 'integration.autowrite',
            target: {
              workspace_key: args.workspaceKey,
              project_key: args.projectKey,
              provider: row.provider,
              trigger: args.event,
              status: 'skipped',
              detail,
            },
          });
          continue;
        }

        const title = buildGitAutoWriteTitle(args);
        const content = buildGitAutoWriteContent(args);
        const result = await notion.client.upsertPage({
          title,
          content,
          parentPageId: getConfigString(config, 'default_parent_page_id'),
        });
        results.push({
          provider: row.provider,
          status: 'success',
          detail: `${result.mode}:${result.id}`,
        });
        await this.recordAudit({
          workspaceId: args.workspaceId,
          workspaceKey: args.workspaceKey,
          actorUserId: args.auth.user.id,
          actorUserEmail: args.auth.user.email,
          action: 'integration.autowrite',
          target: {
            workspace_key: args.workspaceKey,
            project_key: args.projectKey,
            provider: row.provider,
            trigger: args.event,
            status: 'success',
            mode: result.mode,
            page_id: result.id,
          },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        results.push({
          provider: row.provider,
          status: 'failed',
          detail,
        });
        await this.recordAudit({
          workspaceId: args.workspaceId,
          workspaceKey: args.workspaceKey,
          actorUserId: args.auth.user.id,
          actorUserEmail: args.auth.user.email,
          action: 'integration.autowrite',
          target: {
            workspace_key: args.workspaceKey,
            project_key: args.projectKey,
            provider: row.provider,
            trigger: args.event,
            status: 'failed',
            error: detail,
          },
        });
      }
    }
    return results;
  }

  private async getWorkspaceIntegrationRecord(
    workspaceId: string,
    provider: IntegrationProvider
  ) {
    if (this.isIntegrationLocked(provider)) {
      return null;
    }
    return this.prisma.workspaceIntegration.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider,
        },
      },
    });
  }

  private async getJiraClientForWorkspace(workspaceId: string): Promise<JiraClientAdapter> {
    const row = await this.getWorkspaceIntegrationRecord(workspaceId, IntegrationProvider.jira);
    if (row) {
      if (!row.isEnabled) {
        throw new ValidationError('Jira integration is disabled for this workspace.');
      }
      const config = toJsonObject(row.config);
      const baseUrl = getConfigString(config, 'base_url');
      const email = getConfigString(config, 'email');
      const token = getConfigString(config, 'api_token');
      if (baseUrl && email && token) {
        return new JiraClientAdapter(baseUrl, email, token);
      }
    }
    return this.getJiraClient();
  }

  private async getNotionClientForWorkspace(
    workspaceId: string
  ): Promise<{ client: NotionClientAdapter; writeEnabled: boolean }> {
    const row = await this.getWorkspaceIntegrationRecord(workspaceId, IntegrationProvider.notion);
    if (row) {
      if (!row.isEnabled) {
        throw new ValidationError('Notion integration is disabled for this workspace.');
      }
      const config = toJsonObject(row.config);
      const token = getConfigString(config, 'token');
      const parentPageId = getConfigString(config, 'default_parent_page_id');
      const writeEnabled = getConfigBoolean(config, 'write_enabled') ?? this.notionWriteEnabled;
      if (token) {
        return {
          client: new NotionClientAdapter(token, parentPageId),
          writeEnabled,
        };
      }
      if (this.notionClient) {
        return {
          client: this.notionClient,
          writeEnabled,
        };
      }
      throw new ValidationError(
        'Notion workspace integration is missing token. Set notion token in Admin UI or MEMORY_CORE_NOTION_TOKEN.'
      );
    }
    return {
      client: this.getNotionClient(),
      writeEnabled: this.notionWriteEnabled,
    };
  }

  private async getConfluenceClientForWorkspace(workspaceId: string): Promise<ConfluenceClientAdapter> {
    const row = await this.getWorkspaceIntegrationRecord(workspaceId, IntegrationProvider.confluence);
    if (row) {
      if (!row.isEnabled) {
        throw new ValidationError('Confluence integration is disabled for this workspace.');
      }
      const config = toJsonObject(row.config);
      const baseUrl = getConfigString(config, 'base_url');
      const email = getConfigString(config, 'email');
      const token = getConfigString(config, 'api_token');
      if (baseUrl && email && token) {
        return new ConfluenceClientAdapter(baseUrl, email, token);
      }
    }
    return this.getConfluenceClient();
  }

  private async getLinearClientForWorkspace(workspaceId: string): Promise<LinearClientAdapter> {
    const row = await this.getWorkspaceIntegrationRecord(workspaceId, IntegrationProvider.linear);
    if (row) {
      if (!row.isEnabled) {
        throw new ValidationError('Linear integration is disabled for this workspace.');
      }
      const config = toJsonObject(row.config);
      const apiKey = getConfigString(config, 'api_key');
      const apiUrl = getConfigString(config, 'api_url');
      if (apiKey) {
        return new LinearClientAdapter(apiKey, apiUrl);
      }
    }
    return this.getLinearClient();
  }

  private async createProjectAndMapping(args: {
    workspaceId: string;
    kind: ResolutionKind;
    externalId: string;
    projectKey: string;
    projectName: string;
  }): Promise<{
    project: { id: string; key: string; name: string };
    mapping: { id: string };
    created: boolean;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.project.findUnique({
        where: {
          workspaceId_key: {
            workspaceId: args.workspaceId,
            key: args.projectKey,
          },
        },
      });

      const project = await tx.project.upsert({
        where: {
          workspaceId_key: {
            workspaceId: args.workspaceId,
            key: args.projectKey,
          },
        },
        update: {
          name: args.projectName,
        },
        create: {
          workspaceId: args.workspaceId,
          key: args.projectKey,
          name: args.projectName,
        },
        select: {
          id: true,
          key: true,
          name: true,
        },
      });

      const mapping = await this.ensureProjectMapping(
        {
          workspaceId: args.workspaceId,
          projectId: project.id,
          kind: args.kind,
          externalId: args.externalId,
        },
        tx
      );

      return {
        project,
        mapping: { id: mapping.id },
        created: !existing,
      };
    });
  }

  private async ensureProjectMapping(
    args: {
      workspaceId: string;
      projectId: string;
      kind: ResolutionKind;
      externalId: string;
    },
    txArg?: Prisma.TransactionClient
  ): Promise<{ id: string }> {
    const tx = txArg || this.prisma;
    const existing = await tx.projectMapping.findUnique({
      where: {
        workspaceId_kind_externalId: {
          workspaceId: args.workspaceId,
          kind: args.kind,
          externalId: args.externalId,
        },
      },
      select: {
        id: true,
      },
    });
    if (existing) {
      await tx.projectMapping.update({
        where: { id: existing.id },
        data: {
          projectId: args.projectId,
          isEnabled: true,
        },
      });
      return existing;
    }

    const priority = await this.getNextMappingPriority(
      {
        workspaceId: args.workspaceId,
        kind: args.kind,
      },
      tx
    );

    const created = await tx.projectMapping.create({
      data: {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        kind: args.kind,
        externalId: args.externalId,
        priority,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    });
    return created;
  }

  private async getNextMappingPriority(
    args: { workspaceId: string; kind: ResolutionKind },
    txArg?: Prisma.TransactionClient
  ): Promise<number> {
    const tx = txArg || this.prisma;
    const row = await tx.projectMapping.findFirst({
      where: {
        workspaceId: args.workspaceId,
        kind: args.kind,
      },
      orderBy: {
        priority: 'desc',
      },
      select: {
        priority: true,
      },
    });
    return row ? row.priority + 1 : 0;
  }

  private async getImportRecordById(importId: string) {
    const record = await this.prisma.importRecord.findUnique({
      where: { id: importId },
    });
    if (!record) {
      throw new NotFoundError(`Import not found: ${importId}`);
    }
    return record;
  }

  private async recordAudit(args: {
    workspaceId: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
  }) {
    const target = withAutoReason(args.action, args.target);
    const created = await this.prisma.auditLog.create({
      data: {
        workspaceId: args.workspaceId,
        actorUserId: args.actorUserId,
        action: args.action,
        target: target as Prisma.InputJsonValue,
      },
    });

    void (async () => {
      let resolvedTarget = target;
      if (this.auditReasoner) {
        try {
          const reasonSource = typeof target.reason_source === 'string' ? target.reason_source : 'heuristic';
          if (reasonSource !== 'user') {
            const reasonerConfig = await getEffectiveAuditReasonerConfig({
              prisma: this.prisma,
              workspaceId: args.workspaceId,
              integrationLockedProviders: this.integrationLockedProviders,
              auditReasonerEnvConfig: this.auditReasonerEnvConfig,
            });
            if (reasonerConfig) {
              const aiReason = await this.auditReasoner.generateReason(reasonerConfig, {
                action: args.action,
                actorUserEmail: args.actorUserEmail,
                target,
              });
              if (aiReason) {
                resolvedTarget = {
                  ...target,
                  reason: aiReason.reason,
                  reason_source: 'ai',
                  reason_provider: aiReason.provider,
                  reason_model: aiReason.model,
                };
                await this.prisma.auditLog.update({
                  where: { id: created.id },
                  data: {
                    target: resolvedTarget as Prisma.InputJsonValue,
                  },
                });
              }
            }
          }
        } catch {
          // Ignore AI reason generation failures to keep request path non-blocking.
        }
      }

      if (!this.auditSlackNotifier) {
        return;
      }
      try {
        const workspaceSlackConfig = await this.getWorkspaceSlackDeliveryConfig(args.workspaceId);
        if (!this.auditSlackNotifier!.shouldNotify(args.action, workspaceSlackConfig)) {
          return;
        }
        await this.auditSlackNotifier!.notify(
          {
            workspaceId: args.workspaceId,
            workspaceKey: args.workspaceKey,
            actorUserId: args.actorUserId,
            actorUserEmail: args.actorUserEmail,
            action: args.action,
            target: resolvedTarget,
            createdAt: created.createdAt,
          },
          workspaceSlackConfig
        );
      } catch {
        // Ignore Slack forwarding failures to keep request path non-blocking.
      }
    })();
  }

  private async getWorkspaceSlackDeliveryConfig(
    workspaceId: string
  ): Promise<SlackDeliveryConfig | undefined> {
    if (this.isIntegrationLocked(IntegrationProvider.slack)) {
      return undefined;
    }
    const row = await this.prisma.workspaceIntegration.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: IntegrationProvider.slack,
        },
      },
    });
    if (!row) {
      return undefined;
    }
    if (!row.isEnabled) {
      return { enabled: false };
    }
    const config = toJsonObject(row.config);
    return {
      enabled: row.isEnabled,
      webhookUrl: getConfigString(config, 'webhook_url'),
      actionPrefixes: getConfigStringArray(config, 'action_prefixes'),
      defaultChannel: getConfigString(config, 'default_channel'),
      format: getConfigString(config, 'format') === 'compact' ? 'compact' : 'detailed',
      includeTargetJson: getConfigBoolean(config, 'include_target_json') ?? true,
      maskSecrets: getConfigBoolean(config, 'mask_secrets') ?? true,
      routes: getConfigSlackRoutes(config, 'routes'),
      severityRules: getConfigSlackSeverityRules(config, 'severity_rules'),
    };
  }


  private isIntegrationLocked(provider: IntegrationProvider): boolean {
    return this.integrationLockedProviders.has(provider);
  }
}

function buildLocalEmbedding(input: string, dimensions = 256): number[] {
  const cleaned = input.trim().toLowerCase();
  const vector = new Array<number>(dimensions).fill(0);
  if (!cleaned) {
    return vector;
  }
  const tokens = cleaned.split(/[\s,.;:!?()[\]{}"'`<>/\\|+-]+/g).filter(Boolean);
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number.isFinite(value) ? value : 0).join(',')}]`;
}
