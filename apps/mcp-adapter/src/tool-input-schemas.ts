import { memoryTypeSchema } from '@claustrum/shared';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export type ToolSchemaName =
  | 'set_workspace'
  | 'set_project'
  | 'unset_project_pin'
  | 'get_current_project'
  | 'remember'
  | 'recall'
  | 'list_projects'
  | 'context_bundle'
  | 'search_raw'
  | 'notion_search'
  | 'notion_read'
  | 'notion_context'
  | 'jira_search'
  | 'jira_read'
  | 'confluence_search'
  | 'confluence_read'
  | 'linear_search'
  | 'linear_read';

const nonEmptyString = z.string().trim().min(1);
const positiveIntOptional = z.coerce.number().int().positive().optional();
const metadataSchema = z.record(z.unknown());

export const toolArgSchemas = {
  set_workspace: z.object({
    key: nonEmptyString,
  }),
  set_project: z.object({
    key: nonEmptyString,
  }),
  unset_project_pin: z.object({}).strict(),
  get_current_project: z.object({}).strict(),
  remember: z.object({
    type: memoryTypeSchema,
    content: nonEmptyString,
    metadata: metadataSchema.optional(),
  }),
  recall: z.object({
    q: nonEmptyString.optional(),
    type: memoryTypeSchema.optional(),
    limit: positiveIntOptional,
    since: nonEmptyString.optional(),
    mode: z.enum(['hybrid', 'keyword', 'semantic']).optional(),
    project_key: nonEmptyString.optional(),
  }),
  list_projects: z.object({
    workspace_key: nonEmptyString.optional(),
  }),
  context_bundle: z.object({
    q: nonEmptyString.optional(),
    mode: z.enum(['default', 'debug']).optional(),
    budget: z.coerce.number().int().positive().optional(),
    current_subpath: nonEmptyString.optional(),
    project_key: nonEmptyString.optional(),
  }),
  search_raw: z.object({
    q: nonEmptyString,
    limit: positiveIntOptional,
    project_key: nonEmptyString.optional(),
  }),
  notion_search: z.object({
    q: nonEmptyString,
    limit: positiveIntOptional,
  }),
  notion_read: z.object({
    page_id: nonEmptyString,
    max_chars: z.coerce.number().int().positive().optional(),
  }),
  notion_context: z
    .object({
      q: nonEmptyString.optional(),
      page_id: nonEmptyString.optional(),
      limit: positiveIntOptional,
      max_chars: z.coerce.number().int().positive().optional(),
    })
    .refine((input) => Boolean(input.q || input.page_id), {
      message: 'q or page_id is required',
    }),
  jira_search: z.object({
    q: nonEmptyString,
    limit: positiveIntOptional,
  }),
  jira_read: z.object({
    issue_key: nonEmptyString,
    max_chars: z.coerce.number().int().positive().optional(),
  }),
  confluence_search: z.object({
    q: nonEmptyString,
    limit: positiveIntOptional,
  }),
  confluence_read: z.object({
    page_id: nonEmptyString,
    max_chars: z.coerce.number().int().positive().optional(),
  }),
  linear_search: z.object({
    q: nonEmptyString,
    limit: positiveIntOptional,
  }),
  linear_read: z.object({
    issue_key: nonEmptyString,
    max_chars: z.coerce.number().int().positive().optional(),
  }),
} satisfies Record<ToolSchemaName, z.ZodTypeAny>;

type ToolDescriptor = {
  name: ToolSchemaName;
  description: string;
};

