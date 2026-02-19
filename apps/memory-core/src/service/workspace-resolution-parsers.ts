import {
  AutoExtractionMode,
  MonorepoContextMode,
  MonorepoMode,
  ResolutionKind,
  SearchDefaultMode,
} from '@prisma/client';
import {
  defaultMonorepoExcludeGlobs,
  defaultMonorepoRootMarkers,
  defaultMonorepoWorkspaceGlobs,
  defaultOutboundLocales,
  defaultPersonaWeights,
  defaultSearchTypeWeights,
  monorepoContextModeSchema,
  monorepoModeSchema,
  resolutionOrderSchema,
} from '@claustrum/shared';

export const DEFAULT_RESOLUTION_ORDER: ResolutionKind[] = [
  ResolutionKind.github_remote,
  ResolutionKind.repo_root_slug,
  ResolutionKind.manual,
];

export const DEFAULT_GITHUB_PREFIX = 'github:';
export const DEFAULT_LOCAL_PREFIX = 'local:';
export const DEFAULT_GITHUB_PERMISSION_SYNC_MODE: 'add_only' | 'add_and_remove' = 'add_only';
export const DEFAULT_GITHUB_WEBHOOK_SYNC_MODE: 'add_only' | 'add_and_remove' = 'add_only';
export const DEFAULT_GITHUB_ROLE_MAPPING: Record<
  string,
  'owner' | 'maintainer' | 'writer' | 'reader'
> = {
  admin: 'maintainer',
  maintain: 'maintainer',
  write: 'writer',
  triage: 'reader',
  read: 'reader',
};
export const DEFAULT_MONOREPO_MODE = MonorepoMode.repo_hash_subpath;
export const DEFAULT_MONOREPO_CONTEXT_MODE = MonorepoContextMode.shared_repo;
export const DEFAULT_MONOREPO_DETECTION_LEVEL = 2;
export const DEFAULT_MONOREPO_MAX_DEPTH = 3;
export const DEFAULT_MONOREPO_ROOT_MARKERS = [...defaultMonorepoRootMarkers];
export const DEFAULT_MONOREPO_GLOBS = [...defaultMonorepoWorkspaceGlobs];
export const DEFAULT_MONOREPO_EXCLUDE_GLOBS = [...defaultMonorepoExcludeGlobs];
export const DEFAULT_AUTO_EXTRACT_MODE = AutoExtractionMode.draft_only;
export const DEFAULT_SEARCH_MODE = SearchDefaultMode.hybrid;
export const DEFAULT_OUTBOUND_LOCALE = 'en';
export const DEFAULT_SUPPORTED_OUTBOUND_LOCALES = [...defaultOutboundLocales];
export const DEFAULT_RETENTION_MODE: 'archive' | 'hard_delete' = 'archive';
export const DEFAULT_SEARCH_TYPE_WEIGHTS = { ...defaultSearchTypeWeights };
export const DEFAULT_PERSONA_WEIGHTS = Object.fromEntries(
  Object.entries(defaultPersonaWeights).map(([persona, weights]) => [persona, { ...weights }])
) as Record<string, Record<string, number>>;

export function parseResolutionOrder(input: unknown): ResolutionKind[] {
  const parsed = resolutionOrderSchema.safeParse(input);
  if (!parsed.success) {
    return DEFAULT_RESOLUTION_ORDER;
  }
  return parsed.data as ResolutionKind[];
}

export function parseMonorepoMode(input: unknown): MonorepoMode {
  const parsed = monorepoModeSchema.safeParse(input);
  if (!parsed.success) {
    return DEFAULT_MONOREPO_MODE;
  }
  return parsed.data as MonorepoMode;
}

export function parseMonorepoContextMode(input: unknown): MonorepoContextMode {
  const parsed = monorepoContextModeSchema.safeParse(input);
  if (!parsed.success) {
    return DEFAULT_MONOREPO_CONTEXT_MODE;
  }
  return parsed.data as MonorepoContextMode;
}

export function parseStringArray(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) {
    return fallback;
  }
  const values = input
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0);
  return values.length > 0 ? values : fallback;
}

