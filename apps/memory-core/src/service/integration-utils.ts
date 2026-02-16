import { IntegrationProvider, Prisma } from '@prisma/client';
import type { SlackRouteRule, SlackSeverity, SlackSeverityRule } from '../audit-slack-notifier.js';

export function toIntegrationProvider(
  provider: 'notion' | 'jira' | 'confluence' | 'linear' | 'slack'
): IntegrationProvider {
  if (provider === 'notion') {
    return IntegrationProvider.notion;
  }
  if (provider === 'jira') {
    return IntegrationProvider.jira;
  }
  if (provider === 'confluence') {
    return IntegrationProvider.confluence;
  }
  if (provider === 'linear') {
    return IntegrationProvider.linear;
  }
  if (provider === 'slack') {
    return IntegrationProvider.slack;
  }
  throw new Error(`Unsupported integration provider: ${provider}`);
}

export function toIntegrationSummary(args: {
  provider: IntegrationProvider;
  row:
    | {
        isEnabled: boolean;
        config: Prisma.JsonValue;
      }
    | undefined;
  configuredFromEnv: boolean;
  notionWriteEnabled: boolean;
  locked?: boolean;
}) {
  const { provider, row, configuredFromEnv, notionWriteEnabled, locked = false } = args;
  const effectiveRow = locked ? undefined : row;
  const config = toJsonObject(effectiveRow?.config);
  const source = effectiveRow ? 'workspace' : configuredFromEnv ? 'env' : 'none';
  if (provider === IntegrationProvider.notion) {
    const token = getConfigString(config, 'token');
    const parentPageId = getConfigString(config, 'default_parent_page_id');
    const writeEnabled = getConfigBoolean(config, 'write_enabled') ?? notionWriteEnabled;
    const writeOnCommit = getConfigBoolean(config, 'write_on_commit') ?? false;
    const writeOnMerge = getConfigBoolean(config, 'write_on_merge') ?? false;
    return {
      enabled: effectiveRow ? effectiveRow.isEnabled : configuredFromEnv,
      configured: effectiveRow ? Boolean(token) : configuredFromEnv,
      source,
      locked,
      has_token: Boolean(token),
      default_parent_page_id: parentPageId,
      write_enabled: writeEnabled,
      write_on_commit: writeOnCommit,
      write_on_merge: writeOnMerge,
    };
  }
  if (provider === IntegrationProvider.jira) {
    const baseUrl = getConfigString(config, 'base_url');
    const email = getConfigString(config, 'email');
    const hasToken = Boolean(getConfigString(config, 'api_token'));
    const writeOnCommit = getConfigBoolean(config, 'write_on_commit') ?? false;
    const writeOnMerge = getConfigBoolean(config, 'write_on_merge') ?? false;
    return {
      enabled: effectiveRow ? effectiveRow.isEnabled : configuredFromEnv,
      configured: effectiveRow ? Boolean(baseUrl && email && hasToken) : configuredFromEnv,
      source,
      locked,
      base_url: baseUrl,
      email,
      has_api_token: hasToken,
      write_on_commit: writeOnCommit,
      write_on_merge: writeOnMerge,
    };
  }
  if (provider === IntegrationProvider.confluence) {
    const baseUrl = getConfigString(config, 'base_url');
    const email = getConfigString(config, 'email');
    const hasToken = Boolean(getConfigString(config, 'api_token'));
    const writeOnCommit = getConfigBoolean(config, 'write_on_commit') ?? false;
    const writeOnMerge = getConfigBoolean(config, 'write_on_merge') ?? false;
    return {
      enabled: effectiveRow ? effectiveRow.isEnabled : configuredFromEnv,
      configured: effectiveRow ? Boolean(baseUrl && email && hasToken) : configuredFromEnv,
      source,
      locked,
      base_url: baseUrl,
      email,
      has_api_token: hasToken,
      write_on_commit: writeOnCommit,
      write_on_merge: writeOnMerge,
    };
  }
  if (provider === IntegrationProvider.slack) {
    const webhookUrl = getConfigString(config, 'webhook_url');
    const actionPrefixes = getConfigStringArray(config, 'action_prefixes');
    const defaultChannel = getConfigString(config, 'default_channel');
    const format = getConfigString(config, 'format');
    const includeTargetJson = getConfigBoolean(config, 'include_target_json');
    const maskSecrets = getConfigBoolean(config, 'mask_secrets');
    const routes = getConfigSlackRoutes(config, 'routes');
    const severityRules = getConfigSlackSeverityRules(config, 'severity_rules');
    return {
      enabled: effectiveRow ? effectiveRow.isEnabled : configuredFromEnv,
      configured: effectiveRow ? Boolean(webhookUrl) : configuredFromEnv,
      source,
      locked,
      has_webhook: effectiveRow ? Boolean(webhookUrl) : configuredFromEnv,
      default_channel: defaultChannel,
      action_prefixes: actionPrefixes,
      format: format === 'compact' ? 'compact' : 'detailed',
      include_target_json: includeTargetJson ?? true,
      mask_secrets: maskSecrets ?? true,
      routes,
      severity_rules: severityRules,
    };
  }
  const apiUrl = getConfigString(config, 'api_url');
  const hasApiKey = Boolean(getConfigString(config, 'api_key'));
  const writeOnCommit = getConfigBoolean(config, 'write_on_commit') ?? false;
  const writeOnMerge = getConfigBoolean(config, 'write_on_merge') ?? false;
  return {
    enabled: effectiveRow ? effectiveRow.isEnabled : configuredFromEnv,
    configured: effectiveRow ? hasApiKey : configuredFromEnv,
    source,
    locked,
    api_url: apiUrl,
    has_api_key: hasApiKey,
    write_on_commit: writeOnCommit,
    write_on_merge: writeOnMerge,
  };
}

