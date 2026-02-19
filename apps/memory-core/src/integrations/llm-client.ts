import type { AuditReasonerProvider } from '../config.js';
import { Logger } from '../logger.js';

const REQUEST_TIMEOUT_MS = 15000;

export type LlmUsageEvent = {
  workspaceId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  systemActor?: string | null;
  purpose: string;
  provider: string;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  correlationId?: string | null;
};

type LlmUsageRecorder = (event: LlmUsageEvent) => Promise<void>;

export type LlmCompleteTextArgs = {
  workspaceId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  systemActor?: string | null;
  purpose: string;
  correlationId?: string | null;
  provider: AuditReasonerProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type LlmCompleteTextResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export class LlmClient {
  constructor(
    private readonly logger: Logger,
    private readonly recordUsage?: LlmUsageRecorder
  ) {}

  async completeText(args: LlmCompleteTextArgs): Promise<LlmCompleteTextResult> {
    if (args.provider === 'openai') {
      return this.completeOpenAi(args);
    }
    if (args.provider === 'claude') {
      return this.completeClaude(args);
    }
    return this.completeGemini(args);
  }

  private async completeOpenAi(args: LlmCompleteTextArgs): Promise<LlmCompleteTextResult> {
    const endpoint = `${(args.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        temperature: args.temperature ?? 0.1,
        max_tokens: args.maxOutputTokens ?? 512,
        messages: [
          ...(args.systemPrompt
            ? [
                {
                  role: 'system',
                  content: args.systemPrompt,
                },
              ]
            : []),
          {
            role: 'user',
            content: args.userPrompt,
          },
        ],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    const inputTokens = toSafeToken((payload as any)?.usage?.prompt_tokens);
    const outputTokens = toSafeToken((payload as any)?.usage?.completion_tokens);
    await this.safeRecordUsage(args, inputTokens, outputTokens);

    if (!response.ok) {
      throw new Error(`OpenAI HTTP ${response.status}`);
    }

    const text = String((payload as any)?.choices?.[0]?.message?.content || '').trim();
    return {
      text,
      inputTokens,
      outputTokens,
    };
  }

  private async completeClaude(args: LlmCompleteTextArgs): Promise<LlmCompleteTextResult> {
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
        max_tokens: args.maxOutputTokens ?? 512,
        temperature: args.temperature ?? 0.1,
        system: args.systemPrompt || undefined,
        messages: [{ role: 'user', content: args.userPrompt }],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    const inputTokens = toSafeToken((payload as any)?.usage?.input_tokens);
    const outputTokens = toSafeToken((payload as any)?.usage?.output_tokens);
    await this.safeRecordUsage(args, inputTokens, outputTokens);

    if (!response.ok) {
      throw new Error(`Claude HTTP ${response.status}`);
    }

    const text = String(
      ((payload as any)?.content || [])
        .filter((item: any) => item?.type === 'text')
        .map((item: any) => item?.text || '')
        .join('\n')
    ).trim();
    return {
      text,
      inputTokens,
      outputTokens,
    };
  }

  private async completeGemini(args: LlmCompleteTextArgs): Promise<LlmCompleteTextResult> {
    const endpointBase = (args.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const endpoint = `${endpointBase}/models/${encodeURIComponent(
      args.model
    )}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ...(args.systemPrompt
          ? {
              systemInstruction: {
                role: 'system',
                parts: [{ text: args.systemPrompt }],
              },
            }
          : {}),
        contents: [{ role: 'user', parts: [{ text: args.userPrompt }] }],
        generationConfig: {
          temperature: args.temperature ?? 0.1,
          maxOutputTokens: args.maxOutputTokens ?? 512,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    const inputTokens = toSafeToken((payload as any)?.usageMetadata?.promptTokenCount);
    const outputTokens = toSafeToken((payload as any)?.usageMetadata?.candidatesTokenCount);
    await this.safeRecordUsage(args, inputTokens, outputTokens);

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const text = String(
      ((payload as any)?.candidates?.[0]?.content?.parts || []).map((part: any) => part?.text || '').join('\n')
    ).trim();
    return {
      text,
      inputTokens,
      outputTokens,
    };
  }

  private async safeRecordUsage(
    args: LlmCompleteTextArgs,
    inputTokens: number | null,
    outputTokens: number | null
  ): Promise<void> {
    if (!this.recordUsage) {
      return;
    }
    try {
      await this.recordUsage({
        workspaceId: args.workspaceId,
        projectId: args.projectId || null,
        actorUserId: args.actorUserId || null,
        systemActor: args.systemActor || null,
        purpose: args.purpose,
        provider: args.provider,
        model: args.model,
        inputTokens,
        outputTokens,
        correlationId: args.correlationId || null,
      });
    } catch (error) {
      this.logger.warn('Failed to record LLM usage event', {
        workspaceId: args.workspaceId,
        purpose: args.purpose,
        provider: args.provider,
        model: args.model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

function toSafeToken(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const rounded = Math.round(numeric);
  if (rounded < 0) {
    return 0;
  }
  return rounded;
}
