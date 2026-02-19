import { Prisma, RawEventType, type PrismaClient } from '@prisma/client';
import type { AuditReasonerConfig } from '../../integrations/audit-reasoner.js';
import type { LlmClient } from '../../integrations/llm-client.js';
import { toJsonObject } from '../integration-utils.js';
import { getEffectiveWorkspaceSettings } from '../workspace-resolution.js';
import {
  calculateKeywordPriorityScore,
} from './decision-keyword-policy-helpers.js';
import {
  classifyDecisionFromRawEvent,
  type DecisionLlmClassification,
} from './decision-llm-classifier.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

type DecisionBatchArgs = {
  prisma: PrismaClient;
  workspaceId: string;
  actorUserId: string;
  llmClient: LlmClient;
  updateMemoryEmbedding: (memoryId: string, content: string) => Promise<void>;
  getDecisionLlmConfig: (workspaceId: string) => Promise<AuditReasonerConfig | undefined>;
};

type CandidateRawEvent = {
  id: string;
  workspaceId: string;
  projectId: string;
  eventType: RawEventType;
  branch: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  changedFiles: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

const DEFAULT_SCAN_MULTIPLIER = 8;
const MAX_SCAN_LIMIT = 500;

type NormalizedKeywordPolicy = {
  positive_keywords: string[];
  negative_keywords: string[];
  file_path_positive_patterns: string[];
  file_path_negative_patterns: string[];
  weight_positive: number;
  weight_negative: number;
};

export async function runDecisionExtractionBatchForWorkspace(args: DecisionBatchArgs): Promise<void> {
  const settings = await getEffectiveWorkspaceSettings(args.prisma, args.workspaceId);
  if (!settings.enableDecisionExtraction) {
    return;
  }

  const cutoff = new Date(Date.now() - settings.decisionBackfillDays * 24 * 60 * 60 * 1000);
  const scanLimit = Math.min(
    Math.max(settings.decisionBatchSize * DEFAULT_SCAN_MULTIPLIER, settings.decisionBatchSize),
    MAX_SCAN_LIMIT
  );

  const rows = await args.prisma.rawEvent.findMany({
    where: {
      workspaceId: args.workspaceId,
      eventType: {
        in: [RawEventType.post_commit, RawEventType.post_merge],
      },
      createdAt: {
        gte: cutoff,
      },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: scanLimit,
  });

  const unprocessed = rows.filter((row) => {
    const metadata = toJsonObject(row.metadata);
    return metadata.decision_extraction_processed !== true;
  });
  if (unprocessed.length === 0) {
    return;
  }

  const candidates =
    settings.decisionExtractionMode === 'hybrid_priority'
      ? await sortCandidatesByKeywordScore(args.prisma, args.workspaceId, unprocessed)
      : unprocessed;

  const llmConfig = await args.getDecisionLlmConfig(args.workspaceId);
  if (!llmConfig) {
    await markBatchAttemptWithoutLlm(args.prisma, candidates.slice(0, settings.decisionBatchSize));
    console.error(
      `[memory-core] decision extraction skipped: no LLM provider configured for workspace ${args.workspaceId}`
    );
    return;
  }

  for (const event of candidates.slice(0, settings.decisionBatchSize)) {
    try {
      await processEventWithLlm({
        prisma: args.prisma,
        event,
        actorUserId: args.actorUserId,
        settings,
        llmConfig,
        llmClient: args.llmClient,
        updateMemoryEmbedding: args.updateMemoryEmbedding,
      });
    } catch (error) {
      const metadata = toJsonObject(event.metadata);
      await args.prisma.rawEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...metadata,
            decision_extraction_last_attempt_at: new Date().toISOString(),
            decision_extraction_last_error:
              error instanceof Error ? error.message : 'decision extraction failed',
          } as Prisma.InputJsonValue,
        },
      });
    }
  }
}

