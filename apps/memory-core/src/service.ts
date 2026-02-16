import {
  Prisma,
  IntegrationProvider,
  ImportSource,
  ImportStatus,
  ProjectRole,
  ResolutionKind,
  WorkspaceRole,
  type PrismaClient,
} from '@prisma/client';
import {
  createMemorySchema,
  createProjectMappingSchema,
  createProjectSchema,
  memoryTypeSchema,
  resolveProjectSchema,
  resolutionOrderSchema,
  updateProjectMappingSchema,
  workspaceSettingsSchema,
  type ListMemoriesQuery,
  type ResolveProjectInput,
} from '@context-sync/shared';
import type { AuthContext } from './auth.js';
import { hasProjectAccess, requireWorkspaceMembership } from './permissions.js';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { NotionClientAdapter } from './notion-client.js';
import { JiraClientAdapter } from './jira-client.js';
import { ConfluenceClientAdapter } from './confluence-client.js';
import { LinearClientAdapter } from './linear-client.js';
import type {
  SlackAuditNotifier,
  SlackDeliveryConfig,
} from './audit-slack-notifier.js';
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

const DEFAULT_RESOLUTION_ORDER: ResolutionKind[] = [
  ResolutionKind.github_remote,
  ResolutionKind.repo_root_slug,
  ResolutionKind.manual,
];

const DEFAULT_GITHUB_PREFIX = 'github:';
const DEFAULT_LOCAL_PREFIX = 'local:';

