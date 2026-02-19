import { ResolutionKind, type GithubAccountType, type GithubRepositorySelection, type PrismaClient } from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import { assertWorkspaceAccess, assertWorkspaceAdmin } from '../access-control.js';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../errors.js';
import {
  issueGithubInstallStateToken,
  verifyGithubInstallStateToken,
} from '../../security/github-install-state-token.js';
import {
  getInstallationDetails,
  issueGithubAppJwt,
  issueInstallationAccessToken,
  listInstallationRepositories,
  type GithubAppInstallationResponse,
} from './github/github-api-client.js';
import { ensureProjectMapping } from './project-mapping-helpers.js';
import { getEffectiveWorkspaceSettings } from '../workspace-resolution.js';
import {
  normalizeGithubRepoFullName,
  normalizeInstallationPayload,
  normalizeProjectKeyPrefix,
  parseGithubBigInt,
  requireGithubAppConfig,
  resolveInstallBaseUrl,
  toStringMap,
} from './github-integration-utils.js';

type DbLike = PrismaClient;

type RecordAuditFn = (args: {
  workspaceId: string;
  projectId?: string;
  workspaceKey?: string;
  actorUserId: string;
  actorUserEmail?: string;
  action: string;
  target: Record<string, unknown>;
}) => Promise<void>;

export type GithubIntegrationDeps = {
  prisma: DbLike;
  securityConfig: {
    githubAppId?: string;
    githubAppPrivateKey?: string;
    githubAppWebhookSecret?: string;
    githubAppName?: string;
    githubAppUrl?: string;
    githubStateSecret: string;
  };
  githubApiClient?: {
    getInstallationDetails?: typeof getInstallationDetails;
    issueGithubAppJwt?: typeof issueGithubAppJwt;
    issueInstallationAccessToken?: typeof issueInstallationAccessToken;
    listInstallationRepositories?: typeof listInstallationRepositories;
  };
  getWorkspaceByKey: (workspaceKey: string) => Promise<{ id: string; key: string }>;
  recordAudit: RecordAuditFn;
};

export async function getGithubInstallUrlHandler(
  deps: GithubIntegrationDeps,
  args: { auth: AuthContext; workspaceKey: string }
): Promise<{ url: string }> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const installBaseUrl = resolveInstallBaseUrl(deps.securityConfig);
  const state = issueGithubInstallStateToken({
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    secret: deps.securityConfig.githubStateSecret,
    ttlSeconds: 900,
  });

  const installUrl = new URL(installBaseUrl);
  installUrl.searchParams.set('state', state);
  return { url: installUrl.toString() };
}

export async function connectGithubInstallationHandler(
  deps: GithubIntegrationDeps,
  args: { installationId: string; state: string }
): Promise<{
  workspace_key: string;
  installation_id: string;
  account_type: GithubAccountType;
  account_login: string;
  repository_selection: GithubRepositorySelection;
  permissions: Record<string, string>;
  connected: true;
}> {
  const statePayload = verifyGithubInstallStateToken(args.state, deps.securityConfig.githubStateSecret);
  if (!statePayload) {
    throw new AuthenticationError('Invalid or expired GitHub installation state');
  }

  const workspace = await deps.getWorkspaceByKey(statePayload.workspace_key);
  const actorMembership = await deps.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: statePayload.actor_user_id,
      },
    },
    select: {
      role: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!actorMembership || (actorMembership.role !== 'ADMIN' && actorMembership.role !== 'OWNER')) {
    throw new AuthorizationError('Only workspace admin can connect a GitHub installation.');
  }

  const installationId = parseGithubBigInt(args.installationId, 'installation_id');
  const appConfig = requireGithubAppConfig(deps.securityConfig);
  const appJwt = await callIssueGithubAppJwt(deps, appConfig.appId, appConfig.privateKey);
  const installation = await callGetInstallationDetails(deps, appJwt, installationId);

  const normalized = normalizeInstallationPayload(installation);
  const existingForInstallation = await deps.prisma.githubInstallation.findUnique({
    where: {
      installationId,
    },
    select: {
      workspaceId: true,
    },
  });
  if (existingForInstallation && existingForInstallation.workspaceId !== workspace.id) {
    throw new ValidationError('This GitHub installation is already linked to another workspace.');
  }

  const saved = await deps.prisma.githubInstallation.upsert({
    where: {
      workspaceId: workspace.id,
    },
    update: {
      installationId,
      accountType: normalized.accountType,
      accountLogin: normalized.accountLogin,
      repositorySelection: normalized.repositorySelection,
      permissions: normalized.permissions,
    },
    create: {
      workspaceId: workspace.id,
      installationId,
      accountType: normalized.accountType,
      accountLogin: normalized.accountLogin,
      repositorySelection: normalized.repositorySelection,
      permissions: normalized.permissions,
    },
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: actorMembership.user.id,
    actorUserEmail: actorMembership.user.email,
    action: 'github.installation.connected',
    target: {
      workspace_key: workspace.key,
      installation_id: saved.installationId.toString(),
      account_login: saved.accountLogin,
      account_type: saved.accountType,
      repository_selection: saved.repositorySelection,
    },
  });

  return {
    workspace_key: workspace.key,
    installation_id: saved.installationId.toString(),
    account_type: saved.accountType,
    account_login: saved.accountLogin,
    repository_selection: saved.repositorySelection,
    permissions: toStringMap(saved.permissions),
    connected: true,
  };
}