async function sortCandidatesByKeywordScore(
  prisma: DbClient,
  workspaceId: string,
  events: CandidateRawEvent[]
): Promise<CandidateRawEvent[]> {
  const policies = await prisma.decisionKeywordPolicy.findMany({
    where: {
      workspaceId,
      enabled: true,
    },
    orderBy: [{ updatedAt: 'desc' }],
  });
  if (policies.length === 0) {
    return events;
  }

  const normalizedPolicies: NormalizedKeywordPolicy[] = policies.map((policy) => ({
    positive_keywords: toStringArray(policy.positiveKeywords),
    negative_keywords: toStringArray(policy.negativeKeywords),
    file_path_positive_patterns: toStringArray(policy.filePathPositivePatterns),
    file_path_negative_patterns: toStringArray(policy.filePathNegativePatterns),
    weight_positive: policy.weightPositive,
    weight_negative: policy.weightNegative,
  }));

  const scored = events.map((event) => {
    const changedFiles = toStringArray(event.changedFiles);
    const score = normalizedPolicies.reduce((acc, policy) => {
      return (
        acc +
        calculateKeywordPriorityScore({
          commitMessage: event.commitMessage || '',
          changedFiles,
          positiveKeywords: policy.positive_keywords,
          negativeKeywords: policy.negative_keywords,
          filePathPositivePatterns: policy.file_path_positive_patterns,
          filePathNegativePatterns: policy.file_path_negative_patterns,
          weightPositive: policy.weight_positive,
          weightNegative: policy.weight_negative,
        })
      );
    }, 0);
    return {
      event,
      score,
    };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.event.createdAt.getTime() - a.event.createdAt.getTime();
    })
    .map((item) => item.event);
}

async function markBatchAttemptWithoutLlm(
  prisma: DbClient,
  events: CandidateRawEvent[]
): Promise<void> {
  await Promise.all(
    events.map(async (event) => {
      const metadata = toJsonObject(event.metadata);
      await prisma.rawEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...metadata,
            decision_extraction_last_attempt_at: new Date().toISOString(),
            decision_extraction_last_error: 'llm_provider_not_configured',
          } as Prisma.InputJsonValue,
        },
      });
    })
  );
}

async function processEventWithLlm(args: {
  prisma: PrismaClient;
  event: CandidateRawEvent;
  actorUserId: string;
  settings: Awaited<ReturnType<typeof getEffectiveWorkspaceSettings>>;
  llmConfig: AuditReasonerConfig;
  llmClient: LlmClient;
  updateMemoryEmbedding: (memoryId: string, content: string) => Promise<void>;
}): Promise<void> {
  const metadata = toJsonObject(args.event.metadata);
  const changedFiles = toStringArray(args.event.changedFiles);
  const classification = await classifyDecisionFromRawEvent({
    config: args.llmConfig,
    llmClient: args.llmClient,
    event: {
      id: args.event.id,
      workspaceId: args.event.workspaceId,
      projectId: args.event.projectId,
      actorUserId: args.actorUserId,
      eventType: args.event.eventType,
      commitSha: args.event.commitSha,
      commitMessage: args.event.commitMessage,
      branch: args.event.branch,
      changedFiles,
      metadata,
    },
  });

  if (!classification) {
    await args.prisma.rawEvent.update({
      where: { id: args.event.id },
      data: {
        metadata: {
          ...metadata,
          decision_extraction_last_attempt_at: new Date().toISOString(),
          decision_extraction_last_error: 'llm_no_valid_response',
        } as Prisma.InputJsonValue,
      },
    });
    return;
  }

  if (classification.label === 'not_decision') {
    await args.prisma.rawEvent.update({
      where: { id: args.event.id },
      data: {
        metadata: {
          ...metadata,
          decision_extraction_processed: true,
          decision_extraction_processed_at: new Date().toISOString(),
          decision_extraction_result: 'not_decision',
          decision_extraction_confidence: clampConfidence(classification.confidence),
          decision_extraction_provider: classification.provider,
          decision_extraction_model: classification.model,
        } as Prisma.InputJsonValue,
      },
    });
    return;
  }

  const confidence = clampConfidence(classification.confidence);
  const status =
    args.settings.decisionAutoConfirmEnabled && confidence >= args.settings.decisionAutoConfirmMinConfidence
      ? 'confirmed'
      : args.settings.decisionDefaultStatus;

  const content = buildDecisionContent({
    classification,
    commitMessage: args.event.commitMessage,
    commitSha: args.event.commitSha,
    eventId: args.event.id,
    changedFiles,
    branch: args.event.branch,
  });
  const created = await args.prisma.memory.create({
    data: {
      workspaceId: args.event.workspaceId,
      projectId: args.event.projectId,
      type: 'decision',
      content,
      status,
      source: 'auto',
      confidence,
      evidence: {
        raw_event_ids: [args.event.id],
        commit_sha: args.event.commitSha || null,
        event_type: args.event.eventType,
        branch: args.event.branch || null,
        changed_files: changedFiles,
      } as Prisma.InputJsonValue,
      metadata: {
        extraction: {
          mode: args.settings.decisionExtractionMode,
          engine: 'llm',
          version: 'llm-v1',
          provider: classification.provider,
          model: classification.model,
          tags: classification.tags,
        },
      } as Prisma.InputJsonValue,
      createdBy: args.actorUserId,
    },
    select: {
      id: true,
      content: true,
    },
  });
  await args.updateMemoryEmbedding(created.id, created.content);

  await args.prisma.rawEvent.update({
    where: { id: args.event.id },
    data: {
      metadata: {
        ...metadata,
        decision_extraction_processed: true,
        decision_extraction_processed_at: new Date().toISOString(),
        decision_extraction_result: status === 'confirmed' ? 'decision_confirmed' : 'decision_draft',
        decision_extraction_confidence: confidence,
        decision_extraction_provider: classification.provider,
        decision_extraction_model: classification.model,
        decision_extraction_memory_id: created.id,
      } as Prisma.InputJsonValue,
    },
  });
}

