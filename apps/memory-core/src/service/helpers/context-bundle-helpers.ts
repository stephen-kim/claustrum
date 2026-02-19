import { type PrismaClient } from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import { assertProjectAccess } from '../access-control.js';
import { getEffectiveWorkspaceSettings } from '../workspace-resolution.js';
import { buildGlobalRulesBundle } from './global-rules-helpers.js';
import { inferActiveWorkCandidates } from './active-work-helpers.js';
import {
  applyPersonaWeightsToRetrievalRows,
  asIso,
  asOptionalNumber,
  asOptionalString,
  asString,
  buildAppliedTypeSummary,
  buildRoutingHint,
  extractDecisionSummary,
  extractSubpathFromMetadata,
  normalizeSubpath,
  recommendContextPersona,
  resolveContextPersona,
  resolvePersonaWeights,
  snippetFromMemory,
  toRecord,
  toStringArray,
  trimSnippet,
  type PersonaRecommendation,
} from './context-bundle-utils.js';
export { applyPersonaWeightsToRetrievalRows, recommendContextPersona, type PersonaRecommendation } from './context-bundle-utils.js';
type ContextBundleDeps = {
  prisma: PrismaClient;
  getWorkspaceByKey: (workspaceKey: string) => Promise<{ id: string; key: string; name: string }>;
  getProjectByKeys: (
    workspaceKey: string,
    projectKey: string
  ) => Promise<{ id: string; key: string; name: string; workspaceId: string }>;
  listMemories: (args: {
    auth: AuthContext;
    query: {
      workspace_key: string;
      project_key: string;
      type?: string;
      q?: string;
      mode?: 'hybrid' | 'keyword' | 'semantic';
      status?: 'draft' | 'confirmed' | 'rejected';
      limit?: number;
      since?: string;
      current_subpath?: string;
      debug?: boolean;
    };
  }) => Promise<Array<Record<string, unknown>>>;
};
type BundleResult = {
  project: { key: string; name: string };
  global: {
    workspace_rules: Array<{
      id: string;
      title: string;
      content: string;
      category: string;
      priority: number;
      severity: string;
      pinned: boolean;
      selected_reason: string;
      score?: number;
    }>;
    user_rules: Array<{
      id: string;
      title: string;
      content: string;
      category: string;
      priority: number;
      severity: string;
      pinned: boolean;
      selected_reason: string;
      score?: number;
    }>;
    workspace_summary?: string;
    user_summary?: string;
    routing: {
      mode: 'semantic' | 'keyword' | 'hybrid';
      q_used?: string;
      selected_rule_ids: string[];
      dropped_rule_ids: string[];
      score_breakdown?: Array<Record<string, unknown>>;
    };
    warnings: Array<{ level: 'info' | 'warn'; message: string }>;
  };
  snapshot: {
    summary: string;
    top_decisions: Array<{
      id: string;
      summary: string;
      status: string;
      created_at: string;
      evidence_ref?: Record<string, unknown>;
    }>;
    top_constraints: Array<{
      id: string;
      snippet: string;
      created_at: string;
      evidence_ref?: Record<string, unknown>;
    }>;
    active_work: Array<{
      id: string;
      title: string;
      confidence: number;
      status: string;
      stale: boolean;
      stale_reason?: string | null;
      last_evidence_at?: string | null;
      closed_at?: string | null;
      last_updated_at: string;
      evidence_ids: string[];
    }>;
    recent_activity: Array<{
      id: string;
      title: string;
      created_at: string;
      subpath?: string;
    }>;
  };
  retrieval: {
    query?: string;
    results: Array<{
      id: string;
      type: string;
      snippet: string;
      score_breakdown?: Record<string, unknown>;
      persona_weight?: number;
      evidence_ref?: Record<string, unknown>;
    }>;
  };
  debug?: {
    resolved_workspace: string;
    resolved_project: string;
    monorepo_mode: string;
    current_subpath?: string;
    boosts_applied: {
      type_weights: Record<string, number>;
      recency_half_life_days: number;
      subpath_boost_weight: number;
      subpath_boost_enabled: boolean;
    };
    persona_applied: 'neutral' | 'author' | 'reviewer' | 'architect';
    persona_recommended: PersonaRecommendation;
    weight_adjustments: {
      persona_weights: Record<string, number>;
      applied_to_types: Record<string, number>;
    };
    token_budget: {
      total: number;
      allocations: {
        workspace_global: number;
        user_global: number;
        project_snapshot: number;
        retrieval: number;
      };
      retrieval_limit: number;
      per_item_chars: number;
    };
    global_rules: Record<string, unknown>;
    active_work_candidates: ActiveWorkCandidateDebug[];
    active_work_policy: {
      stale_days: number;
      auto_close_enabled: boolean;
      auto_close_days: number;
      confirmed_auto_close_exempt: boolean;
    };
    decision_extractor_recent: Array<{
      raw_event_id: string;
      created_at: string;
      result?: string;
      confidence?: number;
      memory_id?: string;
      error?: string;
    }>;
  };
};

