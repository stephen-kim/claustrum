import type { Knex } from 'knex';
import { normalizeProjectKey } from './project-key.js';

interface ContextItem {
  projectKey: string;
  type: 'active_work' | 'constraint' | 'problem' | 'goal' | 'decision' | 'note' | 'caveat';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
  relevance?: number;
  staleness?: 'fresh' | 'recent' | 'stale' | 'expired';
}

export interface RecallSynthesis {
  summary: string;
  criticalPath: string[];
  activeWork: ContextItem[];
  constraints: ContextItem[];
  problems: ContextItem[];
  goals: ContextItem[];
  decisions: ContextItem[];
  notes: ContextItem[];
  caveats: ContextItem[];
  relationships: Map<string, string[]>;
  gaps: string[];
  suggestions: string[];
  freshness: {
    fresh: number;
    recent: number;
    stale: number;
    expired: number;
  };
  projectKeys: string[];
}

type MemoryRow = {
  project_key: string;
  type: ContextItem['type'];
  content: string;
  metadata: Record<string, any> | null;
  status: string | null;
  created_at: Date;
};

export class RecallEngine {
  private readonly db: Knex;
  private readonly defaultProjectKey?: string;

  constructor(db: Knex, projectKey?: string) {
    this.db = db;
    this.defaultProjectKey = projectKey ? normalizeProjectKey(projectKey) : undefined;
  }

  async recall(options?: {
    query?: string;
    limit?: number;
    projectKey?: string;
    allProjects?: boolean;
  }): Promise<RecallSynthesis> {
    const limit = options?.limit ?? 10;
    const query = options?.query;
    const projectKey = options?.projectKey
      ? normalizeProjectKey(options.projectKey)
      : this.defaultProjectKey;
    const allProjects = options?.allProjects === true;

    const context = await this.gatherContext(limit, query, projectKey, allProjects);
    this.analyzeFreshness(context);
    this.rankByRelevance(context, query);

    const relationships = this.buildRelationships(context);
    const gaps = this.detectGaps(context);
    const summary = this.generateSummary(context);
    const criticalPath = this.extractCriticalPath(context);
    const suggestions = this.generateSuggestions(context, gaps);
    const freshness = this.calculateFreshness(context);
    const projectKeys = Array.from(new Set(context.map((item) => item.projectKey)));

    return {
      summary,
      criticalPath,
      activeWork: context.filter((c) => c.type === 'active_work'),
      constraints: context.filter((c) => c.type === 'constraint'),
      problems: context.filter((c) => c.type === 'problem'),
      goals: context.filter((c) => c.type === 'goal'),
      decisions: context.filter((c) => c.type === 'decision'),
      notes: context.filter((c) => c.type === 'note'),
      caveats: context.filter((c) => c.type === 'caveat'),
      relationships,
      gaps,
      suggestions,
      freshness,
      projectKeys,
    };
  }

  private async gatherContext(
    limit: number,
    query: string | undefined,
    projectKey: string | undefined,
    allProjects: boolean
  ): Promise<ContextItem[]> {
    const rows: MemoryRow[] = [];

    rows.push(
      ...(await this.selectByType('active_work', limit, query, projectKey, allProjects, (qb) =>
        qb.where('status', 'active')
      ))
    );
    rows.push(
      ...(await this.selectByType('constraint', limit, query, projectKey, allProjects))
    );
    rows.push(
      ...(await this.selectByType('problem', limit, query, projectKey, allProjects, (qb) =>
        qb.whereIn('status', ['open', 'investigating'])
      ))
    );
    rows.push(
      ...(await this.selectByType('goal', limit, query, projectKey, allProjects, (qb) =>
        qb.whereIn('status', ['planned', 'in-progress', 'blocked'])
      ))
    );
    rows.push(
      ...(await this.selectByType('decision', limit, query, projectKey, allProjects))
    );
    rows.push(
      ...(await this.selectByType('note', limit, query, projectKey, allProjects))
    );
    rows.push(
      ...(await this.selectByType('caveat', limit, query, projectKey, allProjects, (qb) =>
        qb.where('status', 'open')
      ))
    );

    return rows.map((row) => ({
      projectKey: row.project_key,
      type: row.type,
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
      metadata: row.metadata || {},
    }));
  }

  private async selectByType(
    type: ContextItem['type'],
    limit: number,
    query: string | undefined,
    projectKey: string | undefined,
    allProjects: boolean,
    extraFilter?: (qb: Knex.QueryBuilder) => void
  ): Promise<MemoryRow[]> {
    const qb = this.db<MemoryRow>('memory_entries')
      .select('project_key', 'type', 'content', 'metadata', 'status', 'created_at')
      .where({ type })
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (!allProjects && projectKey) {
      qb.andWhere({ project_key: projectKey });
    }

    if (query && query.trim()) {
      qb.andWhereRaw('content ILIKE ?', [`%${escapeForLike(query.trim())}%`]);
    }

    if (extraFilter) {
      extraFilter(qb);
    }

    return (await qb) as MemoryRow[];
  }