type EffectiveWorkspaceSettings = {
  resolutionOrder: ResolutionKind[];
  autoCreateProject: boolean;
  githubKeyPrefix: string;
  localKeyPrefix: string;
};

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class MemoryCoreService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notionClient?: NotionClientAdapter,
    private readonly notionWriteEnabled = false,
    private readonly jiraClient?: JiraClientAdapter,
    private readonly confluenceClient?: ConfluenceClientAdapter,
    private readonly linearClient?: LinearClientAdapter,
    private readonly auditSlackNotifier?: SlackAuditNotifier,
    private readonly integrationLockedProviders: ReadonlySet<IntegrationProvider> = new Set()
  ) {}

  async selectSession(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
  }): Promise<{ workspace_key: string; project_key: string; ok: true }> {
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await this.assertProjectAccess(args.auth, project.workspaceId, project.id);
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
    const settings = await this.getEffectiveWorkspaceSettings(workspace.id);

    for (const kind of settings.resolutionOrder) {
      if (kind === ResolutionKind.github_remote) {
        const github = this.normalizeGithubSelector(input);
        if (!github) {
          continue;
        }
        const externalCandidates = github.withHost
          ? [github.normalized, github.withHost]
          : [github.normalized];
        const mapping = await this.prisma.projectMapping.findFirst({
          where: {
            workspaceId: workspace.id,
            kind: ResolutionKind.github_remote,
            externalId: { in: externalCandidates },
            isEnabled: true,
          },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          include: { project: true },
        });
        if (mapping) {
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
          const created = await this.createProjectAndMapping({
            workspaceId: workspace.id,
            kind: ResolutionKind.github_remote,
            externalId: github.normalized,
            projectKey: `${settings.githubKeyPrefix}${github.normalized}`,
            projectName: github.normalized,
          });
          return {
            workspace_key: workspace.key,
            project: {
              key: created.project.key,
              id: created.project.id,
              name: created.project.name,
            },
            resolution: ResolutionKind.github_remote,
            matched_mapping_id: created.mapping.id,
            created: created.created,
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
        await this.assertProjectAccess(args.auth, workspace.id, project.id);
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
    const membership = await this.assertWorkspaceAccess(args.auth, workspace.id);
    const projectScope =
      args.auth.projectAccessBypass ||
      args.auth.user.envAdmin ||
      this.isWorkspaceAdmin(membership.role)
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
    await this.assertWorkspaceAdmin(args.auth, workspace.id);

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
    await this.assertProjectAccess(args.auth, project.workspaceId, project.id);

    return this.prisma.memory.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: parsed.data.type,
        content: parsed.data.content,
        metadata: (parsed.data.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        createdBy: args.auth.user.id,
      },
      select: {
        id: true,
        type: true,
        content: true,
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
  }

  async listMemories(args: { auth: AuthContext; query: ListMemoriesQuery }) {
    const limit = Math.min(Math.max(args.query.limit || 20, 1), 200);
    const workspace = await this.getWorkspaceByKey(args.query.workspace_key);
    const membership = await this.assertWorkspaceAccess(args.auth, workspace.id);

    let projectId: string | undefined;
    if (args.query.project_key) {
      const project = await this.getProjectByKeys(args.query.workspace_key, args.query.project_key);
      await this.assertProjectAccess(args.auth, project.workspaceId, project.id);
      projectId = project.id;
    }

    const type = args.query.type ? memoryTypeSchema.parse(args.query.type) : undefined;

    const where: Prisma.MemoryWhereInput = {};
    if (projectId) {
      where.projectId = projectId;
      where.workspaceId = workspace.id;
    } else if (
      args.auth.projectAccessBypass ||
      args.auth.user.envAdmin ||
      this.isWorkspaceAdmin(membership.role)
    ) {
      where.workspaceId = workspace.id;
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
    }
    if (type) {
      where.type = type;
    }
    if (args.query.since) {
      where.createdAt = {
        gte: new Date(args.query.since),
      };
    }
    if (args.query.q) {
      where.content = {
        contains: args.query.q,
        mode: 'insensitive',
      };
    }

    return this.prisma.memory.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        type: true,
        content: true,
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
    await this.assertWorkspaceAdmin(args.auth, workspace.id);
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
    await this.assertProjectAccess(args.auth, project.workspaceId, project.id);

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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
    const effective = await this.getEffectiveWorkspaceSettings(workspace.id);
    return {
      workspace_key: workspace.key,
      resolution_order: effective.resolutionOrder,
      auto_create_project: effective.autoCreateProject,
      github_key_prefix: effective.githubKeyPrefix,
      local_key_prefix: effective.localKeyPrefix,
    };
  }

  async updateWorkspaceSettings(args: {
    auth: AuthContext;
    workspaceKey: string;
    input: unknown;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await this.assertWorkspaceAdmin(args.auth, workspace.id);
    const current = await this.getEffectiveWorkspaceSettings(workspace.id);
    const rawInput = (args.input || {}) as Record<string, unknown>;
    const reason = normalizeReason(rawInput.reason);
    const parsed = workspaceSettingsSchema.safeParse({
      workspace_key: args.workspaceKey,
      resolution_order: rawInput.resolution_order ?? current.resolutionOrder,
      auto_create_project: rawInput.auto_create_project ?? current.autoCreateProject,
      github_key_prefix: rawInput.github_key_prefix ?? current.githubKeyPrefix,
      local_key_prefix: rawInput.local_key_prefix ?? current.localKeyPrefix,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const settings = await this.prisma.workspaceSettings.upsert({
      where: { workspaceId: workspace.id },
      update: {
        resolutionOrder: parsed.data.resolution_order,
        autoCreateProject: parsed.data.auto_create_project,
        githubKeyPrefix: parsed.data.github_key_prefix,
        localKeyPrefix: parsed.data.local_key_prefix,
      },
      create: {
        workspaceId: workspace.id,
        resolutionOrder: parsed.data.resolution_order,
        autoCreateProject: parsed.data.auto_create_project,
        githubKeyPrefix: parsed.data.github_key_prefix,
        localKeyPrefix: parsed.data.local_key_prefix,
      },
    });

    const nextSettings = {
      resolution_order: this.parseResolutionOrder(settings.resolutionOrder),
      auto_create_project: settings.autoCreateProject,
      github_key_prefix: settings.githubKeyPrefix,
      local_key_prefix: settings.localKeyPrefix,
    };
    const changedFields = diffFields(
      {
        resolution_order: current.resolutionOrder,
        auto_create_project: current.autoCreateProject,
        github_key_prefix: current.githubKeyPrefix,
        local_key_prefix: current.localKeyPrefix,
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
          github_key_prefix: current.githubKeyPrefix,
          local_key_prefix: current.localKeyPrefix,
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAdmin(args.auth, workspace.id);
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

    await this.assertWorkspaceAdmin(args.auth, current.workspaceId);

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
    await this.assertWorkspaceAccess(args.auth, workspace.id);

    let projectId: string | undefined;
    if (args.projectKey) {
      const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
      await this.assertProjectAccess(args.auth, workspace.id, project.id);
      projectId = project.id;
    }

    const importId = randomUUID();
    const importDir = path.join(tmpdir(), 'context-sync-imports');
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAccess(args.auth, record.workspaceId);

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
    await this.assertWorkspaceAccess(args.auth, record.workspaceId);

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
    await this.assertWorkspaceAccess(args.auth, record.workspaceId);
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
    await this.assertWorkspaceAccess(args.auth, record.workspaceId);

    let overrideProjectId: string | undefined;
    if (args.projectKey) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: record.workspaceId },
      });
      if (!workspace) {
        throw new NotFoundError('Workspace not found for import.');
      }
      const project = await this.getProjectByKeys(workspace.key, args.projectKey);
      await this.assertProjectAccess(args.auth, record.workspaceId, project.id);
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
    await this.prisma.$transaction(async (tx) => {
      for (const candidate of staged) {
        const targetProjectId =
          overrideProjectId || candidate.projectId || getStringFromJson(record.stats, 'project_id');
        if (!targetProjectId) {
          continue;
        }
        await tx.memory.create({
          data: {
            workspaceId: record.workspaceId,
            projectId: targetProjectId,
            type: candidate.type,
            content: candidate.content,
            metadata: candidate.metadata ?? undefined,
            createdBy: args.auth.user.id,
          },
        });
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
      await this.assertRawAccess(args.auth, workspace.id, project.id);
      projectId = project.id;
    } else {
      await this.assertRawAccess(args.auth, workspace.id, undefined);
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

    await this.assertRawAccess(
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAdmin(args.auth, workspace.id);
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAccess(args.auth, workspace.id);
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
    await this.assertWorkspaceAdmin(args.auth, workspace.id);

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
          ],
        },
      },
    });
    const byProvider = new Map<IntegrationProvider, (typeof rows)[number]>();
    for (const row of rows) {
      byProvider.set(row.provider, row);
    }

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
      },
    };
  }

  async upsertWorkspaceIntegration(args: {
    auth: AuthContext;
    workspaceKey: string;
    provider: 'notion' | 'jira' | 'confluence' | 'linear' | 'slack';
    enabled?: boolean;
    config?: Record<string, unknown>;
    reason?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await this.assertWorkspaceAdmin(args.auth, workspace.id);

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

    return {
      workspace_key: workspace.key,
      provider: args.provider,
      integration: toIntegrationSummary({
        provider,
        row: saved,
        configuredFromEnv: false,
        notionWriteEnabled: this.notionWriteEnabled,
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
    await this.assertWorkspaceAdmin(args.auth, workspace.id);
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
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await this.assertProjectAccess(args.auth, workspace.id, project.id);

    const action =
      args.event === 'commit'
        ? 'git.commit'
        : args.event === 'merge'
          ? 'git.merge'
          : 'git.checkout';
    const targetBase = {
      workspace_key: workspace.key,
      project_key: project.key,
      event: args.event,
      branch: args.branch || null,
      commit_hash: args.commitHash || null,
      message: args.message || null,
      metadata: args.metadata || {},
    };

    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action,
      target: targetBase,
    });

    const autoWrites = await this.runIntegrationAutoWrites({
      auth: args.auth,
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      projectKey: project.key,
      event: args.event,
      branch: args.branch,
      commitHash: args.commitHash,
      message: args.message,
      metadata: args.metadata || {},
    });

    return {
      ok: true as const,
      workspace_key: workspace.key,
      project_key: project.key,
      event: args.event,
      auto_writes: autoWrites,
    };
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

  private async assertWorkspaceAccess(
    auth: AuthContext,
    workspaceId: string
  ): Promise<{ role: WorkspaceRole }> {
    const membership = await requireWorkspaceMembership({
      prisma: this.prisma,
      auth,
      workspaceId,
    });
    if (!membership) {
      throw new AuthorizationError('Workspace access denied');
    }
    return membership;
  }

  private async assertWorkspaceAdmin(auth: AuthContext, workspaceId: string): Promise<void> {
    const membership = await requireWorkspaceMembership({
      prisma: this.prisma,
      auth,
      workspaceId,
    });
    if (!membership) {
      throw new AuthorizationError('Workspace access denied');
    }
    if (membership.role !== WorkspaceRole.ADMIN && membership.role !== WorkspaceRole.OWNER) {
      throw new AuthorizationError('Workspace admin role required');
    }
  }

  private async assertProjectAccess(auth: AuthContext, workspaceId: string, projectId: string): Promise<void> {
    const allowed = await hasProjectAccess({
      prisma: this.prisma,
      auth,
      workspaceId,
      projectId,
    });
    if (!allowed) {
      throw new AuthorizationError('Project access denied');
    }
  }

  private isWorkspaceAdmin(role: WorkspaceRole): boolean {
    return role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER;
  }

  private parseResolutionOrder(input: unknown): ResolutionKind[] {
    const parsed = resolutionOrderSchema.safeParse(input);
    if (!parsed.success) {
      return DEFAULT_RESOLUTION_ORDER;
    }
    return parsed.data as ResolutionKind[];
  }

  private async getEffectiveWorkspaceSettings(workspaceId: string): Promise<EffectiveWorkspaceSettings> {
    const settings = await this.prisma.workspaceSettings.findUnique({
      where: { workspaceId },
    });
    if (!settings) {
      return {
        resolutionOrder: DEFAULT_RESOLUTION_ORDER,
        autoCreateProject: true,
        githubKeyPrefix: DEFAULT_GITHUB_PREFIX,
        localKeyPrefix: DEFAULT_LOCAL_PREFIX,
      };
    }
    return {
      resolutionOrder: this.parseResolutionOrder(settings.resolutionOrder),
      autoCreateProject: settings.autoCreateProject,
      githubKeyPrefix: settings.githubKeyPrefix || DEFAULT_GITHUB_PREFIX,
      localKeyPrefix: settings.localKeyPrefix || DEFAULT_LOCAL_PREFIX,
    };
  }

  private normalizeGithubSelector(input: ResolveProjectInput): { normalized: string; withHost?: string } | null {
    const github = input.github_remote;
    if (!github) {
      return null;
    }
    const normalized = (github.normalized || '').trim();
    if (normalized) {
      const host = (github.host || '').trim().toLowerCase();
      return host ? { normalized, withHost: `${host}/${normalized}` } : { normalized };
    }
    const owner = (github.owner || '').trim();
    const repo = (github.repo || '').trim();
    if (!owner || !repo) {
      return null;
    }
    const parsed = `${owner}/${repo}`;
    const host = (github.host || '').trim().toLowerCase();
    return host ? { normalized: parsed, withHost: `${host}/${parsed}` } : { normalized: parsed };
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

  private async assertRawAccess(
    auth: AuthContext,
    workspaceId: string,
    projectId?: string
  ): Promise<void> {
    if (auth.projectAccessBypass || auth.user.envAdmin) {
      return;
    }
    if (projectId) {
      const allowed = await hasProjectAccess({
        prisma: this.prisma,
        auth,
        workspaceId,
        projectId,
      });
      if (!allowed) {
        throw new AuthorizationError('Raw access requires admin or project member');
      }
      return;
    }
    const membership = await requireWorkspaceMembership({
      prisma: this.prisma,
      auth,
      workspaceId,
    });
    if (!membership) {
      throw new AuthorizationError('Workspace access denied');
    }
    if (membership.role !== WorkspaceRole.ADMIN && membership.role !== WorkspaceRole.OWNER) {
      throw new AuthorizationError('Workspace admin role required for workspace-wide raw search');
    }
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

    if (!this.auditSlackNotifier) {
      return;
    }
    void (async () => {
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
            target,
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