const toolDescriptors: ToolDescriptor[] = [
  {
    name: 'set_workspace',
    description: 'Set active workspace key for this MCP session',
  },
  {
    name: 'set_project',
    description: 'Manually choose and pin a project key (disables auto-switch until unpinned)',
  },
  {
    name: 'unset_project_pin',
    description: 'Disable pin mode and resume automatic project switching',
  },
  {
    name: 'get_current_project',
    description: 'Show current resolved project and pin mode state',
  },
  {
    name: 'remember',
    description: 'Store memory in resolved workspace/project',
  },
  {
    name: 'recall',
    description: 'Query memories from resolved workspace/project',
  },
  {
    name: 'list_projects',
    description: 'List projects in active workspace',
  },
  {
    name: 'context_bundle',
    description: 'Fetch a standardized context bundle (snapshot + retrieval) for the current project',
  },
  {
    name: 'search_raw',
    description: 'Search raw imported conversation snippets (never full transcript)',
  },
  {
    name: 'notion_search',
    description: 'Search Notion pages for external documentation context',
  },
  {
    name: 'notion_read',
    description: 'Read a Notion page content by page id or URL',
  },
  {
    name: 'notion_context',
    description: 'Search then read concise Notion context snippets for the current workspace',
  },
  {
    name: 'jira_search',
    description: 'Search Jira issues for engineering context',
  },
  {
    name: 'jira_read',
    description: 'Read Jira issue details by key',
  },
  {
    name: 'confluence_search',
    description: 'Search Confluence pages for team documentation context',
  },
  {
    name: 'confluence_read',
    description: 'Read Confluence page content by page id',
  },
  {
    name: 'linear_search',
    description: 'Search Linear issues for planning and execution context',
  },
  {
    name: 'linear_read',
    description: 'Read Linear issue details by issue key',
  },
];

type ToolInputSchema = {
  type: 'object';
  properties: Record<string, object>;
  required?: string[];
  [key: string]: unknown;
};

export const toolInputSchemas: Record<ToolSchemaName, ToolInputSchema> = {
  set_workspace: {
    type: 'object',
    properties: {
      key: { type: 'string' },
    },
    required: ['key'],
  },
  set_project: {
    type: 'object',
    properties: {
      key: { type: 'string' },
    },
    required: ['key'],
  },
  unset_project_pin: {
    type: 'object',
    properties: {},
  },
  get_current_project: {
    type: 'object',
    properties: {},
  },
  remember: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['summary', 'activity', 'active_work', 'constraint', 'problem', 'goal', 'decision', 'note', 'caveat'],
      },
      content: { type: 'string' },
      metadata: { type: 'object' },
    },
    required: ['type', 'content'],
  },
  recall: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      type: {
        type: 'string',
        enum: ['summary', 'activity', 'active_work', 'constraint', 'problem', 'goal', 'decision', 'note', 'caveat'],
      },
      limit: { type: 'number' },
      since: { type: 'string' },
      mode: { type: 'string', enum: ['hybrid', 'keyword', 'semantic'] },
      project_key: { type: 'string' },
    },
  },
  list_projects: {
    type: 'object',
    properties: {
      workspace_key: { type: 'string' },
    },
  },
  context_bundle: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      mode: { type: 'string', enum: ['default', 'debug'] },
      budget: { type: 'number' },
      current_subpath: { type: 'string' },
      project_key: { type: 'string' },
    },
  },
  search_raw: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      limit: { type: 'number' },
      project_key: { type: 'string' },
    },
    required: ['q'],
  },
  notion_search: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['q'],
  },
  notion_read: {
    type: 'object',
    properties: {
      page_id: { type: 'string' },
      max_chars: { type: 'number' },
    },
    required: ['page_id'],
  },
  notion_context: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      page_id: { type: 'string' },
      limit: { type: 'number' },
      max_chars: { type: 'number' },
    },
  },
  jira_search: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['q'],
  },
  jira_read: {
    type: 'object',
    properties: {
      issue_key: { type: 'string' },
      max_chars: { type: 'number' },
    },
    required: ['issue_key'],
  },
  confluence_search: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['q'],
  },
  confluence_read: {
    type: 'object',
    properties: {
      page_id: { type: 'string' },
      max_chars: { type: 'number' },
    },
    required: ['page_id'],
  },
  linear_search: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['q'],
  },
  linear_read: {
    type: 'object',
    properties: {
      issue_key: { type: 'string' },
      max_chars: { type: 'number' },
    },
    required: ['issue_key'],
  },
};

export const tools: Tool[] = toolDescriptors.map((descriptor) => ({
  name: descriptor.name,
  description: descriptor.description,
  inputSchema: toolInputSchemas[descriptor.name],
}));
