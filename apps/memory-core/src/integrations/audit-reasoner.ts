import type { AuditReasonerProvider } from '../config.js';
import { Logger } from '../logger.js';

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
  action: string;
  actorUserEmail?: string;
  target: Record<string, unknown>;
};

const MAX_REASON_LENGTH = 240;
const MAX_PROMPT_TARGET_LENGTH = 3000;
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_MODELS: Record<AuditReasonerProvider, string> = {
  openai: 'gpt-4.1-mini',
  claude: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
};

export class AuditReasoner {
  constructor(private readonly logger: Logger) {}

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
        let reason: string | undefined;
        if (provider === 'openai') {
          reason = await this.generateWithOpenAI({
            model,
            apiKey,
            baseUrl: providerConfig?.baseUrl,
            prompt,
          });
        } else if (provider === 'claude') {
          reason = await this.generateWithClaude({
            model,
            apiKey,
            baseUrl: providerConfig?.baseUrl,
            prompt,
          });
        } else {
          reason = await this.generateWithGemini({
            model,
            apiKey,
            baseUrl: providerConfig?.baseUrl,
            prompt,
          });
        }
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

  private async generateWithOpenAI(args: {
    model: string;
    apiKey: string;
    baseUrl?: string;
    prompt: string;
  }): Promise<string | undefined> {
    const endpoint = `${(args.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0.1,
        max_tokens: 120,
        messages: [
          {
            role: 'system',
            content:
              'You write concise engineering audit reasons. Output one sentence only. Avoid secrets and credentials.',
          },
          {
            role: 'user',
            content: args.prompt,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = payload.choices?.[0]?.message?.content || '';
    return normalizeReasonText(text);
  }

  private async generateWithClaude(args: {
    model: string;
    apiKey: string;
    baseUrl?: string;
    prompt: string;
  }): Promise<string | undefined> {
    const endpoint = `${(args.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '')}/v1/messages`;
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: 120,
        temperature: 0.1,
        system:
          'You write concise engineering audit reasons. Output one sentence only. Avoid secrets and credentials.',
        messages: [
          {
            role: 'user',
            content: args.prompt,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Claude HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text =
      payload.content
        ?.filter((part) => part.type === 'text')
        .map((part) => part.text || '')
        .join('\n') || '';
    return normalizeReasonText(text);
  }

  private async generateWithGemini(args: {
    model: string;
    apiKey: string;
    baseUrl?: string;
    prompt: string;
  }): Promise<string | undefined> {
    const endpointBase = (args.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/+$/,
      ''
    );
    const endpoint = `${endpointBase}/models/${encodeURIComponent(
      args.model
    )}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: args.prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 120,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
    return normalizeReasonText(text);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
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
