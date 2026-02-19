import type {
  ConfluencePage,
  ConfluenceReadResponse,
  JiraIssue,
  JiraIssueReadResponse,
  LinearIssue,
  LinearIssueReadResponse,
  NotionReadResponse,
  NotionSearchPage,
} from './types.js';
import type { TextResult, ToolHandlerDeps } from './tool-call-handler.js';

export async function handleIntegrationToolCall(args: {
  toolName: string;
  toolArgs: Record<string, unknown>;
  deps: ToolHandlerDeps;
}): Promise<TextResult | null> {
  const { toolName, toolArgs, deps } = args;

  if (toolName === 'notion_search') {
    const q = String(toolArgs.q || '').trim();
    if (!q) {
      return deps.textResult('q is required');
    }
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const limit = typeof toolArgs.limit === 'number' ? Math.min(Math.max(toolArgs.limit, 1), 20) : 10;
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      q,
      limit: String(limit),
    });
    const response = await deps.requestJson<{ pages: NotionSearchPage[] }>(
      `/v1/notion/search?${query.toString()}`,
      { method: 'GET' }
    );
    const lines = response.pages.map((page) => {
      return `${page.title}\n- ${page.url}\n- page_id: ${page.id}\n- edited: ${page.last_edited_time}`;
    });
    return deps.textResult(lines.length > 0 ? lines.join('\n\n') : 'No Notion pages found');
  }

  if (toolName === 'notion_read') {
    const pageId = String(toolArgs.page_id || '').trim();
    if (!pageId) {
      return deps.textResult('page_id is required');
    }
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const maxChars =
      typeof toolArgs.max_chars === 'number' ? Math.min(Math.max(toolArgs.max_chars, 200), 20000) : 4000;
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      page_id: pageId,
      max_chars: String(maxChars),
    });
    const page = await deps.requestJson<NotionReadResponse>(`/v1/notion/read?${query.toString()}`, {
      method: 'GET',
    });
    const text = `${page.title}\n${page.url}\n\n${page.content}`;
    return deps.textResult(text);
  }

  if (toolName === 'notion_context') {
    const pageId = String(toolArgs.page_id || '').trim();
    const q = String(toolArgs.q || '').trim();
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const limit = typeof toolArgs.limit === 'number' ? Math.min(Math.max(toolArgs.limit, 1), 5) : 3;
    const maxChars =
      typeof toolArgs.max_chars === 'number' ? Math.min(Math.max(toolArgs.max_chars, 200), 4000) : 1200;

    if (pageId) {
      const query = new URLSearchParams({
        workspace_key: workspaceKey,
        page_id: pageId,
        max_chars: String(maxChars),
      });
      const page = await deps.requestJson<NotionReadResponse>(`/v1/notion/read?${query.toString()}`, {
        method: 'GET',
      });
      const text = `Context page (direct)\n${page.title}\n${page.url}\n\n${page.content}`;
      return deps.textResult(text);
    }

    if (!q) {
      return deps.textResult('q or page_id is required');
    }

    const searchQuery = new URLSearchParams({
      workspace_key: workspaceKey,
      q,
      limit: String(limit),
    });
    const search = await deps.requestJson<{ pages: NotionSearchPage[] }>(
      `/v1/notion/search?${searchQuery.toString()}`,
      { method: 'GET' }
    );

    if (search.pages.length === 0) {
      return deps.textResult('No Notion context pages found');
    }

    const sections: string[] = [];
    for (const page of search.pages.slice(0, limit)) {
      try {
        const readQuery = new URLSearchParams({
          workspace_key: workspaceKey,
          page_id: page.id,
          max_chars: String(maxChars),
        });
        const detail = await deps.requestJson<NotionReadResponse>(
          `/v1/notion/read?${readQuery.toString()}`,
          { method: 'GET' }
        );
        sections.push(`### ${detail.title}\n${detail.url}\n${detail.content}`);
      } catch (error) {
        sections.push(`### ${page.title}\n${page.url}\n(read failed: ${deps.toErrorMessage(error)})`);
      }
    }
    return deps.textResult(sections.join('\n\n').slice(0, 20000));
  }

  if (toolName === 'jira_search') {
    const q = String(toolArgs.q || '').trim();
    if (!q) {
      return deps.textResult('q is required');
    }
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const limit = typeof toolArgs.limit === 'number' ? Math.min(Math.max(toolArgs.limit, 1), 20) : 10;
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      q,
      limit: String(limit),
    });
    const response = await deps.requestJson<{ issues: JiraIssue[] }>(`/v1/jira/search?${query.toString()}`, {
      method: 'GET',
    });
    const lines = response.issues.map((issue) => {
      const assignee = issue.assignee ? `, assignee=${issue.assignee}` : '';
      return `${issue.key} [${issue.status}] ${issue.summary}\n- ${issue.url}\n- updated: ${issue.updated}${assignee}`;
    });
    return deps.textResult(lines.length > 0 ? lines.join('\n\n') : 'No Jira issues found');
  }

  if (toolName === 'jira_read') {
    const issueKey = String(toolArgs.issue_key || '').trim();
    if (!issueKey) {
      return deps.textResult('issue_key is required');
    }
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const maxChars =
      typeof toolArgs.max_chars === 'number' ? Math.min(Math.max(toolArgs.max_chars, 200), 20000) : 4000;
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      issue_key: issueKey,
      max_chars: String(maxChars),
    });
    const issue = await deps.requestJson<JiraIssueReadResponse>(`/v1/jira/read?${query.toString()}`, {
      method: 'GET',
    });
    return deps.textResult(
      `${issue.key} [${issue.status}] ${issue.summary}\n${issue.url}\nupdated: ${issue.updated}\n\n${issue.content}`
    );
  }

  if (toolName === 'confluence_search') {
    const q = String(toolArgs.q || '').trim();
    if (!q) {
      return deps.textResult('q is required');
    }
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const limit = typeof toolArgs.limit === 'number' ? Math.min(Math.max(toolArgs.limit, 1), 20) : 10;
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      q,
      limit: String(limit),
    });
    const response = await deps.requestJson<{ pages: ConfluencePage[] }>(
      `/v1/confluence/search?${query.toString()}`,
      { method: 'GET' }
    );
    const lines = response.pages.map((page) => {
      const space = page.space ? `, space=${page.space}` : '';
      return `${page.title}${space}\n- ${page.url}\n- page_id: ${page.id}\n- edited: ${page.last_edited_time}`;
    });
    return deps.textResult(lines.length > 0 ? lines.join('\n\n') : 'No Confluence pages found');
  }

  if (toolName === 'confluence_read') {
    const pageId = String(toolArgs.page_id || '').trim();
    if (!pageId) {
      return deps.textResult('page_id is required');
    }
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const maxChars =
      typeof toolArgs.max_chars === 'number' ? Math.min(Math.max(toolArgs.max_chars, 200), 20000) : 4000;
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      page_id: pageId,
      max_chars: String(maxChars),
    });
    const page = await deps.requestJson<ConfluenceReadResponse>(
      `/v1/confluence/read?${query.toString()}`,
      { method: 'GET' }
    );
    return deps.textResult(`${page.title}\n${page.url}\n\n${page.content}`);
  }

  if (toolName === 'linear_search') {
    const q = String(toolArgs.q || '').trim();
    if (!q) {
      return deps.textResult('q is required');
    }
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const limit = typeof toolArgs.limit === 'number' ? Math.min(Math.max(toolArgs.limit, 1), 20) : 10;
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      q,
      limit: String(limit),
    });
    const response = await deps.requestJson<{ issues: LinearIssue[] }>(
      `/v1/linear/search?${query.toString()}`,
      { method: 'GET' }
    );
    const lines = response.issues.map((issue) => {
      const assignee = issue.assignee ? `, assignee=${issue.assignee}` : '';
      const project = issue.project ? `, project=${issue.project}` : '';
      return `${issue.identifier} [${issue.state}] ${issue.title}\n- ${issue.url}\n- updated: ${issue.updatedAt}${project}${assignee}`;
    });
    return deps.textResult(lines.length > 0 ? lines.join('\n\n') : 'No Linear issues found');
  }

  if (toolName === 'linear_read') {
    const issueKey = String(toolArgs.issue_key || '').trim();
    if (!issueKey) {
      return deps.textResult('issue_key is required');
    }
    const workspaceKey = deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey;
    const maxChars =
      typeof toolArgs.max_chars === 'number' ? Math.min(Math.max(toolArgs.max_chars, 200), 20000) : 4000;
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      issue_key: issueKey,
      max_chars: String(maxChars),
    });
    const issue = await deps.requestJson<LinearIssueReadResponse>(
      `/v1/linear/read?${query.toString()}`,
      { method: 'GET' }
    );
    return deps.textResult(
      `${issue.identifier} [${issue.state}] ${issue.title}\n${issue.url}\nupdated: ${issue.updatedAt}\n\n${issue.content}`
    );
  }

  return null;
}
