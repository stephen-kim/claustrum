import type { RawEventType } from '@prisma/client';
import type { AuditReasonerConfig } from '../../integrations/audit-reasoner.js';
import type { AuditReasonerProvider } from '../../config.js';
import type { LlmClient } from '../../integrations/llm-client.js';

const MAX_MESSAGE_LEN = 2000;
const MAX_FILES = 200;
const MAX_FILES_TEXT_LEN = 4000;

export const DECISION_CLASSIFIER_SYSTEM_PROMPT = [
  'You classify git events into durable engineering decisions.',
  'Return strict JSON only.',
  'Schema:',
  '{"label":"decision|not_decision","confidence":0..1,"summary":"string","reason":["string"],"tags":["string"]}',
  'Rules:',
  '- label=decision only when there is a durable choice (architecture, policy, migration, API contract, deprecation, ownership, process).',
  '- ignore temporary work, experiments, debug/test-only edits.',
  '- summary should be 1-2 concise lines.',
  '- reason should be 1-3 short bullets.',
  '- If label=not_decision, keep summary/reason/tags empty.',
].join('\n');

type ProviderConfig = {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
};

type RawEventForClassification = {
  id: string;
  workspaceId: string;
  projectId: string;
  eventType: RawEventType;
  commitSha?: string | null;
  commitMessage?: string | null;
  branch?: string | null;
  changedFiles: string[];
  metadata?: Record<string, unknown>;
  actorUserId?: string | null;
};

export type DecisionLlmClassification = {
  label: 'decision' | 'not_decision';
  confidence: number;
  summary?: string;
  reason: string[];
  tags: string[];
  provider: AuditReasonerProvider;
  model: string;
  raw_text: string;
};

export async function classifyDecisionFromRawEvent(args: {
  config: AuditReasonerConfig;
  llmClient: LlmClient;
  event: RawEventForClassification;
}): Promise<DecisionLlmClassification | undefined> {
  const prompt = buildClassifierUserPrompt(args.event);
  for (const provider of dedupeProviders(args.config.providerOrder)) {
    const providerConfig = args.config.providers[provider] as ProviderConfig | undefined;
    const apiKey = (providerConfig?.apiKey || '').trim();
    if (!apiKey) {
      continue;
    }
    const model = (providerConfig?.model || '').trim();
    if (!model) {
      continue;
    }
    try {
      const completion = await args.llmClient.completeText({
        workspaceId: args.event.workspaceId,
        projectId: args.event.projectId,
        actorUserId: args.event.actorUserId || null,
        systemActor: 'decision_extractor',
        purpose: 'decision_extract',
        correlationId: args.event.id,
        provider,
        model,
        apiKey,
        baseUrl: providerConfig?.baseUrl,
        systemPrompt: DECISION_CLASSIFIER_SYSTEM_PROMPT,
        userPrompt: prompt,
        temperature: 0.1,
        maxOutputTokens: 500,
      });
      const normalized = normalizeClassificationResponse(completion.text);
      if (!normalized) {
        continue;
      }
      return {
        ...normalized,
        provider,
        model,
        raw_text: completion.text,
      };
    } catch {
      // Keep provider fallback non-blocking.
    }
  }
  return undefined;
}

function buildClassifierUserPrompt(event: RawEventForClassification): string {
  const changedFiles = event.changedFiles.slice(0, MAX_FILES);
  const changedFilesText = truncateText(
    changedFiles.length > 0 ? changedFiles.join('\n') : '(none)',
    MAX_FILES_TEXT_LEN
  );
  const metadataText = truncateText(JSON.stringify(event.metadata || {}, null, 2), 2000);
  return [
    'Classify this git event.',
    '',
    `event_id: ${event.id}`,
    `event_type: ${event.eventType}`,
    `branch: ${event.branch || ''}`,
    `commit_sha: ${event.commitSha || ''}`,
    `commit_message: ${truncateText((event.commitMessage || '').trim(), MAX_MESSAGE_LEN)}`,
    '',
    'changed_files:',
    changedFilesText,
    '',
    'metadata:',
    metadataText,
    '',
    'Return strict JSON only.',
  ].join('\n');
}

function normalizeClassificationResponse(rawText: string): Omit<
  DecisionLlmClassification,
  'provider' | 'model' | 'raw_text'
> | null {
  const parsed = safeParseJsonObject(rawText);
  if (!parsed) {
    return null;
  }
  const labelRaw = String(parsed.label || '')
    .trim()
    .toLowerCase();
  const label = labelRaw === 'decision' ? 'decision' : labelRaw === 'not_decision' ? 'not_decision' : null;
  if (!label) {
    return null;
  }
  const confidenceNumber =
    typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceNumber)
    ? Math.min(Math.max(confidenceNumber, 0), 1)
    : 0;

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
      ? truncateText(parsed.summary.trim(), 280)
      : undefined;
  const reason = normalizeStringArray(parsed.reason, 3, 220);
  const tags = normalizeStringArray(parsed.tags, 6, 60).map((item) => item.toLowerCase());

  if (label === 'not_decision') {
    return {
      label,
      confidence,
      reason: [],
      tags: [],
    };
  }

  return {
    label,
    confidence,
    summary,
    reason,
    tags,
  };
}

function normalizeStringArray(input: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') {
      continue;
    }
    const value = item.trim();
    if (!value) {
      continue;
    }
    const trimmed = truncateText(value, maxLen);
    if (!out.includes(trimmed)) {
      out.push(trimmed);
    }
    if (out.length >= maxItems) {
      break;
    }
  }
  return out;
}

function safeParseJsonObject(input: string): Record<string, unknown> | null {
  const direct = tryParseJson(input);
  if (direct) {
    return direct;
  }

  const first = input.indexOf('{');
  const last = input.lastIndexOf('}');
  if (first === -1 || last <= first) {
    return null;
  }
  return tryParseJson(input.slice(first, last + 1));
}

function tryParseJson(input: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(input) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
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

function truncateText(input: string, maxLength: number): string {
  return input.length > maxLength ? `${input.slice(0, maxLength - 3)}...` : input;
}
