import { IntegrationProvider, type PrismaClient } from '@prisma/client';
import type { AuditReasonerConfig } from '../integrations/audit-reasoner.js';
import type { AuditReasonerProvider } from '../config.js';
import { getConfigString, toJsonObject } from './integration-utils.js';

const DEFAULT_REASONER_MODEL: Record<AuditReasonerProvider, string> = {
  openai: 'gpt-4.1-mini',
  claude: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
};

export type AuditReasonerEnvConfig = {
  enabled: boolean;
  preferEnv: boolean;
  providerOrder: AuditReasonerProvider[];
  providers: Partial<
    Record<
      AuditReasonerProvider,
      {
        model?: string;
        apiKey?: string;
        baseUrl?: string;
      }
    >
  >;
};

export function hasEnvAuditReasonerPreference(envConfig: AuditReasonerEnvConfig): boolean {
  return envConfig.preferEnv;
}

export function getEnvAuditReasonerConfigAsJson(envConfig: AuditReasonerEnvConfig): Record<string, unknown> {
  const openai = getEnvProviderConfig(envConfig, 'openai');
  const claude = getEnvProviderConfig(envConfig, 'claude');
  const gemini = getEnvProviderConfig(envConfig, 'gemini');
  return {
    enabled: envConfig.enabled,
    provider_order: envConfig.providerOrder,
    openai_model: openai.model || null,
    openai_base_url: openai.baseUrl || null,
    has_openai_api_key: Boolean(openai.apiKey),
    claude_model: claude.model || null,
    claude_base_url: claude.baseUrl || null,
    has_claude_api_key: Boolean(claude.apiKey),
    gemini_model: gemini.model || null,
    gemini_base_url: gemini.baseUrl || null,
    has_gemini_api_key: Boolean(gemini.apiKey),
  };
}

export async function getEffectiveAuditReasonerConfig(args: {
  prisma: PrismaClient;
  workspaceId: string;
  integrationLockedProviders: ReadonlySet<IntegrationProvider>;
  auditReasonerEnvConfig: AuditReasonerEnvConfig;
}): Promise<AuditReasonerConfig | undefined> {
  const envConfig = getEnvAuditReasonerConfig(args.auditReasonerEnvConfig);
  if (hasEnvAuditReasonerPreference(args.auditReasonerEnvConfig)) {
    return envConfig;
  }
  if (args.integrationLockedProviders.has(IntegrationProvider.audit_reasoner)) {
    return undefined;
  }

  const row = await args.prisma.workspaceIntegration.findUnique({
    where: {
      workspaceId_provider: {
        workspaceId: args.workspaceId,
        provider: IntegrationProvider.audit_reasoner,
      },
    },
  });

  if (!row || !row.isEnabled) {
    return undefined;
  }

  const config = toJsonObject(row.config);
  const providerOrder = parseAuditReasonerProviderOrder(config);
  const providers = buildAuditReasonerProvidersFromConfig(config, providerOrder);
  if (!providerOrder.some((provider) => Boolean(providers[provider]?.apiKey))) {
    return undefined;
  }

  return {
    enabled: true,
    source: 'workspace',
    providerOrder,
    providers,
  };
}

function getEnvProviderConfig(
  envConfig: AuditReasonerEnvConfig,
  provider: AuditReasonerProvider
): { model?: string; apiKey?: string; baseUrl?: string } {
  const config = envConfig.providers[provider] || {};
  return {
    model: config.model || DEFAULT_REASONER_MODEL[provider],
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  };
}

function getEnvAuditReasonerConfig(
  envConfig: AuditReasonerEnvConfig
): AuditReasonerConfig | undefined {
  if (!envConfig.enabled) {
    return undefined;
  }
  const providerOrder = envConfig.providerOrder.filter(
    (provider, index, array) => array.indexOf(provider) === index
  );
  if (providerOrder.length === 0) {
    return undefined;
  }

  const providers: AuditReasonerConfig['providers'] = {};
  for (const provider of providerOrder) {
    providers[provider] = getEnvProviderConfig(envConfig, provider);
  }

  if (!providerOrder.some((provider) => Boolean(providers[provider]?.apiKey))) {
    return undefined;
  }

  return {
    enabled: true,
    source: 'env',
    providerOrder,
    providers,
  };
}

function parseAuditReasonerProviderOrder(config: Record<string, unknown>): AuditReasonerProvider[] {
  const value = config.provider_order;
  const parsed: AuditReasonerProvider[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string') {
        continue;
      }
      const normalized = normalizeAuditReasonerProvider(item);
      if (normalized && !parsed.includes(normalized)) {
        parsed.push(normalized);
      }
    }
  }
  if (parsed.length > 0) {
    return parsed;
  }

  const legacySingle = normalizeAuditReasonerProvider(getConfigString(config, 'provider') || '');
  if (legacySingle) {
    return [legacySingle];
  }
  return ['openai', 'claude', 'gemini'];
}

function buildAuditReasonerProvidersFromConfig(
  config: Record<string, unknown>,
  providerOrder: AuditReasonerProvider[]
): AuditReasonerConfig['providers'] {
  const out: AuditReasonerConfig['providers'] = {};
  const legacySingle = normalizeAuditReasonerProvider(getConfigString(config, 'provider') || '');
  for (const provider of providerOrder) {
    const model =
      getConfigString(config, `${provider}_model`) ||
      (legacySingle === provider ? getConfigString(config, 'model') : undefined) ||
      DEFAULT_REASONER_MODEL[provider];
    const apiKey =
      getConfigString(config, `${provider}_api_key`) ||
      (legacySingle === provider ? getConfigString(config, 'api_key') : undefined);
    const baseUrl =
      getConfigString(config, `${provider}_base_url`) ||
      (legacySingle === provider ? getConfigString(config, 'base_url') : undefined);
    out[provider] = { model, apiKey, baseUrl };
  }
  return out;
}

function normalizeAuditReasonerProvider(input: string): AuditReasonerProvider | undefined {
  const value = input.trim().toLowerCase();
  if (value === 'openai' || value === 'claude' || value === 'gemini') {
    return value;
  }
  return undefined;
}
