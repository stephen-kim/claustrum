export type LinearIssueSummary = {
  id: string;
  identifier: string;
  title: string;
  state: string;
  url: string;
  updatedAt: string;
  assignee?: string;
  project?: string;
};

export type LinearIssueReadResult = {
  id: string;
  identifier: string;
  title: string;
  state: string;
  url: string;
  updatedAt: string;
  content: string;
};

type LinearIssueNode = {
  id?: string;
  identifier?: string;
  title?: string;
  description?: string | null;
  url?: string;
  updatedAt?: string;
  state?: { name?: string | null } | null;
  assignee?: { name?: string | null } | null;
  project?: { name?: string | null } | null;
};

export class LinearClientAdapter {
  private readonly graphqlUrl: string;

  constructor(
    private readonly apiKey: string,
    apiUrl?: string
  ) {
    this.graphqlUrl = (apiUrl || 'https://api.linear.app/graphql').trim();
  }

  async searchIssues(query: string, limit = 10): Promise<LinearIssueSummary[]> {
    const first = Math.min(Math.max(limit, 1), 20);
    const data = await this.requestGraphql<{
      issueSearch?: { nodes?: LinearIssueNode[] };
    }>(
      `
      query LinearIssueSearch($query: String!, $first: Int!) {
        issueSearch(query: $query, first: $first) {
          nodes {
            id
            identifier
            title
            url
            updatedAt
            state { name }
            assignee { name }
            project { name }
          }
        }
      }
      `,
      { query, first }
    );

    const nodes = Array.isArray(data.issueSearch?.nodes) ? data.issueSearch!.nodes! : [];
    return nodes
      .filter((node) => Boolean(node.id && node.identifier))
      .map((node) => ({
        id: String(node.id),
        identifier: String(node.identifier),
        title: String(node.title || '').trim() || '(untitled)',
        state: String(node.state?.name || '').trim() || 'unknown',
        url: String(node.url || '').trim() || `https://linear.app/issue/${String(node.identifier)}`,
        updatedAt: String(node.updatedAt || ''),
        assignee: node.assignee?.name ? String(node.assignee.name) : undefined,
        project: node.project?.name ? String(node.project.name) : undefined,
      }));
  }

  async readIssue(issueKey: string, maxChars: number): Promise<LinearIssueReadResult> {
    const trimmed = issueKey.trim();
    if (!trimmed) {
      throw new Error('issue_key is required');
    }

    const candidates = await this.requestGraphql<{
      issueSearch?: { nodes?: LinearIssueNode[] };
    }>(
      `
      query LinearIssueRead($query: String!, $first: Int!) {
        issueSearch(query: $query, first: $first) {
          nodes {
            id
            identifier
            title
            description
            url
            updatedAt
            state { name }
          }
        }
      }
      `,
      { query: trimmed, first: 5 }
    );

    const nodes = Array.isArray(candidates.issueSearch?.nodes)
      ? candidates.issueSearch!.nodes!.filter((node) => Boolean(node.id && node.identifier))
      : [];
    if (nodes.length === 0) {
      throw new Error(`Linear issue not found for query: ${trimmed}`);
    }

    const exact = nodes.find((node) => {
      const identifier = String(node.identifier || '').toUpperCase();
      return identifier === trimmed.toUpperCase();
    });
    const target = exact || nodes[0];
    const description = String(target.description || '').trim();

    return {
      id: String(target.id),
      identifier: String(target.identifier),
      title: String(target.title || '').trim() || '(untitled)',
      state: String(target.state?.name || '').trim() || 'unknown',
      url:
        String(target.url || '').trim() ||
        `https://linear.app/issue/${encodeURIComponent(String(target.identifier || '').toUpperCase())}`,
      updatedAt: String(target.updatedAt || ''),
      content: description.slice(0, maxChars),
    };
  }

  private async requestGraphql<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        authorization: this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    const payloadObj =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

    if (!response.ok) {
      throw new Error(`Linear API request failed: ${response.status} ${response.statusText}`);
    }

    const errors = Array.isArray(payloadObj.errors) ? payloadObj.errors : [];
    if (errors.length > 0) {
      const first = errors[0];
      if (first && typeof first === 'object' && typeof (first as Record<string, unknown>).message === 'string') {
        throw new Error(`Linear API request failed: ${String((first as Record<string, unknown>).message)}`);
      }
      throw new Error('Linear API request failed');
    }

    const data = payloadObj.data;
    if (!data || typeof data !== 'object') {
      throw new Error('Linear API response missing data');
    }
    return data as T;
  }
}
