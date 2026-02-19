import path from 'node:path';
import {
  AutoExtractionMode,
  MonorepoContextMode,
  MonorepoMode,
  OidcSyncMode,
  Prisma,
  ResolutionKind,
  SearchDefaultMode,
  type PrismaClient,
} from '@prisma/client';
import {
  defaultAutoConfirmAllowedEventTypes,
  defaultAutoConfirmKeywordAllowlist,
  defaultAutoConfirmKeywordDenylist,
  defaultBundleBudgetGlobalUserPct,
  defaultBundleBudgetGlobalWorkspacePct,
  defaultBundleBudgetProjectPct,
  defaultBundleBudgetRetrievalPct,
  defaultBundleTokenBudgetTotal,
  defaultCheckoutDailyLimit,
  defaultCheckoutDebounceSeconds,
  defaultGlobalRulesRecommendMax,
  defaultGlobalRulesRoutingMinScore,
  defaultGlobalRulesRoutingTopK,
  defaultGlobalRulesSummaryMinCount,
  defaultGlobalRulesWarnThreshold,
  defaultMonorepoSubpathBoostWeight,
  type ResolveProjectInput,
} from '@claustrum/shared';
import {
  DEFAULT_GITHUB_PERMISSION_SYNC_MODE,
  DEFAULT_GITHUB_PREFIX,
  DEFAULT_GITHUB_ROLE_MAPPING,
  DEFAULT_GITHUB_WEBHOOK_SYNC_MODE,
  DEFAULT_LOCAL_PREFIX,
  DEFAULT_MONOREPO_CONTEXT_MODE,
  DEFAULT_MONOREPO_DETECTION_LEVEL,
  DEFAULT_MONOREPO_EXCLUDE_GLOBS,
  DEFAULT_MONOREPO_GLOBS,
  DEFAULT_MONOREPO_MAX_DEPTH,
  DEFAULT_MONOREPO_MODE,
  DEFAULT_MONOREPO_ROOT_MARKERS,
  DEFAULT_OUTBOUND_LOCALE,
  DEFAULT_RESOLUTION_ORDER,
  DEFAULT_RETENTION_MODE,
  DEFAULT_SEARCH_MODE,
  DEFAULT_SEARCH_TYPE_WEIGHTS,
  DEFAULT_PERSONA_WEIGHTS,
  DEFAULT_SUPPORTED_OUTBOUND_LOCALES,
  DEFAULT_AUTO_EXTRACT_MODE,
  clampFloat,
  parseDetectionLevel,
  parseGithubCacheTtlSeconds,
  parseGithubPermissionSyncMode,
  parseGithubRoleMapping,
  parseGlobalRulesRoutingMode,
  parseGlobalRulesSelectionMode,
  parseMonorepoContextMode,
  parseMonorepoMode,
  parseNonNegativeInt,
  parseOutboundLocale,
  parseOutboundLocaleArray,
  parsePersonaWeights,
  parsePositiveInt,
  parseProjectRole,
  parseResolutionOrder,
  parseRetentionMode,
  parseSearchTypeWeights,
  parseSecuritySeverity,
  parseStringArray,
} from './workspace-resolution-parsers.js';

export { DEFAULT_MONOREPO_GLOBS, DEFAULT_MONOREPO_MAX_DEPTH, DEFAULT_RESOLUTION_ORDER };
export { parseResolutionOrder };

