export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type IntegrationProviderKey = 'notion' | 'jira' | 'confluence' | 'linear' | 'slack';

export type MemoryCoreConfig = {
  port: number;
  host: string;
  databaseUrl: string;
  logLevel: LogLevel;
  apiKeys: string[];
  auditSlackWebhookUrl?: string;
  auditSlackActionPrefixes: string[];
  auditSlackDefaultChannel?: string;
  auditSlackFormat: 'compact' | 'detailed';
  auditSlackIncludeTargetJson: boolean;
  auditSlackMaskSecrets: boolean;
  notionToken?: string;
  notionDefaultParentPageId?: string;
  notionWriteEnabled: boolean;
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  confluenceBaseUrl?: string;
  confluenceEmail?: string;
  confluenceApiToken?: string;
  linearApiKey?: string;
  linearApiUrl?: string;
  integrationLockedProviders: IntegrationProviderKey[];
};

export function loadConfig(): MemoryCoreConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required. Example(localdb): postgres://<user>:<pass>@postgres:5432/<db>, example(external): postgres://<user>:<pass>@<rds-endpoint>:5432/<db>?sslmode=require'
    );
  }

  const rawKeys = parseApiKeys();

  return {
    port: Number(process.env.MEMORY_CORE_PORT || 8080),
    host: process.env.MEMORY_CORE_HOST || '0.0.0.0',
    databaseUrl,
    logLevel: normalizeLogLevel(process.env.MEMORY_CORE_LOG_LEVEL),
    apiKeys: rawKeys,
    auditSlackWebhookUrl:
      (process.env.MEMORY_CORE_AUDIT_SLACK_WEBHOOK_URL || '').trim() || undefined,
    auditSlackActionPrefixes: parseCsvList(process.env.MEMORY_CORE_AUDIT_SLACK_ACTION_PREFIXES),
    auditSlackDefaultChannel:
      (process.env.MEMORY_CORE_AUDIT_SLACK_DEFAULT_CHANNEL || '').trim() || undefined,
    auditSlackFormat: parseSlackFormat(process.env.MEMORY_CORE_AUDIT_SLACK_FORMAT),
    auditSlackIncludeTargetJson: parseBoolean(
      process.env.MEMORY_CORE_AUDIT_SLACK_INCLUDE_TARGET_JSON || 'true'
    ),
    auditSlackMaskSecrets: parseBoolean(process.env.MEMORY_CORE_AUDIT_SLACK_MASK_SECRETS || 'true'),
    notionToken: (process.env.MEMORY_CORE_NOTION_TOKEN || '').trim() || undefined,
    notionDefaultParentPageId:
      (process.env.MEMORY_CORE_NOTION_DEFAULT_PARENT_PAGE_ID || '').trim() || undefined,
    notionWriteEnabled: parseBoolean(process.env.MEMORY_CORE_NOTION_WRITE_ENABLED),
    jiraBaseUrl: (process.env.MEMORY_CORE_JIRA_BASE_URL || '').trim() || undefined,
    jiraEmail: (process.env.MEMORY_CORE_JIRA_EMAIL || '').trim() || undefined,
    jiraApiToken: (process.env.MEMORY_CORE_JIRA_API_TOKEN || '').trim() || undefined,
    confluenceBaseUrl: (process.env.MEMORY_CORE_CONFLUENCE_BASE_URL || '').trim() || undefined,
    confluenceEmail: (process.env.MEMORY_CORE_CONFLUENCE_EMAIL || '').trim() || undefined,
    confluenceApiToken: (process.env.MEMORY_CORE_CONFLUENCE_API_TOKEN || '').trim() || undefined,
    linearApiKey: (process.env.MEMORY_CORE_LINEAR_API_KEY || '').trim() || undefined,
    linearApiUrl: (process.env.MEMORY_CORE_LINEAR_API_URL || '').trim() || undefined,
    integrationLockedProviders: parseLockedProviders(
      process.env.MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS
    ),
  };
}

function parseApiKeys(): string[] {
  const joined = [
    process.env.MEMORY_CORE_API_KEY || '',
    process.env.MEMORY_CORE_API_KEYS || '',
  ]
    .join(',')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(joined));
}

function normalizeLogLevel(input?: string): LogLevel {
  const value = (input || 'error').toLowerCase();
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error' || value === 'silent') {
    return value;
  }
  return 'error';
}

function parseBoolean(input?: string): boolean {
  const value = (input || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function parseCsvList(input?: string): string[] {
  return (input || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseSlackFormat(input?: string): 'compact' | 'detailed' {
  return (input || '').trim().toLowerCase() === 'compact' ? 'compact' : 'detailed';
}

function parseLockedProviders(input?: string): IntegrationProviderKey[] {
  const supported = new Set<IntegrationProviderKey>([
    'notion',
    'jira',
    'confluence',
    'linear',
    'slack',
  ]);
  const values = (input || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is IntegrationProviderKey => supported.has(value as IntegrationProviderKey));
  return Array.from(new Set(values));
}
