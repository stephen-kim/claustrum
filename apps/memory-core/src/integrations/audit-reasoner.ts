import type { AuditReasonerProvider } from '../config.js';
import { Logger } from '../logger.js';
import type { LlmClient } from './llm-client.js';

export type AuditReasonerProviderConfig = {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
};

export type AuditReasonerConfig = {
  enabled: boolean;
  source: 'env' | 'workspace';
  providerOrder: AuditReasonerProvider[];
  providers: Partial<Record<AuditReasonerProvider, AuditReasonerProviderConfig>>;
};

export type AuditReasonerResult = {
  reason: string;
  provider: AuditReasonerProvider;
  model: string;
};

type GenerateArgs = {
  workspaceId: string;
  projectId?: string;
  actorUserId?: string;
  correlationId?: string;
  action: string;
  actorUserEmail?: string;
  target: Record<string, unknown>;
};

const MAX_REASON_LENGTH = 240;
const MAX_PROMPT_TARGET_LENGTH = 3000;
const DEFAULT_MODELS: Record<AuditReasonerProvider, string> = {
  openai: 'gpt-4.1-mini',
  claude: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
};

const SYSTEM_PROMPT =
  'You write concise engineering audit reasons. Output one sentence only. Avoid secrets and credentials.';

export class AuditReasoner {
  constructor(
    private readonly logger: Logger,
    private readonly llmClient: LlmClient
  ) {}

  async generateReason(
    config: AuditReasonerConfig,
    args: GenerateArgs
  ): Promise<AuditReasonerResult | undefined> {
    if (!config.enabled) {
      return undefined;
    }
    const prompt = buildAuditReasonPrompt(args);

    for (const provider of dedupeProviders(config.providerOrder)) {
      const providerConfig = config.providers[provider];
      const apiKey = (providerConfig?.apiKey || '').trim();
      if (!apiKey) {
        continue;
      }
      const model = (providerConfig?.model || DEFAULT_MODELS[provider]).trim();
      try {
        const completion = await this.llmClient.completeText({
          workspaceId: args.workspaceId,
          projectId: args.projectId || null,
          actorUserId: args.actorUserId || null,
          systemActor: 'audit_reasoner',
          purpose: 'summarize',
          correlationId: args.correlationId || null,
          provider,
          model,
          apiKey,
          baseUrl: providerConfig?.baseUrl,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: prompt,
          temperature: 0.1,
          maxOutputTokens: 120,
        });
        const reason = normalizeReasonText(completion.text);
        if (reason) {
          return { reason, provider, model };
        }
      } catch (error) {
        this.logger.warn('Audit reason generation failed', {
          provider,
          source: config.source,
          action: args.action,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return undefined;
  }
}

function dedupeProviders(input: AuditReasonerProvider[]): AuditReasonerProvider[] {
  const out: AuditReasonerProvider[] = [];
  for (const provider of input) {
    if (!out.includes(provider)) {
      out.push(provider);
    }
  }
  return out;
}

function buildAuditReasonPrompt(args: GenerateArgs): string {
  const actor = args.actorUserEmail ? `Actor: ${args.actorUserEmail}` : 'Actor: system';
  const target = truncateText(JSON.stringify(redactForPrompt(args.target), null, 2), MAX_PROMPT_TARGET_LENGTH);
  return [
    'Create one short reason for an audit log entry.',
    'Use <= 180 characters.',
    'Focus on intent and impact.',
    'Do not include secrets, tokens, passwords, or full payload dumps.',
    `Action: ${args.action}`,
    actor,
    `Target JSON:\n${target}`,
  ].join('\n');
}

function normalizeReasonText(input: string): string | undefined {
  const compact = input
    .replace(/\s+/g, ' ')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .trim();
  if (!compact) {
    return undefined;
  }
  return truncateText(compact, MAX_REASON_LENGTH);
}

function truncateText(input: string, maxLength: number): string {
  return input.length > maxLength ? `${input.slice(0, maxLength - 3)}...` : input;
}

function redactForPrompt(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 30).map(redactForPrompt);
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      return truncateText(value, 300);
    }
    return value;
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    if (isSensitiveKey(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = redactForPrompt(item);
  }
  return out;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('api_key') ||
    normalized.includes('apikey') ||
    normalized.includes('authorization') ||
    normalized.includes('webhook')
  );
}
