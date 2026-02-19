import {
  Prisma,
  IntegrationProvider,
  ImportSource,
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
  updateProjectMappingSchema,
  type ListMemoriesQuery,
} from '@claustrum/shared';
import type { AuthContext } from '../auth.js';
import { NotionClientAdapter } from '../integrations/notion-client.js';
import { JiraClientAdapter } from '../integrations/jira-client.js';
import { ConfluenceClientAdapter } from '../integrations/confluence-client.js';
import { LinearClientAdapter } from '../integrations/linear-client.js';
import type { SlackAuditNotifier, SlackDeliveryConfig } from '../integrations/audit-slack-notifier.js';
import { AuditReasoner } from '../integrations/audit-reasoner.js';
import type { LlmClient } from '../integrations/llm-client.js';
import { diffFields, normalizeReason } from './audit-utils.js';
import {
  buildAccessAuditParams,
  resolveAccessAuditAction,
} from './helpers/access-audit-helpers.js';
import {
  assertProjectAccess,
  assertRawAccess,
  assertWorkspaceAccess,
  assertWorkspaceAdmin,
  isWorkspaceAdminRole,
} from './access-control.js';
import {
  type AuditReasonerEnvConfig,
  getEffectiveAuditReasonerConfig,
} from './audit-reasoner-config.js';
import {
  AuthenticationError,
  AuthorizationError,
  GoneError,
  NotFoundError,
  ValidationError,
} from './errors.js';
import {
  buildApiKeyPrefix,
  generateApiKey,
  generateInvitationToken,
  hashApiKey,
  hashOneTimeToken,
} from '../security/api-key.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { issueSessionToken } from '../security/session-token.js';
import { issueOneTimeKeyToken, verifyOneTimeKeyToken } from '../security/one-time-key-token.js';
import {
  getEffectiveWorkspaceSettings,
  normalizeSubpathForSplitPolicy,
} from './workspace-resolution.js';
import { buildLocalEmbedding, toVectorLiteral } from './helpers/embedding-utils.js';
import {
  applySubpathBoost,
  prioritizeRowsBySubpath,
  normalizeSubpathValue,
} from './helpers/monorepo-subpath-helper.js';
import { runDecisionExtractionBatchForWorkspace } from './helpers/decision-extraction-helpers.js';
import {
  createDecisionKeywordPolicyHandler,
  deleteDecisionKeywordPolicyHandler,
  listDecisionKeywordPoliciesHandler,
  updateDecisionKeywordPolicyHandler,
} from './helpers/decision-keyword-policy-helpers.js';
import {
  createGlobalRuleHandler,
  deleteGlobalRuleHandler,
  listGlobalRulesHandler,
  summarizeGlobalRulesHandler,
  updateGlobalRuleHandler,
} from './helpers/global-rules-helpers.js';
import { runAuditRetentionSweepHandler } from './helpers/audit-retention-helpers.js';
import {
  createAuditSinkHandler,
  deleteAuditSinkHandler,
  listAuditDeliveryQueueHandler,
  listAuditSinksHandler,
  processAuditDeliveryQueue,
  testAuditSinkDeliveryHandler,
  updateAuditSinkHandler,
} from './helpers/audit-sink-helpers.js';
import {
  createDetectionRuleHandler,
  deleteDetectionRuleHandler,
  listDetectionRulesHandler,
  listDetectionsHandler,
  runDetectionSweepHandler,
  updateDetectionRuleHandler,
  updateDetectionStatusHandler,
} from './helpers/detection-helpers.js';
import {
  createProjectAndMapping,
  ensureProjectMapping,
  getNextMappingPriority,
} from './helpers/project-mapping-helpers.js';
import {
  getConfluenceClient,
  getConfluenceClientForWorkspace,
  getJiraClient,
  getJiraClientForWorkspace,
  getLinearClient,
  getLinearClientForWorkspace,
  getNotionClient,
  getNotionClientForWorkspace,
  getWorkspaceIntegrationRecord,
  runIntegrationAutoWrites,
  splitProjectKey,
} from './helpers/integration-helpers.js';
import {
  getWorkspaceSlackDeliveryConfig,
  recordAuditEntry,
} from './helpers/audit-helpers.js';
import { resolveProjectByPriority } from './helpers/resolve-project-helper.js';
import { updateWorkspaceSettingsWithAudit } from './helpers/workspace-settings-helper.js';
import { bootstrapProjectContextHandler } from './helpers/bootstrap-context-helpers.js';
import {
  getContextBundleHandler,
  recommendContextPersona,
} from './helpers/context-bundle-helpers.js';
import {
  listActiveWorkEventsHandler,
  listActiveWorkHandler,
  recomputeActiveWorkHandler,
  recomputeActiveWorkNightly,
  updateActiveWorkStatusHandler,
} from './helpers/active-work-helpers.js';
import {
  commitImportHandler,
  createImportUploadHandler,
  extractImportHandler,
  listImportsHandler,
  listStagedMemoriesHandler,
  parseImportHandler,
  rawSearchHandler,
  viewRawMessageHandler,
} from './helpers/import-raw-helpers.js';
import {
  createAuditExportStreamHandler,
  confluenceReadHandler,
  confluenceSearchHandler,
  getWorkspaceIntegrationsHandler,
  jiraReadHandler,
  jiraSearchHandler,
  linearReadHandler,
  linearSearchHandler,
  listAccessAuditTimelineHandler,
  listAuditLogsHandler,
  notionReadHandler,
  notionSearchHandler,
  notionWriteHandler,
  upsertWorkspaceIntegrationHandler,
} from './helpers/integration-ops-helpers.js';
import {
  captureRawEventHandler,
  handleCiEventHandler,
  handleGitEventHandler,
  listRawEventsHandler,
} from './helpers/git-events-helpers.js';
import { listLlmUsageHandler, type LlmUsageGroupBy } from './helpers/llm-usage-helpers.js';
import {
  getOutboundPolicyHandler,
  listOutboundTemplateVariablesHandler,
  getWorkspaceOutboundSettingsHandler,
  renderOutboundHandler,
  updateOutboundPolicyHandler,
  updateWorkspaceOutboundSettingsHandler,
} from './helpers/outbound-message-helpers.js';
import {
  deleteOidcGroupMappingHandler,
  finishOidcLoginHandler,
  getWorkspaceSsoSettingsHandler,
  listOidcGroupMappingsHandler,
  listOidcProvidersHandler,
  startOidcLoginHandler,
  updateWorkspaceSsoSettingsHandler,
  upsertOidcGroupMappingHandler,
  upsertOidcProviderHandler,
} from './helpers/oidc-sso-helpers.js';
import {
  connectGithubInstallationHandler,
  getGithubInstallUrlHandler,
  getGithubInstallationStatusHandler,
  listGithubReposHandler,
  syncGithubReposHandler,
} from './helpers/github-integration-helpers.js';
import {
  getGithubPermissionPreviewHandler,
  syncGithubPermissionsHandler,
} from './helpers/github-permission-sync-helpers.js';
import { getGithubPermissionStatusHandler } from './helpers/github-permission-status-helpers.js';
import { getGithubCacheStatusHandler } from './helpers/github-permission-cache-status-helpers.js';
import {
  createGithubUserLinkHandler,
  deleteGithubUserLinkHandler,
  listGithubUserLinksHandler,
} from './helpers/github-user-link-helpers.js';
import {
  createGithubTeamMappingHandler,
  deleteGithubTeamMappingHandler,
  listGithubTeamMappingsHandler,
  patchGithubTeamMappingHandler,
} from './helpers/github-team-mapping-helpers.js';
import {
  enqueueGithubWebhookEventHandler,
  listGithubWebhookEventsHandler,
  processGithubWebhookQueueHandler,
} from './helpers/github-webhook-helpers.js';
import {
  createProjectDomain,
  createWorkspaceDomain,
  listProjectsDomain,
  listWorkspacesDomain,
  updateWorkspaceDomain,
} from './domains/workspace-project-domain.js';
import {
  createMemoryDomain,
  deleteMemoryDomain,
  listMemoriesDomain,
  updateMemoryDomain,
} from './domains/memory-search-domain.js';
import {
  acceptInviteDomain,
  completeSetupDomain,
  createSelfApiKeyDomain,
  createWorkspaceInviteDomain,
  getContextPersonaDomain,
  getAuthMeDomain,
  getInviteDomain,
  listOwnApiKeysDomain,
  listUserApiKeysDomain,
  loginDomain,
  logoutDomain,
  reportGitCaptureInstalledDomain,
  resetUserApiKeysDomain,
  revokeApiKeyDomain,
  updateContextPersonaDomain,
  viewOneTimeApiKeyDomain,
} from './domains/auth-invite-api-key-domain.js';

