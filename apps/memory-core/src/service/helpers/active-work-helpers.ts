import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import { assertProjectAccess } from '../access-control.js';
import {
  recordActiveWorkEvent,
  recomputeActiveWorkForProject,
  recomputeActiveWorkNightly,
  type ActiveWorkPolicy,
} from './active-work-recompute.js';
import { inferActiveWorkCandidates, type ActiveWorkCandidate } from './active-work-inference.js';

type ActiveWorkEventType =
  | 'created'
  | 'updated'
  | 'stale_marked'
  | 'stale_cleared'
  | 'confirmed'
  | 'closed'
  | 'reopened';

export { inferActiveWorkCandidates, recomputeActiveWorkForProject, recomputeActiveWorkNightly };
export type { ActiveWorkCandidate, ActiveWorkPolicy };

export type ActiveWorkApiItem = {
  id: string;
  title: string;
  confidence: number;
  status: 'inferred' | 'confirmed' | 'closed';
  stale: boolean;
  stale_reason?: string | null;
  last_evidence_at?: string | null;
  last_updated_at: string;
  closed_at?: string | null;
  evidence_ids: string[];
};

export async function recomputeActiveWorkHandler(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspace: { id: string; key: string };
  project: { id: string; key: string; name: string };
  source: 'manual' | 'nightly';
  recordAudit?: (args: {
    workspaceId: string;
    projectId?: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
    correlationId?: string;
  }) => Promise<void>;
}): Promise<{
  workspace_key: string;
  project_key: string;
  created: number;
  updated: number;
  stale_marked: number;
  stale_cleared: number;
  closed: number;
  active_work: ActiveWorkApiItem[];
}> {
  await assertProjectAccess(args.prisma, args.auth, args.workspace.id, args.project.id, 'WRITER');
  const now = new Date();
  const correlationId = `active-work-recompute:${randomUUID()}`;

  const result = await recomputeActiveWorkForProject({
    prisma: args.prisma,
    workspaceId: args.workspace.id,
    projectId: args.project.id,
    now,
    correlationId,
  });

  if (args.recordAudit) {
    await args.recordAudit({
      workspaceId: args.workspace.id,
      projectId: args.project.id,
      workspaceKey: args.workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'active_work.recomputed',
      correlationId,
      target: {
        workspace_key: args.workspace.key,
        project_key: args.project.key,
        source: args.source,
        created: result.created,
        updated: result.updated,
        stale_marked: result.staleMarked,
        stale_cleared: result.staleCleared,
        closed: result.closed,
      },
    });
  }

  return {
    workspace_key: args.workspace.key,
    project_key: args.project.key,
    created: result.created,
    updated: result.updated,
    stale_marked: result.staleMarked,
    stale_cleared: result.staleCleared,
    closed: result.closed,
    active_work: result.rows.map(toActiveWorkApiItem),
  };
}

