import { z } from 'zod';

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

const coreEnvSchema = z
  .object({
    DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
    MEMORY_CORE_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    MEMORY_CORE_HOST: z.string().trim().min(1).optional(),
    MEMORY_CORE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),
  })
  .passthrough();

export type MemoryCoreConfig = {
  port: number;
  host: string;
  databaseUrl: string;
  logLevel: LogLevel;
  allowBootstrapAdmin: boolean;
  authSessionSecret: string;
  authSessionTtlSeconds: number;
  apiKeyHashSecret: string;
  oneTimeTokenSecret: string;
  oneTimeTokenTtlSeconds: number;
  githubStateSecret: string;
  publicBaseUrl?: string;
  inviteBaseUrl?: string;
  githubAppId?: string;
  githubAppPrivateKey?: string;
  githubAppWebhookSecret?: string;
  githubAppName?: string;
  githubAppUrl?: string;
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
  const envParsed = coreEnvSchema.safeParse(process.env);
  if (!envParsed.success) {
    const details = envParsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const env = envParsed.data;
  const databaseUrl = env.DATABASE_URL;

  const rawKeys = parseApiKeys();
  const auditReasonerProviderOrder = parseAuditReasonerProviderOrder();
  const openAiApiKey = parseOpenAiApiKey(auditReasonerProviderOrder);
  const claudeApiKey = parseClaudeApiKey(auditReasonerProviderOrder);
  const geminiApiKey = parseGeminiApiKey(auditReasonerProviderOrder);
  const sharedSecret = (process.env.MEMORY_CORE_SECRET || '').trim();
  const integrationLockPolicy = parseIntegrationLockPolicy(
    process.env.MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS
  );

  return {
    port: env.MEMORY_CORE_PORT ?? 8080,
    host: env.MEMORY_CORE_HOST || '0.0.0.0',
    databaseUrl,
    logLevel: normalizeLogLevel(env.MEMORY_CORE_LOG_LEVEL),
    allowBootstrapAdmin: parseBoolean(process.env.MEMORY_CORE_ALLOW_BOOTSTRAP_ADMIN || 'true'),
    authSessionSecret:
      (process.env.MEMORY_CORE_AUTH_SESSION_SECRET || '').trim() ||
      sharedSecret ||
      'claustrum-dev-session-secret-change-me',
    authSessionTtlSeconds: parseSessionTtlSeconds(process.env.MEMORY_CORE_AUTH_SESSION_TTL_SECONDS),
    apiKeyHashSecret:
      (process.env.MEMORY_CORE_API_KEY_HASH_SECRET || '').trim() ||
      sharedSecret ||
      'claustrum-dev-api-key-hash-secret-change-me',
    oneTimeTokenSecret:
      (process.env.MEMORY_CORE_ONE_TIME_TOKEN_SECRET || '').trim() ||
      sharedSecret ||
      (process.env.MEMORY_CORE_AUTH_SESSION_SECRET || '').trim() ||
      'claustrum-dev-one-time-token-secret-change-me',
    oneTimeTokenTtlSeconds: parseOneTimeTokenTtlSeconds(
      process.env.MEMORY_CORE_ONE_TIME_TOKEN_TTL_SECONDS
    ),
    githubStateSecret:
      (process.env.MEMORY_CORE_GITHUB_STATE_SECRET || '').trim() ||
      sharedSecret ||
      (process.env.MEMORY_CORE_AUTH_SESSION_SECRET || '').trim() ||
      'claustrum-dev-github-state-secret-change-me',
    publicBaseUrl: (process.env.MEMORY_CORE_PUBLIC_BASE_URL || '').trim() || undefined,
    inviteBaseUrl: (process.env.MEMORY_CORE_INVITE_BASE_URL || '').trim() || undefined,
    githubAppId: (process.env.GITHUB_APP_ID || '').trim() || undefined,
    githubAppPrivateKey: parseGithubAppPrivateKey(process.env.GITHUB_APP_PRIVATE_KEY),
    githubAppWebhookSecret: (process.env.GITHUB_APP_WEBHOOK_SECRET || '').trim() || undefined,
    githubAppName: (process.env.GITHUB_APP_NAME || '').trim() || undefined,
    githubAppUrl: (process.env.GITHUB_APP_URL || '').trim() || undefined,
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

function parseGithubAppPrivateKey(input?: string): string | undefined {
  const raw = (input || '').trim();
  if (!raw) {
    return undefined;
  }
  const normalized = raw.replace(/\\n/g, '\n');
  if (looksLikePem(normalized)) {
    return normalized;
  }

  const compact = raw.replace(/\s+/g, '');
  try {
    const decoded = Buffer.from(compact, 'base64').toString('utf8').trim();
    if (looksLikePem(decoded)) {
      return decoded;
    }
  } catch {
    // fall through
  }

  throw new Error(
    'GITHUB_APP_PRIVATE_KEY is invalid. Use raw PEM, escaped newlines, or base64-encoded PEM.'
  );
}

function looksLikePem(value: string): boolean {
  return value.includes('BEGIN') && value.includes('PRIVATE KEY');
}

function parseSessionTtlSeconds(input?: string): number {
  const value = Number(input || '43200');
  if (!Number.isFinite(value) || value <= 0) {
    return 43200;
  }
  return Math.max(Math.floor(value), 300);
}

function parseOneTimeTokenTtlSeconds(input?: string): number {
  const value = Number(input || '900');
  if (!Number.isFinite(value) || value <= 0) {
    return 900;
  }
  return Math.max(Math.floor(value), 60);
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
