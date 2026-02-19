export type Workspace = {
  id: string;
  key: string;
  name: string;
};

export type User = {
  id: string;
  email: string;
  name?: string | null;
};

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ProjectRole = 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER';

export type Project = {
  id: string;
  key: string;
  name: string;
};

export type ProjectMember = {
  id: string;
  role: ProjectRole;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
};

export type WorkspaceMember = {
  id: string;
  role: WorkspaceRole;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
};

export type ApiKeyItem = {
  id: string;
  label?: string | null;
  workspace_key?: string;
  key_prefix?: string;
  device_label?: string;
  expires_at?: string | null;
  created_at: string;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_by_user_id?: string | null;
};

export type LlmUsageGroupBy = 'day' | 'purpose' | 'model';

export type LlmUsageItem = {
  group_key: string;
  purpose?: string;
  provider?: string;
  model?: string;
  event_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_cents: number;
};

export type LlmUsageResponse = {
  workspace_key: string;
  from?: string;
  to?: string;
  group_by: LlmUsageGroupBy;
  totals: {
    event_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_cents: number;
  };
  items: LlmUsageItem[];
};

export type MemoryItem = {
  id: string;
  type: string;
  content: string;
  status?: 'draft' | 'confirmed' | 'rejected';
  source?: 'auto' | 'human' | 'import';
  confidence?: number;
  evidence?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  project: {
    key: string;
    name: string;
    workspace: {
      key: string;
      name: string;
    };
  };
};

export type ContextBundleResponse = {
  project: {
    key: string;
    name: string;
  };
  global?: {
    workspace_rules: Array<{
      id: string;
      title: string;
      content: string;
      category: 'policy' | 'security' | 'style' | 'process' | 'other';
      priority: number;
      severity: 'low' | 'medium' | 'high';
      pinned: boolean;
      selected_reason?: string;
      score?: number;
    }>;
    user_rules: Array<{
      id: string;
      title: string;
      content: string;
      category: 'policy' | 'security' | 'style' | 'process' | 'other';
      priority: number;
      severity: 'low' | 'medium' | 'high';
      pinned: boolean;
      selected_reason?: string;
      score?: number;
    }>;
    workspace_summary?: string;
    user_summary?: string;
    routing: {
      mode: 'semantic' | 'keyword' | 'hybrid';
      q_used?: string;
      selected_rule_ids: string[];
      dropped_rule_ids: string[];
      score_breakdown?: Array<Record<string, unknown>>;
    };
    warnings: Array<{ level: 'info' | 'warn'; message: string }>;
  };
  snapshot: {
    summary: string;
    top_decisions: Array<{
      id: string;
      summary: string;
      status: string;
      created_at: string;
      evidence_ref?: Record<string, unknown>;
    }>;
    top_constraints: Array<{
      id: string;
      snippet: string;
      created_at: string;
      evidence_ref?: Record<string, unknown>;
    }>;
    active_work: Array<{
      id: string;
      title: string;
      confidence: number;
      status: string;
      stale?: boolean;
      stale_reason?: string | null;
      last_evidence_at?: string | null;
      closed_at?: string | null;
      last_updated_at: string;
      evidence_ids: string[];
    }>;
    recent_activity: Array<{
      id: string;
      title: string;
      created_at: string;
      subpath?: string;
    }>;
  };
  retrieval: {
    query?: string;
    results: Array<{
      id: string;
      type: string;
      snippet: string;
      score_breakdown?: Record<string, unknown>;
      persona_weight?: number;
      evidence_ref?: Record<string, unknown>;
    }>;
  };
  debug?: {
    resolved_workspace: string;
    resolved_project: string;
    monorepo_mode: string;
    current_subpath?: string;
    boosts_applied: Record<string, unknown>;
    persona_applied?: 'neutral' | 'author' | 'reviewer' | 'architect';
    persona_recommended?: {
      recommended: 'neutral' | 'author' | 'reviewer' | 'architect';
      confidence: number;
      reasons: string[];
      alternatives: Array<{ persona: 'neutral' | 'author' | 'reviewer' | 'architect'; score: number }>;
    };
    weight_adjustments?: {
      persona_weights: Record<string, number>;
      applied_to_types: Record<string, number>;
    };
    token_budget: {
      total: number;
      allocations: {
        workspace_global: number;
        user_global: number;
        project_snapshot: number;
        retrieval: number;
      };
      retrieval_limit: number;
      per_item_chars: number;
    };
    active_work_candidates?: Array<Record<string, unknown>>;
    active_work_policy?: {
      stale_days: number;
      auto_close_enabled: boolean;
      auto_close_days: number;
      confirmed_auto_close_exempt: boolean;
    };
    decision_extractor_recent: Array<Record<string, unknown>>;
    global_rules?: Record<string, unknown>;
  };
};

