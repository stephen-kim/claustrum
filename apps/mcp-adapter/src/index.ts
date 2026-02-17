import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { memoryTypeSchema } from '@claustrum/shared';
import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Logger, parseLogLevel } from './logger.js';
import { detectGitContext } from './git-context.js';
import { decideContextTransition, splitProjectKey, type SessionState } from './context-policy.js';
import { detectSubproject } from './monorepo-detection.js';
import { tools } from './tools.js';
import type {
  ConfluencePage,
  ConfluenceReadResponse,
  JiraIssue,
  JiraIssueReadResponse,
  LinearIssue,
  LinearIssueReadResponse,
  MemoryRow,
  NotionReadResponse,
  NotionSearchPage,
  ProjectSummary,
  RawSearchMatch,
  ResolveResponse,
  WorkspaceSettingsResponse,
} from './types.js';

const MEMORY_CORE_URL = (process.env.MEMORY_CORE_URL || '').trim().replace(/\/+$/, '');
const MEMORY_CORE_API_KEY = (process.env.MEMORY_CORE_API_KEY || '').trim();
const DEFAULT_WORKSPACE_KEY = process.env.MEMORY_CORE_WORKSPACE_KEY || 'personal';
const logger = new Logger(parseLogLevel(process.env.MCP_ADAPTER_LOG_LEVEL));
const execFileAsync = promisify(execFile);
const installedHookRepos = new Set<string>();
const MANAGED_HOOK_MARKER = '# claustrum-managed hook';
const CLI_SCRIPT_PATH = path.resolve(process.argv[1] || '');

let activeWorkspaceKey: string | null = null;
const sessionState: SessionState = {
  currentProjectKey: null,
  currentRepoKey: null,
  currentSubprojectKey: null,
  pinMode: false,
};

