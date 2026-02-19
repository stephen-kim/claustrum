import type { PrismaClient } from '@prisma/client';
import { workspaceSettingsSchema } from '@claustrum/shared';
import type { AuthContext } from '../../auth.js';
import { assertWorkspaceAdmin } from '../access-control.js';
import { diffFields, normalizeReason } from '../audit-utils.js';
import { ValidationError } from '../errors.js';
import { getEffectiveWorkspaceSettings, parseResolutionOrder } from '../workspace-resolution.js';

export async function updateWorkspaceSettingsWithAudit(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspace: { id: string; key: string };
  input: unknown;
  recordAudit: (args: {
    workspaceId: string;
    projectId?: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
  }) => Promise<void>;
}) {
  await assertWorkspaceAdmin(args.prisma, args.auth, args.workspace.id);
  const current = await getEffectiveWorkspaceSettings(args.prisma, args.workspace.id);
  const rawInput = (args.input || {}) as Record<string, unknown>;
  const reason = normalizeReason(rawInput.reason);
  const parsed = workspaceSettingsSchema.safeParse({
    workspace_key: args.workspace.key,
    resolution_order: rawInput.resolution_order ?? current.resolutionOrder,
    auto_create_project: rawInput.auto_create_project ?? current.autoCreateProject,
    auto_create_project_subprojects:
      rawInput.auto_create_project_subprojects ?? current.autoCreateProjectSubprojects,
    auto_switch_repo: rawInput.auto_switch_repo ?? current.autoSwitchRepo,
    auto_switch_subproject: rawInput.auto_switch_subproject ?? current.autoSwitchSubproject,
    allow_manual_pin: rawInput.allow_manual_pin ?? current.allowManualPin,
    enable_git_events: rawInput.enable_git_events ?? current.enableGitEvents,
    enable_commit_events: rawInput.enable_commit_events ?? current.enableCommitEvents,
    enable_merge_events: rawInput.enable_merge_events ?? current.enableMergeEvents,
    enable_checkout_events: rawInput.enable_checkout_events ?? current.enableCheckoutEvents,
    checkout_debounce_seconds: rawInput.checkout_debounce_seconds ?? current.checkoutDebounceSeconds,
    checkout_daily_limit: rawInput.checkout_daily_limit ?? current.checkoutDailyLimit,
    enable_auto_extraction: rawInput.enable_auto_extraction ?? current.enableAutoExtraction,
    auto_extraction_mode: rawInput.auto_extraction_mode ?? current.autoExtractionMode,
    auto_confirm_min_confidence:
      rawInput.auto_confirm_min_confidence ?? current.autoConfirmMinConfidence,
    auto_confirm_allowed_event_types:
      rawInput.auto_confirm_allowed_event_types ?? current.autoConfirmAllowedEventTypes,
    auto_confirm_keyword_allowlist:
      rawInput.auto_confirm_keyword_allowlist ?? current.autoConfirmKeywordAllowlist,
    auto_confirm_keyword_denylist:
      rawInput.auto_confirm_keyword_denylist ?? current.autoConfirmKeywordDenylist,
    auto_extraction_batch_size: rawInput.auto_extraction_batch_size ?? current.autoExtractionBatchSize,
    search_default_mode: rawInput.search_default_mode ?? current.searchDefaultMode,
    search_hybrid_alpha: rawInput.search_hybrid_alpha ?? current.searchHybridAlpha,
    search_hybrid_beta: rawInput.search_hybrid_beta ?? current.searchHybridBeta,
    search_default_limit: rawInput.search_default_limit ?? current.searchDefaultLimit,
    search_type_weights: rawInput.search_type_weights ?? current.searchTypeWeights,
    search_recency_half_life_days:
      rawInput.search_recency_half_life_days ?? current.searchRecencyHalfLifeDays,
    search_subpath_boost_weight:
      rawInput.search_subpath_boost_weight ?? current.searchSubpathBoostWeight,
    bundle_token_budget_total:
      rawInput.bundle_token_budget_total ?? current.bundleTokenBudgetTotal,
    bundle_budget_global_workspace_pct:
      rawInput.bundle_budget_global_workspace_pct ?? current.bundleBudgetGlobalWorkspacePct,
    bundle_budget_global_user_pct:
      rawInput.bundle_budget_global_user_pct ?? current.bundleBudgetGlobalUserPct,
    bundle_budget_project_pct:
      rawInput.bundle_budget_project_pct ?? current.bundleBudgetProjectPct,
    bundle_budget_retrieval_pct:
      rawInput.bundle_budget_retrieval_pct ?? current.bundleBudgetRetrievalPct,
    global_rules_recommend_max:
      rawInput.global_rules_recommend_max ?? current.globalRulesRecommendMax,
    global_rules_warn_threshold:
      rawInput.global_rules_warn_threshold ?? current.globalRulesWarnThreshold,
    global_rules_summary_enabled:
      rawInput.global_rules_summary_enabled ?? current.globalRulesSummaryEnabled,
    global_rules_summary_min_count:
      rawInput.global_rules_summary_min_count ?? current.globalRulesSummaryMinCount,
    global_rules_selection_mode:
      rawInput.global_rules_selection_mode ?? current.globalRulesSelectionMode,
    global_rules_routing_enabled:
      rawInput.global_rules_routing_enabled ?? current.globalRulesRoutingEnabled,
    global_rules_routing_mode:
      rawInput.global_rules_routing_mode ?? current.globalRulesRoutingMode,
    global_rules_routing_top_k:
      rawInput.global_rules_routing_top_k ?? current.globalRulesRoutingTopK,
    global_rules_routing_min_score:
      rawInput.global_rules_routing_min_score ?? current.globalRulesRoutingMinScore,
    persona_weights: rawInput.persona_weights ?? current.personaWeights,
    github_auto_create_projects:
      rawInput.github_auto_create_projects ?? current.githubAutoCreateProjects,
    github_auto_create_subprojects:
      rawInput.github_auto_create_subprojects ?? current.githubAutoCreateSubprojects,
    github_permission_sync_enabled:
      rawInput.github_permission_sync_enabled ?? current.githubPermissionSyncEnabled,
    github_permission_sync_mode:
      rawInput.github_permission_sync_mode ?? current.githubPermissionSyncMode,
    github_cache_ttl_seconds:
      rawInput.github_cache_ttl_seconds ?? current.githubCacheTtlSeconds,
    github_role_mapping:
      rawInput.github_role_mapping ?? current.githubRoleMapping,
    github_webhook_enabled:
      rawInput.github_webhook_enabled ?? current.githubWebhookEnabled,
    github_webhook_sync_mode:
      rawInput.github_webhook_sync_mode ?? current.githubWebhookSyncMode,
    github_team_mapping_enabled:
      rawInput.github_team_mapping_enabled ?? current.githubTeamMappingEnabled,
    github_project_key_prefix:
      rawInput.github_project_key_prefix ?? rawInput.github_key_prefix ?? current.githubProjectKeyPrefix,
    github_key_prefix:
      rawInput.github_key_prefix ?? rawInput.github_project_key_prefix ?? current.githubProjectKeyPrefix,
    local_key_prefix: rawInput.local_key_prefix ?? current.localKeyPrefix,
    enable_monorepo_resolution:
      rawInput.enable_monorepo_resolution ?? current.enableMonorepoResolution,
    monorepo_detection_level: rawInput.monorepo_detection_level ?? current.monorepoDetectionLevel,
    monorepo_mode: rawInput.monorepo_mode ?? current.monorepoMode,
    monorepo_context_mode: rawInput.monorepo_context_mode ?? current.monorepoContextMode,
    monorepo_subpath_metadata_enabled:
      rawInput.monorepo_subpath_metadata_enabled ?? current.monorepoSubpathMetadataEnabled,
    monorepo_subpath_boost_enabled:
      rawInput.monorepo_subpath_boost_enabled ?? current.monorepoSubpathBoostEnabled,
    monorepo_subpath_boost_weight:
      rawInput.monorepo_subpath_boost_weight ?? current.monorepoSubpathBoostWeight,
    monorepo_root_markers: rawInput.monorepo_root_markers ?? current.monorepoRootMarkers,
    monorepo_workspace_globs:
      rawInput.monorepo_workspace_globs ?? current.monorepoWorkspaceGlobs,
    monorepo_exclude_globs: rawInput.monorepo_exclude_globs ?? current.monorepoExcludeGlobs,
    monorepo_max_depth: rawInput.monorepo_max_depth ?? current.monorepoMaxDepth,
    default_outbound_locale: rawInput.default_outbound_locale ?? current.defaultOutboundLocale,
    supported_outbound_locales:
      rawInput.supported_outbound_locales ?? current.supportedOutboundLocales,
    enable_activity_auto_log: rawInput.enable_activity_auto_log ?? current.enableActivityAutoLog,
    enable_decision_extraction:
      rawInput.enable_decision_extraction ?? current.enableDecisionExtraction,
    decision_extraction_mode:
      rawInput.decision_extraction_mode ?? current.decisionExtractionMode,
    decision_default_status: rawInput.decision_default_status ?? current.decisionDefaultStatus,
    decision_auto_confirm_enabled:
      rawInput.decision_auto_confirm_enabled ?? current.decisionAutoConfirmEnabled,
    decision_auto_confirm_min_confidence:
      rawInput.decision_auto_confirm_min_confidence ?? current.decisionAutoConfirmMinConfidence,
    decision_batch_size: rawInput.decision_batch_size ?? current.decisionBatchSize,
    decision_backfill_days: rawInput.decision_backfill_days ?? current.decisionBackfillDays,
    active_work_stale_days: rawInput.active_work_stale_days ?? current.activeWorkStaleDays,
    active_work_auto_close_enabled:
      rawInput.active_work_auto_close_enabled ?? current.activeWorkAutoCloseEnabled,
    active_work_auto_close_days:
      rawInput.active_work_auto_close_days ?? current.activeWorkAutoCloseDays,
    raw_access_min_role: rawInput.raw_access_min_role ?? current.rawAccessMinRole,
    retention_policy_enabled:
      rawInput.retention_policy_enabled ?? current.retentionPolicyEnabled,
    audit_retention_days: rawInput.audit_retention_days ?? current.auditRetentionDays,
    raw_retention_days: rawInput.raw_retention_days ?? current.rawRetentionDays,
    retention_mode: rawInput.retention_mode ?? current.retentionMode,
    security_stream_enabled:
      rawInput.security_stream_enabled ?? current.securityStreamEnabled,
    security_stream_sink_id:
      rawInput.security_stream_sink_id ?? current.securityStreamSinkId,
    security_stream_min_severity:
      rawInput.security_stream_min_severity ?? current.securityStreamMinSeverity,
    oidc_sync_mode: rawInput.oidc_sync_mode ?? current.oidcSyncMode,
    oidc_allow_auto_provision:
      rawInput.oidc_allow_auto_provision ?? current.oidcAllowAutoProvision,
  });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(', '));
  }
  if (parsed.data.security_stream_sink_id) {
    const sink = await args.prisma.auditSink.findFirst({
      where: {
        id: parsed.data.security_stream_sink_id,
        workspaceId: args.workspace.id,
      },
      select: { id: true },
    });
    if (!sink) {
      throw new ValidationError('security_stream_sink_id must belong to this workspace.');
    }
  }

  const workspaceSettingsData = {
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
    searchTypeWeights: parsed.data.search_type_weights,
    searchRecencyHalfLifeDays: parsed.data.search_recency_half_life_days,
    searchSubpathBoostWeight: parsed.data.search_subpath_boost_weight,
    bundleTokenBudgetTotal: parsed.data.bundle_token_budget_total,
    bundleBudgetGlobalWorkspacePct: parsed.data.bundle_budget_global_workspace_pct,
    bundleBudgetGlobalUserPct: parsed.data.bundle_budget_global_user_pct,
    bundleBudgetProjectPct: parsed.data.bundle_budget_project_pct,
    bundleBudgetRetrievalPct: parsed.data.bundle_budget_retrieval_pct,
    globalRulesRecommendMax: parsed.data.global_rules_recommend_max,
    globalRulesWarnThreshold: parsed.data.global_rules_warn_threshold,
    globalRulesSummaryEnabled: parsed.data.global_rules_summary_enabled,
    globalRulesSummaryMinCount: parsed.data.global_rules_summary_min_count,
    globalRulesSelectionMode: parsed.data.global_rules_selection_mode,
    globalRulesRoutingEnabled: parsed.data.global_rules_routing_enabled,
    globalRulesRoutingMode: parsed.data.global_rules_routing_mode,
    globalRulesRoutingTopK: parsed.data.global_rules_routing_top_k,
    globalRulesRoutingMinScore: parsed.data.global_rules_routing_min_score,
    personaWeights: parsed.data.persona_weights,
    githubAutoCreateProjects: parsed.data.github_auto_create_projects,
    githubAutoCreateSubprojects: parsed.data.github_auto_create_subprojects,
    githubPermissionSyncEnabled: parsed.data.github_permission_sync_enabled,
    githubPermissionSyncMode: parsed.data.github_permission_sync_mode,
    githubCacheTtlSeconds: parsed.data.github_cache_ttl_seconds,
    githubRoleMapping: parsed.data.github_role_mapping,
    githubWebhookEnabled: parsed.data.github_webhook_enabled,
    githubWebhookSyncMode: parsed.data.github_webhook_sync_mode,
    githubTeamMappingEnabled: parsed.data.github_team_mapping_enabled,
    githubProjectKeyPrefix: parsed.data.github_project_key_prefix,
    githubKeyPrefix: parsed.data.github_project_key_prefix,
    localKeyPrefix: parsed.data.local_key_prefix,
    enableMonorepoResolution: parsed.data.enable_monorepo_resolution,
    monorepoDetectionLevel: parsed.data.monorepo_detection_level,
    monorepoMode: parsed.data.monorepo_mode,
    monorepoContextMode: parsed.data.monorepo_context_mode,
    monorepoSubpathMetadataEnabled: parsed.data.monorepo_subpath_metadata_enabled,
    monorepoSubpathBoostEnabled: parsed.data.monorepo_subpath_boost_enabled,
    monorepoSubpathBoostWeight: parsed.data.monorepo_subpath_boost_weight,
    monorepoRootMarkers: parsed.data.monorepo_root_markers,
    monorepoWorkspaceGlobs: parsed.data.monorepo_workspace_globs,
    monorepoExcludeGlobs: parsed.data.monorepo_exclude_globs,
    monorepoMaxDepth: parsed.data.monorepo_max_depth,
    defaultOutboundLocale: parsed.data.default_outbound_locale,
    supportedOutboundLocales: parsed.data.supported_outbound_locales,
    enableActivityAutoLog: parsed.data.enable_activity_auto_log,
    enableDecisionExtraction: parsed.data.enable_decision_extraction,
    decisionExtractionMode: parsed.data.decision_extraction_mode,
    decisionDefaultStatus: parsed.data.decision_default_status,
    decisionAutoConfirmEnabled: parsed.data.decision_auto_confirm_enabled,
    decisionAutoConfirmMinConfidence: parsed.data.decision_auto_confirm_min_confidence,
    decisionBatchSize: parsed.data.decision_batch_size,
    decisionBackfillDays: parsed.data.decision_backfill_days,
    activeWorkStaleDays: parsed.data.active_work_stale_days,
    activeWorkAutoCloseEnabled: parsed.data.active_work_auto_close_enabled,
    activeWorkAutoCloseDays: parsed.data.active_work_auto_close_days,
    rawAccessMinRole: parsed.data.raw_access_min_role,
    retentionPolicyEnabled: parsed.data.retention_policy_enabled,
    auditRetentionDays: parsed.data.audit_retention_days,
    rawRetentionDays: parsed.data.raw_retention_days,
    retentionMode: parsed.data.retention_mode,
    securityStreamEnabled: parsed.data.security_stream_enabled,
    securityStreamSinkId: parsed.data.security_stream_sink_id || null,
    securityStreamMinSeverity: parsed.data.security_stream_min_severity,
    oidcSyncMode: parsed.data.oidc_sync_mode,
    oidcAllowAutoProvision: parsed.data.oidc_allow_auto_provision,
  };

  const settings = await args.prisma.workspaceSettings.upsert({
    where: { workspaceId: args.workspace.id },
    update: workspaceSettingsData,
    create: {
      workspaceId: args.workspace.id,
      ...workspaceSettingsData,
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
    search_type_weights: settings.searchTypeWeights,
    search_recency_half_life_days: settings.searchRecencyHalfLifeDays,
    search_subpath_boost_weight: settings.searchSubpathBoostWeight,
    bundle_token_budget_total: settings.bundleTokenBudgetTotal,
    bundle_budget_global_workspace_pct: settings.bundleBudgetGlobalWorkspacePct,
    bundle_budget_global_user_pct: settings.bundleBudgetGlobalUserPct,
    bundle_budget_project_pct: settings.bundleBudgetProjectPct,
    bundle_budget_retrieval_pct: settings.bundleBudgetRetrievalPct,
    global_rules_recommend_max: settings.globalRulesRecommendMax,
    global_rules_warn_threshold: settings.globalRulesWarnThreshold,
    global_rules_summary_enabled: settings.globalRulesSummaryEnabled,
    global_rules_summary_min_count: settings.globalRulesSummaryMinCount,
    global_rules_selection_mode: settings.globalRulesSelectionMode,
    global_rules_routing_enabled: settings.globalRulesRoutingEnabled,
    global_rules_routing_mode: settings.globalRulesRoutingMode,
    global_rules_routing_top_k: settings.globalRulesRoutingTopK,
    global_rules_routing_min_score: settings.globalRulesRoutingMinScore,
    persona_weights: settings.personaWeights,
    github_auto_create_projects: settings.githubAutoCreateProjects,
    github_auto_create_subprojects: settings.githubAutoCreateSubprojects,
    github_permission_sync_enabled: settings.githubPermissionSyncEnabled,
    github_permission_sync_mode: settings.githubPermissionSyncMode,
    github_cache_ttl_seconds: settings.githubCacheTtlSeconds,
    github_role_mapping: settings.githubRoleMapping,
    github_webhook_enabled: settings.githubWebhookEnabled,
    github_webhook_sync_mode: settings.githubWebhookSyncMode,
    github_team_mapping_enabled: settings.githubTeamMappingEnabled,
    github_project_key_prefix: settings.githubProjectKeyPrefix,
    github_key_prefix: settings.githubKeyPrefix,
    local_key_prefix: settings.localKeyPrefix,
    enable_monorepo_resolution: settings.enableMonorepoResolution,
    monorepo_detection_level: settings.monorepoDetectionLevel,
    monorepo_mode: settings.monorepoMode,
    monorepo_context_mode: settings.monorepoContextMode,
    monorepo_subpath_metadata_enabled: settings.monorepoSubpathMetadataEnabled,
    monorepo_subpath_boost_enabled: settings.monorepoSubpathBoostEnabled,
    monorepo_subpath_boost_weight: settings.monorepoSubpathBoostWeight,
    monorepo_root_markers: settings.monorepoRootMarkers,
    monorepo_workspace_globs: settings.monorepoWorkspaceGlobs,
    monorepo_exclude_globs: settings.monorepoExcludeGlobs,
    monorepo_max_depth: settings.monorepoMaxDepth,
    default_outbound_locale: settings.defaultOutboundLocale,
    supported_outbound_locales: settings.supportedOutboundLocales,
    enable_activity_auto_log: settings.enableActivityAutoLog,
    enable_decision_extraction: settings.enableDecisionExtraction,
    decision_extraction_mode: settings.decisionExtractionMode,
    decision_default_status: settings.decisionDefaultStatus,
    decision_auto_confirm_enabled: settings.decisionAutoConfirmEnabled,
    decision_auto_confirm_min_confidence: settings.decisionAutoConfirmMinConfidence,
    decision_batch_size: settings.decisionBatchSize,
    decision_backfill_days: settings.decisionBackfillDays,
    active_work_stale_days: settings.activeWorkStaleDays,
    active_work_auto_close_enabled: settings.activeWorkAutoCloseEnabled,
    active_work_auto_close_days: settings.activeWorkAutoCloseDays,
    raw_access_min_role: settings.rawAccessMinRole,
    retention_policy_enabled: settings.retentionPolicyEnabled,
    audit_retention_days: settings.auditRetentionDays,
    raw_retention_days: settings.rawRetentionDays,
    retention_mode: settings.retentionMode,
    security_stream_enabled: settings.securityStreamEnabled,
    security_stream_sink_id: settings.securityStreamSinkId,
    security_stream_min_severity: settings.securityStreamMinSeverity,
    oidc_sync_mode: settings.oidcSyncMode,
    oidc_allow_auto_provision: settings.oidcAllowAutoProvision,
  };

  const currentSettings = buildWorkspaceSettingsAuditSnapshot(current);
  const changedFields = diffFields(currentSettings, nextSettings);
  await args.recordAudit({
    workspaceId: args.workspace.id,
    workspaceKey: args.workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'workspace_settings.update',
    target: {
      workspace_key: args.workspace.key,
      reason,
      changed_fields: changedFields,
      before: currentSettings,
      after: nextSettings,
    },
  });

  return {
    workspace_key: args.workspace.key,
    ...nextSettings,
  };
}

function buildWorkspaceSettingsAuditSnapshot(settings: Awaited<ReturnType<typeof getEffectiveWorkspaceSettings>>) {
  return {
    resolution_order: settings.resolutionOrder,
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
    search_type_weights: settings.searchTypeWeights,
    search_recency_half_life_days: settings.searchRecencyHalfLifeDays,
    search_subpath_boost_weight: settings.searchSubpathBoostWeight,
    bundle_token_budget_total: settings.bundleTokenBudgetTotal,
    bundle_budget_global_workspace_pct: settings.bundleBudgetGlobalWorkspacePct,
    bundle_budget_global_user_pct: settings.bundleBudgetGlobalUserPct,
    bundle_budget_project_pct: settings.bundleBudgetProjectPct,
    bundle_budget_retrieval_pct: settings.bundleBudgetRetrievalPct,
    global_rules_recommend_max: settings.globalRulesRecommendMax,
    global_rules_warn_threshold: settings.globalRulesWarnThreshold,
    global_rules_summary_enabled: settings.globalRulesSummaryEnabled,
    global_rules_summary_min_count: settings.globalRulesSummaryMinCount,
    global_rules_selection_mode: settings.globalRulesSelectionMode,
    global_rules_routing_enabled: settings.globalRulesRoutingEnabled,
    global_rules_routing_mode: settings.globalRulesRoutingMode,
    global_rules_routing_top_k: settings.globalRulesRoutingTopK,
    global_rules_routing_min_score: settings.globalRulesRoutingMinScore,
    persona_weights: settings.personaWeights,
    github_auto_create_projects: settings.githubAutoCreateProjects,
    github_auto_create_subprojects: settings.githubAutoCreateSubprojects,
    github_permission_sync_enabled: settings.githubPermissionSyncEnabled,
    github_permission_sync_mode: settings.githubPermissionSyncMode,
    github_cache_ttl_seconds: settings.githubCacheTtlSeconds,
    github_role_mapping: settings.githubRoleMapping,
    github_webhook_enabled: settings.githubWebhookEnabled,
    github_webhook_sync_mode: settings.githubWebhookSyncMode,
    github_team_mapping_enabled: settings.githubTeamMappingEnabled,
    github_project_key_prefix: settings.githubProjectKeyPrefix,
    github_key_prefix: settings.githubKeyPrefix,
    local_key_prefix: settings.localKeyPrefix,
    enable_monorepo_resolution: settings.enableMonorepoResolution,
    monorepo_detection_level: settings.monorepoDetectionLevel,
    monorepo_mode: settings.monorepoMode,
    monorepo_context_mode: settings.monorepoContextMode,
    monorepo_subpath_metadata_enabled: settings.monorepoSubpathMetadataEnabled,
    monorepo_subpath_boost_enabled: settings.monorepoSubpathBoostEnabled,
    monorepo_subpath_boost_weight: settings.monorepoSubpathBoostWeight,
    monorepo_root_markers: settings.monorepoRootMarkers,
    monorepo_workspace_globs: settings.monorepoWorkspaceGlobs,
    monorepo_exclude_globs: settings.monorepoExcludeGlobs,
    monorepo_max_depth: settings.monorepoMaxDepth,
    default_outbound_locale: settings.defaultOutboundLocale,
    supported_outbound_locales: settings.supportedOutboundLocales,
    enable_activity_auto_log: settings.enableActivityAutoLog,
    enable_decision_extraction: settings.enableDecisionExtraction,
    decision_extraction_mode: settings.decisionExtractionMode,
    decision_default_status: settings.decisionDefaultStatus,
    decision_auto_confirm_enabled: settings.decisionAutoConfirmEnabled,
    decision_auto_confirm_min_confidence: settings.decisionAutoConfirmMinConfidence,
    decision_batch_size: settings.decisionBatchSize,
    decision_backfill_days: settings.decisionBackfillDays,
    active_work_stale_days: settings.activeWorkStaleDays,
    active_work_auto_close_enabled: settings.activeWorkAutoCloseEnabled,
    active_work_auto_close_days: settings.activeWorkAutoCloseDays,
    raw_access_min_role: settings.rawAccessMinRole,
    retention_policy_enabled: settings.retentionPolicyEnabled,
    audit_retention_days: settings.auditRetentionDays,
    raw_retention_days: settings.rawRetentionDays,
    retention_mode: settings.retentionMode,
    security_stream_enabled: settings.securityStreamEnabled,
    security_stream_sink_id: settings.securityStreamSinkId,
    security_stream_min_severity: settings.securityStreamMinSeverity,
    oidc_sync_mode: settings.oidcSyncMode,
    oidc_allow_auto_provision: settings.oidcAllowAutoProvision,
  };
}
