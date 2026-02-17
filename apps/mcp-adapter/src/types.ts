export type ProjectSummary = {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryRow = {
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

export type ResolveResponse = {
  workspace_key: string;
  project: {
    id: string;
    key: string;
    name?: string;
  };
  resolution: 'github_remote' | 'repo_root_slug' | 'manual';
  matched_mapping_id?: string;
  created?: boolean;
};

export type WorkspaceSettingsResponse = {
  workspace_key: string;
  auto_switch_repo: boolean;
  auto_switch_subproject: boolean;
  allow_manual_pin: boolean;
  enable_git_events: boolean;
  enable_commit_events: boolean;
  enable_merge_events: boolean;
  enable_checkout_events: boolean;
  checkout_debounce_seconds: number;
  checkout_daily_limit: number;
  enable_monorepo_resolution: boolean;
  monorepo_detection_level: number;
  monorepo_workspace_globs: string[];
  monorepo_exclude_globs: string[];
  monorepo_root_markers: string[];
  monorepo_max_depth: number;
};

export type RawSearchMatch = {
  raw_session_id: string;
  source: string;
  source_session_id?: string | null;
  message_id: string;
  role: string;
  snippet: string;
  created_at: string;
  project_key?: string;
};

export type NotionSearchPage = {
  id: string;
  title: string;
  url: string;
  last_edited_time: string;
};

export type NotionReadResponse = {
  id: string;
  title: string;
  url: string;
  content: string;
};

export type JiraIssue = {
  key: string;
  summary: string;
  status: string;
  url: string;
  updated: string;
  assignee?: string;
  issue_type?: string;
  project_key?: string;
};

export type JiraIssueReadResponse = {
  key: string;
  summary: string;
  status: string;
  url: string;
  updated: string;
  content: string;
};

export type ConfluencePage = {
  id: string;
  title: string;
  url: string;
  last_edited_time: string;
  space?: string;
};

export type ConfluenceReadResponse = {
  id: string;
  title: string;
  url: string;
  last_edited_time: string;
  content: string;
};

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  state: string;
  url: string;
  updatedAt: string;
  assignee?: string;
  project?: string;
};

export type LinearIssueReadResponse = {
  id: string;
  identifier: string;
  title: string;
  state: string;
  url: string;
  updatedAt: string;
  content: string;
};