  private analyzeFreshness(context: ContextItem[]): void {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    for (const item of context) {
      const age = now - item.timestamp;
      if (age < 4 * hour) {
        item.staleness = 'fresh';
      } else if (age < 2 * day) {
        item.staleness = 'recent';
      } else if (age < 7 * day) {
        item.staleness = 'stale';
      } else {
        item.staleness = 'expired';
      }
    }
  }

  private rankByRelevance(context: ContextItem[], query?: string): void {
    const queryLower = query?.toLowerCase();
    for (const item of context) {
      let score = 0;
      const dayAge = (Date.now() - item.timestamp) / (24 * 60 * 60 * 1000);
      score += Math.max(0, 10 - dayAge);
      const typePriority: Record<ContextItem['type'], number> = {
        active_work: 10,
        caveat: 9,
        problem: 8,
        goal: 7,
        constraint: 6,
        decision: 5,
        note: 3,
      };
      score += typePriority[item.type];
      if (queryLower && item.content.toLowerCase().includes(queryLower)) {
        score += 15;
      }
      item.relevance = score;
    }

    context.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  }

  private buildRelationships(context: ContextItem[]): Map<string, string[]> {
    const relationships = new Map<string, string[]>();
    for (const item of context) {
      if (item.type === 'decision' || item.type === 'active_work') {
        const files = Array.isArray(item.metadata?.files) ? item.metadata.files : [];
        if (files.length > 0) {
          relationships.set(item.content, files);
        }
      }
    }
    return relationships;
  }

  private detectGaps(context: ContextItem[]): string[] {
    const gaps: string[] = [];
    if (!context.some((c) => c.type === 'active_work')) {
      gaps.push('No active work tracked.');
    }
    if (!context.some((c) => c.type === 'goal')) {
      gaps.push('No goals tracked.');
    }
    if (context.some((c) => c.type === 'problem') && !context.some((c) => c.type === 'constraint')) {
      gaps.push('Problems exist but no constraints are documented.');
    }
    const expired = context.filter((c) => c.staleness === 'expired').length;
    if (context.length > 0 && expired > context.length / 2) {
      gaps.push('Most context is older than a week.');
    }
    return gaps;
  }

  private generateSummary(context: ContextItem[]): string {
    if (context.length === 0) {
      return 'No context stored yet. Use `remember` to capture current work.';
    }
    const active = context.filter((c) => c.type === 'active_work').slice(0, 2);
    const problems = context.filter((c) => c.type === 'problem').slice(0, 1);
    const goals = context.filter((c) => c.type === 'goal').slice(0, 1);
    const decisions = context.filter((c) => c.type === 'decision').slice(0, 2);

    let summary = '';
    if (active.length > 0) {
      summary += `Current work: ${active.map((w) => `"${w.content}"`).join(', ')}. `;
    }
    if (problems.length > 0) {
      summary += `Open problem: "${problems[0].content}". `;
    }
    if (goals.length > 0) {
      summary += `Top goal: "${goals[0].content}". `;
    }
    if (decisions.length > 0) {
      summary += `Recent decisions: ${decisions.map((d) => `"${d.content}"`).join('; ')}.`;
    }
    return summary.trim();
  }

  private extractCriticalPath(context: ContextItem[]): string[] {
    const steps: string[] = [];
    const active = context.find((c) => c.type === 'active_work');
    const problem = context.find((c) => c.type === 'problem');
    const goal = context.find((c) => c.type === 'goal');
    if (active) {
      steps.push(`Continue: ${active.content}`);
    }
    if (problem) {
      steps.push(`Fix: ${problem.content}`);
    }
    if (goal) {
      steps.push(`Target: ${goal.content}`);
    }
    return steps.slice(0, 3);
  }

  private generateSuggestions(context: ContextItem[], gaps: string[]): string[] {
    const suggestions: string[] = [];
    const active = context.find((c) => c.type === 'active_work');
    const problem = context.find((c) => c.type === 'problem');
    if (active) {
      suggestions.push(`Continue active work: ${active.content}`);
    }
    if (problem) {
      suggestions.push(`Resolve blocker: ${problem.content}`);
    }
    if (gaps.length > 0) {
      suggestions.push('Use `remember` to fill missing context.');
    }
    return suggestions;
  }

  private calculateFreshness(context: ContextItem[]): RecallSynthesis['freshness'] {
    return {
      fresh: context.filter((c) => c.staleness === 'fresh').length,
      recent: context.filter((c) => c.staleness === 'recent').length,
      stale: context.filter((c) => c.staleness === 'stale').length,
      expired: context.filter((c) => c.staleness === 'expired').length,
    };
  }
}

function escapeForLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
