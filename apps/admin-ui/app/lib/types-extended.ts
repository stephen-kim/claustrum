import type {
  ContextPersona,
  GithubPermissionSyncMode,
  GithubWebhookSyncMode,
  OidcClaimGroupsFormat,
  OidcSyncMode,
  ProjectRole,
  ResolutionKind,
  RetentionMode,
  SecuritySeverity,
} from './types';

export type GlobalRule = {
  id: string;
  scope: 'workspace' | 'user';
  workspace_id?: string | null;
  user_id?: string | null;
  title: string;
  content: string;
  category: 'policy' | 'security' | 'style' | 'process' | 'other';
  priority: number;
  severity: 'low' | 'medium' | 'high';
  pinned: boolean;
  enabled: boolean;
  tags: string[];
  usage_count: number;
  last_routed_at?: string;
  created_at: string;
  updated_at: string;
};

export type OidcProvider = {
  id: string;
  name: string;
  issuer_url: string;
  client_id: string;
  client_secret_configured: boolean;
  discovery_enabled: boolean;
  scopes: string;
  claim_groups_name: string;
  claim_groups_format: OidcClaimGroupsFormat;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type OidcGroupMapping = {
  id: string;
  provider_id: string;
  claim_name: string;
  group_id: string;
  group_display_name: string;
  target_type: 'workspace' | 'project';
  target_key: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER';
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type OutboundIntegrationType =
  | 'slack'
  | 'jira'
  | 'confluence'
  | 'notion'
  | 'webhook'
  | 'email';

export type OutboundMode = 'template' | 'llm';
export type OutboundStyle = 'short' | 'normal' | 'verbose';
export type OutboundLocale = 'en' | 'ko' | 'ja' | 'es' | 'zh';

export type WorkspaceOutboundSettings = {
  workspace_key: string;
  default_outbound_locale: OutboundLocale;
  supported_outbound_locales: OutboundLocale[];
};

export type OutboundPolicy = {
  workspace_key: string;
  integration_type: OutboundIntegrationType;
  enabled: boolean;
  locale_default: OutboundLocale;
  supported_locales: OutboundLocale[];
  mode: OutboundMode;
  style: OutboundStyle;
  template_overrides: Record<string, unknown>;
  llm_prompt_system?: string | null;
  llm_prompt_user?: string | null;
};

export type OutboundTemplateVariable = {
  name: string;
  description: string;
};

export type OutboundTemplateVariablesResponse = {
  workspace_key: string;
  integration_type: OutboundIntegrationType;
  engine: 'liquid';
  common_variables: OutboundTemplateVariable[];
  action_variables: Array<{
    action_key: string;
    variables: OutboundTemplateVariable[];
  }>;
};

export type ProjectMapping = {
  id: string;
  kind: ResolutionKind;
  external_id: string;
  priority: number;
  is_enabled: boolean;
  project: {
    id: string;
    key: string;
    name: string;
  };
};

export type MonorepoSubprojectPolicy = {
  id: string;
  repo_key: string;
  subpath: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ImportSource = 'codex' | 'claude' | 'generic';
export type ImportStatus = 'uploaded' | 'parsed' | 'extracted' | 'committed' | 'failed';

export type ImportItem = {
  id: string;
  source: ImportSource;
  status: ImportStatus;
  fileName: string;
  stats?: Record<string, unknown> | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StagedMemoryItem = {
  id: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  isSelected: boolean;
  project?: {
    key: string;
    name: string;
  } | null;
};

export type RawSearchMatch = {
  raw_session_id: string;
  source: ImportSource;
  source_session_id?: string | null;
  message_id: string;
  role: string;
  snippet: string;
  created_at: string;
  project_key?: string;
};

export type RawMessageDetail = {
  message_id: string;
  raw_session_id: string;
  role: string;
  snippet: string;
  created_at: string;
  source: ImportSource;
  source_session_id?: string | null;
  project_key?: string | null;
};

export type AuditLogItem = {
  id: string;
  projectId?: string | null;
  actorUserId: string;
  correlationId?: string | null;
  action: string;
  target: Record<string, unknown>;
  createdAt: string;
};

export type AccessTimelineSource = 'manual' | 'github' | 'oidc' | 'system';
export type AccessTimelineAction = 'add' | 'change' | 'remove' | '';

export type AccessTimelineItem = {
  id: string;
  created_at: string;
  action_key: string;
  actor_user_id?: string | null;
  system_actor?: string | null;
  correlation_id?: string | null;
  params: Record<string, unknown>;
};

export type RawEventType = 'post_commit' | 'post_merge' | 'post_checkout';

export type RawEventItem = {
  id: string;
  event_type: RawEventType;
  workspace_key: string;
  project_key: string;
  project_name: string;
  repo_key: string;
  subproject_key?: string | null;
  branch?: string | null;
  from_branch?: string | null;
  to_branch?: string | null;
  commit_sha?: string | null;
  commit_message?: string | null;
  changed_files?: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type IntegrationProvider =
  | 'notion'
  | 'jira'
  | 'confluence'
  | 'linear'
  | 'slack'
  | 'audit_reasoner';

export type IntegrationState = {
  enabled: boolean;
  configured: boolean;
  source: 'workspace' | 'env' | 'none';
  locked?: boolean;
  has_token?: boolean;
  default_parent_page_id?: string;
  write_enabled?: boolean;
  write_on_commit?: boolean;
  write_on_merge?: boolean;
  base_url?: string;
  email?: string;
  has_api_token?: boolean;
  api_url?: string;
  provider?: 'openai' | 'claude' | 'gemini';
  model?: string;
  provider_order?: Array<'openai' | 'claude' | 'gemini'>;
  openai_model?: string;
  claude_model?: string;
  gemini_model?: string;
  openai_base_url?: string;
  claude_base_url?: string;
  gemini_base_url?: string;
  has_openai_api_key?: boolean;
  has_claude_api_key?: boolean;
  has_gemini_api_key?: boolean;
  has_api_key?: boolean;
  has_webhook?: boolean;
  default_channel?: string;
  action_prefixes?: string[];
  format?: 'compact' | 'detailed';
  include_target_json?: boolean;
  mask_secrets?: boolean;
  routes?: Array<{
    action_prefix: string;
    channel?: string;
    min_severity?: 'low' | 'medium' | 'high' | 'critical';
  }>;
  severity_rules?: Array<{ action_prefix: string; severity: 'low' | 'medium' | 'high' | 'critical' }>;
};

export type IntegrationSettingsResponse = {
  workspace_key: string;
  integrations: {
    notion: IntegrationState;
    jira: IntegrationState;
    confluence: IntegrationState;
    linear: IntegrationState;
    slack: IntegrationState;
    audit_reasoner: IntegrationState;
  };
};

export type GithubInstallationStatus = {
  workspace_key: string;
  connected: boolean;
  installation: null | {
    installation_id: string;
    account_type: 'Organization' | 'User';
    account_login: string;
    repository_selection: 'all' | 'selected' | 'unknown';
    permissions: Record<string, string>;
    updated_at: string;
  };
};

export type GithubRepoLinksResponse = {
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
};

export type GithubUserLinksResponse = {
  workspace_key: string;
  links: Array<{
    user_id: string;
    user_email: string;
    user_name: string | null;
    github_login: string;
    github_user_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

export type GithubPermissionSyncResponse = {
  workspace_key: string;
  dry_run: boolean;
  repos_processed: number;
  users_matched: number;
  added: number;
  updated: number;
  removed: number;
  skipped_unmatched: number;
  rate_limit_warnings?: string[];
  unmatched_users: Array<{
    repo_full_name: string;
    github_login: string | null;
    github_user_id: string | null;
    permission: string;
  }>;
  repo_errors: Array<{ repo_full_name: string; error: string }>;
};

export type GithubPermissionStatusResponse = {
  workspace_key: string;
  github_permission_sync_enabled: boolean;
  github_permission_sync_mode: GithubPermissionSyncMode;
  github_cache_ttl_seconds: number;
  github_role_mapping: Record<string, 'owner' | 'maintainer' | 'writer' | 'reader'>;
  last_sync: null | {
    created_at: string;
    dry_run: boolean;
    repos_processed: number;
    users_matched: number;
    added: number;
    updated: number;
    removed: number;
    skipped_unmatched: number;
  };
  unmatched_users: Array<{
    repo_full_name: string;
    github_login: string | null;
    github_user_id: string | null;
    permission: string;
  }>;
};

export type GithubPermissionPreviewResponse = {
  workspace_key: string;
  repo_full_name: string;
  project_key: string | null;
  computed_permissions: Array<{
    github_user_id: string;
    github_login: string | null;
    permission: 'admin' | 'maintain' | 'write' | 'triage' | 'read';
    matched_user_id: string | null;
    matched_user_email: string | null;
    mapped_project_role: 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER' | null;
  }>;
  unmatched_users: Array<{
    github_user_id: string;
    github_login: string | null;
    permission: 'admin' | 'maintain' | 'write' | 'triage' | 'read';
  }>;
};

export type GithubPermissionCacheStatusResponse = {
  workspace_key: string;
  ttl_seconds: number;
  repo_teams_cache_count: number;
  team_members_cache_count: number;
  permission_cache_count: number;
  latest_repo_teams_cache_at: string | null;
  latest_team_members_cache_at: string | null;
  latest_permission_cache_at: string | null;
};

export type GithubWebhookEventsResponse = {
  workspace_key: string;
  deliveries: Array<{
    id: string;
    delivery_id: string;
    installation_id: string;
    event_type: string;
    status: 'queued' | 'processing' | 'done' | 'failed';
    affected_repos_count: number;
    error: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

export type GithubTeamMappingsResponse = {
  workspace_key: string;
  mappings: Array<{
    id: string;
    provider_installation_id: string | null;
    github_team_id: string;
    github_team_slug: string;
    github_org_login: string;
    target_type: 'workspace' | 'project';
    target_key: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER';
    enabled: boolean;
    priority: number;
    created_at: string;
    updated_at: string;
  }>;
};

export type AuditSinksResponse = {
  workspace_key: string;
  sinks: Array<{
    id: string;
    type: 'webhook' | 'http';
    name: string;
    enabled: boolean;
    endpoint_url: string;
    has_secret: boolean;
    event_filter: {
      include_prefixes: string[];
      exclude_actions: string[];
    };
    retry_policy: {
      max_attempts: number;
      backoff_sec: number[];
    };
    created_at: string;
    updated_at: string;
  }>;
};

export type AuditDeliveryQueueResponse = {
  workspace_key: string;
  deliveries: Array<{
    id: string;
    sink_id: string;
    sink_name: string;
    audit_log_id: string;
    action_key: string;
    status: 'queued' | 'sending' | 'delivered' | 'failed';
    attempt_count: number;
    next_attempt_at: string;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

export type DetectionRulesResponse = {
  workspace_key: string;
  rules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    severity: SecuritySeverity;
    condition: Record<string, unknown>;
    notify: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>;
};

export type DetectionsResponse = {
  workspace_key: string;
  detections: Array<{
    id: string;
    rule_id: string;
    rule_name: string;
    severity: SecuritySeverity;
    status: 'open' | 'ack' | 'closed';
    actor_user_id: string | null;
    correlation_id: string | null;
    evidence: Record<string, unknown>;
    triggered_at: string;
    created_at: string;
    updated_at: string;
  }>;
};

export type DecisionKeywordPolicy = {
  id: string;
  name: string;
  positive_keywords: string[];
  negative_keywords: string[];
  file_path_positive_patterns: string[];
  file_path_negative_patterns: string[];
  weight_positive: number;
  weight_negative: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ActiveWorkItem = {
  id: string;
  title: string;
  confidence: number;
  status: 'inferred' | 'confirmed' | 'closed';
  stale: boolean;
  stale_reason?: string | null;
  last_evidence_at?: string | null;
  last_updated_at: string;
  closed_at?: string | null;
  evidence_ids: string[];
};

export type ActiveWorkEventItem = {
  id: string;
  active_work_id: string;
  event_type: 'created' | 'updated' | 'stale_marked' | 'stale_cleared' | 'confirmed' | 'closed' | 'reopened';
  details: Record<string, unknown>;
  correlation_id?: string | null;
  created_at: string;
};

export type PersonaRecommendationResponse = {
  recommended: ContextPersona;
  confidence: number;
  reasons: string[];
  alternatives: Array<{ persona: ContextPersona; score: number }>;
};

export const MEMORY_TYPES = [
  'summary',
  'activity',
  'active_work',
  'constraint',
  'problem',
  'goal',
  'decision',
  'note',
  'caveat',
];

export const RESOLUTION_KINDS: ResolutionKind[] = ['github_remote', 'repo_root_slug', 'manual'];