type ActiveWorkCandidateDebug = {
  key: string;
  title: string;
  confidence: number;
  score: number;
  evidence_ids: string[];
  breakdown: Record<string, number>;
};
export async function getContextBundleHandler(
  deps: ContextBundleDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    projectKey: string;
    q?: string;
    currentSubpath?: string;
    mode?: 'default' | 'debug';
    budget?: number;
  }
): Promise<BundleResult> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  const project = await deps.getProjectByKeys(args.workspaceKey, args.projectKey);
  await assertProjectAccess(deps.prisma, args.auth, workspace.id, project.id, 'READER');

  const settings = await getEffectiveWorkspaceSettings(deps.prisma, workspace.id);
  const mode = args.mode === 'debug' ? 'debug' : 'default';
  const budget = Math.min(
    Math.max(Math.floor(args.budget || settings.bundleTokenBudgetTotal || 3000), 300),
    50000
  );
  const perItemChars = 280;
  const retrievalBudget = Math.max(
    200,
    Math.floor(budget * (settings.bundleBudgetRetrievalPct || 0.3))
  );
  const workspaceGlobalBudget = Math.max(
    100,
    Math.floor(budget * (settings.bundleBudgetGlobalWorkspacePct || 0.15))
  );
  const userGlobalBudget = Math.max(
    80,
    Math.floor(budget * (settings.bundleBudgetGlobalUserPct || 0.1))
  );
  const projectSnapshotBudget = Math.max(
    180,
    Math.floor(budget * (settings.bundleBudgetProjectPct || 0.45))
  );
  const retrievalLimit = Math.min(Math.max(Math.floor(retrievalBudget / 220), 5), 40);

  const [summaryRows, decisionRows, constraintRows, activityRows, personaSetting, activeWorkRows] = await Promise.all([
    deps.listMemories({
      auth: args.auth,
      query: {
        workspace_key: workspace.key,
        project_key: project.key,
        type: 'summary',
        status: 'confirmed',
        limit: 3,
      },
    }),
    deps.listMemories({
      auth: args.auth,
      query: {
        workspace_key: workspace.key,
        project_key: project.key,
        type: 'decision',
        status: 'confirmed',
        limit: 6,
      },
    }),
    deps.listMemories({
      auth: args.auth,
      query: {
        workspace_key: workspace.key,
        project_key: project.key,
        type: 'constraint',
        limit: 6,
      },
    }),
    deps.listMemories({
      auth: args.auth,
      query: {
        workspace_key: workspace.key,
        project_key: project.key,
        type: 'activity',
        limit: 10,
      },
    }),
    deps.prisma.userSetting.findUnique({
      where: { userId: args.auth.user.id },
      select: { contextPersona: true },
    }),
    deps.prisma.activeWork.findMany({
      where: {
        workspaceId: workspace.id,
        projectId: project.id,
        status: { in: ['inferred', 'confirmed'] },
      },
      orderBy: [{ confidence: 'desc' }, { lastUpdatedAt: 'desc' }],
      take: mode === 'debug' ? 12 : 8,
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

  const personaApplied = resolveContextPersona(personaSetting?.contextPersona);
  const personaWeights = resolvePersonaWeights(settings.personaWeights, personaApplied);
  const query = String(args.q || '').trim();
  const routingContextHint = buildRoutingHint({
    summaryRows,
    activeWorkRows: activeWorkRows.map((row) => ({
      id: row.id,
      content: row.title,
      createdAt: row.lastUpdatedAt,
    })),
    activityRows,
    currentSubpath: args.currentSubpath,
    projectName: project.name,
    projectKey: project.key,
  });
  const personaRecommended = recommendContextPersona({
    query: query || undefined,
    contextHint: query.length > 0 ? undefined : routingContextHint,
    allowContextFallback: true,
  });
  const visibleActiveWork = activeWorkRows
    .filter((row) => row.status !== 'closed')
    .filter((row) => mode === 'debug' || row.confidence >= 0.35)
    .slice(0, 5);

  let retrievalRows: Array<Record<string, unknown>> = [];
  if (query.length > 0) {
    retrievalRows = await deps.listMemories({
      auth: args.auth,
      query: {
        workspace_key: workspace.key,
        project_key: project.key,
        q: query,
        mode: settings.searchDefaultMode,
        limit: retrievalLimit,
        current_subpath: args.currentSubpath,
        debug: mode === 'debug',
      },
    });
  }
  const rankedRetrievalRows = applyPersonaWeightsToRetrievalRows({
    rows: retrievalRows,
    personaWeights,
    includeDebug: mode === 'debug',
  });

  const globalBundle = await buildGlobalRulesBundle({
    prisma: deps.prisma,
    auth: args.auth,
    workspace,
    settings,
    totalBudget: budget,
    queryText: query || undefined,
    contextHintText: query ? undefined : routingContextHint,
    includeRoutingDebug: mode === 'debug',
  });

  const summaryText =
    summaryRows
      .map((row) => snippetFromMemory(row, 400))
      .filter(Boolean)
      .join('\n\n') || `Project ${project.name} (${project.key})`;

  const result: BundleResult = {
    project: { key: project.key, name: project.name },
    global: {
      workspace_rules: globalBundle.workspace_rules.map((rule) => ({
        id: rule.id,
        title: rule.title,
        content: trimSnippet(rule.content, 400),
        category: rule.category,
        priority: rule.priority,
        severity: rule.severity,
        pinned: rule.pinned,
        selected_reason: rule.selected_reason,
        score: rule.score,
      })),
      user_rules: globalBundle.user_rules.map((rule) => ({
        id: rule.id,
        title: rule.title,
        content: trimSnippet(rule.content, 300),
        category: rule.category,
        priority: rule.priority,
        severity: rule.severity,
        pinned: rule.pinned,
        selected_reason: rule.selected_reason,
        score: rule.score,
      })),
      workspace_summary: globalBundle.workspace_summary,
      user_summary: globalBundle.user_summary,
      routing: globalBundle.routing,
      warnings: globalBundle.warnings,
    },
    snapshot: {
      summary: summaryText,
      top_decisions: decisionRows.slice(0, 5).map((row) => ({
        id: asString(row.id),
        summary: extractDecisionSummary(asString(row.content)),
        status: asString(row.status || 'draft'),
        created_at: asIso(row.createdAt),
        evidence_ref: toRecord(row.evidence),
      })),
      top_constraints: constraintRows.slice(0, 5).map((row) => ({
        id: asString(row.id),
        snippet: snippetFromMemory(row, perItemChars),
        created_at: asIso(row.createdAt),
        evidence_ref: toRecord(row.evidence),
      })),
      active_work: visibleActiveWork.map((row) => ({
        id: row.id,
        title: trimSnippet(row.title, 200),
        confidence: Number(row.confidence.toFixed(3)),
        status: row.status,
        stale: row.stale,
        stale_reason: row.staleReason,
        last_evidence_at: row.lastEvidenceAt?.toISOString() || null,
        closed_at: row.closedAt?.toISOString() || null,
        last_updated_at: row.lastUpdatedAt.toISOString(),
        evidence_ids: toStringArray(row.evidenceIds),
      })),
      recent_activity: activityRows.slice(0, 8).map((row) => ({
        id: asString(row.id),
        title: snippetFromMemory(row, 160),
        created_at: asIso(row.createdAt),
        subpath: extractSubpathFromMetadata(row.metadata),
      })),
    },
    retrieval: {
      query: query || undefined,
      results: rankedRetrievalRows.map((row) => ({
        id: asString(row.id),
        type: asString(row.type),
        snippet: snippetFromMemory(row, perItemChars),
        score_breakdown:
          mode === 'debug'
            ? {
                ...(toRecord(row.score_breakdown) || {}),
                ...(toRecord(row.persona_adjustment) || {}),
              }
            : undefined,
        persona_weight: mode === 'debug' ? asOptionalNumber(toRecord(row.persona_adjustment)?.persona_weight) : undefined,
        evidence_ref: toRecord(row.evidence),
      })),
    },
  };

  if (mode === 'debug') {
    const [recentExtraction, activeWorkCandidates] = await Promise.all([
      listRecentDecisionExtraction(deps.prisma, workspace.id, project.id),
      listActiveWorkCandidatesForDebug(deps.prisma, workspace.id, project.id),
    ]);
    result.debug = {
      resolved_workspace: workspace.key,
      resolved_project: project.key,
      monorepo_mode: settings.monorepoContextMode,
      current_subpath: normalizeSubpath(args.currentSubpath) || undefined,
      boosts_applied: {
        type_weights: settings.searchTypeWeights,
        recency_half_life_days: settings.searchRecencyHalfLifeDays,
        subpath_boost_weight: settings.searchSubpathBoostWeight,
        subpath_boost_enabled:
          settings.monorepoContextMode === 'shared_repo' && settings.monorepoSubpathBoostEnabled,
      },
      persona_applied: personaApplied,
      persona_recommended: personaRecommended,
      weight_adjustments: {
        persona_weights: personaWeights,
        applied_to_types: buildAppliedTypeSummary(rankedRetrievalRows),
      },
      token_budget: {
        total: budget,
        allocations: {
          workspace_global: workspaceGlobalBudget,
          user_global: userGlobalBudget,
          project_snapshot: projectSnapshotBudget,
          retrieval: retrievalBudget,
        },
        retrieval_limit: retrievalLimit,
        per_item_chars: perItemChars,
      },
      global_rules: globalBundle.debug,
      active_work_candidates: activeWorkCandidates,
      active_work_policy: {
        stale_days: settings.activeWorkStaleDays,
        auto_close_enabled: settings.activeWorkAutoCloseEnabled,
        auto_close_days: settings.activeWorkAutoCloseDays,
        confirmed_auto_close_exempt: true,
      },
      decision_extractor_recent: recentExtraction,
    };
  }

  return result;
}

async function listRecentDecisionExtraction(
  prisma: PrismaClient,
  workspaceId: string,
  projectId: string
): Promise<
  Array<{
    raw_event_id: string;
    created_at: string;
    result?: string;
    confidence?: number;
    memory_id?: string;
    error?: string;
  }>
> {
  const rows = await prisma.rawEvent.findMany({
    where: {
      workspaceId,
      projectId,
      eventType: {
        in: ['post_commit', 'post_merge'],
      },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 20,
    select: {
      id: true,
      createdAt: true,
      metadata: true,
    },
  });

  return rows
    .map((row) => {
      const metadata = toRecord(row.metadata);
      if (!metadata) {
        return null;
      }
      return {
        raw_event_id: row.id,
        created_at: row.createdAt.toISOString(),
        result: asOptionalString(metadata.decision_extraction_result),
        confidence: asOptionalNumber(metadata.decision_extraction_confidence),
        memory_id: asOptionalString(metadata.decision_extraction_memory_id),
        error: asOptionalString(metadata.decision_extraction_last_error),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 10);
}

async function listActiveWorkCandidatesForDebug(
  prisma: PrismaClient,
  workspaceId: string,
  projectId: string
): Promise<ActiveWorkCandidateDebug[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [rawEvents, memories] = await Promise.all([
    prisma.rawEvent.findMany({
      where: {
        workspaceId,
        projectId,
        createdAt: { gte: since },
        eventType: { in: ['post_commit', 'post_merge', 'post_checkout'] },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
      select: {
        id: true,
        createdAt: true,
        branch: true,
        commitMessage: true,
        changedFiles: true,
      },
    }),
    prisma.memory.findMany({
      where: {
        workspaceId,
        projectId,
        createdAt: { gte: since },
        type: { in: ['decision', 'goal', 'activity'] },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
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
  ]);

  const candidates = inferActiveWorkCandidates({
    now: new Date(),
    rawEvents,
    memories,
    maxItems: 8,
  });

  return candidates.map((candidate) => ({
    key: candidate.key,
    title: candidate.title,
    confidence: candidate.confidence,
    score: candidate.score,
    evidence_ids: candidate.evidence_ids,
    breakdown: candidate.breakdown,
  }));
}