export function parsePositiveInt(input: unknown, fallback: number): number {
  const value =
    typeof input === 'number'
      ? input
      : typeof input === 'string' && input.trim()
        ? Number(input)
        : Number.NaN;
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

export function parseNonNegativeInt(input: unknown, fallback: number): number {
  const value =
    typeof input === 'number'
      ? input
      : typeof input === 'string' && input.trim()
        ? Number(input)
        : Number.NaN;
  if (!Number.isInteger(value) || value < 0) {
    return fallback;
  }
  return value;
}

export function clampFloat(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

export function parseDetectionLevel(input: unknown, fallback: number): number {
  const value =
    typeof input === 'number'
      ? input
      : typeof input === 'string' && input.trim()
        ? Number(input)
        : Number.NaN;
  if (!Number.isInteger(value)) {
    return fallback;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 3) {
    return 3;
  }
  return value;
}

export function parseGithubCacheTtlSeconds(input: unknown, fallback: number): number {
  const value = parsePositiveInt(input, fallback);
  if (value < 30) {
    return 30;
  }
  if (value > 86400) {
    return 86400;
  }
  return value;
}

export function parseOutboundLocale(input: unknown, fallback: string): string {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) {
    return fallback;
  }
  return DEFAULT_SUPPORTED_OUTBOUND_LOCALES.includes(value as (typeof defaultOutboundLocales)[number])
    ? value
    : fallback;
}

export function parseOutboundLocaleArray(input: unknown, fallback: string[]): string[] {
  const values = parseStringArray(input, fallback)
    .map((value) => value.trim().toLowerCase())
    .filter((value) =>
      DEFAULT_SUPPORTED_OUTBOUND_LOCALES.includes(value as (typeof defaultOutboundLocales)[number])
    );
  if (values.length === 0) {
    return fallback;
  }
  return Array.from(new Set(values));
}

export function parseGithubPermissionSyncMode(input: unknown): 'add_only' | 'add_and_remove' {
  if (input === 'add_and_remove') {
    return 'add_and_remove';
  }
  return 'add_only';
}

export function parseRetentionMode(input: unknown): 'archive' | 'hard_delete' {
  if (input === 'hard_delete') {
    return 'hard_delete';
  }
  return 'archive';
}

export function parseSecuritySeverity(input: unknown): 'low' | 'medium' | 'high' {
  if (input === 'low' || input === 'high') {
    return input;
  }
  return 'medium';
}

export function parseGlobalRulesSelectionMode(input: unknown): 'score' | 'recent' | 'priority_only' {
  if (input === 'recent' || input === 'priority_only') {
    return input;
  }
  return 'score';
}

export function parseGlobalRulesRoutingMode(input: unknown): 'semantic' | 'keyword' | 'hybrid' {
  if (input === 'semantic' || input === 'keyword') {
    return input;
  }
  return 'hybrid';
}

export function parseGithubRoleMapping(
  input: unknown
): Record<string, 'owner' | 'maintainer' | 'writer' | 'reader'> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_GITHUB_ROLE_MAPPING };
  }
  const out: Record<string, 'owner' | 'maintainer' | 'writer' | 'reader'> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = String(rawKey || '').trim().toLowerCase();
    if (!key) {
      continue;
    }
    const value = String(rawValue || '').trim().toLowerCase();
    if (value === 'owner' || value === 'maintainer' || value === 'writer' || value === 'reader') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : { ...DEFAULT_GITHUB_ROLE_MAPPING };
}

export function parseSearchTypeWeights(input: unknown): Record<string, number> {
  const base = { ...defaultSearchTypeWeights } as Record<string, number>;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return base;
  }
  const parsed: Record<string, number> = { ...base };
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const normalizedKey = String(key || '').trim().toLowerCase();
    const numeric = Number(value);
    if (!normalizedKey || !Number.isFinite(numeric) || numeric <= 0) {
      continue;
    }
    parsed[normalizedKey] = Math.min(numeric, 100);
  }
  return parsed;
}

export function parsePersonaWeights(input: unknown): Record<string, Record<string, number>> {
  const fallback = Object.fromEntries(
    Object.entries(defaultPersonaWeights).map(([persona, weights]) => [persona, { ...weights }])
  ) as Record<string, Record<string, number>>;

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fallback;
  }

  const parsed: Record<string, Record<string, number>> = {};
  for (const [personaKey, rawWeights] of Object.entries(input as Record<string, unknown>)) {
    if (!rawWeights || typeof rawWeights !== 'object' || Array.isArray(rawWeights)) {
      continue;
    }
    const persona = String(personaKey || '').trim().toLowerCase();
    if (!persona) {
      continue;
    }
    const weightMap: Record<string, number> = {};
    for (const [rawType, rawValue] of Object.entries(rawWeights as Record<string, unknown>)) {
      const type = String(rawType || '').trim().toLowerCase();
      const numeric = Number(rawValue);
      if (!type || !Number.isFinite(numeric) || numeric <= 0) {
        continue;
      }
      weightMap[type] = Math.min(numeric, 100);
    }
    parsed[persona] = {
      ...(fallback[persona] || {}),
      ...weightMap,
    };
  }

  for (const [persona, weights] of Object.entries(fallback)) {
    if (!parsed[persona]) {
      parsed[persona] = { ...weights };
    }
  }

  return parsed;
}

export function parseProjectRole(
  input: unknown,
  fallback: 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER'
): 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER' {
  if (input === 'OWNER' || input === 'MAINTAINER' || input === 'WRITER' || input === 'READER') {
    return input;
  }
  return fallback;
}
