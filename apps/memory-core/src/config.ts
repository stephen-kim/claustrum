export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type IntegrationProviderKey =
  | 'notion'
  | 'jira'
  | 'confluence'
  | 'linear'
  | 'slack'
  | 'audit_reasoner';
export type AuditReasonerProvider = 'openai' | 'claude' | 'gemini';
const AUDIT_REASONER_PROVIDER_ORDER_DEFAULT: AuditReasonerProvider[] = ['openai', 'claude', 'gemini'];

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
  auditReasonerEnabled: boolean;
  auditReasonerPreferEnv: boolean;
  auditReasonerProviderOrder: AuditReasonerProvider[];
  auditReasonerOpenAiModel?: string;
  auditReasonerOpenAiApiKey?: string;
  auditReasonerOpenAiBaseUrl?: string;
  auditReasonerClaudeModel?: string;
  auditReasonerClaudeApiKey?: string;
  auditReasonerClaudeBaseUrl?: string;
  auditReasonerGeminiModel?: string;
  auditReasonerGeminiApiKey?: string;
  auditReasonerGeminiBaseUrl?: string;
  integrationLockedProviders: IntegrationProviderKey[];
  integrationIgnoreEnv: boolean;
};

export function loadConfig(): MemoryCoreConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required. Example(localdb): postgres://<user>:<pass>@postgres:5432/<db>, example(external): postgres://<user>:<pass>@<rds-endpoint>:5432/<db>?sslmode=require'
    );
  }

  const rawKeys = parseApiKeys();
  const auditReasonerProviderOrder = parseAuditReasonerProviderOrder();
  const openAiApiKey = parseOpenAiApiKey(auditReasonerProviderOrder);
  const claudeApiKey = parseClaudeApiKey(auditReasonerProviderOrder);
  const geminiApiKey = parseGeminiApiKey(auditReasonerProviderOrder);
  const integrationLockPolicy = parseIntegrationLockPolicy(
    process.env.MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS
  );

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
    auditReasonerEnabled: parseAuditReasonerEnabled(
      auditReasonerProviderOrder,
      openAiApiKey,
      claudeApiKey,
      geminiApiKey
    ),
    auditReasonerPreferEnv: parseAuditReasonerPreferEnv(),
    auditReasonerProviderOrder,
    auditReasonerOpenAiModel: parseProviderModel('openai', auditReasonerProviderOrder),
    auditReasonerOpenAiApiKey: openAiApiKey,
    auditReasonerOpenAiBaseUrl: parseProviderBaseUrl('openai', auditReasonerProviderOrder),
    auditReasonerClaudeModel: parseProviderModel('claude', auditReasonerProviderOrder),
    auditReasonerClaudeApiKey: claudeApiKey,
    auditReasonerClaudeBaseUrl: parseProviderBaseUrl('claude', auditReasonerProviderOrder),
    auditReasonerGeminiModel: parseProviderModel('gemini', auditReasonerProviderOrder),
    auditReasonerGeminiApiKey: geminiApiKey,
    auditReasonerGeminiBaseUrl: parseProviderBaseUrl('gemini', auditReasonerProviderOrder),
    integrationLockedProviders: integrationLockPolicy.lockedProviders,
    integrationIgnoreEnv: integrationLockPolicy.ignoreEnv,
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