async function runMcpServer() {
  if (!MEMORY_CORE_URL) {
    throw new Error(
      'MEMORY_CORE_URL is required (e.g. http://memory-core:8080 in docker network).'
    );
  }
  if (!MEMORY_CORE_API_KEY.trim()) {
    throw new Error('MEMORY_CORE_API_KEY is required.');
  }

  const server = new Server(
    { name: 'claustrum-mcp-adapter', version: '0.2.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: unknown } }) => {
    const toolName = request.params.name;
    const args = (request.params.arguments || {}) as Record<string, unknown>;

    if (toolName === 'set_workspace') {
      const key = String(args.key || '').trim();
      if (!key) {
        return textResult('Missing key');
      }
      await listProjects(key);
      activeWorkspaceKey = key;
      sessionState.currentProjectKey = null;
      sessionState.currentRepoKey = null;
      sessionState.currentSubprojectKey = null;
      sessionState.pinMode = false;
      try {
        await ensureGitHooksInstalledForCwd(key);
      } catch (error) {
        logger.warn('git hook install skipped on set_workspace', toErrorMessage(error));
      }
      return textResult(`Workspace selected: ${key}`);
    }

    if (toolName === 'set_project') {
      const key = String(args.key || '').trim();
      if (!key) {
        return textResult('Missing key');
      }
      const workspaceSettings = await getWorkspaceSettings();
      if (!workspaceSettings.allow_manual_pin) {
        return textResult('Manual pin is disabled by workspace policy.');
      }
      const resolved = await resolveProject({
        manualProjectKey: key,
        includeMonorepo: false,
      });
      setSessionProject(resolved.project.key, true);
      return textResult(
        `Project selected: ${resolved.project.key} (${resolved.resolution}, pin=true)`
      );
    }

    if (toolName === 'unset_project_pin') {
      sessionState.pinMode = false;
      return textResult('Pin mode disabled');
    }

    if (toolName === 'get_current_project') {
      return textResult(
        JSON.stringify(
          {
            workspace_key: activeWorkspaceKey || DEFAULT_WORKSPACE_KEY,
            current_project_key: sessionState.currentProjectKey,
            current_repo_key: sessionState.currentRepoKey,
            current_subproject_key: sessionState.currentSubprojectKey,
            pin_mode: sessionState.pinMode,
          },
          null,
          2
        )
      );
    }

    if (toolName === 'remember') {
      const context = await ensureContext();
      const type = memoryTypeSchema.parse(args.type);
      const content = String(args.content || '').trim();
      if (!content) {
        return textResult('Missing content');
      }
      const metadata =
        args.metadata && typeof args.metadata === 'object'
          ? (args.metadata as Record<string, unknown>)
          : undefined;

      const memory = await requestJson<{ id: string }>('/v1/memories', {
        method: 'POST',
        body: {
          workspace_key: context.workspaceKey,
          project_key: context.projectKey,
          type,
          content,
          metadata,
        },
      });
      return textResult(`Stored memory ${memory.id} in ${context.projectKey}`);
    }

    if (toolName === 'recall') {
      const context = await ensureContext();
      const projectOverride = args.project_key ? String(args.project_key).trim() : '';
      const queryProjectKey = projectOverride
        ? await resolveProjectKeyOverride(projectOverride, context.workspaceKey)
        : context.projectKey;

      const query = new URLSearchParams({
        workspace_key: context.workspaceKey,
        project_key: queryProjectKey,
        mode: 'hybrid',
      });
      if (args.q) {
        query.set('q', String(args.q));
      }
      if (args.type) {
        query.set('type', memoryTypeSchema.parse(args.type));
      }
      if (typeof args.limit === 'number') {
        query.set('limit', String(args.limit));
      }
      if (args.since) {
        query.set('since', String(args.since));
      }
      if (args.mode) {
        const mode = String(args.mode).trim();
        if (mode === 'keyword' || mode === 'semantic' || mode === 'hybrid') {
          query.set('mode', mode);
        }
      }

      const response = await requestJson<{ memories: MemoryRow[] }>(`/v1/memories?${query.toString()}`, {
        method: 'GET',
      });

      const lines = response.memories.map((memory) => {
        return `[${memory.createdAt}] [${memory.project.workspace.key}/${memory.project.key}] [${memory.type}] ${memory.content}`;
      });
      return textResult(lines.length > 0 ? lines.join('\n') : 'No memories found');
    }

    if (toolName === 'list_projects') {
      const workspaceKey = String(args.workspace_key || activeWorkspaceKey || DEFAULT_WORKSPACE_KEY).trim();
      const projects = await listProjects(workspaceKey);
      const text = projects.map((project) => `${project.key}\t${project.name}`).join('\n');
      return textResult(text || 'No projects');
    }

    if (toolName === 'search_raw') {
      const context = await ensureContext();
      const q = String(args.q || '').trim();
      if (!q) {
        return textResult('q is required');
      }

      const workspaceKey = context.workspaceKey;
      const projectKey = args.project_key
        ? String(args.project_key).trim()
        : context.projectKey || '';
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 20) : 10;

      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        q,
        limit: String(limit),
        max_chars: '500',
      });
      if (projectKey) {
        query.set('project_key', projectKey);
      }
      const response = await requestJson<{ matches: RawSearchMatch[] }>(
        `/v1/raw/search?${query.toString()}`,
        {
          method: 'GET',
        }
      );
      const lines = response.matches.map((match) => {
        const scope = match.project_key ? `${workspaceKey}/${match.project_key}` : workspaceKey;
        return `[${match.created_at}] [${scope}] [${match.role}] ${match.snippet}`;
      });
      return textResult(lines.length > 0 ? lines.join('\n') : 'No raw snippet matches');
    }

    if (toolName === 'notion_search') {
      const q = String(args.q || '').trim();
      if (!q) {
        return textResult('q is required');
      }
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 20) : 10;
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        q,
        limit: String(limit),
      });
      const response = await requestJson<{ pages: NotionSearchPage[] }>(
        `/v1/notion/search?${query.toString()}`,
        { method: 'GET' }
      );
      const lines = response.pages.map((page) => {
        return `${page.title}\n- ${page.url}\n- page_id: ${page.id}\n- edited: ${page.last_edited_time}`;
      });
      return textResult(lines.length > 0 ? lines.join('\n\n') : 'No Notion pages found');
    }

    if (toolName === 'notion_read') {
      const pageId = String(args.page_id || '').trim();
      if (!pageId) {
        return textResult('page_id is required');
      }
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const maxChars =
        typeof args.max_chars === 'number'
          ? Math.min(Math.max(args.max_chars, 200), 20000)
          : 4000;
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        page_id: pageId,
        max_chars: String(maxChars),
      });
      const page = await requestJson<NotionReadResponse>(`/v1/notion/read?${query.toString()}`, {
        method: 'GET',
      });
      const text = `${page.title}\n${page.url}\n\n${page.content}`;
      return textResult(text);
    }

    if (toolName === 'notion_context') {
      const pageId = String(args.page_id || '').trim();
      const q = String(args.q || '').trim();
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 5) : 3;
      const maxChars =
        typeof args.max_chars === 'number'
          ? Math.min(Math.max(args.max_chars, 200), 4000)
          : 1200;

      if (pageId) {
        const query = new URLSearchParams({
          workspace_key: workspaceKey,
          page_id: pageId,
          max_chars: String(maxChars),
        });
        const page = await requestJson<NotionReadResponse>(`/v1/notion/read?${query.toString()}`, {
          method: 'GET',
        });
        const text = `Context page (direct)\n${page.title}\n${page.url}\n\n${page.content}`;
        return textResult(text);
      }

      if (!q) {
        return textResult('q or page_id is required');
      }

      const searchQuery = new URLSearchParams({
        workspace_key: workspaceKey,
        q,
        limit: String(limit),
      });
      const search = await requestJson<{ pages: NotionSearchPage[] }>(
        `/v1/notion/search?${searchQuery.toString()}`,
        { method: 'GET' }
      );

      if (search.pages.length === 0) {
        return textResult('No Notion context pages found');
      }

      const sections: string[] = [];
      for (const page of search.pages.slice(0, limit)) {
        try {
          const readQuery = new URLSearchParams({
            workspace_key: workspaceKey,
            page_id: page.id,
            max_chars: String(maxChars),
          });
          const detail = await requestJson<NotionReadResponse>(
            `/v1/notion/read?${readQuery.toString()}`,
            { method: 'GET' }
          );
          sections.push(`### ${detail.title}\n${detail.url}\n${detail.content}`);
        } catch (error) {
          sections.push(`### ${page.title}\n${page.url}\n(read failed: ${toErrorMessage(error)})`);
        }
      }
      return textResult(sections.join('\n\n').slice(0, 20000));
    }

    if (toolName === 'jira_search') {
      const q = String(args.q || '').trim();
      if (!q) {
        return textResult('q is required');
      }
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 20) : 10;
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        q,
        limit: String(limit),
      });
      const response = await requestJson<{ issues: JiraIssue[] }>(`/v1/jira/search?${query.toString()}`, {
        method: 'GET',
      });
      const lines = response.issues.map((issue) => {
        const assignee = issue.assignee ? `, assignee=${issue.assignee}` : '';
        return `${issue.key} [${issue.status}] ${issue.summary}\n- ${issue.url}\n- updated: ${issue.updated}${assignee}`;
      });
      return textResult(lines.length > 0 ? lines.join('\n\n') : 'No Jira issues found');
    }

    if (toolName === 'jira_read') {
      const issueKey = String(args.issue_key || '').trim();
      if (!issueKey) {
        return textResult('issue_key is required');
      }
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const maxChars =
        typeof args.max_chars === 'number'
          ? Math.min(Math.max(args.max_chars, 200), 20000)
          : 4000;
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        issue_key: issueKey,
        max_chars: String(maxChars),
      });
      const issue = await requestJson<JiraIssueReadResponse>(`/v1/jira/read?${query.toString()}`, {
        method: 'GET',
      });
      return textResult(
        `${issue.key} [${issue.status}] ${issue.summary}\n${issue.url}\nupdated: ${issue.updated}\n\n${issue.content}`
      );
    }

    if (toolName === 'confluence_search') {
      const q = String(args.q || '').trim();
      if (!q) {
        return textResult('q is required');
      }
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 20) : 10;
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        q,
        limit: String(limit),
      });
      const response = await requestJson<{ pages: ConfluencePage[] }>(
        `/v1/confluence/search?${query.toString()}`,
        { method: 'GET' }
      );
      const lines = response.pages.map((page) => {
        const space = page.space ? `, space=${page.space}` : '';
        return `${page.title}${space}\n- ${page.url}\n- page_id: ${page.id}\n- edited: ${page.last_edited_time}`;
      });
      return textResult(lines.length > 0 ? lines.join('\n\n') : 'No Confluence pages found');
    }

    if (toolName === 'confluence_read') {
      const pageId = String(args.page_id || '').trim();
      if (!pageId) {
        return textResult('page_id is required');
      }
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const maxChars =
        typeof args.max_chars === 'number'
          ? Math.min(Math.max(args.max_chars, 200), 20000)
          : 4000;
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        page_id: pageId,
        max_chars: String(maxChars),
      });
      const page = await requestJson<ConfluenceReadResponse>(
        `/v1/confluence/read?${query.toString()}`,
        { method: 'GET' }
      );
      return textResult(`${page.title}\n${page.url}\n\n${page.content}`);
    }

    if (toolName === 'linear_search') {
      const q = String(args.q || '').trim();
      if (!q) {
        return textResult('q is required');
      }
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 20) : 10;
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        q,
        limit: String(limit),
      });
      const response = await requestJson<{ issues: LinearIssue[] }>(
        `/v1/linear/search?${query.toString()}`,
        { method: 'GET' }
      );
      const lines = response.issues.map((issue) => {
        const assignee = issue.assignee ? `, assignee=${issue.assignee}` : '';
        const project = issue.project ? `, project=${issue.project}` : '';
        return `${issue.identifier} [${issue.state}] ${issue.title}\n- ${issue.url}\n- updated: ${issue.updatedAt}${project}${assignee}`;
      });
      return textResult(lines.length > 0 ? lines.join('\n\n') : 'No Linear issues found');
    }

    if (toolName === 'linear_read') {
      const issueKey = String(args.issue_key || '').trim();
      if (!issueKey) {
        return textResult('issue_key is required');
      }
      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const maxChars =
        typeof args.max_chars === 'number'
          ? Math.min(Math.max(args.max_chars, 200), 20000)
          : 4000;
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        issue_key: issueKey,
        max_chars: String(maxChars),
      });
      const issue = await requestJson<LinearIssueReadResponse>(
        `/v1/linear/read?${query.toString()}`,
        { method: 'GET' }
      );
      return textResult(
        `${issue.identifier} [${issue.state}] ${issue.title}\n${issue.url}\nupdated: ${issue.updatedAt}\n\n${issue.content}`
      );
    }

    return textResult(`Unknown tool: ${toolName}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

type EnsureContextResult = {
  workspaceKey: string;
  projectKey: string;
  repoKey: string | null;
  subprojectKey: string | null;
  pinMode: boolean;
};

async function ensureContext(): Promise<EnsureContextResult> {
  if (!activeWorkspaceKey) {
    activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
  }
  const workspaceSettings = await getWorkspaceSettings();
  const gitContext = await detectGitContext(process.cwd(), {
    enableMonorepoDetection: false,
  });
  if (gitContext.repo_root) {
    await ensureGitHooksInstalled(gitContext.repo_root, activeWorkspaceKey || DEFAULT_WORKSPACE_KEY);
  }
  let repoResolved: ResolveResponse;
  try {
    repoResolved = await resolveProjectFromContext(gitContext, {
      includeMonorepo: false,
    });
  } catch (error) {
    if (sessionState.currentProjectKey) {
      return {
        workspaceKey: activeWorkspaceKey,
        projectKey: sessionState.currentProjectKey,
        repoKey: sessionState.currentRepoKey,
        subprojectKey: sessionState.currentSubprojectKey,
        pinMode: sessionState.pinMode,
      };
    }
    throw error;
  }
  activeWorkspaceKey = repoResolved.workspace_key;
  const repoProject = splitProjectKey(repoResolved.project.key);
  let detectedSubprojectKey: string | null = null;
  if (
    workspaceSettings.enable_monorepo_resolution === true &&
    gitContext.repo_root &&
    gitContext.cwd
  ) {
    detectedSubprojectKey = await detectSubproject(gitContext.repo_root, gitContext.cwd, {
      monorepoDetectionLevel: workspaceSettings.monorepo_detection_level ?? 2,
      monorepoWorkspaceGlobs: workspaceSettings.monorepo_workspace_globs ?? ['apps/*', 'packages/*'],
      monorepoExcludeGlobs:
        workspaceSettings.monorepo_exclude_globs ??
        ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '.next/**'],
      monorepoRootMarkers:
        workspaceSettings.monorepo_root_markers ??
        ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'],
      monorepoMaxDepth: workspaceSettings.monorepo_max_depth ?? 3,
    });
    if (detectedSubprojectKey) {
      gitContext.monorepo = {
        enabled: true,
        candidate_subpaths: [detectedSubprojectKey],
      };
    }
  }

  let candidateProjectKey = repoResolved.project.key;
  if (detectedSubprojectKey) {
    try {
      const subprojectResolved = await resolveProjectFromContext(gitContext, {
        includeMonorepo: true,
      });
      candidateProjectKey = subprojectResolved.project.key;
    } catch (error) {
      logger.warn('subproject resolution failed; falling back to repo project', toErrorMessage(error));
    }
  }

  const candidate = splitProjectKey(candidateProjectKey);
  const decision = decideContextTransition(
    sessionState,
    {
      autoSwitchRepo: workspaceSettings.auto_switch_repo,
      autoSwitchSubproject: workspaceSettings.auto_switch_subproject,
    },
    {
      projectKey: candidateProjectKey,
      repoKey: repoProject.repoKey || candidate.repoKey,
      subprojectKey: detectedSubprojectKey,
    }
  );

  applySessionState(decision.next);
  if (decision.switched && sessionState.currentProjectKey) {
    console.error(`[memory-core] auto-switched project to ${sessionState.currentProjectKey}`);
  }

  if (!sessionState.currentProjectKey) {
    setSessionProject(candidateProjectKey, sessionState.pinMode);
  }

  return {
    workspaceKey: activeWorkspaceKey,
    projectKey: sessionState.currentProjectKey || candidateProjectKey,
    repoKey: sessionState.currentRepoKey,
    subprojectKey: sessionState.currentSubprojectKey,
    pinMode: sessionState.pinMode,
  };
}

async function resolveProject(options: {
  manualProjectKey?: string;
  includeMonorepo: boolean;
}): Promise<ResolveResponse> {
  const gitContext = await detectGitContext(process.cwd(), {
    enableMonorepoDetection: false,
  });
  return resolveProjectFromContext(gitContext, options);
}

async function resolveProjectFromContext(
  gitContext: Awaited<ReturnType<typeof detectGitContext>>,
  options: {
    manualProjectKey?: string;
    includeMonorepo: boolean;
  }
): Promise<ResolveResponse> {
  if (!activeWorkspaceKey) {
    activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
  }

  const payload: Record<string, unknown> = {
    workspace_key: activeWorkspaceKey,
  };
  if (gitContext.github_remote) {
    payload.github_remote = gitContext.github_remote;
  }
  if (gitContext.repo_root_slug) {
    payload.repo_root_slug = gitContext.repo_root_slug;
  }
  if (gitContext.repo_root) {
    payload.repo_root = gitContext.repo_root;
  }
  if (gitContext.cwd) {
    payload.cwd = gitContext.cwd;
  }
  if (gitContext.relative_path) {
    payload.relative_path = gitContext.relative_path;
  }
  if (options.includeMonorepo && gitContext.monorepo?.candidate_subpaths?.length) {
    payload.monorepo = {
      enabled: gitContext.monorepo.enabled ?? true,
      candidate_subpaths: gitContext.monorepo.candidate_subpaths,
    };
  } else if (!options.includeMonorepo) {
    payload.monorepo = {
      enabled: false,
    };
  }
  if (options.manualProjectKey) {
    payload.manual_project_key = options.manualProjectKey;
  }

  return requestJson<ResolveResponse>('/v1/resolve-project', {
    method: 'POST',
    body: payload,
  });
}

async function resolveProjectKeyOverride(projectKey: string, workspaceKey: string): Promise<string> {
  const resolved = await requestJson<ResolveResponse>('/v1/resolve-project', {
    method: 'POST',
    body: {
      workspace_key: workspaceKey,
      manual_project_key: projectKey,
      monorepo: {
        enabled: false,
      },
    },
  });
  return resolved.project.key;
}

async function getWorkspaceSettings(): Promise<WorkspaceSettingsResponse> {
  if (!activeWorkspaceKey) {
    activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
  }
  const query = new URLSearchParams({
    workspace_key: activeWorkspaceKey,
  });
  return requestJson<WorkspaceSettingsResponse>(`/v1/workspace-settings?${query.toString()}`, {
    method: 'GET',
  });
}

function setSessionProject(projectKey: string, pinMode: boolean): void {
  const parsed = splitProjectKey(projectKey);
  sessionState.currentProjectKey = projectKey;
  sessionState.currentRepoKey = parsed.repoKey;
  sessionState.currentSubprojectKey = parsed.subprojectKey;
  sessionState.pinMode = pinMode;
}

function applySessionState(next: SessionState): void {
  sessionState.currentProjectKey = next.currentProjectKey;
  sessionState.currentRepoKey = next.currentRepoKey;
  sessionState.currentSubprojectKey = next.currentSubprojectKey;
  sessionState.pinMode = next.pinMode;
}

async function listProjects(workspaceKey: string): Promise<ProjectSummary[]> {
  const response = await requestJson<{ projects: ProjectSummary[] }>(
    `/v1/projects?workspace_key=${encodeURIComponent(workspaceKey)}`,
    {
      method: 'GET',
    }
  );
  return response.projects;
}

async function requestJson<T>(
  pathname: string,
  options: {
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
  }
): Promise<T> {
  const response = await fetch(`${MEMORY_CORE_URL}${pathname}`, {
    method: options.method,
    headers: {
      authorization: `Bearer ${MEMORY_CORE_API_KEY}`,
      'content-type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return payload as T;
}

function textResult(text: string) {
  return { content: [{ type: 'text', text }] };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'unknown error';
}

type CaptureEventType = 'post_commit' | 'post_merge' | 'post_checkout';

async function ensureGitHooksInstalledForCwd(workspaceKey: string): Promise<void> {
  const gitContext = await detectGitContext(process.cwd(), {
    enableMonorepoDetection: false,
  });
  if (!gitContext.repo_root) {
    return;
  }
  await ensureGitHooksInstalled(gitContext.repo_root, workspaceKey);
}

async function ensureGitHooksInstalled(repoRoot: string, workspaceKey: string): Promise<void> {
  const cacheKey = `${repoRoot}::${workspaceKey}`;
  if (installedHookRepos.has(cacheKey)) {
    return;
  }

  const hooksDir = path.join(repoRoot, '.git', 'hooks');
  await mkdir(hooksDir, { recursive: true });

  const nodePath = shellEscape(process.execPath);
  const scriptPath = shellEscape(CLI_SCRIPT_PATH);
  const coreUrl = shellEscape(MEMORY_CORE_URL);
  const apiKey = shellEscape(MEMORY_CORE_API_KEY);
  const workspace = shellEscape(workspaceKey);

  const basePrefix = `MEMORY_CORE_URL=${coreUrl} MEMORY_CORE_API_KEY=${apiKey} MEMORY_CORE_WORKSPACE_KEY=${workspace} ${nodePath} ${scriptPath} capture`;
  const hookContents: Array<{ name: 'post-commit' | 'post-merge' | 'post-checkout'; body: string }> = [
    {
      name: 'post-commit',
      body: `${basePrefix} --event post_commit`,
    },
    {
      name: 'post-merge',
      body: `${basePrefix} --event post_merge --squash "$1"`,
    },
    {
      name: 'post-checkout',
      body: `${basePrefix} --event post_checkout --from-ref "$1" --to-ref "$2" --checkout-flag "$3"`,
    },
  ];

  for (const hook of hookContents) {
    const hookPath = path.join(hooksDir, hook.name);
    const content = `#!/bin/sh
${MANAGED_HOOK_MARKER}: ${hook.name}
(
  ${hook.body} >/dev/null 2>&1
) &
exit 0
`;
    await writeManagedHook(hookPath, content);
  }

  installedHookRepos.add(cacheKey);
}

async function writeManagedHook(hookPath: string, content: string): Promise<void> {
  let existing = '';
  try {
    existing = await readFile(hookPath, 'utf8');
  } catch {
    existing = '';
  }
  if (existing && !existing.includes(MANAGED_HOOK_MARKER)) {
    logger.warn(`existing hook is not managed by claustrum, skipped: ${hookPath}`);
    return;
  }
  await writeFile(hookPath, content, 'utf8');
  await chmod(hookPath, 0o755);
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

async function runCaptureCommand(argv: string[]): Promise<void> {
  if (!MEMORY_CORE_URL) {
    throw new Error('MEMORY_CORE_URL is required for capture mode.');
  }
  if (!MEMORY_CORE_API_KEY) {
    throw new Error('MEMORY_CORE_API_KEY is required for capture mode.');
  }

  const options = parseCliOptions(argv);
  const rawEvent = String(options.event || '').trim() as CaptureEventType;
  if (!rawEvent || !['post_commit', 'post_merge', 'post_checkout'].includes(rawEvent)) {
    throw new Error('capture requires --event post_commit|post_merge|post_checkout');
  }

  const workspaceKey =
    String(options['workspace-key'] || process.env.MEMORY_CORE_WORKSPACE_KEY || DEFAULT_WORKSPACE_KEY).trim() ||
    DEFAULT_WORKSPACE_KEY;
  activeWorkspaceKey = workspaceKey;

  const workspaceSettings = await getWorkspaceSettings();
  const gitContext = await detectGitContext(process.cwd(), {
    enableMonorepoDetection: false,
  });
  if (!gitContext.repo_root) {
    logger.warn('capture skipped: git repository not detected');
    return;
  }

  if (workspaceSettings.enable_monorepo_resolution === true && gitContext.repo_root && gitContext.cwd) {
    const subpath = await detectSubproject(gitContext.repo_root, gitContext.cwd, {
      monorepoDetectionLevel: workspaceSettings.monorepo_detection_level ?? 2,
      monorepoWorkspaceGlobs: workspaceSettings.monorepo_workspace_globs ?? ['apps/*', 'packages/*'],
      monorepoExcludeGlobs:
        workspaceSettings.monorepo_exclude_globs ??
        ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '.next/**'],
      monorepoRootMarkers:
        workspaceSettings.monorepo_root_markers ??
        ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'],
      monorepoMaxDepth: workspaceSettings.monorepo_max_depth ?? 3,
    });
    if (subpath) {
      gitContext.monorepo = {
        enabled: true,
        candidate_subpaths: [subpath],
      };
    }
  }

  const resolved = await resolveProjectFromContext(gitContext, {
    includeMonorepo: Boolean(gitContext.monorepo?.candidate_subpaths?.length),
  });

  const branch = (await safeGitExec(process.cwd(), ['rev-parse', '--abbrev-ref', 'HEAD'])) || undefined;
  const commitSha = (await safeGitExec(process.cwd(), ['rev-parse', 'HEAD'])) || undefined;
  const commitMessage = (await safeGitExec(process.cwd(), ['log', '-1', '--pretty=%s'])) || undefined;
  const changedFiles = await getChangedFiles(process.cwd());
  const fromRef = typeof options['from-ref'] === 'string' ? String(options['from-ref']) : undefined;
  const toRef = typeof options['to-ref'] === 'string' ? String(options['to-ref']) : undefined;
  const fromBranch = fromRef ? await resolveBranchName(process.cwd(), fromRef) : undefined;
  const toBranch = toRef ? await resolveBranchName(process.cwd(), toRef) : branch;

  await requestJson('/v1/raw-events', {
    method: 'POST',
    body: {
      workspace_key: resolved.workspace_key,
      project_key: resolved.project.key,
      event_type: rawEvent,
      branch,
      from_branch: rawEvent === 'post_checkout' ? fromBranch : undefined,
      to_branch: rawEvent === 'post_checkout' ? toBranch : undefined,
      commit_sha: rawEvent === 'post_checkout' ? undefined : commitSha,
      commit_message: rawEvent === 'post_checkout' ? undefined : commitMessage,
      changed_files: changedFiles.length > 0 ? changedFiles : undefined,
      metadata: {
        source: 'git_hook',
        hook_event: rawEvent,
        checkout_flag:
          typeof options['checkout-flag'] === 'string' ? String(options['checkout-flag']) : undefined,
        squash: typeof options.squash === 'string' ? String(options.squash) : undefined,
        repo_root: gitContext.repo_root,
        cwd: gitContext.cwd,
        relative_path: gitContext.relative_path,
        github_remote: gitContext.github_remote?.normalized,
      },
    },
  });
}

async function runInstallHooksCommand(argv: string[]): Promise<void> {
  if (!MEMORY_CORE_URL) {
    throw new Error('MEMORY_CORE_URL is required for install-hooks mode.');
  }
  if (!MEMORY_CORE_API_KEY) {
    throw new Error('MEMORY_CORE_API_KEY is required for install-hooks mode.');
  }
  const options = parseCliOptions(argv);
  const workspaceKey =
    String(options['workspace-key'] || process.env.MEMORY_CORE_WORKSPACE_KEY || DEFAULT_WORKSPACE_KEY).trim() ||
    DEFAULT_WORKSPACE_KEY;
  await ensureGitHooksInstalledForCwd(workspaceKey);
}

function parseCliOptions(argv: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    i += 1;
  }
  return parsed;
}

async function safeGitExec(cwd: string, args: string[]): Promise<string | null> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000,
    });
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

async function getChangedFiles(cwd: string): Promise<string[]> {
  const output = await safeGitExec(cwd, ['show', '--name-only', '--pretty=format:', 'HEAD']);
  if (!output) {
    return [];
  }
  return output
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2000);
}

async function resolveBranchName(cwd: string, ref: string): Promise<string | undefined> {
  const output = await safeGitExec(cwd, ['name-rev', '--name-only', '--exclude=tags/*', ref]);
  if (!output) {
    return undefined;
  }
  const normalized = output
    .replace(/^remotes\/origin\//, '')
    .replace(/^heads\//, '')
    .replace(/\^0$/, '')
    .trim();
  if (!normalized || normalized === 'undefined') {
    return undefined;
  }
  return normalized;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'capture') {
    await runCaptureCommand(rest);
    return;
  }
  if (command === 'install-hooks') {
    await runInstallHooksCommand(rest);
    return;
  }
  await runMcpServer();
}

main().catch((error) => {
  logger.error('startup failed', error);
  process.exit(1);
});
