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

export type Project = {
  id: string;
  key: string;
  name: string;
};

export type ProjectMember = {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
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

export type ResolutionKind = 'github_remote' | 'repo_root_slug' | 'manual';
export type MonorepoMode = 'repo_only' | 'repo_hash_subpath' | 'repo_colon_subpath';

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
  github_key_prefix: string;
  local_key_prefix: string;
  enable_monorepo_resolution: boolean;
  monorepo_detection_level: number;
  monorepo_mode: MonorepoMode;
  monorepo_root_markers: string[];
  monorepo_workspace_globs: string[];
  monorepo_exclude_globs: string[];
  monorepo_max_depth: number;
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
  actorUserId: string;
  action: string;
  target: Record<string, unknown>;
  createdAt: string;
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

export const MEMORY_TYPES = [
  'active_work',
  'constraint',
  'problem',
  'goal',
  'decision',
  'note',
  'caveat',
];

export const RESOLUTION_KINDS: ResolutionKind[] = ['github_remote', 'repo_root_slug', 'manual'];