export type EffectiveWorkspaceSettings = {
  resolutionOrder: ResolutionKind[];
  autoCreateProject: boolean;
  autoCreateProjectSubprojects: boolean;
  githubAutoCreateProjects: boolean;
  githubAutoCreateSubprojects: boolean;
  githubPermissionSyncEnabled: boolean;
  githubPermissionSyncMode: 'add_only' | 'add_and_remove';
  githubCacheTtlSeconds: number;
  githubRoleMapping: Record<string, 'owner' | 'maintainer' | 'writer' | 'reader'>;
  githubWebhookEnabled: boolean;
  githubWebhookSyncMode: 'add_only' | 'add_and_remove';
  githubTeamMappingEnabled: boolean;
  autoSwitchRepo: boolean;
  autoSwitchSubproject: boolean;
  allowManualPin: boolean;
  enableGitEvents: boolean;
  enableCommitEvents: boolean;
  enableMergeEvents: boolean;
  enableCheckoutEvents: boolean;
  checkoutDebounceSeconds: number;
  checkoutDailyLimit: number;
  enableAutoExtraction: boolean;
  autoExtractionMode: AutoExtractionMode;
  autoConfirmMinConfidence: number;
  autoConfirmAllowedEventTypes: string[];
  autoConfirmKeywordAllowlist: string[];
  autoConfirmKeywordDenylist: string[];
  autoExtractionBatchSize: number;
  searchDefaultMode: SearchDefaultMode;
  searchHybridAlpha: number;
  searchHybridBeta: number;
  searchDefaultLimit: number;
  searchTypeWeights: Record<string, number>;
  searchRecencyHalfLifeDays: number;
  searchSubpathBoostWeight: number;
  bundleTokenBudgetTotal: number;
  bundleBudgetGlobalWorkspacePct: number;
  bundleBudgetGlobalUserPct: number;
  bundleBudgetProjectPct: number;
  bundleBudgetRetrievalPct: number;
  globalRulesRecommendMax: number;
  globalRulesWarnThreshold: number;
  globalRulesSummaryEnabled: boolean;
  globalRulesSummaryMinCount: number;
  globalRulesSelectionMode: 'score' | 'recent' | 'priority_only';
  globalRulesRoutingEnabled: boolean;
  globalRulesRoutingMode: 'semantic' | 'keyword' | 'hybrid';
  globalRulesRoutingTopK: number;
  globalRulesRoutingMinScore: number;
  personaWeights: Record<string, Record<string, number>>;
  githubProjectKeyPrefix: string;
  githubKeyPrefix: string;
  localKeyPrefix: string;
  enableMonorepoResolution: boolean;
  monorepoDetectionLevel: number;
  monorepoMode: MonorepoMode;
  monorepoContextMode: MonorepoContextMode;
  monorepoSubpathMetadataEnabled: boolean;
  monorepoSubpathBoostEnabled: boolean;
  monorepoSubpathBoostWeight: number;
  monorepoRootMarkers: string[];
  monorepoWorkspaceGlobs: string[];
  monorepoExcludeGlobs: string[];
  monorepoMaxDepth: number;
  defaultOutboundLocale: string;
  supportedOutboundLocales: string[];
  enableActivityAutoLog: boolean;
  enableDecisionExtraction: boolean;
  decisionExtractionMode: 'llm_only' | 'hybrid_priority';
  decisionDefaultStatus: 'draft' | 'confirmed';
  decisionAutoConfirmEnabled: boolean;
  decisionAutoConfirmMinConfidence: number;
  decisionBatchSize: number;
  decisionBackfillDays: number;
  activeWorkStaleDays: number;
  activeWorkAutoCloseEnabled: boolean;
  activeWorkAutoCloseDays: number;
  rawAccessMinRole: 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER';
  retentionPolicyEnabled: boolean;
  auditRetentionDays: number;
  rawRetentionDays: number;
  retentionMode: 'archive' | 'hard_delete';
  securityStreamEnabled: boolean;
  securityStreamSinkId: string | null;
  securityStreamMinSeverity: 'low' | 'medium' | 'high';
  oidcSyncMode: OidcSyncMode;
  oidcAllowAutoProvision: boolean;
};

