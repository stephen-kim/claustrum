import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export type EvalExpected = {
  must_include_types?: string[];
  should_include_types?: string[];
  must_not_include_types?: string[];
  must_include_keywords?: string[];
  should_include_keywords?: string[];
  must_include_fields?: string[];
};

export type EvalQuestion = {
  id: string;
  category?: string;
  q?: string;
  persona?: 'neutral' | 'author' | 'reviewer' | 'architect';
  workspace_key?: string;
  project_key?: string;
  current_subpath?: string;
  budget?: number;
  expected?: EvalExpected;
};

export type EvalConfig = {
  version?: number;
  defaults?: {
    workspace_key?: string;
    project_key?: string;
    budget?: number;
  };
  questions: EvalQuestion[];
};

export type BundleCallResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
  error?: string;
};

export type BundleJsonlEntry = {
  id: string;
  category?: string;
  q?: string;
  persona?: string;
  workspace_key: string;
  project_key: string;
  current_subpath?: string;
  budget: number;
  request: {
    base_url: string;
    mode: 'default' | 'debug';
    status: number;
    ok: boolean;
    error?: string;
  };
  token_estimate: number;
  bundle: Record<string, unknown>;
  debug_bundle?: Record<string, unknown>;
  created_at: string;
};

export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') {
      continue;
    }
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

export function defaultQuestionsPath(cwd: string): string {
  const yamlPath = path.join(cwd, 'eval', 'questions.yaml');
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`Questions file not found: ${yamlPath}`);
  }
  return yamlPath;
}

export function loadQuestionsConfig(filePath: string): EvalConfig {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = yaml.load(raw);
  if (Array.isArray(parsed)) {
    return { version: 1, questions: parsed as EvalQuestion[] };
  }
  const config = (parsed || {}) as EvalConfig;
  if (!Array.isArray(config.questions)) {
    throw new Error('Invalid questions file: `questions` array is required.');
  }
  return config;
}

export function sanitizeId(value: string): string {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128);
}

export function runTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function uniqueLower(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

export function estimateKeywordMatches(haystackLower: string, keywords: string[]): { matched: string[]; missing: string[] } {
  const normalized = uniqueLower(keywords);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const keyword of normalized) {
    if (haystackLower.includes(keyword)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }
  return { matched, missing };
}

export function flattenJsonForSearch(value: unknown): string {
  return JSON.stringify(value || {}).toLowerCase();
}

export function collectBundleTypes(bundle: Record<string, unknown>): string[] {
  const seen: string[] = [];
  const retrieval = (((bundle.retrieval as Record<string, unknown>) || {}).results || []) as Array<
    Record<string, unknown>
  >;
  for (const item of retrieval) {
    const type = String(item.type || '').trim().toLowerCase();
    if (type) {
      seen.push(type);
    }
  }

  const snapshot = (bundle.snapshot || {}) as Record<string, unknown>;
  if (Array.isArray(snapshot.top_decisions) && snapshot.top_decisions.length > 0) {
    seen.push('decision');
  }
  if (Array.isArray(snapshot.top_constraints) && snapshot.top_constraints.length > 0) {
    seen.push('constraint');
  }
  if (Array.isArray(snapshot.active_work) && snapshot.active_work.length > 0) {
    seen.push('active_work');
  }
  if (Array.isArray(snapshot.recent_activity) && snapshot.recent_activity.length > 0) {
    seen.push('activity');
  }

  return uniqueLower(seen);
}

export function hasField(bundle: Record<string, unknown>, field: string): boolean {
  const key = String(field || '').trim().toLowerCase();
  if (!key) {
    return true;
  }
  if (key === 'global') {
    return Boolean(bundle.global && typeof bundle.global === 'object');
  }
  if (key === 'active_work') {
    const snapshot = (bundle.snapshot || {}) as Record<string, unknown>;
    return Array.isArray(snapshot.active_work);
  }
  return Object.prototype.hasOwnProperty.call(bundle, field);
}

function shouldMaskKey(key: string): boolean {
  return /(api[_-]?key|token|secret|password|authorization)/i.test(key);
}

function maskString(value: string): string {
  if (value.length <= 8) {
    return '***';
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export function maskSensitive(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => maskSensitive(item));
  }
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string' && /(bearer\s+[A-Za-z0-9._-]+)/i.test(input)) {
      return input.replace(/(bearer\s+)([A-Za-z0-9._-]+)/gi, (_, prefix, token) => `${prefix}${maskString(token)}`);
    }
    return input;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (shouldMaskKey(key)) {
      if (typeof value === 'string') {
        out[key] = maskString(value);
      } else if (value == null) {
        out[key] = value;
      } else {
        out[key] = '***';
      }
      continue;
    }
    out[key] = maskSensitive(value);
  }
  return out;
}

export async function callContextBundle(args: {
  baseUrl: string;
  apiKey?: string;
  workspaceKey: string;
  projectKey: string;
  q?: string;
  persona?: string;
  currentSubpath?: string;
  budget?: number;
  mode: 'default' | 'debug';
}): Promise<BundleCallResult> {
  const params = new URLSearchParams({
    workspace_key: args.workspaceKey,
    project_key: args.projectKey,
    mode: args.mode,
  });
  if (args.q) {
    params.set('q', args.q);
  }
  if (args.persona) {
    params.set('persona', args.persona);
  }
  if (args.currentSubpath) {
    params.set('current_subpath', args.currentSubpath);
  }
  if (args.budget && args.budget > 0) {
    params.set('budget', String(args.budget));
  }

  const headers: Record<string, string> = {};
  if (args.apiKey) {
    headers.authorization = `Bearer ${args.apiKey}`;
  }

  try {
    const response = await fetch(`${args.baseUrl.replace(/\/$/, '')}/v1/context/bundle?${params.toString()}`, {
      method: 'GET',
      headers,
    });
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      body = { raw: text };
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function readJsonlFile<T = Record<string, unknown>>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`jsonl file not found: ${filePath}`);
  }
  const lines = fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => JSON.parse(line) as T);
}

export function writeJsonlFile(filePath: string, rows: Array<Record<string, unknown>>): void {
  const content = rows.map((row) => JSON.stringify(row)).join('\n');
  fs.writeFileSync(filePath, `${content}\n`, 'utf8');
}

export function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, numerator / denominator));
}

export function scoreComponent(value: number, maxScore: number): number {
  return Math.round(value * maxScore * 100) / 100;
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function shortText(input: string, maxLen: number): string {
  const value = String(input || '').replace(/\s+/g, ' ').trim();
  if (value.length <= maxLen) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLen - 1))}…`;
}
