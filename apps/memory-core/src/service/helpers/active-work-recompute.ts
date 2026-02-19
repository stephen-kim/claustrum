import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { inferActiveWorkCandidates, type ActiveWorkCandidate } from './active-work-inference.js';

export type ActiveWorkPolicy = {
  staleDays: number;
  autoCloseEnabled: boolean;
  autoCloseDays: number;
};

export async function recomputeActiveWorkForProject(args: {
  prisma: PrismaClient;
  workspaceId: string;
  projectId: string;
  now: Date;
  policy?: ActiveWorkPolicy;
  correlationId?: string;
}): Promise<{
  created: number;
  updated: number;
  staleMarked: number;
  staleCleared: number;
  closed: number;
  rows: Array<{
    id: string;
    title: string;
    confidence: number;
    status: 'inferred' | 'confirmed' | 'closed';
    stale: boolean;
    staleReason: string | null;
    lastEvidenceAt: Date | null;
    lastUpdatedAt: Date;
    closedAt: Date | null;
    evidenceIds: unknown;
  }>;
  candidates: ActiveWorkCandidate[];
}> {
  const policy = args.policy || (await resolvePolicy(args.prisma, args.workspaceId));
  const correlationId = args.correlationId || `active-work-recompute:${randomUUID()}`;
  const since = new Date(args.now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [rawEvents, memories, existingRows] = await Promise.all([
    args.prisma.rawEvent.findMany({
      where: {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        createdAt: { gte: since },
        eventType: { in: ['post_commit', 'post_merge', 'post_checkout'] },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 800,
      select: {
        id: true,
        createdAt: true,
        branch: true,
        commitMessage: true,
        changedFiles: true,
      },
    }),
    args.prisma.memory.findMany({
      where: {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        createdAt: { gte: since },
        type: { in: ['decision', 'goal', 'activity'] },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 400,
      select: {
        id: true,
        type: true,
        status: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
      },
    }),
    args.prisma.activeWork.findMany({
      where: {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
      },
      select: {
        id: true,
        title: true,
        confidence: true,
        status: true,
        stale: true,
        staleReason: true,
        lastEvidenceAt: true,
        lastUpdatedAt: true,
        closedAt: true,
        evidenceIds: true,
      },
    }),
  ]);

  const candidates = inferActiveWorkCandidates({
    now: args.now,
    rawEvents,
    memories,
    maxItems: 10,
  });

  const existingByTitle = new Map(
    existingRows.map((row) => [normalizeText(row.title), row] as const)
  );

  let created = 0;
  let updated = 0;
  let staleMarked = 0;
  let staleCleared = 0;
  let closed = 0;

  for (const candidate of candidates) {
    const key = normalizeText(candidate.title);
    const existing = existingByTitle.get(key);
    if (existing) {
      const nextStatus = existing.status === 'confirmed' ? 'confirmed' : 'inferred';
      const evidenceChanged = !sameEvidence(existing.evidenceIds, candidate.evidence_ids);
      const confidenceChanged = Math.abs(Number(existing.confidence) - candidate.confidence) >= 0.01;
      const staleWasCleared = existing.stale;

      await args.prisma.activeWork.update({
        where: { id: existing.id },
        data: {
          confidence: candidate.confidence,
          evidenceIds: candidate.evidence_ids,
          status: nextStatus,
          stale: false,
          staleReason: null,
          lastEvidenceAt: candidate.last_evidence_at,
          closedAt: null,
          lastUpdatedAt: args.now,
        },
      });

      if (staleWasCleared) {
        staleCleared += 1;
        await recordActiveWorkEvent(args.prisma, {
          workspaceId: args.workspaceId,
          projectId: args.projectId,
          activeWorkId: existing.id,
          eventType: 'stale_cleared',
          correlationId,
          details: {
            source: 'auto_recompute',
            reason: 'New evidence detected.',
            candidate_score: candidate.score,
          },
        });
      }

      if (confidenceChanged || evidenceChanged || nextStatus !== existing.status) {
        updated += 1;
        await recordActiveWorkEvent(args.prisma, {
          workspaceId: args.workspaceId,
          projectId: args.projectId,
          activeWorkId: existing.id,
          eventType: 'updated',
          correlationId,
          details: {
            source: 'auto_recompute',
            previous: {
              confidence: Number(existing.confidence),
              status: existing.status,
              stale: existing.stale,
            },
            next: {
              confidence: candidate.confidence,
              status: nextStatus,
              stale: false,
            },
            score_breakdown: candidate.breakdown,
            evidence_ids: candidate.evidence_ids,
          },
        });
      }

      continue;
    }

    const createdRow = await args.prisma.activeWork.create({
      data: {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        title: candidate.title,
        confidence: candidate.confidence,
        evidenceIds: candidate.evidence_ids,
        status: 'inferred',
        stale: false,
        staleReason: null,
        lastEvidenceAt: candidate.last_evidence_at,
        lastUpdatedAt: args.now,
      },
      select: { id: true },
    });
    created += 1;
    await recordActiveWorkEvent(args.prisma, {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      activeWorkId: createdRow.id,
      eventType: 'created',
      correlationId,
      details: {
        source: 'auto_recompute',
        title: candidate.title,
        confidence: candidate.confidence,
        score_breakdown: candidate.breakdown,
        evidence_ids: candidate.evidence_ids,
      },
    });
  }

  const currentRows = await args.prisma.activeWork.findMany({
    where: {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      status: { in: ['inferred', 'confirmed'] },
    },
    select: {
      id: true,
      title: true,
      confidence: true,
      status: true,
      stale: true,
      staleReason: true,
      lastEvidenceAt: true,
      lastUpdatedAt: true,
      closedAt: true,
      evidenceIds: true,
    },
  });

  for (const row of currentRows) {
    const evidenceAt = row.lastEvidenceAt || row.lastUpdatedAt;
    const ageDays = daysBetween(evidenceAt, args.now);
    const shouldClose =
      policy.autoCloseEnabled &&
      row.status === 'inferred' &&
      ageDays >= policy.autoCloseDays;

    if (shouldClose) {
      await args.prisma.activeWork.update({
        where: { id: row.id },
        data: {
          status: 'closed',
          stale: true,
          staleReason: `No evidence for ${policy.autoCloseDays}+ days.`,
          closedAt: args.now,
          lastUpdatedAt: args.now,
        },
      });
      closed += 1;
      await recordActiveWorkEvent(args.prisma, {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        activeWorkId: row.id,
        eventType: 'closed',
        correlationId,
        details: {
          source: 'auto_recompute',
          reason: 'auto_close',
          age_days: Number(ageDays.toFixed(3)),
          auto_close_days: policy.autoCloseDays,
        },
      });
      continue;
    }

    const shouldStale = ageDays >= policy.staleDays;
    if (shouldStale && !row.stale) {
      await args.prisma.activeWork.update({
        where: { id: row.id },
        data: {
          stale: true,
          staleReason: `No evidence for ${policy.staleDays}+ days.`,
          lastUpdatedAt: args.now,
        },
      });
      staleMarked += 1;
      await recordActiveWorkEvent(args.prisma, {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        activeWorkId: row.id,
        eventType: 'stale_marked',
        correlationId,
        details: {
          source: 'auto_recompute',
          age_days: Number(ageDays.toFixed(3)),
          stale_days: policy.staleDays,
        },
      });
      continue;
    }

    if (!shouldStale && row.stale) {
      await args.prisma.activeWork.update({
        where: { id: row.id },
        data: {
          stale: false,
          staleReason: null,
          lastUpdatedAt: args.now,
        },
      });
      staleCleared += 1;
      await recordActiveWorkEvent(args.prisma, {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        activeWorkId: row.id,
        eventType: 'stale_cleared',
        correlationId,
        details: {
          source: 'auto_recompute',
          age_days: Number(ageDays.toFixed(3)),
          stale_days: policy.staleDays,
        },
      });
    }
  }

  const rows = await args.prisma.activeWork.findMany({
    where: {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
    },
    orderBy: [{ status: 'asc' }, { confidence: 'desc' }, { lastUpdatedAt: 'desc' }],
    take: 20,
    select: {
      id: true,
      title: true,
      confidence: true,
      status: true,
      stale: true,
      staleReason: true,
      lastEvidenceAt: true,
      lastUpdatedAt: true,
      closedAt: true,
      evidenceIds: true,
    },
  });

  return {
    created,
    updated,
    staleMarked,
    staleCleared,
    closed,
    rows,
    candidates,
  };
}

export async function recomputeActiveWorkNightly(args: {
  prisma: PrismaClient;
  now: Date;
}): Promise<{
  workspaces_processed: number;
  projects_processed: number;
  changed_projects: number;
}> {
  const workspaces = await args.prisma.workspace.findMany({
    select: { id: true },
  });

  let projectsProcessed = 0;
  let changedProjects = 0;

  for (const workspace of workspaces) {
    const settings = await args.prisma.workspaceSettings.findUnique({
      where: { workspaceId: workspace.id },
      select: {
        enableActivityAutoLog: true,
        activeWorkStaleDays: true,
        activeWorkAutoCloseEnabled: true,
        activeWorkAutoCloseDays: true,
      },
    });
    if (settings?.enableActivityAutoLog === false) {
      continue;
    }

    const projects = await args.prisma.project.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true },
      take: 1000,
    });

    for (const project of projects) {
      projectsProcessed += 1;
      const result = await recomputeActiveWorkForProject({
        prisma: args.prisma,
        workspaceId: workspace.id,
        projectId: project.id,
        now: args.now,
        policy: {
          staleDays: clampInt(settings?.activeWorkStaleDays ?? 14, 14, 1, 3650),
          autoCloseEnabled: settings?.activeWorkAutoCloseEnabled === true,
          autoCloseDays: clampInt(settings?.activeWorkAutoCloseDays ?? 45, 45, 1, 3650),
        },
      });
      if (
        result.created > 0 ||
        result.updated > 0 ||
        result.staleMarked > 0 ||
        result.staleCleared > 0 ||
        result.closed > 0
      ) {
        changedProjects += 1;
      }
    }
  }

  return {
    workspaces_processed: workspaces.length,
    projects_processed: projectsProcessed,
    changed_projects: changedProjects,
  };
}