export type ResolutionKind = 'github_remote' | 'repo_root_slug' | 'manual';
export type MonorepoMode = 'repo_only' | 'repo_hash_subpath' | 'repo_colon_subpath';
export type MonorepoContextMode = 'shared_repo' | 'split_on_demand' | 'split_auto';
export type OidcSyncMode = 'add_only' | 'add_and_remove';
export type GithubPermissionSyncMode = 'add_only' | 'add_and_remove';
export type GithubWebhookSyncMode = 'add_only' | 'add_and_remove';
export type OidcClaimGroupsFormat = 'id' | 'name';
export type RetentionMode = 'archive' | 'hard_delete';
export type SecuritySeverity = 'low' | 'medium' | 'high';
export type ContextPersona = 'neutral' | 'author' | 'reviewer' | 'architect';

export type WorkspaceSettings = {
  workspace_key: string;
  resolution_order: ResolutionKind[];
  auto_create_project: boolean;
  auto_create_project_subprojects: boolean;
  auto_switch_repo: boolean;
  auto_switch_subproject: boolean;
  allow_manual_pin: boolean;
  enable_git_events: boolean;
  enable_commit_events: boolean;
  enable_merge_events: boolean;
  enable_checkout_events: boolean;
  checkout_debounce_seconds: number;
  checkout_daily_limit: number;
  enable_auto_extraction: boolean;
  auto_extraction_mode: 'draft_only' | 'auto_confirm';
  auto_confirm_min_confidence: number;
  auto_confirm_allowed_event_types: Array<'post_commit' | 'post_merge' | 'post_checkout'>;
  auto_confirm_keyword_allowlist: string[];
  auto_confirm_keyword_denylist: string[];
  auto_extraction_batch_size: number;
  search_default_mode: 'hybrid' | 'keyword' | 'semantic';
  search_hybrid_alpha: number;
  search_hybrid_beta: number;
  search_default_limit: number;
  search_type_weights: Record<string, number>;
  search_recency_half_life_days: number;
  search_subpath_boost_weight: number;
  bundle_token_budget_total: number;
  bundle_budget_global_workspace_pct: number;
  bundle_budget_global_user_pct: number;
  bundle_budget_project_pct: number;
  bundle_budget_retrieval_pct: number;
  global_rules_recommend_max: number;
  global_rules_warn_threshold: number;
  global_rules_summary_enabled: boolean;
  global_rules_summary_min_count: number;
  global_rules_selection_mode: 'score' | 'recent' | 'priority_only';
  global_rules_routing_enabled: boolean;
  global_rules_routing_mode: 'semantic' | 'keyword' | 'hybrid';
  global_rules_routing_top_k: number;
  global_rules_routing_min_score: number;
  persona_weights: Record<string, Record<string, number>>;
  github_auto_create_projects: boolean;
  github_auto_create_subprojects: boolean;
  github_permission_sync_enabled: boolean;
  github_permission_sync_mode: GithubPermissionSyncMode;
  github_cache_ttl_seconds: number;
  github_role_mapping: Record<string, 'owner' | 'maintainer' | 'writer' | 'reader'>;
  github_webhook_enabled: boolean;
  github_webhook_sync_mode: GithubWebhookSyncMode;
  github_team_mapping_enabled: boolean;
  github_project_key_prefix: string;
  github_key_prefix: string;
  local_key_prefix: string;
  enable_monorepo_resolution: boolean;
  monorepo_detection_level: number;
  monorepo_mode: MonorepoMode;
  monorepo_context_mode: MonorepoContextMode;
  monorepo_subpath_metadata_enabled: boolean;
  monorepo_subpath_boost_enabled: boolean;
  monorepo_subpath_boost_weight: number;
  monorepo_root_markers: string[];
  monorepo_workspace_globs: string[];
  monorepo_exclude_globs: string[];
  monorepo_max_depth: number;
  default_outbound_locale: 'en' | 'ko' | 'ja' | 'es' | 'zh';
  supported_outbound_locales: Array<'en' | 'ko' | 'ja' | 'es' | 'zh'>;
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
  raw_access_min_role: ProjectRole;
  retention_policy_enabled: boolean;
  audit_retention_days: number;
  raw_retention_days: number;
  retention_mode: RetentionMode;
  security_stream_enabled: boolean;
  security_stream_sink_id?: string | null;
  security_stream_min_severity: SecuritySeverity;
  oidc_sync_mode: OidcSyncMode;
  oidc_allow_auto_provision: boolean;
};

export * from './types-extended';
