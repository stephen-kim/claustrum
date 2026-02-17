import { Client } from '@notionhq/client';

export type NotionPageSummary = {
  id: string;
  title: string;
  url: string;
  last_edited_time: string;
};

export type NotionReadResult = {
  id: string;
  title: string;
  url: string;
  content: string;
};

export type NotionWriteResult = {
  id: string;
  title: string;
  url: string;
  last_edited_time: string;
  mode: 'created' | 'updated';
};

export class NotionClientAdapter {
  private readonly client: Client;

  constructor(
    private readonly token: string,
    private readonly defaultParentPageId?: string
  ) {
    this.client = new Client({ auth: token });
  }

  async searchPages(query: string, limit = 10): Promise<NotionPageSummary[]> {
    const response = await this.client.search({
      query,
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: Math.min(Math.max(limit, 1), 20),
    });

    return response.results
      .filter((result) => result.object === 'page')
      .map((result) => {
        const page = result as Record<string, unknown>;
        return {
          id: String(page.id || ''),
          title: this.extractTitle(page),
          url: String(page.url || ''),
          last_edited_time: String(page.last_edited_time || ''),
        };
      })
      .filter((item) => item.id);
  }

  async readPage(inputPageIdOrUrl: string, maxChars: number): Promise<NotionReadResult> {
    const pageId = normalizeNotionPageId(inputPageIdOrUrl);
    const page = (await this.client.pages.retrieve({ page_id: pageId })) as Record<string, unknown>;
    const title = this.extractTitle(page);
    const url = String(page.url || '');

    const lines: string[] = [];
    let cursor: string | undefined;
    let done = false;

    while (!done && lines.join('\n').length < maxChars) {
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        start_cursor: cursor,
      });
      for (const block of blocks.results) {
        const line = this.extractBlockText(block as Record<string, unknown>);
        if (line) {
          lines.push(line);
        }
        if (lines.join('\n').length >= maxChars) {
          break;
        }
      }
      done = !blocks.has_more || !blocks.next_cursor;
      cursor = blocks.next_cursor || undefined;
    }

    const content = lines.join('\n').slice(0, maxChars);
    return {
      id: pageId,
      title,
      url,
      content,
    };
  }

  async upsertPage(args: {
    title: string;
    content: string;
    pageId?: string;
    parentPageId?: string;
  }): Promise<NotionWriteResult> {
    if (args.pageId && args.pageId.trim()) {
      const pageId = normalizeNotionPageId(args.pageId);
      await this.replacePageContent(pageId, args.content);
      const page = (await this.client.pages.retrieve({ page_id: pageId })) as Record<string, unknown>;
      return {
        id: pageId,
        title: this.extractTitle(page) || args.title,
        url: String(page.url || ''),
        last_edited_time: String(page.last_edited_time || new Date().toISOString()),
        mode: 'updated',
      };
    }

    const parentPageId = args.parentPageId || this.defaultParentPageId;
    if (!parentPageId) {
      throw new Error('parent_page_id is required for create mode (or configure a default parent page).');
    }
    const normalizedParentId = normalizeNotionPageId(parentPageId);
    const chunks = chunkBlocks(this.contentToBlocks(args.content), 100);
    const createResponse = (await this.client.pages.create({
      parent: { page_id: normalizedParentId },
      properties: {
        title: {
          title: [{ text: { content: args.title.slice(0, 200) } }],
        },
      },
      children: (chunks[0] || this.contentToBlocks('')) as any,
    })) as Record<string, unknown>;

    const createdId = String(createResponse.id || '');
    for (let i = 1; i < chunks.length; i += 1) {
      await this.client.blocks.children.append({
        block_id: createdId,
        children: chunks[i] as any,
      });
    }

    return {
      id: createdId,
      title: args.title,
      url: String(createResponse.url || ''),
      last_edited_time: String(createResponse.last_edited_time || new Date().toISOString()),
      mode: 'created',
    };
  }

  private async replacePageContent(pageId: string, content: string): Promise<void> {
    let cursor: string | undefined;
    let done = false;

    while (!done) {
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        start_cursor: cursor,
      });
      for (const block of blocks.results) {
        const blockId = String((block as Record<string, unknown>).id || '');
        if (blockId) {
          await this.client.blocks.delete({ block_id: blockId });
        }
      }
      done = !blocks.has_more || !blocks.next_cursor;
      cursor = blocks.next_cursor || undefined;
    }

    const chunks = chunkBlocks(this.contentToBlocks(content), 100);
    for (const chunk of chunks) {
      await this.client.blocks.children.append({
        block_id: pageId,
        children: chunk as any,
      });
    }
  }

  private contentToBlocks(content: string): Array<Record<string, unknown>> {
    const lines = content
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 1000);

    if (lines.length === 0) {
      return [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content: '(empty)' },
              },
            ],
          },
        },
      ];
    }

    return lines.map((line) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: line.slice(0, 2000) },
          },
        ],
      },
    }));
  }

  private extractTitle(page: Record<string, unknown>): string {
    const properties = page.properties;
    if (!properties || typeof properties !== 'object') {
      return 'Untitled';
    }
    for (const value of Object.values(properties as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const property = value as Record<string, unknown>;
      if (property.type !== 'title' || !Array.isArray(property.title)) {
        continue;
      }
      const title = property.title
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }
          const node = item as Record<string, unknown>;
          return typeof node.plain_text === 'string' ? node.plain_text : '';
        })
        .join('')
        .trim();
      if (title) {
        return title;
      }
    }
    return 'Untitled';
  }

  private extractBlockText(block: Record<string, unknown>): string {
    const type = typeof block.type === 'string' ? block.type : '';
    if (!type) {
      return '';
    }
    const typedNode = block[type];
    if (!typedNode || typeof typedNode !== 'object') {
      return '';
    }
    const richText = (typedNode as Record<string, unknown>).rich_text;
    if (!Array.isArray(richText)) {
      return '';
    }
    return richText
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return '';
        }
        const node = item as Record<string, unknown>;
        return typeof node.plain_text === 'string' ? node.plain_text : '';
      })
      .join('')
      .trim();
  }
}

export function normalizeNotionPageId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Notion page id/url is required.');
  }

  const urlMatch = trimmed.match(/([0-9a-fA-F]{32}|[0-9a-fA-F-]{36})/);
  const raw = urlMatch ? urlMatch[1] : trimmed;
  const compact = raw.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) {
    throw new Error(`Invalid Notion page id/url: ${input}`);
  }
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
}

function chunkBlocks<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [[]];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
