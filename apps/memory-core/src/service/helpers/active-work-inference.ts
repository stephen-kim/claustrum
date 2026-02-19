type RawEventForInference = {
  id: string;
  createdAt: Date;
  branch?: string | null;
  commitMessage?: string | null;
  changedFiles?: unknown;
};

type MemoryForInference = {
  id: string;
  type: string;
  status?: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: unknown;
};

type InferenceInput = {
  now: Date;
  rawEvents: RawEventForInference[];
  memories: MemoryForInference[];
  maxItems?: number;
};

export type ActiveWorkCandidate = {
  key: string;
  title: string;
  confidence: number;
  score: number;
  evidence_ids: string[];
  last_evidence_at: Date;
  breakdown: {
    recency_weight: number;
    frequency_weight: number;
    decision_status_weight: number;
    commit_keyword_weight: number;
    total: number;
  };
};

export function inferActiveWorkCandidates(input: InferenceInput): ActiveWorkCandidate[] {
  const candidateMap = new Map<
    string,
    {
      title: string;
      lastSeen: Date;
      frequency: number;
      decisionWeight: number;
      keywordWeight: number;
      evidenceIds: Set<string>;
      keywords: Set<string>;
    }
  >();

  for (const event of input.rawEvents) {
    const clusterKey = inferClusterKey(event.changedFiles) || inferKeywordTitle(event.commitMessage, event.branch);
    if (!clusterKey) {
      continue;
    }
    const key = `cluster:${clusterKey.toLowerCase()}`;
    const candidate = ensureCandidate(candidateMap, key, humanizeCluster(clusterKey), event.createdAt);
    candidate.frequency += 1;
    candidate.lastSeen = maxDate(candidate.lastSeen, event.createdAt);
    candidate.evidenceIds.add(event.id);

    for (const keyword of extractKeywords(event.commitMessage || '')) {
      candidate.keywords.add(keyword);
    }
  }

  for (const memory of input.memories) {
    const summary = summarizeText(memory.content, 120);
    if (!summary) {
      continue;
    }

    if (memory.type === 'decision' || memory.type === 'goal') {
      const key = `${memory.type}:${normalizeText(summary).slice(0, 120)}`;
      const candidate = ensureCandidate(candidateMap, key, summary, memory.updatedAt || memory.createdAt);
      candidate.lastSeen = maxDate(candidate.lastSeen, memory.updatedAt || memory.createdAt);
      candidate.decisionWeight += memory.status === 'draft' ? 2.0 : 1.0;
      candidate.evidenceIds.add(memory.id);
      for (const keyword of extractKeywords(summary)) {
        candidate.keywords.add(keyword);
      }
      continue;
    }

    if (memory.type === 'activity') {
      const metadata = asRecord(memory.metadata);
      const subpath = typeof metadata?.subpath === 'string' ? metadata.subpath : '';
      const key = subpath
        ? `activity:${subpath.toLowerCase()}`
        : `activity:${normalizeText(summary).slice(0, 80)}`;
      const candidate = ensureCandidate(
        candidateMap,
        key,
        subpath ? `Activity around ${subpath}` : summary,
        memory.updatedAt || memory.createdAt
      );
      candidate.lastSeen = maxDate(candidate.lastSeen, memory.updatedAt || memory.createdAt);
      candidate.keywordWeight += 0.2;
      candidate.evidenceIds.add(memory.id);
      for (const keyword of extractKeywords(summary)) {
        candidate.keywords.add(keyword);
      }
    }
  }

  const results: ActiveWorkCandidate[] = [];
  for (const [key, candidate] of candidateMap.entries()) {
    const ageDays = Math.max(0, (input.now.getTime() - candidate.lastSeen.getTime()) / (24 * 60 * 60 * 1000));
    const recencyWeight = Number((Math.max(0, 1 - ageDays / 14) * 2).toFixed(3));
    const frequencyWeight = Number((Math.min(candidate.frequency, 20) / 20 * 2).toFixed(3));
    const decisionStatusWeight = Number(Math.min(candidate.decisionWeight, 3.5).toFixed(3));
    const commitKeywordWeight = Number(
      (Math.min(candidate.keywords.size, 6) * 0.2 + candidate.keywordWeight).toFixed(3)
    );
    const total = Number((recencyWeight + frequencyWeight + decisionStatusWeight + commitKeywordWeight).toFixed(3));
    if (total <= 0.25) {
      continue;
    }

    const confidence = Number(clampFloat(total / 7.5, 0.15, 0.99).toFixed(3));
    results.push({
      key,
      title: candidate.title,
      confidence,
      score: total,
      evidence_ids: Array.from(candidate.evidenceIds).slice(0, 32),
      last_evidence_at: candidate.lastSeen,
      breakdown: {
        recency_weight: recencyWeight,
        frequency_weight: frequencyWeight,
        decision_status_weight: decisionStatusWeight,
        commit_keyword_weight: commitKeywordWeight,
        total,
      },
    });
  }

  const maxItems = Math.min(Math.max(input.maxItems || 5, 1), 10);
  return results
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.title.localeCompare(b.title))
    .slice(0, maxItems);
}