export async function recordActiveWorkEvent(
  prisma: PrismaClient,
  args: {
    workspaceId: string;
    projectId: string;
    activeWorkId: string;
    eventType: 'created' | 'updated' | 'stale_marked' | 'stale_cleared' | 'confirmed' | 'closed' | 'reopened';
    details?: Record<string, unknown>;
    correlationId?: string;
  }
) {
  await prisma.activeWorkEvent.create({
    data: {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      activeWorkId: args.activeWorkId,
      eventType: args.eventType,
      details: (args.details || {}) as Prisma.InputJsonValue,
      correlationId: args.correlationId || null,
    },
  });
}

function resolvePolicy(prisma: PrismaClient, workspaceId: string): Promise<ActiveWorkPolicy> {
  return prisma.workspaceSettings
    .findUnique({
      where: { workspaceId },
      select: {
        activeWorkStaleDays: true,
        activeWorkAutoCloseEnabled: true,
        activeWorkAutoCloseDays: true,
      },
    })
    .then((settings) => ({
      staleDays: clampInt(settings?.activeWorkStaleDays ?? 14, 14, 1, 3650),
      autoCloseEnabled: settings?.activeWorkAutoCloseEnabled === true,
      autoCloseDays: clampInt(settings?.activeWorkAutoCloseDays ?? 45, 45, 1, 3650),
    }));
}

function sameEvidence(left: unknown, right: string[]): boolean {
  const leftArray = toStringArray(left).slice().sort();
  const rightArray = right.slice().sort();
  if (leftArray.length !== rightArray.length) {
    return false;
  }
  for (let i = 0; i < leftArray.length; i += 1) {
    if (leftArray[i] !== rightArray[i]) {
      return false;
    }
  }
  return true;
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const out: string[] = [];
  for (const value of input) {
    const normalized = String(value || '').trim();
    if (normalized) {
      out.push(normalized);
    }
  }
  return out;
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function clampInt(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}
