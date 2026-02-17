export type JiraIssueSummary = {
  key: string;
  summary: string;
  status: string;
  url: string;
  updated: string;
  assignee?: string;
  issue_type?: string;
  project_key?: string;
};

export type JiraIssueReadResult = {
  key: string;
  summary: string;
  status: string;
  url: string;
  updated: string;
  content: string;
};

export class JiraClientAdapter {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
  }

  async searchIssues(query: string, limit = 10): Promise<JiraIssueSummary[]> {
    const safeQuery = query.replace(/["\\]/g, '\\$&');
    const params = new URLSearchParams({
      jql: `text ~ "${safeQuery}" ORDER BY updated DESC`,
      maxResults: String(Math.min(Math.max(limit, 1), 20)),
      fields: 'summary,status,assignee,updated,issuetype,project',
    });
    const response = await this.requestJson<{
      issues?: Array<{
        key?: string;
        fields?: {
          summary?: string;
          updated?: string;
          status?: { name?: string };
          assignee?: { displayName?: string };
          issuetype?: { name?: string };
          project?: { key?: string };
        };
      }>;
    }>(`/rest/api/3/search?${params.toString()}`);

    const issues = Array.isArray(response.issues) ? response.issues : [];
    const out: JiraIssueSummary[] = [];
    for (const item of issues) {
      const key = String(item.key || '').trim();
      if (!key) {
        continue;
      }
      const fields = item.fields || {};
      out.push({
        key,
        summary: String(fields.summary || '').trim() || '(no summary)',
        status: String(fields.status?.name || '').trim() || 'unknown',
        url: `${this.baseUrl}/browse/${encodeURIComponent(key)}`,
        updated: String(fields.updated || ''),
        assignee: fields.assignee?.displayName ? String(fields.assignee.displayName) : undefined,
        issue_type: fields.issuetype?.name ? String(fields.issuetype.name) : undefined,
        project_key: fields.project?.key ? String(fields.project.key) : undefined,
      });
    }
    return out;
  }

  async readIssue(issueKey: string, maxChars: number): Promise<JiraIssueReadResult> {
    const key = issueKey.trim().toUpperCase();
    if (!key) {
      throw new Error('issue_key is required');
    }

    const params = new URLSearchParams({
      fields: 'summary,status,description,comment,updated',
    });
    const issue = await this.requestJson<{
      key?: string;
      fields?: {
        summary?: string;
        updated?: string;
        status?: { name?: string };
        description?: unknown;
        comment?: {
          comments?: Array<{ body?: unknown }>;
        };
      };
    }>(`/rest/api/3/issue/${encodeURIComponent(key)}?${params.toString()}`);

    const finalKey = String(issue.key || key);
    const fields = issue.fields || {};
    const description = extractAtlassianDocText(fields.description);
    const comments = Array.isArray(fields.comment?.comments)
      ? fields.comment!.comments
          .slice(0, 8)
          .map((comment) => extractAtlassianDocText(comment.body))
          .filter(Boolean)
      : [];
    const merged = [description, ...comments].filter(Boolean).join('\n\n');

    return {
      key: finalKey,
      summary: String(fields.summary || '').trim() || '(no summary)',
      status: String(fields.status?.name || '').trim() || 'unknown',
      url: `${this.baseUrl}/browse/${encodeURIComponent(finalKey)}`,
      updated: String(fields.updated || ''),
      content: merged.slice(0, maxChars),
    };
  }

  private async requestJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        authorization: this.authHeader,
        accept: 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const payloadObj = payload as Record<string, unknown>;
      const errors = Array.isArray(payloadObj.errorMessages) ? payloadObj.errorMessages : [];
      const message = typeof errors[0] === 'string' ? String(errors[0]) : `${response.status} ${response.statusText}`;
      throw new Error(`Jira API request failed: ${message}`);
    }
    return payload as T;
  }
}

export function extractAtlassianDocText(value: unknown): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => extractAtlassianDocText(item)).filter(Boolean).join('\n').trim();
  }
  if (typeof value !== 'object') {
    return '';
  }

  const node = value as Record<string, unknown>;
  if (typeof node.text === 'string') {
    return node.text.trim();
  }

  const content = Array.isArray(node.content)
    ? node.content.map((item) => extractAtlassianDocText(item)).filter(Boolean).join('\n')
    : '';

  if (content) {
    return content.trim();
  }

  if (node.attrs && typeof node.attrs === 'object') {
    const attrs = node.attrs as Record<string, unknown>;
    if (typeof attrs.text === 'string') {
      return attrs.text.trim();
    }
  }

  return '';
}
