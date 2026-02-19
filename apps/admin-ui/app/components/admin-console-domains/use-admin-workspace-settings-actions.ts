'use client';

import type { WorkspaceSettings } from '../../lib/types';
import type { AdminCallApi } from './types';
import { parseLineSeparatedValues } from './types';
import type { AdminMemorySearchState } from './use-admin-memory-search-state';
import type { AdminWorkspaceProjectState } from './use-admin-workspace-project-state';

type WorkspaceSettingsDeps = {
  callApi: AdminCallApi;
  workspaceState: AdminWorkspaceProjectState;
  memoryState: AdminMemorySearchState;
};

const DEFAULT_SEARCH_TYPE_WEIGHTS = {
  decision: 1.5,
  constraint: 1.35,
  goal: 1.2,
  activity: 1.05,
  active_work: 1.1,
  summary: 1.2,
  note: 1.0,
  problem: 1.0,
  caveat: 0.95,
};

const DEFAULT_GITHUB_ROLE_MAPPING = {
  admin: 'maintainer',
  maintain: 'maintainer',
  write: 'writer',
  triage: 'reader',
  read: 'reader',
};

function parseJsonOrFallback(input: string, fallback: Record<string, unknown>) {
  if (!input.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}

export function createWorkspaceSettingsActions(deps: WorkspaceSettingsDeps) {
  const { callApi, workspaceState, memoryState } = deps;

  async function loadWorkspaceSettings(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const settings = await callApi<WorkspaceSettings>(`/v1/workspace-settings?${query.toString()}`);
    workspaceState.setResolutionOrder(settings.resolution_order);
    workspaceState.setAutoCreateProject(settings.auto_create_project);
    workspaceState.setAutoCreateProjectSubprojects(settings.auto_create_project_subprojects);
    workspaceState.setAutoSwitchRepo(settings.auto_switch_repo ?? true);
    workspaceState.setAutoSwitchSubproject(settings.auto_switch_subproject ?? false);
    workspaceState.setAllowManualPin(settings.allow_manual_pin ?? true);
    workspaceState.setEnableGitEvents(settings.enable_git_events ?? true);
    workspaceState.setEnableCommitEvents(settings.enable_commit_events ?? true);
    workspaceState.setEnableMergeEvents(settings.enable_merge_events ?? true);
    workspaceState.setEnableCheckoutEvents(settings.enable_checkout_events ?? false);
    workspaceState.setCheckoutDebounceSeconds(settings.checkout_debounce_seconds ?? 30);
    workspaceState.setCheckoutDailyLimit(settings.checkout_daily_limit ?? 200);
    memoryState.setEnableActivityAutoLog(settings.enable_activity_auto_log ?? true);
    memoryState.setEnableDecisionExtraction(settings.enable_decision_extraction ?? true);
    memoryState.setDecisionExtractionMode(settings.decision_extraction_mode ?? 'llm_only');
    memoryState.setDecisionDefaultStatus(settings.decision_default_status ?? 'draft');
    memoryState.setDecisionAutoConfirmEnabled(settings.decision_auto_confirm_enabled ?? false);
    memoryState.setDecisionAutoConfirmMinConfidence(settings.decision_auto_confirm_min_confidence ?? 0.9);
    memoryState.setDecisionBatchSize(settings.decision_batch_size ?? 25);
    memoryState.setDecisionBackfillDays(settings.decision_backfill_days ?? 30);
    memoryState.setActiveWorkStaleDays(settings.active_work_stale_days ?? 14);
    memoryState.setActiveWorkAutoCloseEnabled(settings.active_work_auto_close_enabled ?? false);
    memoryState.setActiveWorkAutoCloseDays(settings.active_work_auto_close_days ?? 45);
    memoryState.setRawAccessMinRole(settings.raw_access_min_role ?? 'WRITER');
    workspaceState.setOidcSyncMode(settings.oidc_sync_mode ?? 'add_only');
    workspaceState.setOidcAllowAutoProvision(settings.oidc_allow_auto_provision ?? true);
    workspaceState.setSearchDefaultMode(settings.search_default_mode ?? 'hybrid');
    memoryState.setQueryMode(settings.search_default_mode ?? 'hybrid');
    workspaceState.setSearchHybridAlpha(settings.search_hybrid_alpha ?? 0.6);
    workspaceState.setSearchHybridBeta(settings.search_hybrid_beta ?? 0.4);
    workspaceState.setSearchDefaultLimit(settings.search_default_limit ?? 20);
    workspaceState.setSearchTypeWeightsJson(
      JSON.stringify(settings.search_type_weights || DEFAULT_SEARCH_TYPE_WEIGHTS, null, 2)
    );
    workspaceState.setSearchRecencyHalfLifeDays(settings.search_recency_half_life_days ?? 14);
    workspaceState.setSearchSubpathBoostWeight(settings.search_subpath_boost_weight ?? 1.5);
    workspaceState.setBundleTokenBudgetTotal(settings.bundle_token_budget_total ?? 3000);
    workspaceState.setBundleBudgetGlobalWorkspacePct(settings.bundle_budget_global_workspace_pct ?? 0.15);
    workspaceState.setBundleBudgetGlobalUserPct(settings.bundle_budget_global_user_pct ?? 0.1);
    workspaceState.setBundleBudgetProjectPct(settings.bundle_budget_project_pct ?? 0.45);
    workspaceState.setBundleBudgetRetrievalPct(settings.bundle_budget_retrieval_pct ?? 0.3);
    workspaceState.setGlobalRulesRecommendMax(settings.global_rules_recommend_max ?? 5);
    workspaceState.setGlobalRulesWarnThreshold(settings.global_rules_warn_threshold ?? 10);
    workspaceState.setGlobalRulesSummaryEnabled(settings.global_rules_summary_enabled ?? true);
    workspaceState.setGlobalRulesSummaryMinCount(settings.global_rules_summary_min_count ?? 8);
    workspaceState.setGlobalRulesSelectionMode(settings.global_rules_selection_mode ?? 'score');
    workspaceState.setGlobalRulesRoutingEnabled(settings.global_rules_routing_enabled ?? true);
    workspaceState.setGlobalRulesRoutingMode(settings.global_rules_routing_mode ?? 'hybrid');
    workspaceState.setGlobalRulesRoutingTopK(settings.global_rules_routing_top_k ?? 5);
    workspaceState.setGlobalRulesRoutingMinScore(settings.global_rules_routing_min_score ?? 0.2);
    workspaceState.setRetentionPolicyEnabled(settings.retention_policy_enabled ?? false);
    workspaceState.setAuditRetentionDays(settings.audit_retention_days ?? 365);
    workspaceState.setRawRetentionDays(settings.raw_retention_days ?? 90);
    workspaceState.setRetentionMode(settings.retention_mode ?? 'archive');
    workspaceState.setSecurityStreamEnabled(settings.security_stream_enabled ?? true);
    workspaceState.setSecurityStreamSinkId(settings.security_stream_sink_id || '');
    workspaceState.setSecurityStreamMinSeverity(settings.security_stream_min_severity ?? 'medium');
    workspaceState.setGithubAutoCreateProjects(settings.github_auto_create_projects ?? true);
    workspaceState.setGithubAutoCreateSubprojects(settings.github_auto_create_subprojects ?? false);
    workspaceState.setGithubPermissionSyncEnabled(settings.github_permission_sync_enabled ?? false);
    workspaceState.setGithubPermissionSyncMode(settings.github_permission_sync_mode ?? 'add_only');
    workspaceState.setGithubCacheTtlSeconds(settings.github_cache_ttl_seconds ?? 900);
    workspaceState.setGithubWebhookEnabled(settings.github_webhook_enabled ?? false);
    workspaceState.setGithubWebhookSyncMode(settings.github_webhook_sync_mode ?? 'add_only');
    workspaceState.setGithubTeamMappingEnabled(settings.github_team_mapping_enabled ?? true);
    workspaceState.setGithubRoleMappingJson(
      JSON.stringify(settings.github_role_mapping || DEFAULT_GITHUB_ROLE_MAPPING, null, 2)
    );
    workspaceState.setGithubProjectKeyPrefix(
      settings.github_project_key_prefix ?? settings.github_key_prefix ?? 'github:'
    );
    workspaceState.setGithubPrefix(settings.github_project_key_prefix ?? settings.github_key_prefix ?? 'github:');
    workspaceState.setLocalPrefix(settings.local_key_prefix);
    workspaceState.setEnableMonorepoResolution(settings.enable_monorepo_resolution);
    workspaceState.setMonorepoDetectionLevel(settings.monorepo_detection_level ?? 2);
    workspaceState.setMonorepoMode(settings.monorepo_mode);
    workspaceState.setMonorepoContextMode(settings.monorepo_context_mode ?? 'shared_repo');
    workspaceState.setMonorepoSubpathMetadataEnabled(settings.monorepo_subpath_metadata_enabled ?? true);
    workspaceState.setMonorepoSubpathBoostEnabled(settings.monorepo_subpath_boost_enabled ?? true);
    workspaceState.setMonorepoSubpathBoostWeight(settings.monorepo_subpath_boost_weight ?? 1.5);
    workspaceState.setMonorepoWorkspaceGlobsText((settings.monorepo_workspace_globs || []).join('\n'));
    workspaceState.setMonorepoExcludeGlobsText((settings.monorepo_exclude_globs || []).join('\n'));
    workspaceState.setMonorepoRootMarkersText((settings.monorepo_root_markers || []).join('\n'));
    workspaceState.setMonorepoMaxDepth(settings.monorepo_max_depth || 3);
  }

  async function saveWorkspaceSettings() {
    if (!workspaceState.selectedWorkspace) {
      return;
    }
    const reason = workspaceState.workspaceSettingsReason.trim();
    const githubProjectKeyPrefix =
      (workspaceState.githubProjectKeyPrefix || workspaceState.githubPrefix || 'github:').trim() ||
      'github:';
    const githubRoleMapping = parseJsonOrFallback(
      workspaceState.githubRoleMappingJson,
      DEFAULT_GITHUB_ROLE_MAPPING
    );
    const searchTypeWeights = parseJsonOrFallback(
      workspaceState.searchTypeWeightsJson,
      DEFAULT_SEARCH_TYPE_WEIGHTS
    );

    await callApi('/v1/workspace-settings', {
      method: 'PUT',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
        resolution_order: workspaceState.resolutionOrder,
        auto_create_project: workspaceState.autoCreateProject,
        auto_create_project_subprojects: workspaceState.autoCreateProjectSubprojects,
        auto_switch_repo: workspaceState.autoSwitchRepo,
        auto_switch_subproject: workspaceState.autoSwitchSubproject,
        allow_manual_pin: workspaceState.allowManualPin,
        enable_git_events: workspaceState.enableGitEvents,
        enable_commit_events: workspaceState.enableCommitEvents,
        enable_merge_events: workspaceState.enableMergeEvents,
        enable_checkout_events: workspaceState.enableCheckoutEvents,
        checkout_debounce_seconds: Math.min(Math.max(workspaceState.checkoutDebounceSeconds || 0, 0), 3600),
        checkout_daily_limit: Math.min(Math.max(workspaceState.checkoutDailyLimit || 1, 1), 50000),
        enable_activity_auto_log: memoryState.enableActivityAutoLog,
        enable_decision_extraction: memoryState.enableDecisionExtraction,
        decision_extraction_mode: memoryState.decisionExtractionMode,
        decision_default_status: memoryState.decisionDefaultStatus,
        decision_auto_confirm_enabled: memoryState.decisionAutoConfirmEnabled,
        decision_auto_confirm_min_confidence: Math.min(
          Math.max(memoryState.decisionAutoConfirmMinConfidence || 0, 0),
          1
        ),
        decision_batch_size: Math.min(Math.max(memoryState.decisionBatchSize || 1, 1), 2000),
        decision_backfill_days: Math.min(Math.max(memoryState.decisionBackfillDays || 1, 1), 3650),
        active_work_stale_days: Math.min(Math.max(memoryState.activeWorkStaleDays || 1, 1), 3650),
        active_work_auto_close_enabled: memoryState.activeWorkAutoCloseEnabled,
        active_work_auto_close_days: Math.min(Math.max(memoryState.activeWorkAutoCloseDays || 1, 1), 3650),
        raw_access_min_role: memoryState.rawAccessMinRole,
        oidc_sync_mode: workspaceState.oidcSyncMode,
        oidc_allow_auto_provision: workspaceState.oidcAllowAutoProvision,
        search_default_mode: workspaceState.searchDefaultMode,
        search_hybrid_alpha: Math.min(Math.max(workspaceState.searchHybridAlpha || 0, 0), 1),
        search_hybrid_beta: Math.min(Math.max(workspaceState.searchHybridBeta || 0, 0), 1),
        search_default_limit: Math.min(Math.max(workspaceState.searchDefaultLimit || 1, 1), 500),
        search_type_weights: searchTypeWeights,
        search_recency_half_life_days: Math.min(
          Math.max(workspaceState.searchRecencyHalfLifeDays || 1, 1),
          3650
        ),
        search_subpath_boost_weight: Math.min(
          Math.max(workspaceState.searchSubpathBoostWeight || 1.5, 1),
          10
        ),
        bundle_token_budget_total: Math.min(
          Math.max(workspaceState.bundleTokenBudgetTotal || 300, 300),
          50000
        ),
        bundle_budget_global_workspace_pct: Math.min(
          Math.max(workspaceState.bundleBudgetGlobalWorkspacePct || 0, 0),
          1
        ),
        bundle_budget_global_user_pct: Math.min(
          Math.max(workspaceState.bundleBudgetGlobalUserPct || 0, 0),
          1
        ),
        bundle_budget_project_pct: Math.min(Math.max(workspaceState.bundleBudgetProjectPct || 0, 0), 1),
        bundle_budget_retrieval_pct: Math.min(Math.max(workspaceState.bundleBudgetRetrievalPct || 0, 0), 1),
        global_rules_recommend_max: Math.min(Math.max(workspaceState.globalRulesRecommendMax || 1, 1), 1000),
        global_rules_warn_threshold: Math.min(Math.max(workspaceState.globalRulesWarnThreshold || 1, 1), 1000),
        global_rules_summary_enabled: workspaceState.globalRulesSummaryEnabled,
        global_rules_summary_min_count: Math.min(
          Math.max(workspaceState.globalRulesSummaryMinCount || 1, 1),
          1000
        ),
        global_rules_selection_mode: workspaceState.globalRulesSelectionMode,
        global_rules_routing_enabled: workspaceState.globalRulesRoutingEnabled,
        global_rules_routing_mode: workspaceState.globalRulesRoutingMode,
        global_rules_routing_top_k: Math.min(Math.max(workspaceState.globalRulesRoutingTopK || 1, 1), 100),
        global_rules_routing_min_score: Math.min(
          Math.max(workspaceState.globalRulesRoutingMinScore || 0, 0),
          1
        ),
        retention_policy_enabled: workspaceState.retentionPolicyEnabled,
        audit_retention_days: Math.min(Math.max(workspaceState.auditRetentionDays || 1, 1), 3650),
        raw_retention_days: Math.min(Math.max(workspaceState.rawRetentionDays || 1, 1), 3650),
        retention_mode: workspaceState.retentionMode,
        security_stream_enabled: workspaceState.securityStreamEnabled,
        security_stream_sink_id: workspaceState.securityStreamSinkId || null,
        security_stream_min_severity: workspaceState.securityStreamMinSeverity,
        github_auto_create_projects: workspaceState.githubAutoCreateProjects,
        github_auto_create_subprojects: workspaceState.githubAutoCreateSubprojects,
        github_permission_sync_enabled: workspaceState.githubPermissionSyncEnabled,
        github_permission_sync_mode: workspaceState.githubPermissionSyncMode,
        github_cache_ttl_seconds: Math.min(Math.max(workspaceState.githubCacheTtlSeconds || 30, 30), 86400),
        github_webhook_enabled: workspaceState.githubWebhookEnabled,
        github_webhook_sync_mode: workspaceState.githubWebhookSyncMode,
        github_team_mapping_enabled: workspaceState.githubTeamMappingEnabled,
        github_role_mapping: githubRoleMapping,
        github_project_key_prefix: githubProjectKeyPrefix,
        github_key_prefix: githubProjectKeyPrefix,
        local_key_prefix: workspaceState.localPrefix,
        enable_monorepo_resolution: workspaceState.enableMonorepoResolution,
        monorepo_detection_level: Math.min(Math.max(workspaceState.monorepoDetectionLevel || 2, 0), 3),
        monorepo_mode: workspaceState.monorepoMode,
        monorepo_context_mode: workspaceState.monorepoContextMode,
        monorepo_subpath_metadata_enabled: workspaceState.monorepoSubpathMetadataEnabled,
        monorepo_subpath_boost_enabled: workspaceState.monorepoSubpathBoostEnabled,
        monorepo_subpath_boost_weight: Math.min(
          Math.max(workspaceState.monorepoSubpathBoostWeight || 1.5, 1),
          10
        ),
        monorepo_workspace_globs: parseLineSeparatedValues(workspaceState.monorepoWorkspaceGlobsText),
        monorepo_exclude_globs: parseLineSeparatedValues(workspaceState.monorepoExcludeGlobsText),
        monorepo_root_markers: parseLineSeparatedValues(workspaceState.monorepoRootMarkersText),
        monorepo_max_depth: Math.min(Math.max(workspaceState.monorepoMaxDepth || 3, 1), 12),
        reason: reason || undefined,
      }),
    });
    await loadWorkspaceSettings(workspaceState.selectedWorkspace);
  }

  return {
    loadWorkspaceSettings,
    saveWorkspaceSettings,
  };
}
