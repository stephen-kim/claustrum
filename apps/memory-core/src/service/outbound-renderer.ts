import {
  defaultOutboundLocales,
  defaultOutboundTemplates,
  outboundIntegrationTypeSchema,
  outboundStyleSchema,
  type OutboundIntegrationType,
  type OutboundLocale,
  type OutboundStyle,
} from '@claustrum/shared';
import { Liquid } from 'liquidjs';

type WorkspaceOutboundSettings = {
  defaultOutboundLocale?: string;
  supportedOutboundLocales?: string[];
};

type OutboundPolicy = {
  localeDefault?: string;
  supportedLocales?: string[];
  mode?: 'template' | 'llm';
  style?: OutboundStyle;
  templateOverrides?: Record<string, unknown>;
  llmPromptSystem?: string | null;
  llmPromptUser?: string | null;
};

const liquidEngine = new Liquid({
  strictVariables: false,
  strictFilters: false,
});

const TEMPLATE_VARIABLE_DESCRIPTIONS: Record<string, string> = {
  q: 'Search query text.',
  count: 'Number of matched items/results.',
  message_id: 'Raw message identifier.',
  summary: 'Short summary for event/decision.',
  status: 'Status value such as success/failure/enabled/disabled.',
  provider: 'Integration provider name.',
  repository: 'Repository name or owner/repo.',
  branch: 'Git branch name.',
  integration_type: 'Integration type key (slack/jira/notion/etc).',
  workspace_key: 'Workspace key.',
  project_key: 'Project key.',
  commit_sha: 'Git commit SHA.',
  correlation_id: 'Batch/event correlation id.',
};

const COMMON_TEMPLATE_VARIABLES = [
  'q',
  'count',
  'summary',
  'status',
  'provider',
  'repository',
  'branch',
  'workspace_key',
  'project_key',
  'commit_sha',
  'correlation_id',
];

function normalizeLocale(input: unknown): OutboundLocale | null {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) {
    return null;
  }
  return defaultOutboundLocales.includes(value as OutboundLocale) ? (value as OutboundLocale) : null;
}

function normalizeLocaleList(input: unknown, fallback: OutboundLocale[]): OutboundLocale[] {
  if (!Array.isArray(input)) {
    return fallback;
  }
  const values: OutboundLocale[] = [];
  for (const item of input) {
    const locale = normalizeLocale(item);
    if (locale && !values.includes(locale)) {
      values.push(locale);
    }
  }
  return values.length > 0 ? values : fallback;
}

function convertLegacyTemplateSyntax(template: string): string {
  if (/\{\{|\{%/.test(template)) {
    return template;
  }
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, '{{ $1 }}');
}

function renderLiquidTemplate(template: string, params: Record<string, unknown>): string {
  const liquidTemplate = convertLegacyTemplateSyntax(template);
  return liquidEngine.parseAndRenderSync(liquidTemplate, params);
}

function extractTemplateVariables(template: string): string[] {
  const out = new Set<string>();

  for (const match of template.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)/g)) {
    if (match[1]) {
      out.add(match[1].trim());
    }
  }
  if (!/\{\{|\{%/.test(template)) {
    for (const match of template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
      if (match[1]) {
        out.add(match[1].trim());
      }
    }
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

function getTemplateFromOverrides(args: {
  overrides: Record<string, unknown> | undefined;
  actionKey: string;
  locale: OutboundLocale;
}): string | null {
  const node = args.overrides?.[args.actionKey];
  if (!node) {
    return null;
  }
  if (typeof node === 'string') {
    return node;
  }
  if (typeof node !== 'object' || Array.isArray(node)) {
    return null;
  }
  const byLocale = node as Record<string, unknown>;
  const localized = byLocale[args.locale];
  if (typeof localized === 'string' && localized.trim()) {
    return localized;
  }
  const english = byLocale.en;
  if (typeof english === 'string' && english.trim()) {
    return english;
  }
  return null;
}

function summarizeParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params).slice(0, 6);
  if (entries.length === 0) {
    return 'no params';
  }
  return entries
    .map(([key, value]) => {
      if (value === null || value === undefined) {
        return `${key}=null`;
      }
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return `${key}=${String(value)}`;
      }
      return `${key}=${JSON.stringify(value)}`;
    })
    .join(', ');
}

export type OutboundTemplateVariable = {
  name: string;
  description: string;
};

export type OutboundTemplateVariablesCatalog = {
  engine: 'liquid';
  integration_type: OutboundIntegrationType;
  common_variables: OutboundTemplateVariable[];
  action_variables: Array<{
    action_key: string;
    variables: OutboundTemplateVariable[];
  }>;
};

export function buildOutboundTemplateVariablesCatalog(args: {
  integrationType: OutboundIntegrationType;
  templateOverrides?: Record<string, unknown>;
}): OutboundTemplateVariablesCatalog {
  const localeTemplateSets = defaultOutboundLocales
    .map((locale) => defaultOutboundTemplates[locale]?.[args.integrationType])
    .filter((value): value is Record<string, string> => Boolean(value));
  const actionKeys = new Set<string>();
  for (const templates of localeTemplateSets) {
    for (const key of Object.keys(templates)) {
      actionKeys.add(key);
    }
  }
  if (args.templateOverrides && typeof args.templateOverrides === 'object') {
    for (const key of Object.keys(args.templateOverrides)) {
      actionKeys.add(key);
    }
  }

  const actionVariables: Array<{
    action_key: string;
    variables: OutboundTemplateVariable[];
  }> = [];

  for (const actionKey of Array.from(actionKeys).sort((a, b) => a.localeCompare(b))) {
    const templates: string[] = [];
    for (const locale of defaultOutboundLocales) {
      const value = defaultOutboundTemplates[locale]?.[args.integrationType]?.[actionKey];
      if (typeof value === 'string' && value.trim()) {
        templates.push(value);
      }
    }

    const overrideNode = args.templateOverrides?.[actionKey];
    if (typeof overrideNode === 'string' && overrideNode.trim()) {
      templates.push(overrideNode);
    } else if (overrideNode && typeof overrideNode === 'object' && !Array.isArray(overrideNode)) {
      for (const value of Object.values(overrideNode)) {
        if (typeof value === 'string' && value.trim()) {
          templates.push(value);
        }
      }
    }

    const names = new Set<string>();
    for (const template of templates) {
      for (const variableName of extractTemplateVariables(template)) {
        names.add(variableName);
      }
    }

    actionVariables.push({
      action_key: actionKey,
      variables: Array.from(names)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          name,
          description:
            TEMPLATE_VARIABLE_DESCRIPTIONS[name] ||
            `Template param available at runtime as "${name}".`,
        })),
    });
  }

  return {
    engine: 'liquid',
    integration_type: args.integrationType,
    common_variables: COMMON_TEMPLATE_VARIABLES.map((name) => ({
      name,
      description: TEMPLATE_VARIABLE_DESCRIPTIONS[name] || `Template param "${name}".`,
    })),
    action_variables: actionVariables,
  };
}