export async function getEffectiveWorkspaceSettings(
  prisma: PrismaClient | Prisma.TransactionClient,
  workspaceId: string
): Promise<EffectiveWorkspaceSettings> {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId },
  });
  if (!settings) {
    return {
      resolutionOrder: DEFAULT_RESOLUTION_ORDER,
      autoCreateProject: true,
      githubAutoCreateProjects: true,
      githubAutoCreateSubprojects: false,
      githubPermissionSyncEnabled: false,
      githubPermissionSyncMode: DEFAULT_GITHUB_PERMISSION_SYNC_MODE,
      githubCacheTtlSeconds: 900,
      githubRoleMapping: { ...DEFAULT_GITHUB_ROLE_MAPPING },
      githubWebhookEnabled: false,
      githubWebhookSyncMode: DEFAULT_GITHUB_WEBHOOK_SYNC_MODE,
      githubTeamMappingEnabled: true,
      autoSwitchRepo: true,
      autoSwitchSubproject: false,
      allowManualPin: true,
      enableGitEvents: true,
      enableCommitEvents: true,
      enableMergeEvents: true,
      enableCheckoutEvents: false,
      checkoutDebounceSeconds: defaultCheckoutDebounceSeconds,
      checkoutDailyLimit: defaultCheckoutDailyLimit,
      enableAutoExtraction: true,
      autoExtractionMode: DEFAULT_AUTO_EXTRACT_MODE,
      autoConfirmMinConfidence: 0.85,
      autoConfirmAllowedEventTypes: [...defaultAutoConfirmAllowedEventTypes],
      autoConfirmKeywordAllowlist: [...defaultAutoConfirmKeywordAllowlist],
      autoConfirmKeywordDenylist: [...defaultAutoConfirmKeywordDenylist],
      autoExtractionBatchSize: 20,
      searchDefaultMode: DEFAULT_SEARCH_MODE,
      searchHybridAlpha: 0.6,
      searchHybridBeta: 0.4,
      searchDefaultLimit: 20,
      searchTypeWeights: { ...DEFAULT_SEARCH_TYPE_WEIGHTS },
      searchRecencyHalfLifeDays: 14,
      searchSubpathBoostWeight: defaultMonorepoSubpathBoostWeight,
      bundleTokenBudgetTotal: defaultBundleTokenBudgetTotal,
      bundleBudgetGlobalWorkspacePct: defaultBundleBudgetGlobalWorkspacePct,
      bundleBudgetGlobalUserPct: defaultBundleBudgetGlobalUserPct,
      bundleBudgetProjectPct: defaultBundleBudgetProjectPct,
      bundleBudgetRetrievalPct: defaultBundleBudgetRetrievalPct,
      globalRulesRecommendMax: defaultGlobalRulesRecommendMax,
      globalRulesWarnThreshold: defaultGlobalRulesWarnThreshold,
      globalRulesSummaryEnabled: true,
      globalRulesSummaryMinCount: defaultGlobalRulesSummaryMinCount,
      globalRulesSelectionMode: 'score',
      globalRulesRoutingEnabled: true,
      globalRulesRoutingMode: 'hybrid',
      globalRulesRoutingTopK: defaultGlobalRulesRoutingTopK,
      globalRulesRoutingMinScore: defaultGlobalRulesRoutingMinScore,
      personaWeights: parsePersonaWeights(DEFAULT_PERSONA_WEIGHTS),
      githubProjectKeyPrefix: DEFAULT_GITHUB_PREFIX,
      githubKeyPrefix: DEFAULT_GITHUB_PREFIX,
      localKeyPrefix: DEFAULT_LOCAL_PREFIX,
      autoCreateProjectSubprojects: true,
      enableMonorepoResolution: false,
      monorepoDetectionLevel: DEFAULT_MONOREPO_DETECTION_LEVEL,
      monorepoMode: DEFAULT_MONOREPO_MODE,
      monorepoContextMode: DEFAULT_MONOREPO_CONTEXT_MODE,
      monorepoSubpathMetadataEnabled: true,
      monorepoSubpathBoostEnabled: true,
      monorepoSubpathBoostWeight: defaultMonorepoSubpathBoostWeight,
      monorepoRootMarkers: DEFAULT_MONOREPO_ROOT_MARKERS,
      monorepoWorkspaceGlobs: DEFAULT_MONOREPO_GLOBS,
      monorepoExcludeGlobs: DEFAULT_MONOREPO_EXCLUDE_GLOBS,
      monorepoMaxDepth: DEFAULT_MONOREPO_MAX_DEPTH,
      defaultOutboundLocale: DEFAULT_OUTBOUND_LOCALE,
      supportedOutboundLocales: DEFAULT_SUPPORTED_OUTBOUND_LOCALES,
      enableActivityAutoLog: true,
      enableDecisionExtraction: true,
      decisionExtractionMode: 'llm_only',
      decisionDefaultStatus: 'draft',
      decisionAutoConfirmEnabled: false,
      decisionAutoConfirmMinConfidence: 0.9,
      decisionBatchSize: 25,
      decisionBackfillDays: 30,
      activeWorkStaleDays: 14,
      activeWorkAutoCloseEnabled: false,
      activeWorkAutoCloseDays: 45,
      rawAccessMinRole: 'WRITER',
      retentionPolicyEnabled: false,
      auditRetentionDays: 365,
      rawRetentionDays: 90,
      retentionMode: 'archive',
      securityStreamEnabled: true,
      securityStreamSinkId: null,
      securityStreamMinSeverity: 'medium',
      oidcSyncMode: OidcSyncMode.add_only,
      oidcAllowAutoProvision: true,
    };
  }
  return {
    resolutionOrder: parseResolutionOrder(settings.resolutionOrder),
    autoCreateProject: settings.autoCreateProject,
    autoCreateProjectSubprojects: settings.autoCreateProjectSubprojects,
    githubAutoCreateProjects: settings.githubAutoCreateProjects ?? settings.autoCreateProject ?? true,
    githubAutoCreateSubprojects:
      settings.githubAutoCreateSubprojects ?? settings.autoCreateProjectSubprojects ?? false,
    githubPermissionSyncEnabled: settings.githubPermissionSyncEnabled ?? false,
    githubPermissionSyncMode: parseGithubPermissionSyncMode(settings.githubPermissionSyncMode),
    githubCacheTtlSeconds: parseGithubCacheTtlSeconds(settings.githubCacheTtlSeconds, 900),
    githubRoleMapping: parseGithubRoleMapping(settings.githubRoleMapping),
    githubWebhookEnabled: settings.githubWebhookEnabled ?? false,
    githubWebhookSyncMode: parseGithubPermissionSyncMode(
      settings.githubWebhookSyncMode ?? DEFAULT_GITHUB_WEBHOOK_SYNC_MODE
    ),
    githubTeamMappingEnabled: settings.githubTeamMappingEnabled ?? true,
    autoSwitchRepo: settings.autoSwitchRepo,
    autoSwitchSubproject: settings.autoSwitchSubproject,
    allowManualPin: settings.allowManualPin,
    enableGitEvents: settings.enableGitEvents,
    enableCommitEvents: settings.enableCommitEvents,
    enableMergeEvents: settings.enableMergeEvents,
    enableCheckoutEvents: settings.enableCheckoutEvents,
    checkoutDebounceSeconds: parseNonNegativeInt(
      settings.checkoutDebounceSeconds,
      defaultCheckoutDebounceSeconds
    ),
    checkoutDailyLimit: parsePositiveInt(settings.checkoutDailyLimit, defaultCheckoutDailyLimit),
    enableAutoExtraction: settings.enableAutoExtraction,
    autoExtractionMode: settings.autoExtractionMode || DEFAULT_AUTO_EXTRACT_MODE,
    autoConfirmMinConfidence: Math.min(
      Math.max(Number(settings.autoConfirmMinConfidence ?? 0.85), 0),
      1
    ),
    autoConfirmAllowedEventTypes: parseStringArray(
      settings.autoConfirmAllowedEventTypes,
      [...defaultAutoConfirmAllowedEventTypes]
    ),
    autoConfirmKeywordAllowlist: parseStringArray(
      settings.autoConfirmKeywordAllowlist,
      [...defaultAutoConfirmKeywordAllowlist]
    ),
    autoConfirmKeywordDenylist: parseStringArray(
      settings.autoConfirmKeywordDenylist,
      [...defaultAutoConfirmKeywordDenylist]
    ),
    autoExtractionBatchSize: parsePositiveInt(settings.autoExtractionBatchSize, 20),
    searchDefaultMode: settings.searchDefaultMode || DEFAULT_SEARCH_MODE,
    searchHybridAlpha: Math.min(Math.max(Number(settings.searchHybridAlpha ?? 0.6), 0), 1),
    searchHybridBeta: Math.min(Math.max(Number(settings.searchHybridBeta ?? 0.4), 0), 1),
    searchDefaultLimit: parsePositiveInt(settings.searchDefaultLimit, 20),
    searchTypeWeights: parseSearchTypeWeights(settings.searchTypeWeights),
    searchRecencyHalfLifeDays: Math.min(
      Math.max(Number(settings.searchRecencyHalfLifeDays ?? 14), 1),
      3650
    ),
    searchSubpathBoostWeight: Math.min(
      Math.max(Number(settings.searchSubpathBoostWeight ?? defaultMonorepoSubpathBoostWeight), 1),
      10
    ),
    bundleTokenBudgetTotal: parsePositiveInt(
      settings.bundleTokenBudgetTotal,
      defaultBundleTokenBudgetTotal
    ),
    bundleBudgetGlobalWorkspacePct: Math.min(
      Math.max(
        Number(settings.bundleBudgetGlobalWorkspacePct ?? defaultBundleBudgetGlobalWorkspacePct),
        0
      ),
      1
    ),
    bundleBudgetGlobalUserPct: Math.min(
      Math.max(Number(settings.bundleBudgetGlobalUserPct ?? defaultBundleBudgetGlobalUserPct), 0),
      1
    ),
    bundleBudgetProjectPct: Math.min(
      Math.max(Number(settings.bundleBudgetProjectPct ?? defaultBundleBudgetProjectPct), 0),
      1
    ),
    bundleBudgetRetrievalPct: Math.min(
      Math.max(Number(settings.bundleBudgetRetrievalPct ?? defaultBundleBudgetRetrievalPct), 0),
      1
    ),
    globalRulesRecommendMax: parsePositiveInt(
      settings.globalRulesRecommendMax,
      defaultGlobalRulesRecommendMax
    ),
    globalRulesWarnThreshold: parsePositiveInt(
      settings.globalRulesWarnThreshold,
      defaultGlobalRulesWarnThreshold
    ),
    globalRulesSummaryEnabled: settings.globalRulesSummaryEnabled ?? true,
    globalRulesSummaryMinCount: parsePositiveInt(
      settings.globalRulesSummaryMinCount,
      defaultGlobalRulesSummaryMinCount
    ),
    globalRulesSelectionMode: parseGlobalRulesSelectionMode(settings.globalRulesSelectionMode),
    globalRulesRoutingEnabled: settings.globalRulesRoutingEnabled ?? true,
    globalRulesRoutingMode: parseGlobalRulesRoutingMode(settings.globalRulesRoutingMode),
    globalRulesRoutingTopK: Math.min(
      Math.max(
        parsePositiveInt(settings.globalRulesRoutingTopK, defaultGlobalRulesRoutingTopK),
        1
      ),
      100
    ),
    globalRulesRoutingMinScore: clampFloat(
      Number(settings.globalRulesRoutingMinScore ?? defaultGlobalRulesRoutingMinScore),
      defaultGlobalRulesRoutingMinScore,
      0,
      1
    ),
    personaWeights: parsePersonaWeights(settings.personaWeights),
    githubProjectKeyPrefix:
      settings.githubProjectKeyPrefix ||
      settings.githubKeyPrefix ||
      DEFAULT_GITHUB_PREFIX,
    githubKeyPrefix: settings.githubKeyPrefix || settings.githubProjectKeyPrefix || DEFAULT_GITHUB_PREFIX,
    localKeyPrefix: settings.localKeyPrefix || DEFAULT_LOCAL_PREFIX,
    enableMonorepoResolution: settings.enableMonorepoResolution,
    monorepoDetectionLevel: parseDetectionLevel(
      settings.monorepoDetectionLevel,
      DEFAULT_MONOREPO_DETECTION_LEVEL
    ),
    monorepoMode: parseMonorepoMode(settings.monorepoMode),
    monorepoContextMode: parseMonorepoContextMode(settings.monorepoContextMode),
    monorepoSubpathMetadataEnabled: settings.monorepoSubpathMetadataEnabled ?? true,
    monorepoSubpathBoostEnabled: settings.monorepoSubpathBoostEnabled ?? true,
    monorepoSubpathBoostWeight: Math.min(
      Math.max(Number(settings.monorepoSubpathBoostWeight ?? defaultMonorepoSubpathBoostWeight), 1),
      10
    ),
    monorepoRootMarkers: parseStringArray(
      settings.monorepoRootMarkers,
      DEFAULT_MONOREPO_ROOT_MARKERS
    ),
    monorepoWorkspaceGlobs: parseStringArray(
      settings.monorepoWorkspaceGlobs,
      DEFAULT_MONOREPO_GLOBS
    ),
    monorepoExcludeGlobs: parseStringArray(
      settings.monorepoExcludeGlobs,
      DEFAULT_MONOREPO_EXCLUDE_GLOBS
    ),
    monorepoMaxDepth: parsePositiveInt(settings.monorepoMaxDepth, DEFAULT_MONOREPO_MAX_DEPTH),
    defaultOutboundLocale: parseOutboundLocale(
      settings.defaultOutboundLocale,
      DEFAULT_OUTBOUND_LOCALE
    ),
    supportedOutboundLocales: parseOutboundLocaleArray(
      settings.supportedOutboundLocales,
      DEFAULT_SUPPORTED_OUTBOUND_LOCALES
    ),
    enableActivityAutoLog: settings.enableActivityAutoLog ?? true,
    enableDecisionExtraction: settings.enableDecisionExtraction ?? true,
    decisionExtractionMode: settings.decisionExtractionMode ?? 'llm_only',
    decisionDefaultStatus: settings.decisionDefaultStatus ?? 'draft',
    decisionAutoConfirmEnabled: settings.decisionAutoConfirmEnabled ?? false,
    decisionAutoConfirmMinConfidence: Math.min(
      Math.max(Number(settings.decisionAutoConfirmMinConfidence ?? 0.9), 0),
      1
    ),
    decisionBatchSize: parsePositiveInt(settings.decisionBatchSize, 25),
    decisionBackfillDays: parsePositiveInt(settings.decisionBackfillDays, 30),
    activeWorkStaleDays: parsePositiveInt(settings.activeWorkStaleDays, 14),
    activeWorkAutoCloseEnabled: settings.activeWorkAutoCloseEnabled ?? false,
    activeWorkAutoCloseDays: parsePositiveInt(settings.activeWorkAutoCloseDays, 45),
    rawAccessMinRole: parseProjectRole(settings.rawAccessMinRole, 'WRITER'),
    retentionPolicyEnabled: settings.retentionPolicyEnabled ?? false,
    auditRetentionDays: parsePositiveInt(settings.auditRetentionDays, 365),
    rawRetentionDays: parsePositiveInt(settings.rawRetentionDays, 90),
    retentionMode: parseRetentionMode(settings.retentionMode ?? DEFAULT_RETENTION_MODE),
    securityStreamEnabled: settings.securityStreamEnabled ?? true,
    securityStreamSinkId: settings.securityStreamSinkId || null,
    securityStreamMinSeverity: parseSecuritySeverity(settings.securityStreamMinSeverity),
    oidcSyncMode: settings.oidcSyncMode ?? OidcSyncMode.add_only,
    oidcAllowAutoProvision: settings.oidcAllowAutoProvision ?? true,
  };
}
