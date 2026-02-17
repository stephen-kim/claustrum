import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tools: Tool[] = [
  {
    name: 'set_workspace',
    description: 'Set active workspace key for this MCP session',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
      },
      required: ['key'],
    },
  },
  {
    name: 'set_project',
    description: 'Manually choose and pin a project key (disables auto-switch until unpinned)',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
      },
      required: ['key'],
    },
  },
  {
    name: 'unset_project_pin',
    description: 'Disable pin mode and resume automatic project switching',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_current_project',
    description: 'Show current resolved project and pin mode state',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'remember',
    description: 'Store memory in resolved workspace/project',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['active_work', 'constraint', 'problem', 'goal', 'decision', 'note', 'caveat'],
        },
        content: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['type', 'content'],
    },
  },
  {
    name: 'recall',
    description: 'Query memories from resolved workspace/project',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        type: {
          type: 'string',
          enum: ['active_work', 'constraint', 'problem', 'goal', 'decision', 'note', 'caveat'],
        },
        limit: { type: 'number' },
        since: { type: 'string' },
        mode: { type: 'string', enum: ['hybrid', 'keyword', 'semantic'] },
        project_key: { type: 'string' },
      },
    },
  },
  {
    name: 'list_projects',
    description: 'List projects in active workspace',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_key: { type: 'string' },
      },
    },
  },
  {
    name: 'search_raw',
    description: 'Search raw imported conversation snippets (never full transcript)',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number' },
        project_key: { type: 'string' },
      },
      required: ['q'],
    },
  },
  {
    name: 'notion_search',
    description: 'Search Notion pages for external documentation context',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['q'],
    },
  },
  {
    name: 'notion_read',
    description: 'Read a Notion page content by page id or URL',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string' },
        max_chars: { type: 'number' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'notion_context',
    description: 'Search then read concise Notion context snippets for the current workspace',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        page_id: { type: 'string' },
        limit: { type: 'number' },
        max_chars: { type: 'number' },
      },
    },
  },
  {
    name: 'jira_search',
    description: 'Search Jira issues for engineering context',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['q'],
    },
  },
  {
    name: 'jira_read',
    description: 'Read Jira issue details by key',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string' },
        max_chars: { type: 'number' },
      },
      required: ['issue_key'],
    },
  },
  {
    name: 'confluence_search',
    description: 'Search Confluence pages for team documentation context',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['q'],
    },
  },
  {
    name: 'confluence_read',
    description: 'Read Confluence page content by page id',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string' },
        max_chars: { type: 'number' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'linear_search',
    description: 'Search Linear issues for planning and execution context',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['q'],
    },
  },
  {
    name: 'linear_read',
    description: 'Read Linear issue details by issue key',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string' },
        max_chars: { type: 'number' },
      },
      required: ['issue_key'],
    },
  },
];
