import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { memoryTypeSchema } from '@context-sync/shared';
import { Logger, parseLogLevel } from './logger.js';
import { detectGitContext } from './git-context.js';
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
} from './types.js';

const MEMORY_CORE_URL = (process.env.MEMORY_CORE_URL || '').trim().replace(/\/+$/, '');
const MEMORY_CORE_API_KEY = (process.env.MEMORY_CORE_API_KEY || '').trim();
const DEFAULT_WORKSPACE_KEY = process.env.MEMORY_CORE_WORKSPACE_KEY || 'personal';
const logger = new Logger(parseLogLevel(process.env.MCP_ADAPTER_LOG_LEVEL));

let activeWorkspaceKey: string | null = null;
let activeProjectKey: string | null = null;
let activeProjectId: string | null = null;

async function main() {
  if (!MEMORY_CORE_URL) {
    throw new Error(
      'MEMORY_CORE_URL is required (e.g. http://memory-core:8080 in docker network).'
    );
  }
  if (!MEMORY_CORE_API_KEY.trim()) {
    throw new Error('MEMORY_CORE_API_KEY is required.');
  }

  const server = new Server(
    { name: 'context-sync-mcp-adapter', version: '0.2.0' },
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
      activeProjectKey = null;
      activeProjectId = null;
      return textResult(`Workspace selected: ${key}`);
    }

    if (toolName === 'set_project') {
      const key = String(args.key || '').trim();
      if (!key) {
        return textResult('Missing key');
      }
      const resolved = await ensureResolvedProject(key);
      return textResult(
        `Project selected: ${resolved.project.key} (${resolved.resolution})`
      );
    }

    if (toolName === 'remember') {
      const resolved = await ensureResolvedProject();
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
          workspace_key: resolved.workspace_key,
          project_key: resolved.project.key,
          type,
          content,
          metadata,
        },
      });
      return textResult(`Stored memory ${memory.id} in ${resolved.project.key}`);
    }

    if (toolName === 'recall') {
      const projectOverride = args.project_key ? String(args.project_key).trim() : '';
      const resolved = projectOverride
        ? await ensureResolvedProject(projectOverride)
        : await ensureResolvedProject();

      const query = new URLSearchParams({
        workspace_key: resolved.workspace_key,
        project_key: resolved.project.key,
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
      const q = String(args.q || '').trim();
      if (!q) {
        return textResult('q is required');
      }

      const workspaceKey = activeWorkspaceKey || DEFAULT_WORKSPACE_KEY;
      const projectKey = args.project_key
        ? String(args.project_key).trim()
        : activeProjectKey || '';
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

async function ensureResolvedProject(manualProjectKey?: string): Promise<ResolveResponse> {
  if (!activeWorkspaceKey) {
    activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
  }

  if (!manualProjectKey && activeProjectKey && activeProjectId) {
    return {
      workspace_key: activeWorkspaceKey,
      project: {
        id: activeProjectId,
        key: activeProjectKey,
      },
      resolution: 'manual',
    };
  }

  const gitContext = await detectGitContext(process.cwd());
  const payload: Record<string, unknown> = {
    workspace_key: activeWorkspaceKey,
  };
  if (gitContext.github_remote) {
    payload.github_remote = gitContext.github_remote;
  }
  if (gitContext.repo_root_slug) {
    payload.repo_root_slug = gitContext.repo_root_slug;
  }
  if (manualProjectKey) {
    payload.manual_project_key = manualProjectKey;
  }

  const resolved = await requestJson<ResolveResponse>('/v1/resolve-project', {
    method: 'POST',
    body: payload,
  });

  activeWorkspaceKey = resolved.workspace_key;
  activeProjectKey = resolved.project.key;
  activeProjectId = resolved.project.id;
  return resolved;
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

main().catch((error) => {
  logger.error('startup failed', error);
  process.exit(1);
});