export async function getGithubInstallationStatusHandler(
  deps: GithubIntegrationDeps,
  args: { auth: AuthContext; workspaceKey: string }
): Promise<{
  workspace_key: string;
  connected: boolean;
  installation: null | {
    installation_id: string;
    account_type: GithubAccountType;
    account_login: string;
    repository_selection: GithubRepositorySelection;
    permissions: Record<string, string>;
    updated_at: string;
  };
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAccess(deps.prisma, args.auth, workspace.id, 'MEMBER');

  const installation = await deps.prisma.githubInstallation.findUnique({
    where: {
      workspaceId: workspace.id,
    },
  });

  if (!installation) {
    return {
      workspace_key: workspace.key,
      connected: false,
      installation: null,
    };
  }

  return {
    workspace_key: workspace.key,
    connected: true,
    installation: {
      installation_id: installation.installationId.toString(),
      account_type: installation.accountType,
      account_login: installation.accountLogin,
      repository_selection: installation.repositorySelection,
      permissions: toStringMap(installation.permissions),
      updated_at: installation.updatedAt.toISOString(),
    },
  };
}

export async function syncGithubReposHandler(
  deps: GithubIntegrationDeps,
  args: { auth: AuthContext; workspaceKey: string; repos?: string[] }
): Promise<{
  workspace_key: string;
  count: number;
  projects_auto_created: number;
  projects_auto_linked: number;
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);

  const installation = await deps.prisma.githubInstallation.findUnique({
    where: {
      workspaceId: workspace.id,
    },
  });
  if (!installation) {
    throw new NotFoundError('GitHub installation is not connected for this workspace.');
  }

  const appConfig = requireGithubAppConfig(deps.securityConfig);
  const appJwt = await callIssueGithubAppJwt(deps, appConfig.appId, appConfig.privateKey);
  const installationToken = await callIssueInstallationAccessToken(
    deps,
    appJwt,
    installation.installationId
  );
  const allRepos = await callListInstallationRepositories(deps, installationToken);
  const repoFilter = new Set(
    (args.repos || [])
      .map((item) => normalizeGithubRepoFullName(item))
      .filter((item): item is string => Boolean(item))
  );
  const repos = repoFilter.size
    ? allRepos.filter((repo) => repoFilter.has(normalizeGithubRepoFullName(repo.full_name) || ''))
    : allRepos;
  const requestedButMissing =
    repoFilter.size === 0
      ? []
      : Array.from(repoFilter).filter(
          (fullName) =>
            !allRepos.some(
              (repo) => normalizeGithubRepoFullName(repo.full_name) === fullName
            )
        );
  const settings = await getEffectiveWorkspaceSettings(deps.prisma, workspace.id);
  const githubProjectPrefix = normalizeProjectKeyPrefix(settings.githubProjectKeyPrefix);
  const autoCreateProjects = settings.githubAutoCreateProjects;
  let createdProjects = 0;
  let linkedProjects = 0;

  await deps.prisma.$transaction(async (tx) => {
    if (repoFilter.size === 0) {
      await tx.githubRepoLink.updateMany({
        where: { workspaceId: workspace.id },
        data: { isActive: false },
      });
    } else if (requestedButMissing.length > 0) {
      await tx.githubRepoLink.updateMany({
        where: {
          workspaceId: workspace.id,
          fullName: { in: requestedButMissing },
        },
        data: { isActive: false },
      });
    }

    for (const repo of repos) {
      const repoFullName = normalizeGithubRepoFullName(repo.full_name);
      let linkedProjectId: string | null = null;
      if (autoCreateProjects && repoFullName) {
        const projectKey = `${githubProjectPrefix}${repoFullName}`;
        const existingProject = await tx.project.findUnique({
          where: {
            workspaceId_key: {
              workspaceId: workspace.id,
              key: projectKey,
            },
          },
          select: { id: true },
        });
        const project = await tx.project.upsert({
          where: {
            workspaceId_key: {
              workspaceId: workspace.id,
              key: projectKey,
            },
          },
          update: {
            name: repoFullName,
          },
          create: {
            workspaceId: workspace.id,
            key: projectKey,
            name: repoFullName,
          },
          select: {
            id: true,
          },
        });
        if (!existingProject) {
          createdProjects += 1;
        }
        linkedProjectId = project.id;
        await ensureProjectMapping({
          prisma: tx,
          workspaceId: workspace.id,
          projectId: project.id,
          kind: ResolutionKind.github_remote,
          externalId: repoFullName,
        });
        linkedProjects += 1;
      }

      await tx.githubRepoLink.upsert({
        where: {
          workspaceId_githubRepoId: {
            workspaceId: workspace.id,
            githubRepoId: BigInt(repo.id),
          },
        },
        update: {
          fullName: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch || null,
          isActive: true,
          ...(autoCreateProjects ? { linkedProjectId } : {}),
        },
        create: {
          workspaceId: workspace.id,
          linkedProjectId,
          githubRepoId: BigInt(repo.id),
          fullName: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch || null,
          isActive: true,
        },
      });
    }
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'github.repos.synced',
    target: {
      workspace_key: workspace.key,
      installation_id: installation.installationId.toString(),
      repo_count: repos.length,
      repos_filtered: repoFilter.size > 0 ? Array.from(repoFilter) : null,
      repos_missing: requestedButMissing,
      repository_selection: installation.repositorySelection,
    },
  });
  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'github.projects.auto_created',
    target: {
      workspace_key: workspace.key,
      enabled: autoCreateProjects,
      repo_count: repos.length,
      created_count: createdProjects,
      key_prefix: githubProjectPrefix,
    },
  });
  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'github.projects.auto_linked',
    target: {
      workspace_key: workspace.key,
      enabled: autoCreateProjects,
      repo_count: repos.length,
      linked_count: linkedProjects,
    },
  });

  return {
    workspace_key: workspace.key,
    count: repos.length,
    projects_auto_created: createdProjects,
    projects_auto_linked: linkedProjects,
  };
}

