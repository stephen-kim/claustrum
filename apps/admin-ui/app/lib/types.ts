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

export type WorkspaceSettings = {
  workspace_key: string;
  resolution_order: ResolutionKind[];
  auto_create_project: boolean;
  github_key_prefix: string;
  local_key_prefix: string;
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

export type IntegrationProvider = 'notion' | 'jira' | 'confluence' | 'linear' | 'slack';

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