export function normalizeIntegrationConfig(
  provider: IntegrationProvider,
  patch: Record<string, unknown>
): Record<string, unknown> {
  if (provider === IntegrationProvider.slack) {
    const out: Record<string, unknown> = {};
    const webhookUrl = normalizeOptionalString(patch.webhook_url);
    if (webhookUrl !== undefined) {
      out.webhook_url = webhookUrl;
    }
    const defaultChannel = normalizeOptionalString(patch.default_channel);
    if (defaultChannel !== undefined) {
      out.default_channel = defaultChannel;
    }
    if (typeof patch.format === 'string') {
      const format = patch.format.trim().toLowerCase();
      if (format === 'compact' || format === 'detailed') {
        out.format = format;
      }
    }
    const actionPrefixes = normalizeStringArrayPatch(patch.action_prefixes);
    if (actionPrefixes !== undefined) {
      out.action_prefixes = actionPrefixes;
    }
    const routes = normalizeSlackRoutesPatch(patch.routes);
    if (routes !== undefined) {
      out.routes = routes;
    }
    const severityRules = normalizeSlackSeverityRulesPatch(patch.severity_rules);
    if (severityRules !== undefined) {
      out.severity_rules = severityRules;
    }
    if (typeof patch.include_target_json === 'boolean') {
      out.include_target_json = patch.include_target_json;
    }
    if (typeof patch.mask_secrets === 'boolean') {
      out.mask_secrets = patch.mask_secrets;
    }
    return out;
  }

  const triggerKeys = ['write_on_commit', 'write_on_merge'];
  const keys =
    provider === IntegrationProvider.linear
      ? ['api_key', 'api_url', ...triggerKeys]
      : provider === IntegrationProvider.notion
        ? ['token', 'default_parent_page_id', 'write_enabled', ...triggerKeys]
        : ['base_url', 'email', 'api_token', ...triggerKeys];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (!(key in patch)) {
      continue;
    }
    const value = patch[key];
    if (
      key === 'write_on_commit' ||
      key === 'write_on_merge' ||
      (provider === IntegrationProvider.notion && key === 'write_enabled')
    ) {
      if (typeof value === 'boolean') {
        out[key] = value;
      }
      continue;
    }
    if (value === null || value === undefined) {
      out[key] = null;
      continue;
    }
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    out[key] = trimmed || null;
  }
  return out;
}

export function toJsonObject(value: Prisma.JsonValue | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function getConfigString(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function getConfigBoolean(config: Record<string, unknown>, key: string): boolean | undefined {
  const value = config[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function getConfigStringArray(config: Record<string, unknown>, key: string): string[] {
  const value = config[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getConfigSlackRoutes(config: Record<string, unknown>, key: string): SlackRouteRule[] {
  const value = config[key];
  if (!Array.isArray(value)) {
    return [];
  }
  const routes: SlackRouteRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const actionPrefix = asString(row.action_prefix);
    if (!actionPrefix) {
      continue;
    }
    const route: SlackRouteRule = {
      action_prefix: actionPrefix,
    };
    const channel = asString(row.channel);
    if (channel) {
      route.channel = channel;
    }
    const minSeverity = toSlackSeverity(row.min_severity);
    if (minSeverity) {
      route.min_severity = minSeverity;
    }
    routes.push(route);
  }
  return routes;
}

export function getConfigSlackSeverityRules(
  config: Record<string, unknown>,
  key: string
): SlackSeverityRule[] {
  const value = config[key];
  if (!Array.isArray(value)) {
    return [];
  }
  const rules: SlackSeverityRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const actionPrefix = asString(row.action_prefix);
    const severity = toSlackSeverity(row.severity);
    if (!actionPrefix || !severity) {
      continue;
    }
    rules.push({
      action_prefix: actionPrefix,
      severity,
    });
  }
  return rules;
}

function normalizeOptionalString(input: unknown): string | null | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input === null) {
    return null;
  }
  if (typeof input !== 'string') {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed || null;
}

function normalizeStringArrayPatch(input: unknown): string[] | null | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input === null) {
    return null;
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(input)) {
    return undefined;
  }
  return input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSlackRoutesPatch(input: unknown): SlackRouteRule[] | null | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input === null) {
    return null;
  }
  if (!Array.isArray(input)) {
    return undefined;
  }
  const routes: SlackRouteRule[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const actionPrefix = asString(row.action_prefix);
    if (!actionPrefix) {
      continue;
    }
    const route: SlackRouteRule = {
      action_prefix: actionPrefix,
    };
    const channel = asString(row.channel);
    if (channel) {
      route.channel = channel;
    }
    const minSeverity = toSlackSeverity(row.min_severity);
    if (minSeverity) {
      route.min_severity = minSeverity;
    }
    routes.push(route);
  }
  return routes;
}

function normalizeSlackSeverityRulesPatch(
  input: unknown
): SlackSeverityRule[] | null | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input === null) {
    return null;
  }
  if (!Array.isArray(input)) {
    return undefined;
  }
  const rules: SlackSeverityRule[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const actionPrefix = asString(row.action_prefix);
    const severity = toSlackSeverity(row.severity);
    if (!actionPrefix || !severity) {
      continue;
    }
    rules.push({
      action_prefix: actionPrefix,
      severity,
    });
  }
  return rules;
}

function toSlackSeverity(input: unknown): SlackSeverity | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }
  const value = input.trim().toLowerCase();
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') {
    return value;
  }
  return undefined;
}

function asString(input: unknown): string | undefined {
  return typeof input === 'string' && input.trim() ? input.trim() : undefined;
}