export {
  AuthenticationError,
  AuthorizationError,
  GoneError,
  NotFoundError,
  ValidationError,
} from './errors.js';

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
    private readonly llmClient?: LlmClient,
    private readonly integrationLockedProviders: ReadonlySet<IntegrationProvider> = new Set(),
    private readonly auditReasonerEnvConfig: AuditReasonerEnvConfig = {
      enabled: false,
      preferEnv: false,
      providerOrder: [],
      providers: {},
    },
    private readonly securityConfig: {
      apiKeyHashSecret: string;
      oneTimeTokenSecret: string;
      oneTimeTokenTtlSeconds: number;
      githubStateSecret: string;
      publicBaseUrl?: string;
      inviteBaseUrl?: string;
      githubAppId?: string;
      githubAppPrivateKey?: string;
      githubAppWebhookSecret?: string;
      githubAppName?: string;
      githubAppUrl?: string;
    } = {
      apiKeyHashSecret: 'claustrum-dev-api-key-hash-secret-change-me',
      oneTimeTokenSecret: 'claustrum-dev-one-time-token-secret-change-me',
      oneTimeTokenTtlSeconds: 900,
      githubStateSecret: 'claustrum-dev-github-state-secret-change-me',
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
    return resolveProjectByPriority({
      prisma: this.prisma,
      auth: args.auth,
      input: args.input,
      getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
      createProjectAndMapping: (params) => this.createProjectAndMapping(params),
      ensureProjectMapping: (params) => this.ensureProjectMapping(params),
    });
  }

  async listProjects(args: { auth: AuthContext; workspaceKey: string }) {
    return listProjectsDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        hasGlobalAdminAccess: (auth) => this.hasGlobalAdminAccess(auth),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async createProject(args: {
    auth: AuthContext;
    input: unknown;
  }) {
    const created = await createProjectDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        hasGlobalAdminAccess: (auth) => this.hasGlobalAdminAccess(auth),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
    try {
      const workspace =
        (created.workspaceId &&
          (await this.prisma.workspace.findUnique({
            where: { id: created.workspaceId },
            select: { key: true },
          }))) ||
        null;
      if (workspace?.key) {
        await bootstrapProjectContextHandler(
          {
            prisma: this.prisma,
            getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
            getProjectByKeys: (workspaceKey, projectKey) => this.getProjectByKeys(workspaceKey, projectKey),
            updateMemoryEmbedding: (memoryId, content) => this.updateMemoryEmbedding(memoryId, content),
            recordAudit: (auditArgs) => this.recordAudit(auditArgs),
          },
          {
            auth: args.auth,
            workspaceKey: workspace.key,
            projectKey: created.key,
            source: 'project_create',
          }
        );
      }
    } catch (error) {
      console.error('[memory-core] project bootstrap context failed', error);
    }
    return created;
  }

  async bootstrapProjectContext(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
  }) {
    return bootstrapProjectContextHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        getProjectByKeys: (workspaceKey, projectKey) => this.getProjectByKeys(workspaceKey, projectKey),
        updateMemoryEmbedding: (memoryId, content) => this.updateMemoryEmbedding(memoryId, content),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      {
        auth: args.auth,
        workspaceKey: args.workspaceKey,
        projectKey: args.projectKey,
        source: 'manual',
      }
    );
  }

  async recomputeProjectActiveWork(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    return recomputeActiveWorkHandler({
      prisma: this.prisma,
      auth: args.auth,
      workspace,
      project,
      source: 'manual',
      recordAudit: (auditArgs) => this.recordAudit(auditArgs),
    });
  }

  async listProjectActiveWork(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    includeClosed?: boolean;
    limit?: number;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    return listActiveWorkHandler({
      prisma: this.prisma,
      auth: args.auth,
      workspace,
      project,
      includeClosed: args.includeClosed,
      limit: args.limit,
    });
  }

  async listProjectActiveWorkEvents(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    activeWorkId?: string;
    limit?: number;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    return listActiveWorkEventsHandler({
      prisma: this.prisma,
      auth: args.auth,
      workspace,
      project,
      activeWorkId: args.activeWorkId,
      limit: args.limit,
    });
  }

  async updateProjectActiveWorkStatus(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    activeWorkId: string;
    action: 'confirm' | 'close' | 'reopen';
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    return updateActiveWorkStatusHandler({
      prisma: this.prisma,
      auth: args.auth,
      workspace,
      project,
      activeWorkId: args.activeWorkId,
      action: args.action,
      recordAudit: (auditArgs) => this.recordAudit(auditArgs),
    });
  }

  async createMemory(args: { auth: AuthContext; input: unknown }) {
    return createMemoryDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        getProjectByKeys: (workspaceKey, projectKey) => this.getProjectByKeys(workspaceKey, projectKey),
        updateMemoryEmbedding: (memoryId, content) => this.updateMemoryEmbedding(memoryId, content),
        searchMemoryCandidateScores: (searchArgs) => this.searchMemoryCandidateScores(searchArgs),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listMemories(args: { auth: AuthContext; query: ListMemoriesQuery }) {
    return listMemoriesDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        getProjectByKeys: (workspaceKey, projectKey) => this.getProjectByKeys(workspaceKey, projectKey),
        updateMemoryEmbedding: (memoryId, content) => this.updateMemoryEmbedding(memoryId, content),
        searchMemoryCandidateScores: (searchArgs) => this.searchMemoryCandidateScores(searchArgs),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getContextBundle(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    q?: string;
    currentSubpath?: string;
    mode?: 'default' | 'debug';
    budget?: number;
  }) {
    return getContextBundleHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        getProjectByKeys: async (workspaceKey, projectKey) => {
          const project = await this.getProjectByKeys(workspaceKey, projectKey);
          return {
            id: project.id,
            key: project.key,
            name: project.name,
            workspaceId: project.workspaceId,
          };
        },
        listMemories: async (bundleArgs) =>
          (await this.listMemories({
            auth: bundleArgs.auth,
            query: bundleArgs.query as ListMemoriesQuery,
          })) as Array<Record<string, unknown>>,
      },
      args
    );
  }

  async getContextPersonaRecommendation(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    q?: string;
  }): Promise<{
    recommended: 'neutral' | 'author' | 'reviewer' | 'architect';
    confidence: number;
    reasons: string[];
    alternatives: Array<{
      persona: 'neutral' | 'author' | 'reviewer' | 'architect';
      score: number;
    }>;
  }> {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await assertProjectAccess(this.prisma, args.auth, workspace.id, project.id, 'READER');
    return recommendContextPersona({
      query: args.q,
      allowContextFallback: false,
    });
  }

  async runActiveWorkNightly(args: { now: Date }) {
    return recomputeActiveWorkNightly({
      prisma: this.prisma,
      now: args.now,
    });
  }

  async listWorkspaces(args: { auth: AuthContext }) {
    return listWorkspacesDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        hasGlobalAdminAccess: (auth) => this.hasGlobalAdminAccess(auth),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async createWorkspace(args: {
    auth: AuthContext;
    key: string;
    name: string;
  }) {
    return createWorkspaceDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        hasGlobalAdminAccess: (auth) => this.hasGlobalAdminAccess(auth),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async updateWorkspace(args: {
    auth: AuthContext;
    workspaceKey: string;
    name: string;
  }) {
    return updateWorkspaceDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        hasGlobalAdminAccess: (auth) => this.hasGlobalAdminAccess(auth),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listUsers(args: { auth: AuthContext }) {
    if (!(await this.hasGlobalAdminAccess(args.auth))) {
      throw new AuthorizationError('Only platform admin can list users.');
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
    if (!(await this.hasGlobalAdminAccess(args.auth))) {
      throw new AuthorizationError('Only platform admin can create users.');
    }

    return this.prisma.user.upsert({
      where: { email: args.email },
      update: {
        name: args.name ?? null,
        mustChangePassword: false,
        emailVerified: true,
      },
      create: {
        email: args.email,
        name: args.name ?? null,
        mustChangePassword: false,
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  async login(args: {
    email: string;
    password: string;
    sessionSecret: string;
    sessionTtlSeconds: number;
  }): Promise<{
    token: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      must_change_password: boolean;
      email_verified: boolean;
    };
  }> {
    return loginDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getAuthMe(args: { auth: AuthContext }): Promise<{
    user: {
      id: string;
      email: string;
      name: string | null;
      must_change_password: boolean;
      email_verified: boolean;
      context_persona: 'neutral' | 'author' | 'reviewer' | 'architect';
      auth_method: 'session' | 'api_key' | 'env_admin';
      active_api_key_count: number;
      needs_welcome_setup: boolean;
    };
  }> {
    return getAuthMeDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getContextPersona(args: { auth: AuthContext }): Promise<{
    context_persona: 'neutral' | 'author' | 'reviewer' | 'architect';
  }> {
    return getContextPersonaDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async updateContextPersona(args: {
    auth: AuthContext;
    contextPersona: unknown;
  }): Promise<{ context_persona: 'neutral' | 'author' | 'reviewer' | 'architect' }> {
    return updateContextPersonaDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async logout(_args: { auth: AuthContext }): Promise<{ ok: true }> {
    return logoutDomain();
  }

  async completeSetup(args: {
    auth: AuthContext;
    newEmail: string;
    newPassword: string;
    name?: string;
  }): Promise<{
    ok: true;
    user: {
      id: string;
      email: string;
      name: string | null;
      must_change_password: false;
      email_verified: true;
    };
  }> {
    return completeSetupDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async startOidcLogin(args: {
    workspaceKey: string;
    requestBaseUrl?: string;
    providerId?: string;
  }) {
    return startOidcLoginHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async finishOidcLogin(args: {
    workspaceKey: string;
    code: string;
    state: string;
    sessionSecret: string;
    sessionTtlSeconds: number;
  }) {
    return finishOidcLoginHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getGithubInstallUrl(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return getGithubInstallUrlHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async connectGithubInstallation(args: {
    installationId: string;
    state: string;
  }) {
    return connectGithubInstallationHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getGithubInstallationStatus(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return getGithubInstallationStatusHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async syncGithubRepos(args: {
    auth: AuthContext;
    workspaceKey: string;
    repos?: string[];
  }) {
    return syncGithubReposHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listGithubRepos(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return listGithubReposHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listGithubUserLinks(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return listGithubUserLinksHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async createGithubUserLink(args: {
    auth: AuthContext;
    workspaceKey: string;
    userId: string;
    githubLogin: string;
  }) {
    return createGithubUserLinkHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async deleteGithubUserLink(args: {
    auth: AuthContext;
    workspaceKey: string;
    userId: string;
  }) {
    return deleteGithubUserLinkHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async syncGithubPermissions(args: {
    auth: AuthContext;
    workspaceKey: string;
    dryRun?: boolean;
    projectKeyPrefix?: string;
    repos?: string[];
  }) {
    return syncGithubPermissionsHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getGithubPermissionStatus(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return getGithubPermissionStatusHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
      },
      args
    );
  }

  async getGithubPermissionPreview(args: {
    auth: AuthContext;
    workspaceKey: string;
    repo: string;
  }) {
    return getGithubPermissionPreviewHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getGithubCacheStatus(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return getGithubCacheStatusHandler(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async enqueueGithubWebhookEvent(args: {
    eventType: string;
    deliveryId: string;
    signature256?: string;
    payload: unknown;
    payloadRaw: Buffer;
  }) {
    return enqueueGithubWebhookEventHandler(
      {
        prisma: this.prisma,
        securityConfig: {
          githubAppWebhookSecret: this.securityConfig.githubAppWebhookSecret,
          githubAppId: this.securityConfig.githubAppId,
          githubAppPrivateKey: this.securityConfig.githubAppPrivateKey,
          githubStateSecret: this.securityConfig.githubStateSecret,
        },
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async processGithubWebhookQueue(args?: { batchSize?: number }) {
    return processGithubWebhookQueueHandler(
      {
        prisma: this.prisma,
        securityConfig: {
          githubAppWebhookSecret: this.securityConfig.githubAppWebhookSecret,
          githubAppId: this.securityConfig.githubAppId,
          githubAppPrivateKey: this.securityConfig.githubAppPrivateKey,
          githubStateSecret: this.securityConfig.githubStateSecret,
        },
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async runAuditRetentionSweep(args?: { now?: Date }) {
    return runAuditRetentionSweepHandler(
      {
        prisma: this.prisma,
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listAuditSinks(args: { auth: AuthContext; workspaceKey: string }) {
    return listAuditSinksHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async createAuditSink(args: {
    auth: AuthContext;
    workspaceKey: string;
    type: 'webhook' | 'http';
    name: string;
    enabled?: boolean;
    endpointUrl: string;
    secret: string;
    eventFilter?: Record<string, unknown>;
    retryPolicy?: Record<string, unknown>;
    reason?: string;
  }) {
    return createAuditSinkHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async updateAuditSink(args: {
    auth: AuthContext;
    workspaceKey: string;
    sinkId: string;
    input: {
      name?: string;
      enabled?: boolean;
      endpoint_url?: string;
      secret?: string;
      event_filter?: Record<string, unknown>;
      retry_policy?: Record<string, unknown>;
      reason?: string;
    };
  }) {
    return updateAuditSinkHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async deleteAuditSink(args: {
    auth: AuthContext;
    workspaceKey: string;
    sinkId: string;
    reason?: string;
  }) {
    return deleteAuditSinkHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async testAuditSinkDelivery(args: {
    auth: AuthContext;
    workspaceKey: string;
    sinkId: string;
  }) {
    return testAuditSinkDeliveryHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listAuditDeliveryQueue(args: {
    auth: AuthContext;
    workspaceKey: string;
    sinkId?: string;
    status?: 'queued' | 'sending' | 'delivered' | 'failed';
    limit?: number;
  }) {
    return listAuditDeliveryQueueHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async processAuditDeliveryQueue(args?: { batchSize?: number }) {
    return processAuditDeliveryQueue({
      prisma: this.prisma,
      batchSize: args?.batchSize,
    });
  }

  async listDetectionRules(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return listDetectionRulesHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async createDetectionRule(args: {
    auth: AuthContext;
    workspaceKey: string;
    input: {
      name: string;
      enabled?: boolean;
      severity?: 'low' | 'medium' | 'high';
      condition: Record<string, unknown>;
      notify?: Record<string, unknown>;
      reason?: string;
    };
  }) {
    return createDetectionRuleHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async updateDetectionRule(args: {
    auth: AuthContext;
    workspaceKey: string;
    ruleId: string;
    input: {
      name?: string;
      enabled?: boolean;
      severity?: 'low' | 'medium' | 'high';
      condition?: Record<string, unknown>;
      notify?: Record<string, unknown>;
      reason?: string;
    };
  }) {
    return updateDetectionRuleHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async deleteDetectionRule(args: {
    auth: AuthContext;
    workspaceKey: string;
    ruleId: string;
    reason?: string;
  }) {
    return deleteDetectionRuleHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listDetections(args: {
    auth: AuthContext;
    workspaceKey: string;
    status?: 'open' | 'ack' | 'closed';
    limit?: number;
  }) {
    return listDetectionsHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async updateDetectionStatus(args: {
    auth: AuthContext;
    workspaceKey: string;
    detectionId: string;
    status: 'open' | 'ack' | 'closed';
    reason?: string;
  }) {
    return updateDetectionStatusHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async runDetectionSweep(args?: { now?: Date; batchSize?: number }) {
    return runDetectionSweepHandler(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listGithubWebhookEvents(args: {
    auth: AuthContext;
    workspaceKey: string;
    status?: 'queued' | 'processing' | 'done' | 'failed';
    limit?: number;
  }) {
    return listGithubWebhookEventsHandler(
      {
        prisma: this.prisma,
        securityConfig: {
          githubAppWebhookSecret: this.securityConfig.githubAppWebhookSecret,
          githubAppId: this.securityConfig.githubAppId,
          githubAppPrivateKey: this.securityConfig.githubAppPrivateKey,
          githubStateSecret: this.securityConfig.githubStateSecret,
        },
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listGithubTeamMappings(args: { auth: AuthContext; workspaceKey: string }) {
    return listGithubTeamMappingsHandler(
      {
        prisma: this.prisma,
        securityConfig: {
          githubAppId: this.securityConfig.githubAppId,
          githubAppPrivateKey: this.securityConfig.githubAppPrivateKey,
        },
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async createGithubTeamMapping(args: {
    auth: AuthContext;
    workspaceKey: string;
    input: {
      providerInstallationId?: string | null;
      githubTeamId: string;
      githubTeamSlug: string;
      githubOrgLogin: string;
      targetType: 'workspace' | 'project';
      targetKey: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER';
      enabled?: boolean;
      priority?: number;
    };
  }) {
    return createGithubTeamMappingHandler(
      {
        prisma: this.prisma,
        securityConfig: {
          githubAppId: this.securityConfig.githubAppId,
          githubAppPrivateKey: this.securityConfig.githubAppPrivateKey,
        },
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async patchGithubTeamMapping(args: {
    auth: AuthContext;
    workspaceKey: string;
    mappingId: string;
    input: {
      providerInstallationId?: string | null;
      githubTeamId?: string;
      githubTeamSlug?: string;
      githubOrgLogin?: string;
      targetType?: 'workspace' | 'project';
      targetKey?: string;
      role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER';
      enabled?: boolean;
      priority?: number;
    };
  }) {
    return patchGithubTeamMappingHandler(
      {
        prisma: this.prisma,
        securityConfig: {
          githubAppId: this.securityConfig.githubAppId,
          githubAppPrivateKey: this.securityConfig.githubAppPrivateKey,
        },
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async deleteGithubTeamMapping(args: {
    auth: AuthContext;
    workspaceKey: string;
    mappingId: string;
  }) {
    return deleteGithubTeamMappingHandler(
      {
        prisma: this.prisma,
        securityConfig: {
          githubAppId: this.securityConfig.githubAppId,
          githubAppPrivateKey: this.securityConfig.githubAppPrivateKey,
        },
        getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listOidcProviders(args: { auth: AuthContext; workspaceKey: string }) {
    return listOidcProvidersHandler(
      {
        prisma: this.prisma,
        auth: args.auth,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      { workspaceKey: args.workspaceKey }
    );
  }

  async upsertOidcProvider(args: {
    auth: AuthContext;
    workspaceKey: string;
    providerId?: string;
    input: {
      name?: string;
      issuer_url?: string;
      client_id?: string;
      client_secret?: string;
      discovery_enabled?: boolean;
      scopes?: string;
      claim_groups_name?: string;
      claim_groups_format?: 'id' | 'name';
      enabled?: boolean;
      reason?: string;
    };
  }) {
    return upsertOidcProviderHandler(
      {
        prisma: this.prisma,
        auth: args.auth,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listOidcGroupMappings(args: {
    auth: AuthContext;
    workspaceKey: string;
    providerId?: string;
  }) {
    return listOidcGroupMappingsHandler(
      {
        prisma: this.prisma,
        auth: args.auth,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async upsertOidcGroupMapping(args: {
    auth: AuthContext;
    workspaceKey: string;
    mappingId?: string;
    input: {
      provider_id: string;
      claim_name?: string;
      group_id?: string;
      group_display_name?: string;
      target_type?: 'workspace' | 'project';
      target_key?: string;
      role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER';
      priority?: number;
      enabled?: boolean;
      reason?: string;
    };
  }) {
    return upsertOidcGroupMappingHandler(
      {
        prisma: this.prisma,
        auth: args.auth,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async deleteOidcGroupMapping(args: {
    auth: AuthContext;
    workspaceKey: string;
    mappingId: string;
    reason?: string;
  }) {
    return deleteOidcGroupMappingHandler(
      {
        prisma: this.prisma,
        auth: args.auth,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getWorkspaceSsoSettings(args: { auth: AuthContext; workspaceKey: string }) {
    return getWorkspaceSsoSettingsHandler(
      {
        prisma: this.prisma,
        auth: args.auth,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async updateWorkspaceSsoSettings(args: {
    auth: AuthContext;
    workspaceKey: string;
    oidcSyncMode?: 'add_only' | 'add_and_remove';
    oidcAllowAutoProvision?: boolean;
    reason?: string;
  }) {
    return updateWorkspaceSsoSettingsHandler(
      {
        prisma: this.prisma,
        auth: args.auth,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async getInvite(args: {
    token: string;
  }): Promise<{
    workspace_key: string;
    workspace_name: string;
    email: string;
    role: WorkspaceRole;
    project_roles: Record<string, ProjectRole>;
    expires_at: string;
    used_at: string | null;
  }> {
    return getInviteDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async acceptInvite(args: {
    token: string;
    password: string;
    name?: string;
    ip?: string;
  }): Promise<{
    ok: true;
    workspace_key: string;
    email: string;
    role: WorkspaceRole;
  }> {
    return acceptInviteDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async createWorkspaceInvite(args: {
    auth: AuthContext;
    workspaceKey: string;
    email: string;
    role: WorkspaceRole;
    projectRoles?: Record<string, ProjectRole>;
    requestBaseUrl?: string;
    ip?: string;
  }): Promise<{ invite_url: string; expires_at: string }> {
    return createWorkspaceInviteDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async reportGitCaptureInstalled(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ ok: true }> {
    return reportGitCaptureInstalledDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      {
        ...args,
        getProjectByKeys: (workspaceKey, projectKey) => this.getProjectByKeys(workspaceKey, projectKey),
      }
    );
  }

  async createSelfApiKey(args: {
    auth: AuthContext;
    label?: string;
    workspaceKey?: string;
    deviceLabel: string;
    expiresAt?: string;
    ip?: string;
  }): Promise<{
    id: string;
    label: string | null;
    workspace_key: string;
    key_prefix: string;
    device_label: string;
    expires_at: string | null;
    api_key: string;
  }> {
    return createSelfApiKeyDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listOwnApiKeys(args: { auth: AuthContext }): Promise<{
    keys: Array<{
      id: string;
      label: string | null;
      workspace_key: string;
      key_prefix: string;
      device_label: string;
      expires_at: Date | null;
      created_at: Date;
      last_used_at: Date | null;
      revoked_at: Date | null;
      created_by_user_id: string | null;
    }>;
  }> {
    return listOwnApiKeysDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listUserApiKeys(args: {
    auth: AuthContext;
    userId: string;
  }): Promise<{
    user_id: string;
    keys: Array<{
      id: string;
      label: string | null;
      workspace_key: string;
      key_prefix: string;
      device_label: string;
      expires_at: Date | null;
      created_at: Date;
      last_used_at: Date | null;
      revoked_at: Date | null;
      created_by_user_id: string | null;
    }>;
  }> {
    return listUserApiKeysDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async revokeApiKey(args: {
    auth: AuthContext;
    apiKeyId: string;
    ip?: string;
  }): Promise<{ revoked: true; api_key_id: string }> {
    return revokeApiKeyDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async resetUserApiKeys(args: {
    auth: AuthContext;
    userId: string;
    workspaceKey?: string;
    deviceLabel: string;
    expiresAt?: string;
    requestBaseUrl?: string;
    ip?: string;
  }): Promise<{ one_time_url: string; expires_at: string }> {
    return resetUserApiKeysDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async viewOneTimeApiKey(args: {
    token: string;
    ip?: string;
  }): Promise<{ api_key: string; api_key_id: string; expires_at: string }> {
    return viewOneTimeApiKeyDomain(
      {
        prisma: this.prisma,
        securityConfig: this.securityConfig,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        normalizeInviteProjectRoles: (input) => this.normalizeInviteProjectRoles(input),
        resolveAuditWorkspaceForUser: (userId) => this.resolveAuditWorkspaceForUser(userId),
        canManageUserKeys: (auth, targetUserId) => this.canManageUserKeys(auth, targetUserId),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async listWorkspaceMembers(args: { auth: AuthContext; workspaceKey: string }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id, 'MEMBER');
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async addWorkspaceMember(args: {
    auth: AuthContext;
    workspaceKey: string;
    email: string;
    role: WorkspaceRole;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const user = await this.prisma.user.findUnique({ where: { email: args.email } });
    if (!user) {
      throw new NotFoundError(`User not found: ${args.email}`);
    }
    const existing = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      select: { role: true },
    });
    const member = await this.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: { role: args.role },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: args.role,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    const action = resolveAccessAuditAction({
      kind: 'workspace',
      oldRole: existing?.role || null,
      newRole: member.role,
    });
    if (action) {
      await this.recordAudit({
        workspaceId: workspace.id,
        workspaceKey: workspace.key,
        actorUserId: args.auth.user.id,
        actorUserEmail: args.auth.user.email,
        action,
        target: buildAccessAuditParams({
          source: 'manual',
          targetUserId: user.id,
          oldRole: existing?.role || null,
          newRole: member.role,
          workspaceKey: workspace.key,
        }),
      });
    }
    return member;
  }

  async updateWorkspaceMemberRole(args: {
    auth: AuthContext;
    workspaceKey: string;
    userId: string;
    role: WorkspaceRole;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: args.userId,
        },
      },
    });
    if (!member) {
      throw new NotFoundError('Workspace member not found');
    }
    const updated = await this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role: args.role },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    const action = resolveAccessAuditAction({
      kind: 'workspace',
      oldRole: member.role,
      newRole: updated.role,
    });
    if (action) {
      await this.recordAudit({
        workspaceId: workspace.id,
        workspaceKey: workspace.key,
        actorUserId: args.auth.user.id,
        actorUserEmail: args.auth.user.email,
        action,
        target: buildAccessAuditParams({
          source: 'manual',
          targetUserId: args.userId,
          oldRole: member.role,
          newRole: updated.role,
          workspaceKey: workspace.key,
        }),
      });
    }
    return updated;
  }

  async removeWorkspaceMember(args: {
    auth: AuthContext;
    workspaceKey: string;
    userId: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: args.userId,
        },
      },
    });
    if (!member) {
      throw new NotFoundError('Workspace member not found');
    }
    await this.prisma.workspaceMember.delete({ where: { id: member.id } });
    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'access.workspace_member.removed',
      target: buildAccessAuditParams({
        source: 'manual',
        targetUserId: args.userId,
        oldRole: member.role,
        newRole: null,
        workspaceKey: workspace.key,
      }),
    });
    return { deleted: true as const, user_id: args.userId };
  }

  async issueWorkspaceApiKey(args: {
    auth: AuthContext;
    workspaceKey: string;
    userId: string;
    label?: string;
    deviceLabel: string;
    expiresAt?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: args.userId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ValidationError('Target user is not a workspace member.');
    }
    const normalizedDeviceLabel = args.deviceLabel.trim();
    if (!normalizedDeviceLabel) {
      throw new ValidationError('device_label is required.');
    }
    const plainKey = generateApiKey();
    const keyHash = hashApiKey(plainKey, this.securityConfig.apiKeyHashSecret);
    const keyPrefix = buildApiKeyPrefix(plainKey);
    const oneTimeExpiresAt = new Date(Date.now() + this.securityConfig.oneTimeTokenTtlSeconds * 1000);
    const keyExpiresAt = args.expiresAt ? new Date(args.expiresAt) : null;
    if (keyExpiresAt && !Number.isFinite(keyExpiresAt.getTime())) {
      throw new ValidationError('expires_at must be a valid ISO datetime.');
    }
    if (keyExpiresAt && keyExpiresAt.getTime() <= Date.now()) {
      throw new ValidationError('expires_at must be in the future.');
    }
    const created = await this.prisma.apiKey.create({
      data: {
        key: null,
        workspaceId: workspace.id,
        keyHash,
        keyPrefix,
        deviceLabel: normalizedDeviceLabel,
        expiresAt: keyExpiresAt,
        userId: args.userId,
        createdByUserId: args.auth.user.id,
        label: args.label?.trim() || 'workspace-issued',
      },
      select: { id: true, label: true, createdAt: true },
    });
    const token = issueOneTimeKeyToken({
      apiKeyId: created.id,
      apiKey: plainKey,
      userId: args.userId,
      expiresAtUnixMs: oneTimeExpiresAt.getTime(),
      secret: this.securityConfig.oneTimeTokenSecret,
    });
    const tokenHash = hashOneTimeToken(token, this.securityConfig.oneTimeTokenSecret);
    await this.prisma.apiKeyOneTimeToken.create({
      data: {
        apiKeyId: created.id,
        tokenHash,
        expiresAt: oneTimeExpiresAt,
        createdByUserId: args.auth.user.id,
      },
    });
    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'api_key.created',
      target: {
        target_user_id: args.userId,
        api_key_id: created.id,
        actor_user_id: args.auth.user.id,
        key_prefix: keyPrefix,
        device_label: normalizedDeviceLabel,
        expires_at: keyExpiresAt ? keyExpiresAt.toISOString() : null,
      },
    });
    const baseUrl = (this.securityConfig.publicBaseUrl || '').replace(/\/$/, '');
    return {
      api_key_id: created.id,
      workspace_key: workspace.key,
      user_id: args.userId,
      key_prefix: keyPrefix,
      device_label: normalizedDeviceLabel,
      key_expires_at: keyExpiresAt ? keyExpiresAt.toISOString() : null,
      label: created.label,
      created_at: created.createdAt,
      one_time_url: `${baseUrl}/v1/api-keys/one-time/${encodeURIComponent(token)}`,
      expires_at: oneTimeExpiresAt.toISOString(),
    };
  }

  async listWorkspaceApiKeys(args: {
    auth: AuthContext;
    workspaceKey: string;
    userId?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      select: { userId: true },
    });
    const userIds = members.map((item) => item.userId);
    if (userIds.length === 0) {
      return { workspace_key: workspace.key, keys: [] as Array<Record<string, unknown>> };
    }
    const keys = await this.prisma.apiKey.findMany({
      where: {
        workspaceId: workspace.id,
        userId: args.userId ? args.userId : { in: userIds },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        keyPrefix: true,
        deviceLabel: true,
        expiresAt: true,
        label: true,
        createdAt: true,
        revokedAt: true,
        lastUsedAt: true,
      },
    });
    return {
      workspace_key: workspace.key,
      keys: keys.map((key) => ({
        id: key.id,
        workspace_id: key.workspaceId,
        user_id: key.userId,
        key_prefix: key.keyPrefix,
        device_label: key.deviceLabel,
        expires_at: key.expiresAt,
        label: key.label,
        created_at: key.createdAt,
        revoked_at: key.revokedAt,
        last_used_at: key.lastUsedAt,
      })),
    };
  }

  async revokeWorkspaceApiKey(args: {
    auth: AuthContext;
    workspaceKey: string;
    apiKeyId: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const row = await this.prisma.apiKey.findUnique({
      where: { id: args.apiKeyId },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        revokedAt: true,
      },
    });
    if (!row) {
      throw new NotFoundError('API key not found');
    }
    if (row.workspaceId !== workspace.id) {
      throw new ValidationError('API key is not scoped to this workspace.');
    }
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: row.userId,
        },
      },
      select: { id: true },
    });
    if (!member) {
      throw new ValidationError('API key user is not a member of this workspace.');
    }
    if (!row.revokedAt) {
      await this.prisma.apiKey.update({
        where: { id: row.id },
        data: {
          revokedAt: new Date(),
        },
      });
    }
    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'api_key.revoked',
      target: {
        target_user_id: row.userId,
        api_key_id: row.id,
        actor_user_id: args.auth.user.id,
      },
    });
    return {
      revoked: true as const,
      api_key_id: row.id,
    };
  }

  async addProjectMember(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    email: string;
    role: 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER';
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await assertProjectAccess(this.prisma, args.auth, workspace.id, project.id, 'MAINTAINER');

    const user = await this.prisma.user.findUnique({
      where: { email: args.email },
    });
    if (!user) {
      throw new NotFoundError(`User not found: ${args.email}`);
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: user.id,
        },
      },
      select: { role: true },
    });

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

    const action = resolveAccessAuditAction({
      kind: 'project',
      oldRole: existing?.role || null,
      newRole: member.role,
    });
    if (action) {
      await this.recordAudit({
        workspaceId: workspace.id,
        projectId: project.id,
        workspaceKey: workspace.key,
        actorUserId: args.auth.user.id,
        actorUserEmail: args.auth.user.email,
        action,
        target: buildAccessAuditParams({
          source: 'manual',
          targetUserId: user.id,
          oldRole: existing?.role || null,
          newRole: member.role,
          workspaceKey: workspace.key,
          projectKey: project.key,
        }),
      });
    }

    return member;
  }

  async listProjectMembers(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
  }) {
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await assertProjectAccess(this.prisma, args.auth, project.workspaceId, project.id, 'READER');

    return this.prisma.projectMember.findMany({
      where: { projectId: project.id },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async updateProjectMemberRole(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    userId: string;
    role: 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER';
  }) {
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await assertProjectAccess(this.prisma, args.auth, project.workspaceId, project.id, 'MAINTAINER');

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: args.userId,
        },
      },
    });
    if (!member) {
      throw new NotFoundError('Project member not found');
    }
    const updated = await this.prisma.projectMember.update({
      where: { id: member.id },
      data: { role: args.role },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    const action = resolveAccessAuditAction({
      kind: 'project',
      oldRole: member.role,
      newRole: updated.role,
    });
    if (action) {
      await this.recordAudit({
        workspaceId: project.workspaceId,
        projectId: project.id,
        workspaceKey: args.workspaceKey,
        actorUserId: args.auth.user.id,
        actorUserEmail: args.auth.user.email,
        action,
        target: buildAccessAuditParams({
          source: 'manual',
          targetUserId: args.userId,
          oldRole: member.role,
          newRole: updated.role,
          workspaceKey: args.workspaceKey,
          projectKey: project.key,
        }),
      });
    }
    return updated;
  }

  async removeProjectMember(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    userId: string;
  }) {
    const project = await this.getProjectByKeys(args.workspaceKey, args.projectKey);
    await assertProjectAccess(this.prisma, args.auth, project.workspaceId, project.id, 'MAINTAINER');
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: args.userId,
        },
      },
    });
    if (!member) {
      throw new NotFoundError('Project member not found');
    }
    await this.prisma.projectMember.delete({
      where: { id: member.id },
    });
    await this.recordAudit({
      workspaceId: project.workspaceId,
      projectId: project.id,
      workspaceKey: args.workspaceKey,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'access.project_member.removed',
      target: buildAccessAuditParams({
        source: 'manual',
        targetUserId: args.userId,
        oldRole: member.role,
        newRole: null,
        workspaceKey: args.workspaceKey,
        projectKey: project.key,
      }),
    });
    return { deleted: true as const, user_id: args.userId };
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
      search_type_weights: effective.searchTypeWeights,
      search_recency_half_life_days: effective.searchRecencyHalfLifeDays,
      search_subpath_boost_weight: effective.searchSubpathBoostWeight,
      bundle_token_budget_total: effective.bundleTokenBudgetTotal,
      bundle_budget_global_workspace_pct: effective.bundleBudgetGlobalWorkspacePct,
      bundle_budget_global_user_pct: effective.bundleBudgetGlobalUserPct,
      bundle_budget_project_pct: effective.bundleBudgetProjectPct,
      bundle_budget_retrieval_pct: effective.bundleBudgetRetrievalPct,
      global_rules_recommend_max: effective.globalRulesRecommendMax,
      global_rules_warn_threshold: effective.globalRulesWarnThreshold,
      global_rules_summary_enabled: effective.globalRulesSummaryEnabled,
      global_rules_summary_min_count: effective.globalRulesSummaryMinCount,
      global_rules_selection_mode: effective.globalRulesSelectionMode,
      global_rules_routing_enabled: effective.globalRulesRoutingEnabled,
      global_rules_routing_mode: effective.globalRulesRoutingMode,
      global_rules_routing_top_k: effective.globalRulesRoutingTopK,
      global_rules_routing_min_score: effective.globalRulesRoutingMinScore,
      persona_weights: effective.personaWeights,
      github_auto_create_projects: effective.githubAutoCreateProjects,
      github_auto_create_subprojects: effective.githubAutoCreateSubprojects,
      github_permission_sync_enabled: effective.githubPermissionSyncEnabled,
      github_permission_sync_mode: effective.githubPermissionSyncMode,
      github_cache_ttl_seconds: effective.githubCacheTtlSeconds,
      github_role_mapping: effective.githubRoleMapping,
      github_webhook_enabled: effective.githubWebhookEnabled,
      github_webhook_sync_mode: effective.githubWebhookSyncMode,
      github_team_mapping_enabled: effective.githubTeamMappingEnabled,
      github_project_key_prefix: effective.githubProjectKeyPrefix,
      github_key_prefix: effective.githubKeyPrefix,
      local_key_prefix: effective.localKeyPrefix,
      enable_monorepo_resolution: effective.enableMonorepoResolution,
      monorepo_detection_level: effective.monorepoDetectionLevel,
      monorepo_mode: effective.monorepoMode,
      monorepo_context_mode: effective.monorepoContextMode,
      monorepo_subpath_metadata_enabled: effective.monorepoSubpathMetadataEnabled,
      monorepo_subpath_boost_enabled: effective.monorepoSubpathBoostEnabled,
      monorepo_subpath_boost_weight: effective.monorepoSubpathBoostWeight,
      monorepo_root_markers: effective.monorepoRootMarkers,
      monorepo_workspace_globs: effective.monorepoWorkspaceGlobs,
      monorepo_exclude_globs: effective.monorepoExcludeGlobs,
      monorepo_max_depth: effective.monorepoMaxDepth,
      default_outbound_locale: effective.defaultOutboundLocale,
      supported_outbound_locales: effective.supportedOutboundLocales,
      enable_activity_auto_log: effective.enableActivityAutoLog,
      enable_decision_extraction: effective.enableDecisionExtraction,
      decision_extraction_mode: effective.decisionExtractionMode,
      decision_default_status: effective.decisionDefaultStatus,
      decision_auto_confirm_enabled: effective.decisionAutoConfirmEnabled,
      decision_auto_confirm_min_confidence: effective.decisionAutoConfirmMinConfidence,
      decision_batch_size: effective.decisionBatchSize,
      decision_backfill_days: effective.decisionBackfillDays,
      active_work_stale_days: effective.activeWorkStaleDays,
      active_work_auto_close_enabled: effective.activeWorkAutoCloseEnabled,
      active_work_auto_close_days: effective.activeWorkAutoCloseDays,
      raw_access_min_role: effective.rawAccessMinRole,
      retention_policy_enabled: effective.retentionPolicyEnabled,
      audit_retention_days: effective.auditRetentionDays,
      raw_retention_days: effective.rawRetentionDays,
      retention_mode: effective.retentionMode,
      security_stream_enabled: effective.securityStreamEnabled,
      security_stream_sink_id: effective.securityStreamSinkId,
      security_stream_min_severity: effective.securityStreamMinSeverity,
      oidc_sync_mode: effective.oidcSyncMode,
      oidc_allow_auto_provision: effective.oidcAllowAutoProvision,
    };
  }

  async updateWorkspaceSettings(args: {
    auth: AuthContext;
    workspaceKey: string;
    input: unknown;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    return updateWorkspaceSettingsWithAudit({
      prisma: this.prisma,
      auth: args.auth,
      workspace,
      input: args.input,
      recordAudit: (auditArgs) => this.recordAudit(auditArgs),
    });
  }

  async getExtractionSettings(args: { auth: AuthContext; workspaceKey: string }) {
    const settings = await this.getWorkspaceSettings(args);
    return this.toExtractionSettingsResponse(settings);
  }

  async updateExtractionSettings(args: {
    auth: AuthContext;
    workspaceKey: string;
    input: unknown;
  }) {
    const payload = {
      ...(args.input as Record<string, unknown>),
      workspace_key: args.workspaceKey,
    };
    const settings = await this.updateWorkspaceSettings({
      auth: args.auth,
      workspaceKey: args.workspaceKey,
      input: payload,
    });
    return this.toExtractionSettingsResponse(settings);
  }

  async listDecisionKeywordPolicies(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return listDecisionKeywordPoliciesHandler(this.getDecisionKeywordPolicyDeps(), args);
  }

  async createDecisionKeywordPolicy(args: {
    auth: AuthContext;
    workspaceKey: string;
    input: {
      name?: string;
      positive_keywords?: string[];
      negative_keywords?: string[];
      file_path_positive_patterns?: string[];
      file_path_negative_patterns?: string[];
      weight_positive?: number;
      weight_negative?: number;
      enabled?: boolean;
      reason?: string;
    };
  }) {
    return createDecisionKeywordPolicyHandler(this.getDecisionKeywordPolicyDeps(), args);
  }

  async updateDecisionKeywordPolicy(args: {
    auth: AuthContext;
    workspaceKey: string;
    policyId: string;
    input: {
      name?: string;
      positive_keywords?: string[];
      negative_keywords?: string[];
      file_path_positive_patterns?: string[];
      file_path_negative_patterns?: string[];
      weight_positive?: number;
      weight_negative?: number;
      enabled?: boolean;
      reason?: string;
    };
  }) {
    return updateDecisionKeywordPolicyHandler(this.getDecisionKeywordPolicyDeps(), args);
  }

  async deleteDecisionKeywordPolicy(args: {
    auth: AuthContext;
    workspaceKey: string;
    policyId: string;
    reason?: string;
  }) {
    return deleteDecisionKeywordPolicyHandler(this.getDecisionKeywordPolicyDeps(), args);
  }

  async listGlobalRules(args: {
    auth: AuthContext;
    workspaceKey: string;
    scope: 'workspace' | 'user';
    userId?: string;
  }) {
    return listGlobalRulesHandler(this.getGlobalRulesDeps(), args);
  }

  async createGlobalRule(args: {
    auth: AuthContext;
    workspaceKey: string;
    input: {
      scope?: 'workspace' | 'user';
      user_id?: string;
      title?: string;
      content?: string;
      category?: 'policy' | 'security' | 'style' | 'process' | 'other';
      priority?: number;
      severity?: 'low' | 'medium' | 'high';
      pinned?: boolean;
      enabled?: boolean;
      tags?: string[];
      reason?: string;
    };
  }) {
    return createGlobalRuleHandler(this.getGlobalRulesDeps(), args);
  }

  async updateGlobalRule(args: {
    auth: AuthContext;
    workspaceKey: string;
    ruleId: string;
    input: {
      scope?: 'workspace' | 'user';
      user_id?: string;
      title?: string;
      content?: string;
      category?: 'policy' | 'security' | 'style' | 'process' | 'other';
      priority?: number;
      severity?: 'low' | 'medium' | 'high';
      pinned?: boolean;
      enabled?: boolean;
      tags?: string[];
      reason?: string;
    };
  }) {
    return updateGlobalRuleHandler(this.getGlobalRulesDeps(), args);
  }

  async deleteGlobalRule(args: {
    auth: AuthContext;
    workspaceKey: string;
    ruleId: string;
    reason?: string;
  }) {
    return deleteGlobalRuleHandler(this.getGlobalRulesDeps(), args);
  }

  async summarizeGlobalRules(args: {
    auth: AuthContext;
    workspaceKey: string;
    scope: 'workspace' | 'user';
    userId?: string;
    mode: 'preview' | 'replace';
    reason?: string;
  }) {
    return summarizeGlobalRulesHandler(this.getGlobalRulesDeps(), args);
  }

  async listDecisions(args: {
    auth: AuthContext;
    query: {
      workspace_key: string;
      project_key?: string;
      q?: string;
      mode?: 'hybrid' | 'keyword' | 'semantic';
      status?: 'draft' | 'confirmed' | 'rejected';
      source?: 'auto' | 'human' | 'import';
      confidence_min?: number;
      confidence_max?: number;
      debug?: boolean;
      limit?: number;
      since?: string;
    };
  }) {
    return this.listMemories({
      auth: args.auth,
      query: {
        ...args.query,
        type: 'decision',
      },
    });
  }

  async getDecision(args: { auth: AuthContext; workspaceKey: string; decisionId: string }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    const row = await this.prisma.memory.findUnique({
      where: { id: args.decisionId },
      include: {
        project: {
          select: {
            id: true,
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
    if (!row || row.workspaceId !== workspace.id || row.type !== 'decision') {
      throw new NotFoundError(`Decision not found: ${args.decisionId}`);
    }
    await assertProjectAccess(this.prisma, args.auth, row.workspaceId, row.projectId);
    return row;
  }

  async setDecisionStatus(args: {
    auth: AuthContext;
    workspaceKey: string;
    decisionId: string;
    status: 'confirmed' | 'rejected';
  }) {
    const decision = await this.getDecision({
      auth: args.auth,
      workspaceKey: args.workspaceKey,
      decisionId: args.decisionId,
    });
    await assertProjectAccess(
      this.prisma,
      args.auth,
      decision.workspaceId,
      decision.projectId,
      'MAINTAINER'
    );
    await this.recordAudit({
      workspaceId: decision.workspaceId,
      projectId: decision.projectId,
      workspaceKey: args.workspaceKey,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: args.status === 'confirmed' ? 'decision.confirm' : 'decision.reject',
      target: {
        workspace_key: args.workspaceKey,
        project_id: decision.projectId,
        decision_id: decision.id,
      },
    });
    return this.updateMemory({
      auth: args.auth,
      memoryId: args.decisionId,
      input: {
        status: args.status,
      },
    });
  }

  async getWorkspaceOutboundSettings(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return getWorkspaceOutboundSettingsHandler(this.getOutboundDeps(), args);
  }

  async updateWorkspaceOutboundSettings(args: {
    auth: AuthContext;
    workspaceKey: string;
    defaultOutboundLocale?: string;
    supportedOutboundLocales?: string[];
    reason?: string;
  }) {
    return updateWorkspaceOutboundSettingsHandler(this.getOutboundDeps(), args);
  }

  async getOutboundPolicy(args: {
    auth: AuthContext;
    workspaceKey: string;
    integrationType: string;
  }) {
    return getOutboundPolicyHandler(this.getOutboundDeps(), args);
  }

  async updateOutboundPolicy(args: {
    auth: AuthContext;
    workspaceKey: string;
    integrationType: string;
    enabled?: boolean;
    localeDefault?: string;
    supportedLocales?: string[];
    mode?: string;
    style?: string;
    templateOverrides?: Record<string, unknown>;
    llmPromptSystem?: string | null;
    llmPromptUser?: string | null;
    reason?: string;
  }) {
    return updateOutboundPolicyHandler(this.getOutboundDeps(), args);
  }

  async renderOutbound(args: {
    auth: AuthContext;
    workspaceKey: string;
    integrationType: string;
    actionKey: string;
    params?: Record<string, unknown>;
    locale?: string;
  }) {
    return renderOutboundHandler(this.getOutboundDeps(), args);
  }

  async listOutboundTemplateVariables(args: {
    auth: AuthContext;
    workspaceKey: string;
    integrationType: string;
  }) {
    return listOutboundTemplateVariablesHandler(this.getOutboundDeps(), args);
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

  async listMonorepoSubprojectPolicies(args: {
    auth: AuthContext;
    workspaceKey: string;
    repoKey?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAccess(this.prisma, args.auth, workspace.id);
    const policies = await this.prisma.monorepoSubprojectPolicy.findMany({
      where: {
        workspaceId: workspace.id,
        repoKey: args.repoKey?.trim() || undefined,
      },
      orderBy: [{ repoKey: 'asc' }, { subpath: 'asc' }],
    });
    return {
      workspace_key: workspace.key,
      policies: policies.map((row) => ({
        id: row.id,
        repo_key: row.repoKey,
        subpath: row.subpath,
        enabled: row.enabled,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      })),
    };
  }

  async createMonorepoSubprojectPolicy(args: {
    auth: AuthContext;
    workspaceKey: string;
    repoKey: string;
    subpath: string;
    enabled?: boolean;
    reason?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const settings = await getEffectiveWorkspaceSettings(this.prisma, workspace.id);
    const repoKey = String(args.repoKey || '').trim();
    if (!repoKey) {
      throw new ValidationError('repo_key is required.');
    }
    const normalizedSubpath = normalizeSubpathForSplitPolicy(
      args.subpath,
      settings.monorepoMaxDepth,
      settings.monorepoExcludeGlobs
    );
    if (!normalizedSubpath) {
      throw new ValidationError('subpath is invalid or blocked by monorepo policy.');
    }

    const policy = await this.prisma.monorepoSubprojectPolicy.upsert({
      where: {
        workspaceId_repoKey_subpath: {
          workspaceId: workspace.id,
          repoKey,
          subpath: normalizedSubpath,
        },
      },
      update: {
        enabled: args.enabled ?? true,
      },
      create: {
        workspaceId: workspace.id,
        repoKey,
        subpath: normalizedSubpath,
        enabled: args.enabled ?? true,
      },
    });

    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'monorepo_subproject_policy.create',
      target: {
        workspace_key: workspace.key,
        reason: normalizeReason(args.reason),
        policy_id: policy.id,
        repo_key: policy.repoKey,
        subpath: policy.subpath,
        enabled: policy.enabled,
      },
    });

    return {
      id: policy.id,
      repo_key: policy.repoKey,
      subpath: policy.subpath,
      enabled: policy.enabled,
      created_at: policy.createdAt.toISOString(),
      updated_at: policy.updatedAt.toISOString(),
    };
  }

  async updateMonorepoSubprojectPolicy(args: {
    auth: AuthContext;
    workspaceKey: string;
    id: string;
    enabled: boolean;
    reason?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const current = await this.prisma.monorepoSubprojectPolicy.findUnique({
      where: { id: args.id },
    });
    if (!current || current.workspaceId !== workspace.id) {
      throw new NotFoundError('Monorepo subproject policy not found.');
    }
    const policy = await this.prisma.monorepoSubprojectPolicy.update({
      where: { id: args.id },
      data: { enabled: args.enabled },
    });
    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'monorepo_subproject_policy.update',
      target: {
        workspace_key: workspace.key,
        reason: normalizeReason(args.reason),
        policy_id: policy.id,
        repo_key: policy.repoKey,
        subpath: policy.subpath,
        changed_fields: diffFields({ enabled: current.enabled }, { enabled: policy.enabled }),
      },
    });
    return {
      id: policy.id,
      repo_key: policy.repoKey,
      subpath: policy.subpath,
      enabled: policy.enabled,
      created_at: policy.createdAt.toISOString(),
      updated_at: policy.updatedAt.toISOString(),
    };
  }

  async deleteMonorepoSubprojectPolicy(args: {
    auth: AuthContext;
    workspaceKey: string;
    id: string;
    reason?: string;
  }) {
    const workspace = await this.getWorkspaceByKey(args.workspaceKey);
    await assertWorkspaceAdmin(this.prisma, args.auth, workspace.id);
    const current = await this.prisma.monorepoSubprojectPolicy.findUnique({
      where: { id: args.id },
    });
    if (!current || current.workspaceId !== workspace.id) {
      throw new NotFoundError('Monorepo subproject policy not found.');
    }
    await this.prisma.monorepoSubprojectPolicy.delete({
      where: { id: args.id },
    });
    await this.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'monorepo_subproject_policy.delete',
      target: {
        workspace_key: workspace.key,
        reason: normalizeReason(args.reason),
        policy_id: current.id,
        repo_key: current.repoKey,
        subpath: current.subpath,
      },
    });
    return { deleted: true as const, id: args.id };
  }

  async createImportUpload(args: {
    auth: AuthContext;
    workspaceKey: string;
    source: ImportSource;
    fileName: string;
    fileBuffer: Buffer;
    projectKey?: string;
  }): Promise<{ import_id: string }> {
    return createImportUploadHandler(this.getImportRawDeps(), args);
  }

  async listImports(args: {
    auth: AuthContext;
    workspaceKey: string;
    limit?: number;
  }) {
    return listImportsHandler(this.getImportRawDeps(), args);
  }

  async parseImport(args: {
    auth: AuthContext;
    importId: string;
  }) {
    return parseImportHandler(this.getImportRawDeps(), args);
  }

  async extractImport(args: {
    auth: AuthContext;
    importId: string;
  }) {
    return extractImportHandler(this.getImportRawDeps(), args);
  }

  async listStagedMemories(args: {
    auth: AuthContext;
    importId: string;
  }) {
    return listStagedMemoriesHandler(this.getImportRawDeps(), args);
  }

  async commitImport(args: {
    auth: AuthContext;
    importId: string;
    stagedIds?: string[];
    projectKey?: string;
  }) {
    return commitImportHandler(this.getImportRawDeps(), args);
  }

  async rawSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey?: string;
    q: string;
    limit?: number;
    maxChars?: number;
  }) {
    return rawSearchHandler(this.getImportRawDeps(), args);
  }

  async viewRawMessage(args: {
    auth: AuthContext;
    messageId: string;
    maxChars?: number;
  }) {
    return viewRawMessageHandler(this.getImportRawDeps(), args);
  }

  async notionSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    query: string;
    limit?: number;
  }) {
    return notionSearchHandler(this.getIntegrationOpsDeps(), args);
  }

  async notionRead(args: {
    auth: AuthContext;
    workspaceKey: string;
    pageId: string;
    maxChars?: number;
  }) {
    return notionReadHandler(this.getIntegrationOpsDeps(), args);
  }

  async notionWrite(args: {
    auth: AuthContext;
    workspaceKey: string;
    title: string;
    content: string;
    pageId?: string;
    parentPageId?: string;
  }) {
    return notionWriteHandler(this.getIntegrationOpsDeps(), args);
  }

  async jiraSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    query: string;
    limit?: number;
  }) {
    return jiraSearchHandler(this.getIntegrationOpsDeps(), args);
  }

  async jiraRead(args: {
    auth: AuthContext;
    workspaceKey: string;
    issueKey: string;
    maxChars?: number;
  }) {
    return jiraReadHandler(this.getIntegrationOpsDeps(), args);
  }

  async confluenceSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    query: string;
    limit?: number;
  }) {
    return confluenceSearchHandler(this.getIntegrationOpsDeps(), args);
  }

  async confluenceRead(args: {
    auth: AuthContext;
    workspaceKey: string;
    pageId: string;
    maxChars?: number;
  }) {
    return confluenceReadHandler(this.getIntegrationOpsDeps(), args);
  }

  async linearSearch(args: {
    auth: AuthContext;
    workspaceKey: string;
    query: string;
    limit?: number;
  }) {
    return linearSearchHandler(this.getIntegrationOpsDeps(), args);
  }

  async linearRead(args: {
    auth: AuthContext;
    workspaceKey: string;
    issueKey: string;
    maxChars?: number;
  }) {
    return linearReadHandler(this.getIntegrationOpsDeps(), args);
  }

  async getWorkspaceIntegrations(args: {
    auth: AuthContext;
    workspaceKey: string;
  }) {
    return getWorkspaceIntegrationsHandler(this.getIntegrationOpsDeps(), args);
  }

  async upsertWorkspaceIntegration(args: {
    auth: AuthContext;
    workspaceKey: string;
    provider: 'notion' | 'jira' | 'confluence' | 'linear' | 'slack' | 'audit_reasoner';
    enabled?: boolean;
    config?: Record<string, unknown>;
    reason?: string;
  }) {
    return upsertWorkspaceIntegrationHandler(this.getIntegrationOpsDeps(), args);
  }

  async listAuditLogs(args: {
    auth: AuthContext;
    workspaceKey: string;
    limit?: number;
    projectKey?: string;
    actionKey?: string;
    actionPrefix?: string;
    actorUserId?: string;
  }) {
    return listAuditLogsHandler(this.getIntegrationOpsDeps(), args);
  }

  async listAccessAuditTimeline(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey?: string;
    userId?: string;
    source?: 'manual' | 'github' | 'oidc' | 'system';
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }) {
    return listAccessAuditTimelineHandler(this.getIntegrationOpsDeps(), args);
  }

  async listLlmUsage(args: {
    auth: AuthContext;
    workspaceKey: string;
    from?: string;
    to?: string;
    groupBy: LlmUsageGroupBy;
  }) {
    return listLlmUsageHandler({
      prisma: this.prisma,
      auth: args.auth,
      getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
      workspaceKey: args.workspaceKey,
      from: args.from,
      to: args.to,
      groupBy: args.groupBy,
    });
  }

  async createAuditExportStream(args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey?: string;
    from?: string;
    to?: string;
    format: 'csv' | 'json';
    source?: 'manual' | 'github' | 'oidc' | 'system';
    action?: string;
  }) {
    return createAuditExportStreamHandler(this.getIntegrationOpsDeps(), args);
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
    return captureRawEventHandler(this.getGitEventsDeps(), args);
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
    return handleGitEventHandler(this.getGitEventsDeps(), args);
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
    return listRawEventsHandler(this.getGitEventsDeps(), args);
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
    return handleCiEventHandler(this.getGitEventsDeps(), args);
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
    return updateMemoryDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        getProjectByKeys: (workspaceKey, projectKey) => this.getProjectByKeys(workspaceKey, projectKey),
        updateMemoryEmbedding: (memoryId, content) => this.updateMemoryEmbedding(memoryId, content),
        searchMemoryCandidateScores: (searchArgs) => this.searchMemoryCandidateScores(searchArgs),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
  }

  async deleteMemory(args: {
    auth: AuthContext;
    memoryId: string;
  }) {
    return deleteMemoryDomain(
      {
        prisma: this.prisma,
        getWorkspaceByKey: (workspaceKey) => this.getWorkspaceByKey(workspaceKey),
        getProjectByKeys: (workspaceKey, projectKey) => this.getProjectByKeys(workspaceKey, projectKey),
        updateMemoryEmbedding: (memoryId, content) => this.updateMemoryEmbedding(memoryId, content),
        searchMemoryCandidateScores: (searchArgs) => this.searchMemoryCandidateScores(searchArgs),
        recordAudit: (auditArgs) => this.recordAudit(auditArgs),
      },
      args
    );
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

  private async runDecisionExtractionBatchForWorkspace(args: {
    workspaceId: string;
    actorUserId: string;
  }): Promise<void> {
    if (!this.llmClient) {
      return;
    }
    return runDecisionExtractionBatchForWorkspace({
      prisma: this.prisma,
      workspaceId: args.workspaceId,
      actorUserId: args.actorUserId,
      llmClient: this.llmClient,
      getDecisionLlmConfig: (workspaceId: string) => this.getDecisionLlmConfig(workspaceId),
      updateMemoryEmbedding: (memoryId: string, content: string) =>
        this.updateMemoryEmbedding(memoryId, content),
    });
  }

  private async getDecisionLlmConfig(workspaceId: string) {
    return getEffectiveAuditReasonerConfig({
      prisma: this.prisma,
      workspaceId,
      integrationLockedProviders: this.integrationLockedProviders,
      auditReasonerEnvConfig: this.auditReasonerEnvConfig,
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
    return splitProjectKey(projectKey);
  }

  private getNotionClient(): NotionClientAdapter {
    return getNotionClient({ notionClient: this.notionClient });
  }

  private getJiraClient(): JiraClientAdapter {
    return getJiraClient({ jiraClient: this.jiraClient });
  }

  private getConfluenceClient(): ConfluenceClientAdapter {
    return getConfluenceClient({ confluenceClient: this.confluenceClient });
  }

  private getLinearClient(): LinearClientAdapter {
    return getLinearClient({ linearClient: this.linearClient });
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
    return runIntegrationAutoWrites({
      prisma: this.prisma,
      integrationLockedProviders: this.integrationLockedProviders,
      notionClient: this.notionClient,
      notionWriteEnabled: this.notionWriteEnabled,
      auth: args.auth,
      workspaceId: args.workspaceId,
      workspaceKey: args.workspaceKey,
      projectKey: args.projectKey,
      event: args.event,
      branch: args.branch,
      commitHash: args.commitHash,
      message: args.message,
      metadata: args.metadata,
      recordAudit: (auditArgs) => this.recordAudit(auditArgs),
    });
  }

  private async getWorkspaceIntegrationRecord(
    workspaceId: string,
    provider: IntegrationProvider
  ) {
    return getWorkspaceIntegrationRecord({
      prisma: this.prisma,
      workspaceId,
      provider,
      integrationLockedProviders: this.integrationLockedProviders,
    });
  }

  private async getJiraClientForWorkspace(workspaceId: string): Promise<JiraClientAdapter> {
    return getJiraClientForWorkspace({
      prisma: this.prisma,
      workspaceId,
      jiraClient: this.jiraClient,
      integrationLockedProviders: this.integrationLockedProviders,
    });
  }

  private async getNotionClientForWorkspace(
    workspaceId: string
  ): Promise<{ client: NotionClientAdapter; writeEnabled: boolean }> {
    return getNotionClientForWorkspace({
      prisma: this.prisma,
      workspaceId,
      notionClient: this.notionClient,
      notionWriteEnabled: this.notionWriteEnabled,
      integrationLockedProviders: this.integrationLockedProviders,
    });
  }

  private async getConfluenceClientForWorkspace(workspaceId: string): Promise<ConfluenceClientAdapter> {
    return getConfluenceClientForWorkspace({
      prisma: this.prisma,
      workspaceId,
      confluenceClient: this.confluenceClient,
      integrationLockedProviders: this.integrationLockedProviders,
    });
  }

  private async getLinearClientForWorkspace(workspaceId: string): Promise<LinearClientAdapter> {
    return getLinearClientForWorkspace({
      prisma: this.prisma,
      workspaceId,
      linearClient: this.linearClient,
      integrationLockedProviders: this.integrationLockedProviders,
    });
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
    return createProjectAndMapping({
      prisma: this.prisma,
      workspaceId: args.workspaceId,
      kind: args.kind,
      externalId: args.externalId,
      projectKey: args.projectKey,
      projectName: args.projectName,
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
    return ensureProjectMapping({
      prisma: txArg || this.prisma,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      kind: args.kind,
      externalId: args.externalId,
    });
  }

  private async getNextMappingPriority(
    args: { workspaceId: string; kind: ResolutionKind },
    txArg?: Prisma.TransactionClient
  ): Promise<number> {
    return getNextMappingPriority({
      prisma: txArg || this.prisma,
      workspaceId: args.workspaceId,
      kind: args.kind,
    });
  }

  private toExtractionSettingsResponse(settings: {
    workspace_key: string;
    enable_activity_auto_log: boolean;
    enable_decision_extraction: boolean;
    decision_extraction_mode: 'llm_only' | 'hybrid_priority';
    decision_default_status: 'draft' | 'confirmed';
    decision_auto_confirm_enabled: boolean;
    decision_auto_confirm_min_confidence: number;
    decision_batch_size: number;
    decision_backfill_days: number;
    active_work_stale_days: number;
    active_work_auto_close_enabled: boolean;
    active_work_auto_close_days: number;
  }) {
    return {
      workspace_key: settings.workspace_key,
      enable_activity_auto_log: settings.enable_activity_auto_log,
      enable_decision_extraction: settings.enable_decision_extraction,
      decision_extraction_mode: settings.decision_extraction_mode,
      decision_default_status: settings.decision_default_status,
      decision_auto_confirm_enabled: settings.decision_auto_confirm_enabled,
      decision_auto_confirm_min_confidence: settings.decision_auto_confirm_min_confidence,
      decision_batch_size: settings.decision_batch_size,
      decision_backfill_days: settings.decision_backfill_days,
      active_work_stale_days: settings.active_work_stale_days,
      active_work_auto_close_enabled: settings.active_work_auto_close_enabled,
      active_work_auto_close_days: settings.active_work_auto_close_days,
    };
  }

  private getImportRawDeps() {
    return {
      prisma: this.prisma,
      getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
      getProjectByKeys: (workspaceKey: string, projectKey: string) =>
        this.getProjectByKeys(workspaceKey, projectKey),
      getImportRecordById: (importId: string) => this.getImportRecordById(importId),
      recordAudit: (args: {
        workspaceId: string;
        projectId?: string;
        workspaceKey?: string;
        actorUserId: string;
        actorUserEmail?: string;
        action: string;
        target: Record<string, unknown>;
        correlationId?: string;
      }) => this.recordAudit(args),
      updateMemoryEmbedding: (memoryId: string, content: string) =>
        this.updateMemoryEmbedding(memoryId, content),
    };
  }

  private getDecisionKeywordPolicyDeps() {
    return {
      prisma: this.prisma,
      getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
      recordAudit: (args: {
        workspaceId: string;
        projectId?: string;
        workspaceKey?: string;
        actorUserId: string;
        actorUserEmail?: string;
        action: string;
        target: Record<string, unknown>;
        correlationId?: string;
      }) => this.recordAudit(args),
    };
  }

  private getGlobalRulesDeps() {
    return {
      prisma: this.prisma,
      getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
      recordAudit: (args: {
        workspaceId: string;
        projectId?: string;
        workspaceKey?: string;
        actorUserId: string;
        actorUserEmail?: string;
        action: string;
        target: Record<string, unknown>;
        correlationId?: string;
      }) => this.recordAudit(args),
    };
  }

  private getIntegrationOpsDeps() {
    return {
      prisma: this.prisma,
      notionClient: this.notionClient,
      jiraClient: this.jiraClient,
      confluenceClient: this.confluenceClient,
      linearClient: this.linearClient,
      notionWriteEnabled: this.notionWriteEnabled,
      auditSlackEnabled: this.auditSlackNotifier?.isEnabled() || false,
      auditReasonerEnvConfig: this.auditReasonerEnvConfig,
      getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
      getNotionClientForWorkspace: (workspaceId: string) =>
        this.getNotionClientForWorkspace(workspaceId),
      getJiraClientForWorkspace: (workspaceId: string) => this.getJiraClientForWorkspace(workspaceId),
      getConfluenceClientForWorkspace: (workspaceId: string) =>
        this.getConfluenceClientForWorkspace(workspaceId),
      getLinearClientForWorkspace: (workspaceId: string) =>
        this.getLinearClientForWorkspace(workspaceId),
      isIntegrationLocked: (provider: IntegrationProvider) => this.isIntegrationLocked(provider),
      recordAudit: (args: {
        workspaceId: string;
        projectId?: string;
        workspaceKey?: string;
        actorUserId: string;
        actorUserEmail?: string;
        action: string;
        target: Record<string, unknown>;
        correlationId?: string;
      }) => this.recordAudit(args),
    };
  }

  private getGitEventsDeps() {
    return {
      prisma: this.prisma,
      getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
      getProjectByKeys: (workspaceKey: string, projectKey: string) =>
        this.getProjectByKeys(workspaceKey, projectKey),
      splitProjectKey: (projectKey: string) => this.splitProjectKey(projectKey),
      recordAudit: (args: {
        workspaceId: string;
        projectId?: string;
        workspaceKey?: string;
        actorUserId: string;
        actorUserEmail?: string;
        action: string;
        target: Record<string, unknown>;
        correlationId?: string;
      }) => this.recordAudit(args),
      runIntegrationAutoWrites: (args: {
        auth: AuthContext;
        workspaceId: string;
        workspaceKey: string;
        projectKey: string;
        event: 'commit' | 'merge' | 'checkout';
        branch?: string;
        commitHash?: string;
        message?: string;
        metadata: Record<string, unknown>;
      }) => this.runIntegrationAutoWrites(args),
      runDecisionExtractionBatchForWorkspace: (args: {
        workspaceId: string;
        actorUserId: string;
      }) => this.runDecisionExtractionBatchForWorkspace(args),
      updateMemoryEmbedding: (memoryId: string, content: string) =>
        this.updateMemoryEmbedding(memoryId, content),
    };
  }

  private getOutboundDeps() {
    return {
      prisma: this.prisma,
      getWorkspaceByKey: (workspaceKey: string) => this.getWorkspaceByKey(workspaceKey),
      recordAudit: (args: {
        workspaceId: string;
        projectId?: string;
        workspaceKey?: string;
        actorUserId: string;
        actorUserEmail?: string;
        action: string;
        target: Record<string, unknown>;
      }) => this.recordAudit(args),
    };
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

  private normalizeInviteProjectRoles(value: unknown): Record<string, ProjectRole> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const allowed = new Set<ProjectRole>([
      ProjectRole.OWNER,
      ProjectRole.MAINTAINER,
      ProjectRole.WRITER,
      ProjectRole.READER,
    ]);
    const out: Record<string, ProjectRole> = {};
    for (const [projectKey, roleValue] of Object.entries(value as Record<string, unknown>)) {
      if (!projectKey || typeof projectKey !== 'string') {
        continue;
      }
      if (typeof roleValue !== 'string') {
        continue;
      }
      const normalized = roleValue.toUpperCase() as ProjectRole;
      if (!allowed.has(normalized)) {
        continue;
      }
      out[projectKey] = normalized;
    }
    return out;
  }

  private async hasGlobalAdminAccess(auth: AuthContext): Promise<boolean> {
    if (auth.projectAccessBypass || auth.user.envAdmin) {
      return true;
    }
    if (auth.authMethod !== 'session') {
      return false;
    }
    const firstUser = await this.prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return firstUser?.id === auth.user.id;
  }

  private async canManageUserKeys(auth: AuthContext, targetUserId: string): Promise<boolean> {
    if (auth.user.id === targetUserId) {
      return true;
    }
    if (await this.hasGlobalAdminAccess(auth)) {
      return true;
    }
    const sharedWorkspaceAdmin = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: auth.user.id,
        role: {
          in: [WorkspaceRole.ADMIN, WorkspaceRole.OWNER],
        },
        workspace: {
          members: {
            some: {
              userId: targetUserId,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });
    return Boolean(sharedWorkspaceAdmin);
  }

  private async resolveAuditWorkspaceForUser(
    userId: string
  ): Promise<{ id: string; key: string } | null> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        workspace: {
          select: {
            id: true,
            key: true,
          },
        },
      },
    });
    if (membership?.workspace) {
      return membership.workspace;
    }
    return this.prisma.workspace.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, key: true },
    });
  }

  private async recordAudit(args: {
    workspaceId: string;
    projectId?: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
    correlationId?: string;
  }) {
    return recordAuditEntry({
      prisma: this.prisma,
      auditSlackNotifier: this.auditSlackNotifier,
      auditReasoner: this.auditReasoner,
      integrationLockedProviders: this.integrationLockedProviders,
      auditReasonerEnvConfig: this.auditReasonerEnvConfig,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      workspaceKey: args.workspaceKey,
      actorUserId: args.actorUserId,
      actorUserEmail: args.actorUserEmail,
      action: args.action,
      target: args.target,
      correlationId: args.correlationId,
    });
  }

  private async getWorkspaceSlackDeliveryConfig(
    workspaceId: string
  ): Promise<SlackDeliveryConfig | undefined> {
    return getWorkspaceSlackDeliveryConfig({
      prisma: this.prisma,
      workspaceId,
      integrationLockedProviders: this.integrationLockedProviders,
    });
  }


  private isIntegrationLocked(provider: IntegrationProvider): boolean {
    return this.integrationLockedProviders.has(provider);
  }
}