function buildDecisionContent(args: {
  classification: DecisionLlmClassification;
  commitMessage: string | null;
  commitSha: string | null;
  eventId: string;
  changedFiles: string[];
  branch: string | null;
}): string {
  const summary = args.classification.summary || firstLine(args.commitMessage || '') || 'Decision detected';
  const whyLines = normalizeBulletLines(args.classification.reason, [
    'LLM identified durable engineering decision signals from commit metadata.',
  ]);
  const alternatives = normalizeBulletLines([], [
    'Keep the previous implementation path and defer this change.',
  ]);
  const impact = normalizeBulletLines(
    [
      args.branch ? `Applied on branch ${args.branch}.` : '',
      args.changedFiles.length > 0
        ? `Touched ${Math.min(args.changedFiles.length, 50)} file(s): ${args.changedFiles
            .slice(0, 8)
            .join(', ')}${args.changedFiles.length > 8 ? ', ...' : ''}`
        : '',
    ],
    ['Affects implementation and project context for future tasks.']
  );
  const evidence = normalizeBulletLines(
    [
      args.commitSha ? `commit_sha: ${args.commitSha}` : '',
      `raw_event_id: ${args.eventId}`,
      args.branch ? `branch: ${args.branch}` : '',
      args.changedFiles.length > 0 ? `files: ${args.changedFiles.slice(0, 20).join(', ')}` : '',
    ],
    ['No structured evidence was available.']
  );

  const content = [
    'Summary:',
    truncateLine(summary, 280),
    'Why:',
    ...whyLines,
    'Alternatives:',
    ...alternatives,
    'Impact:',
    ...impact,
    'Evidence:',
    ...evidence,
  ].join('\n');
  return ensureDecisionTemplateSections(content);
}

function firstLine(input: string): string {
  const line = input.split('\n').map((part) => part.trim()).find(Boolean) || '';
  return line.length > 280 ? `${line.slice(0, 277)}...` : line;
}

function clampConfidence(input: number): number {
  return Math.min(Math.max(Number.isFinite(input) ? input : 0, 0), 1);
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 2000);
}

function normalizeBulletLines(lines: string[], fallback: string[]): string[] {
  const normalized = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((line) => `- ${truncateLine(line, 280)}`);
  if (normalized.length > 0) {
    return normalized;
  }
  return fallback.map((line) => `- ${truncateLine(line, 280)}`);
}

function truncateLine(input: string, max: number): string {
  if (input.length <= max) {
    return input;
  }
  return `${input.slice(0, Math.max(max - 3, 1)).trimEnd()}...`;
}

function ensureDecisionTemplateSections(content: string): string {
  const sectionOrder = ['Summary:', 'Why:', 'Alternatives:', 'Impact:', 'Evidence:'] as const;
  const lines = content.split('\n').map((line) => line.trimEnd());
  const chunks = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of lines) {
    if (sectionOrder.includes(line as (typeof sectionOrder)[number])) {
      current = line;
      if (!chunks.has(current)) {
        chunks.set(current, []);
      }
      continue;
    }
    if (!current) {
      continue;
    }
    chunks.get(current)!.push(line);
  }
  const output: string[] = [];
  for (const section of sectionOrder) {
    output.push(section);
    const values = (chunks.get(section) || []).map((value) => value.trim()).filter(Boolean);
    if (section === 'Summary:') {
      output.push(values[0] || 'No summary provided.');
      continue;
    }
    if (values.length === 0) {
      output.push('- n/a');
      continue;
    }
    const normalized = values.slice(0, 3).map((value) => (value.startsWith('- ') ? value : `- ${value}`));
    output.push(...normalized);
  }
  return output.join('\n');
}
