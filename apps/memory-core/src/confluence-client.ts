export type ConfluencePageSummary = {
  id: string;
  title: string;
  url: string;
  last_edited_time: string;
  space?: string;
};

export type ConfluenceReadResult = {
  id: string;
  title: string;
  url: string;
  last_edited_time: string;
  content: string;
};

export class ConfluenceClientAdapter {
  private readonly baseUrl: string;
  private readonly apiBase: string;
  private readonly authHeader: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiBase = this.baseUrl.endsWith('/wiki')
      ? `${this.baseUrl}/rest/api`
      : `${this.baseUrl}/wiki/rest/api`;
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
  }

  async searchPages(query: string, limit = 10): Promise<ConfluencePageSummary[]> {
    const safe = query.replace(/["\\]/g, '\\$&');
    const cql = `type=page AND text~"${safe}" ORDER BY lastmodified DESC`;
    const params = new URLSearchParams({
      cql,
      limit: String(Math.min(Math.max(limit, 1), 20)),
    });

    const response = await this.requestJson<{
      results?: Array<{
        lastModified?: string;
        content?: {
          id?: string;
          title?: string;
          _links?: { webui?: string };
          space?: { name?: string };
          version?: { when?: string };
        };
      }>;
    }>(`/search?${params.toString()}`);

    const rows = Array.isArray(response.results) ? response.results : [];
    const out: ConfluencePageSummary[] = [];
    for (const row of rows) {
      const content = row.content || {};
      const id = String(content.id || '').trim();
      if (!id) {
        continue;
      }
      const webUi = String(content._links?.webui || '').trim();
      const url = webUi ? `${this.baseUrl}${webUi}` : `${this.baseUrl}/wiki/pages/viewpage.action?pageId=${id}`;
      out.push({
        id,
        title: String(content.title || '').trim() || '(untitled)',
        url,
        last_edited_time: String(content.version?.when || row.lastModified || ''),
        space: content.space?.name ? String(content.space.name) : undefined,
      });
    }
    return out;
  }

  async readPage(pageIdOrUrl: string, maxChars: number): Promise<ConfluenceReadResult> {
    const pageId = normalizeConfluencePageId(pageIdOrUrl);
    const params = new URLSearchParams({
      expand: 'body.storage,version,_links,space',
    });
    const page = await this.requestJson<{
      id?: string;
      title?: string;
      body?: {
        storage?: {
          value?: string;
        };
      };
      version?: {
        when?: string;
      };
      _links?: {
        webui?: string;
      };
    }>(`/content/${encodeURIComponent(pageId)}?${params.toString()}`);

    const contentHtml = String(page.body?.storage?.value || '');
    const plainText = htmlToText(contentHtml).slice(0, maxChars);
    const webUi = String(page._links?.webui || '');
    const url = webUi ? `${this.baseUrl}${webUi}` : `${this.baseUrl}/wiki/pages/viewpage.action?pageId=${pageId}`;

    return {
      id: String(page.id || pageId),
      title: String(page.title || '').trim() || '(untitled)',
      url,
      last_edited_time: String(page.version?.when || ''),
      content: plainText,
    };
  }

  private async requestJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      method: 'GET',
      headers: {
        authorization: this.authHeader,
        accept: 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload && typeof (payload as Record<string, unknown>).message === 'string'
          ? String((payload as Record<string, unknown>).message)
          : `${response.status} ${response.statusText}`;
      throw new Error(`Confluence API request failed: ${message}`);
    }
    return payload as T;
  }
}

export function normalizeConfluencePageId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('page_id is required');
  }
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  const fromQuery = trimmed.match(/[?&]pageId=(\d+)/i);
  if (fromQuery) {
    return fromQuery[1];
  }
  const fromPath = trimmed.match(/\/pages\/(\d+)\b/i);
  if (fromPath) {
    return fromPath[1];
  }
  throw new Error(`Invalid Confluence page id/url: ${input}`);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