export async function listActiveWorkHandler(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspace: { id: string; key: string };
  project: { id: string; key: string; name: string };
  includeClosed?: boolean;
  limit?: number;
}): Promise<{
  workspace_key: string;
  project_key: string;
  active_work: ActiveWorkApiItem[];
}> {
  await assertProjectAccess(args.prisma, args.auth, args.workspace.id, args.project.id, 'READER');
  const limit = Math.min(Math.max(args.limit || 50, 1), 200);
  const rows = await args.prisma.activeWork.findMany({
    where: {
      workspaceId: args.workspace.id,
      projectId: args.project.id,
      ...(args.includeClosed ? {} : { status: { in: ['inferred', 'confirmed'] } }),
    },
    orderBy: [{ confidence: 'desc' }, { lastUpdatedAt: 'desc' }],
    take: limit,
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
    workspace_key: args.workspace.key,
    project_key: args.project.key,
    active_work: rows.map(toActiveWorkApiItem),
  };
}

export async function listActiveWorkEventsHandler(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspace: { id: string; key: string };
  project: { id: string; key: string; name: string };
  activeWorkId?: string;
  limit?: number;
}): Promise<{
  workspace_key: string;
  project_key: string;
  events: Array<{
    id: string;
    active_work_id: string;
    event_type: ActiveWorkEventType;
    details: Record<string, unknown>;
    correlation_id?: string | null;
    created_at: string;
  }>;
}> {
  await assertProjectAccess(args.prisma, args.auth, args.workspace.id, args.project.id, 'READER');
  const limit = Math.min(Math.max(args.limit || 100, 1), 500);
  const rows = await args.prisma.activeWorkEvent.findMany({
    where: {
      workspaceId: args.workspace.id,
      projectId: args.project.id,
      ...(args.activeWorkId ? { activeWorkId: args.activeWorkId } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      activeWorkId: true,
      eventType: true,
      details: true,
      correlationId: true,
      createdAt: true,
    },
  });

  return {
    workspace_key: args.workspace.key,
    project_key: args.project.key,
    events: rows.map((row) => ({
      id: row.id,
      active_work_id: row.activeWorkId,
      event_type: row.eventType,
      details: asRecord(row.details) || {},
      correlation_id: row.correlationId || null,
      created_at: row.createdAt.toISOString(),
    })),
  };
}

export async function updateActiveWorkStatusHandler(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspace: { id: string; key: string };
  project: { id: string; key: string; name: string };
  activeWorkId: string;
  action: 'confirm' | 'close' | 'reopen';
  recordAudit?: (args: {
    workspaceId: string;
    projectId?: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
    correlationId?: string;
  }) => Promise<void>;
}): Promise<{
  workspace_key: string;
  project_key: string;
  active_work: ActiveWorkApiItem;
}> {
  await assertProjectAccess(args.prisma, args.auth, args.workspace.id, args.project.id, 'MAINTAINER');
  const existing = await args.prisma.activeWork.findUnique({
    where: { id: args.activeWorkId },
    select: {
      id: true,
      workspaceId: true,
      projectId: true,
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
  if (!existing || existing.workspaceId !== args.workspace.id || existing.projectId !== args.project.id) {
    throw new Error('Active work item not found for this project.');
  }

  const now = new Date();
  const correlationId = `active-work-manual:${randomUUID()}`;
  const previousStatus = existing.status;
  const nextData =
    args.action === 'confirm'
      ? { status: 'confirmed' as const, stale: false, staleReason: null, closedAt: null, lastUpdatedAt: now }
      : args.action === 'close'
        ? {
            status: 'closed' as const,
            stale: true,
            staleReason: existing.staleReason || 'Manually closed by maintainer.',
            closedAt: now,
            lastUpdatedAt: now,
          }
        : { status: 'inferred' as const, stale: false, staleReason: null, closedAt: null, lastUpdatedAt: now };

  const updated = await args.prisma.activeWork.update({
    where: { id: existing.id },
    data: nextData,
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

  const eventType: ActiveWorkEventType =
    args.action === 'confirm' ? 'confirmed' : args.action === 'close' ? 'closed' : 'reopened';
  await recordActiveWorkEvent(args.prisma, {
    workspaceId: args.workspace.id,
    projectId: args.project.id,
    activeWorkId: existing.id,
    eventType,
    correlationId,
    details: {
      source: 'manual',
      previous_status: previousStatus,
      next_status: updated.status,
      stale: updated.stale,
      stale_reason: updated.staleReason,
    },
  });

  if (args.recordAudit) {
    const action =
      args.action === 'confirm'
        ? 'active_work.manual_confirm'
        : args.action === 'close'
          ? 'active_work.manual_close'
          : 'active_work.manual_reopen';
    await args.recordAudit({
      workspaceId: args.workspace.id,
      projectId: args.project.id,
      workspaceKey: args.workspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action,
      correlationId,
      target: {
        workspace_key: args.workspace.key,
        project_key: args.project.key,
        active_work_id: existing.id,
        title: existing.title,
        previous_status: previousStatus,
        next_status: updated.status,
      },
    });
  }

  return {
    workspace_key: args.workspace.key,
    project_key: args.project.key,
    active_work: toActiveWorkApiItem(updated),
  };
}

function toActiveWorkApiItem(row: {
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
}): ActiveWorkApiItem {
  return {
    id: row.id,
    title: row.title,
    confidence: Number(row.confidence.toFixed(3)),
    status: row.status,
    stale: row.stale,
    stale_reason: row.staleReason,
    last_evidence_at: row.lastEvidenceAt?.toISOString() || null,
    last_updated_at: row.lastUpdatedAt.toISOString(),
    closed_at: row.closedAt?.toISOString() || null,
    evidence_ids: toStringArray(row.evidenceIds),
  };
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

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}