function parseIntegrationLockPolicy(input?: string): {
  lockedProviders: IntegrationProviderKey[];
  ignoreEnv: boolean;
} {
  const allProviders: IntegrationProviderKey[] = [
    'notion',
    'jira',
    'confluence',
    'linear',
    'slack',
    'audit_reasoner',
  ];
  const supported = new Set<IntegrationProviderKey>(allProviders);
  const raw = (input || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (raw.includes('none')) {
    return { lockedProviders: [], ignoreEnv: true };
  }
  if (raw.includes('all')) {
    return { lockedProviders: allProviders, ignoreEnv: false };
  }

  const values = raw.filter((value): value is IntegrationProviderKey =>
    supported.has(value as IntegrationProviderKey)
  );
  return { lockedProviders: Array.from(new Set(values)), ignoreEnv: false };
}

function parseAuditReasonerProviderOrder(): AuditReasonerProvider[] {
  const explicitList = (process.env.MEMORY_CORE_AUDIT_REASONER_PROVIDER_ORDER || '')
    .split(',')
    .map((value) => normalizeAuditReasonerProvider(value))
    .filter((value): value is AuditReasonerProvider => Boolean(value));
  if (explicitList.length > 0) {
    return Array.from(new Set(explicitList));
  }

  const legacySingle = normalizeAuditReasonerProvider(process.env.MEMORY_CORE_AUDIT_REASONER_PROVIDER || '');
  if (legacySingle) {
    return [legacySingle];
  }

  const inferred = AUDIT_REASONER_PROVIDER_ORDER_DEFAULT.filter((provider) =>
    Boolean(providerApiKeyFromEnv(provider))
  );
  if (inferred.length > 0) {
    return inferred;
  }

  return [...AUDIT_REASONER_PROVIDER_ORDER_DEFAULT];
}

function parseOpenAiApiKey(providerOrder: AuditReasonerProvider[]): string | undefined {
  return parseProviderApiKey('openai', providerOrder);
}

function parseClaudeApiKey(providerOrder: AuditReasonerProvider[]): string | undefined {
  return parseProviderApiKey('claude', providerOrder);
}

function parseGeminiApiKey(providerOrder: AuditReasonerProvider[]): string | undefined {
  return parseProviderApiKey('gemini', providerOrder);
}

function parseProviderApiKey(
  provider: AuditReasonerProvider,
  providerOrder: AuditReasonerProvider[]
): string | undefined {
  const names =
    provider === 'openai'
      ? ['MEMORY_CORE_AUDIT_REASONER_OPENAI_API_KEY', 'OPENAI_API_KEY']
      : provider === 'claude'
        ? [
            'MEMORY_CORE_AUDIT_REASONER_CLAUDE_API_KEY',
            'MEMORY_CORE_CLAUDE_API_KEY',
            'ANTHROPIC_API_KEY',
            'CLAUDE_API_KEY',
          ]
        : ['MEMORY_CORE_AUDIT_REASONER_GEMINI_API_KEY', 'GEMINI_API_KEY'];

  for (const name of names) {
    const value = (process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }

  const legacyGeneric = (process.env.MEMORY_CORE_AUDIT_REASONER_API_KEY || '').trim();
  if (legacyGeneric && providerOrder[0] === provider) {
    return legacyGeneric;
  }
  return undefined;
}

function parseProviderModel(
  provider: AuditReasonerProvider,
  providerOrder: AuditReasonerProvider[]
): string | undefined {
  const names =
    provider === 'openai'
      ? ['MEMORY_CORE_AUDIT_REASONER_OPENAI_MODEL']
      : provider === 'claude'
        ? ['MEMORY_CORE_AUDIT_REASONER_CLAUDE_MODEL']
        : ['MEMORY_CORE_AUDIT_REASONER_GEMINI_MODEL'];

  for (const name of names) {
    const value = (process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }

  const legacyGeneric = (process.env.MEMORY_CORE_AUDIT_REASONER_MODEL || '').trim();
  if (legacyGeneric && providerOrder[0] === provider) {
    return legacyGeneric;
  }
  return undefined;
}

function parseProviderBaseUrl(
  provider: AuditReasonerProvider,
  providerOrder: AuditReasonerProvider[]
): string | undefined {
  const names =
    provider === 'openai'
      ? ['MEMORY_CORE_AUDIT_REASONER_OPENAI_BASE_URL']
      : provider === 'claude'
        ? ['MEMORY_CORE_AUDIT_REASONER_CLAUDE_BASE_URL']
        : ['MEMORY_CORE_AUDIT_REASONER_GEMINI_BASE_URL'];

  for (const name of names) {
    const value = (process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }

  const legacyGeneric = (process.env.MEMORY_CORE_AUDIT_REASONER_BASE_URL || '').trim();
  if (legacyGeneric && providerOrder[0] === provider) {
    return legacyGeneric;
  }
  return undefined;
}

function providerApiKeyFromEnv(provider: AuditReasonerProvider): string | undefined {
  if (provider === 'openai') {
    return (process.env.MEMORY_CORE_AUDIT_REASONER_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim() || undefined;
  }
  if (provider === 'claude') {
    return (
      process.env.MEMORY_CORE_AUDIT_REASONER_CLAUDE_API_KEY ||
      process.env.MEMORY_CORE_CLAUDE_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CLAUDE_API_KEY ||
      ''
    ).trim() || undefined;
  }
  return (process.env.MEMORY_CORE_AUDIT_REASONER_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim() || undefined;
}

function normalizeAuditReasonerProvider(input: string): AuditReasonerProvider | undefined {
  const value = input.trim().toLowerCase();
  if (value === 'openai' || value === 'claude' || value === 'gemini') {
    return value;
  }
  return undefined;
}

function parseAuditReasonerEnabled(
  providerOrder: AuditReasonerProvider[],
  openAiApiKey?: string,
  claudeApiKey?: string,
  geminiApiKey?: string
): boolean {
  if (process.env.MEMORY_CORE_AUDIT_REASONER_ENABLED !== undefined) {
    return parseBoolean(process.env.MEMORY_CORE_AUDIT_REASONER_ENABLED);
  }
  const hasAnyConfigured = providerOrder.some((provider) => {
    if (provider === 'openai') {
      return Boolean(openAiApiKey);
    }
    if (provider === 'claude') {
      return Boolean(claudeApiKey);
    }
    return Boolean(geminiApiKey);
  });
  return hasAnyConfigured;
}

function parseAuditReasonerPreferEnv(): boolean {
  const explicitVars = [
    'MEMORY_CORE_AUDIT_REASONER_ENABLED',
    'MEMORY_CORE_AUDIT_REASONER_PROVIDER_ORDER',
    'MEMORY_CORE_AUDIT_REASONER_PROVIDER',
    'MEMORY_CORE_AUDIT_REASONER_MODEL',
    'MEMORY_CORE_AUDIT_REASONER_API_KEY',
    'MEMORY_CORE_AUDIT_REASONER_BASE_URL',
    'MEMORY_CORE_AUDIT_REASONER_OPENAI_MODEL',
    'MEMORY_CORE_AUDIT_REASONER_OPENAI_API_KEY',
    'MEMORY_CORE_AUDIT_REASONER_OPENAI_BASE_URL',
    'MEMORY_CORE_AUDIT_REASONER_CLAUDE_MODEL',
    'MEMORY_CORE_AUDIT_REASONER_CLAUDE_API_KEY',
    'MEMORY_CORE_AUDIT_REASONER_CLAUDE_BASE_URL',
    'MEMORY_CORE_AUDIT_REASONER_GEMINI_MODEL',
    'MEMORY_CORE_AUDIT_REASONER_GEMINI_API_KEY',
    'MEMORY_CORE_AUDIT_REASONER_GEMINI_BASE_URL',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'CLAUDE_API_KEY',
    'GEMINI_API_KEY',
    'MEMORY_CORE_CLAUDE_API_KEY',
  ];
  return explicitVars.some((name) => process.env[name] !== undefined && process.env[name] !== '');
}