export async function listGithubReposHandler(
  deps: GithubIntegrationDeps,
  args: { auth: AuthContext; workspaceKey: string }
): Promise<{
  workspace_key: string;
  repos: Array<{
    github_repo_id: string;
    full_name: string;
    private: boolean;
      default_branch: string | null;
      is_active: boolean;
      updated_at: string;
      linked_project_id: string | null;
      linked_project_key: string | null;
      linked_project_name: string | null;
    }>;
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAccess(deps.prisma, args.auth, workspace.id, 'MEMBER');

  const repos = await deps.prisma.githubRepoLink.findMany({
    where: {
      workspaceId: workspace.id,
      isActive: true,
    },
    orderBy: [{ fullName: 'asc' }],
    include: {
      linkedProject: {
        select: {
          id: true,
          key: true,
          name: true,
        },
      },
    },
  });

  return {
    workspace_key: workspace.key,
    repos: repos.map((repo) => ({
      github_repo_id: repo.githubRepoId.toString(),
      full_name: repo.fullName,
      private: repo.private,
      default_branch: repo.defaultBranch || null,
      is_active: repo.isActive,
      updated_at: repo.updatedAt.toISOString(),
      linked_project_id: repo.linkedProject?.id || null,
      linked_project_key: repo.linkedProject?.key || null,
      linked_project_name: repo.linkedProject?.name || null,
    })),
  };
}

async function callIssueGithubAppJwt(
  deps: GithubIntegrationDeps,
  appId: string,
  privateKey: string
): Promise<string> {
  if (deps.githubApiClient?.issueGithubAppJwt) {
    return deps.githubApiClient.issueGithubAppJwt(appId, privateKey);
  }
  return issueGithubAppJwt(appId, privateKey);
}

async function callGetInstallationDetails(
  deps: GithubIntegrationDeps,
  appJwt: string,
  installationId: bigint
): Promise<GithubAppInstallationResponse> {
  if (deps.githubApiClient?.getInstallationDetails) {
    return deps.githubApiClient.getInstallationDetails(appJwt, installationId);
  }
  return getInstallationDetails(appJwt, installationId);
}

async function callIssueInstallationAccessToken(
  deps: GithubIntegrationDeps,
  appJwt: string,
  installationId: bigint
): Promise<string> {
  if (deps.githubApiClient?.issueInstallationAccessToken) {
    return deps.githubApiClient.issueInstallationAccessToken(appJwt, installationId);
  }
  return issueInstallationAccessToken(appJwt, installationId);
}

async function callListInstallationRepositories(
  deps: GithubIntegrationDeps,
  token: string
): Promise<Array<{ id: number; full_name: string; private: boolean; default_branch?: string | null }>> {
  if (deps.githubApiClient?.listInstallationRepositories) {
    return deps.githubApiClient.listInstallationRepositories(token);
  }
  return listInstallationRepositories(token);
}