function ensureCandidate(
  map: Map<
    string,
    {
      title: string;
      lastSeen: Date;
      frequency: number;
      decisionWeight: number;
      keywordWeight: number;
      evidenceIds: Set<string>;
      keywords: Set<string>;
    }
  >,
  key: string,
  title: string,
  initialDate: Date
) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const next = {
    title: summarizeText(title, 140),
    lastSeen: initialDate,
    frequency: 0,
    decisionWeight: 0,
    keywordWeight: 0,
    evidenceIds: new Set<string>(),
    keywords: new Set<string>(),
  };
  map.set(key, next);
  return next;
}

function inferClusterKey(changedFiles: unknown): string | null {
  const paths = toChangedFilePaths(changedFiles);
  for (const filePath of paths) {
    const normalized = normalizePath(filePath);
    if (!normalized || isIgnoredPath(normalized)) {
      continue;
    }
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length >= 2 && ['apps', 'packages', 'services', 'libs'].includes(parts[0])) {
      return `${parts[0]}/${parts[1]}`;
    }
    return parts.slice(0, Math.min(2, parts.length)).join('/');
  }
  return null;
}

function inferKeywordTitle(commitMessage?: string | null, branch?: string | null): string | null {
  const fromMessage = summarizeText(commitMessage || '', 80);
  if (fromMessage) {
    return fromMessage;
  }
  const fromBranch = summarizeText(branch || '', 60);
  if (fromBranch) {
    return `branch:${fromBranch}`;
  }
  return null;
}

function humanizeCluster(cluster: string): string {
  const normalized = cluster.replace(/[-_]/g, ' ').replace(/\//g, ' / ').trim();
  return `Focus on ${normalized}`;
}

function toChangedFilePaths(changedFiles: unknown): string[] {
  if (!Array.isArray(changedFiles)) {
    return [];
  }

  const output: string[] = [];
  for (const entry of changedFiles) {
    if (typeof entry === 'string') {
      output.push(entry);
      continue;
    }
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const candidate = record.path || record.file || record.name;
      if (typeof candidate === 'string') {
        output.push(candidate);
      }
    }
  }
  return output;
}

function extractKeywords(input: string): string[] {
  if (!input.trim()) {
    return [];
  }
  const stopwords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'into',
    'this',
    'that',
    'these',
    'those',
    'update',
    'fix',
    'feat',
    'chore',
    'refactor',
    'merge',
    'branch',
    'main',
    'release',
    'test',
    'tests',
    'build',
    'wip',
    'tmp',
    'debug',
    'change',
    'changes',
    'file',
    'files',
    'project',
    'workspace',
    'claustrum',
  ]);

  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token))
    .slice(0, 20);
}

function summarizeText(input: string, maxChars: number): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(maxChars - 3, 1)).trimEnd()}...`;
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isIgnoredPath(pathValue: string): boolean {
  return (
    pathValue.startsWith('node_modules/') ||
    pathValue.startsWith('.git/') ||
    pathValue.startsWith('dist/') ||
    pathValue.startsWith('build/') ||
    pathValue.startsWith('.next/')
  );
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