export function resolveOutboundLocale(
  workspaceSettings: WorkspaceOutboundSettings,
  policy: OutboundPolicy | null | undefined,
  override?: string
): OutboundLocale {
  const workspaceSupported = normalizeLocaleList(
    workspaceSettings.supportedOutboundLocales,
    [...defaultOutboundLocales]
  );
  const policySupported = normalizeLocaleList(policy?.supportedLocales, workspaceSupported);
  const supportedSet = new Set<OutboundLocale>([...workspaceSupported, ...policySupported]);
  const candidates = [
    normalizeLocale(override),
    normalizeLocale(policy?.localeDefault),
    normalizeLocale(workspaceSettings.defaultOutboundLocale),
    'en' as OutboundLocale,
  ];
  for (const candidate of candidates) {
    if (candidate && supportedSet.has(candidate)) {
      return candidate;
    }
  }
  return 'en';
}

export function renderOutboundMessage(args: {
  integrationType: string;
  actionKey: string;
  params?: Record<string, unknown>;
  locale: OutboundLocale;
  style: OutboundStyle;
  mode: 'template' | 'llm';
  templateOverrides?: Record<string, unknown>;
}): string {
  const integrationParsed = outboundIntegrationTypeSchema.safeParse(args.integrationType);
  const integration = integrationParsed.success ? integrationParsed.data : 'slack';
  const locale = normalizeLocale(args.locale) || 'en';
  const style = outboundStyleSchema.safeParse(args.style).success ? args.style : 'short';
  const params = args.params || {};

  const overrideTemplate = getTemplateFromOverrides({
    overrides: args.templateOverrides,
    actionKey: args.actionKey,
    locale,
  });
  const localeTemplates =
    defaultOutboundTemplates[locale][integration as OutboundIntegrationType] ||
    defaultOutboundTemplates[locale].slack;
  const englishTemplates =
    defaultOutboundTemplates.en[integration as OutboundIntegrationType] ||
    defaultOutboundTemplates.en.slack;
  const baseTemplate =
    overrideTemplate ||
    localeTemplates?.[args.actionKey] ||
    englishTemplates?.[args.actionKey] ||
    englishTemplates?.['integration.update'] ||
    `${args.actionKey} event`;

  let rendered = '';
  try {
    rendered = renderLiquidTemplate(baseTemplate, params).trim();
  } catch {
    // Rendering should not break outbound flow; fallback keeps deterministic output.
    rendered = convertLegacyTemplateSyntax(baseTemplate)
      .replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, key: string) => {
        const value = params[key];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        return JSON.stringify(value);
      })
      .trim();
  }
  if (!rendered) {
    rendered = `${args.actionKey} event`;
  }

  if (style === 'short') {
    return rendered.length > 160 ? `${rendered.slice(0, 157)}...` : rendered;
  }
  if (style === 'verbose') {
    return `${rendered}\nDetails: ${summarizeParams(params)}`;
  }
  return rendered;
}
