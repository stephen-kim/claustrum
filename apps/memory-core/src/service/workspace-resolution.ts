import path from 'node:path';
import {
  AutoExtractionMode,
  MonorepoMode,
  ResolutionKind,
  SearchDefaultMode,
  type PrismaClient,
} from '@prisma/client';
import {
  defaultAutoConfirmAllowedEventTypes,
  defaultAutoConfirmKeywordAllowlist,
  defaultAutoConfirmKeywordDenylist,
  defaultCheckoutDailyLimit,
  defaultCheckoutDebounceSeconds,
  defaultMonorepoExcludeGlobs,
  defaultMonorepoRootMarkers,
  defaultMonorepoWorkspaceGlobs,
  monorepoModeSchema,
  resolutionOrderSchema,
  type ResolveProjectInput,
} from '@claustrum/shared';

export const DEFAULT_RESOLUTION_ORDER: ResolutionKind[] = [
  ResolutionKind.github_remote,
  ResolutionKind.repo_root_slug,
  ResolutionKind.manual,
];

const DEFAULT_GITHUB_PREFIX = 'github:';
const DEFAULT_LOCAL_PREFIX = 'local:';
const DEFAULT_MONOREPO_MODE = MonorepoMode.repo_hash_subpath;
const DEFAULT_MONOREPO_DETECTION_LEVEL = 2;
const DEFAULT_MONOREPO_MAX_DEPTH = 3;
const DEFAULT_MONOREPO_ROOT_MARKERS = [...defaultMonorepoRootMarkers];
const DEFAULT_MONOREPO_GLOBS = [...defaultMonorepoWorkspaceGlobs];
const DEFAULT_MONOREPO_EXCLUDE_GLOBS = [...defaultMonorepoExcludeGlobs];
const DEFAULT_AUTO_EXTRACT_MODE = AutoExtractionMode.draft_only;
const DEFAULT_SEARCH_MODE = SearchDefaultMode.hybrid;

export type EffectiveWorkspaceSettings = {
  resolutionOrder: ResolutionKind[];
  autoCreateProject: boolean;
  autoCreateProjectSubprojects: boolean;
  autoSwitchRepo: boolean;
  autoSwitchSubproject: boolean;
  allowManualPin: boolean;
  enableGitEvents: boolean;
  enableCommitEvents: boolean;
  enableMergeEvents: boolean;
  enableCheckoutEvents: boolean;
  checkoutDebounceSeconds: number;
  checkoutDailyLimit: number;
  enableAutoExtraction: boolean;
  autoExtractionMode: AutoExtractionMode;
  autoConfirmMinConfidence: number;
  autoConfirmAllowedEventTypes: string[];
  autoConfirmKeywordAllowlist: string[];
  autoConfirmKeywordDenylist: string[];
  autoExtractionBatchSize: number;
  searchDefaultMode: SearchDefaultMode;
  searchHybridAlpha: number;
  searchHybridBeta: number;
  searchDefaultLimit: number;
  githubKeyPrefix: string;
  localKeyPrefix: string;
  enableMonorepoResolution: boolean;
  monorepoDetectionLevel: number;
  monorepoMode: MonorepoMode;
  monorepoRootMarkers: string[];
  monorepoWorkspaceGlobs: string[];
  monorepoExcludeGlobs: string[];
  monorepoMaxDepth: number;
};

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

function parseStringArray(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) {
    return fallback;
  }
  const values = input
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0);
  return values.length > 0 ? values : fallback;
}

function parsePositiveInt(input: unknown, fallback: number): number {
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

function parseNonNegativeInt(input: unknown, fallback: number): number {
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

function parseDetectionLevel(input: unknown, fallback: number): number {
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

export async function getEffectiveWorkspaceSettings(
  prisma: PrismaClient,
  workspaceId: string
): Promise<EffectiveWorkspaceSettings> {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId },
  });
  if (!settings) {
    return {
      resolutionOrder: DEFAULT_RESOLUTION_ORDER,
      autoCreateProject: true,
      autoSwitchRepo: true,
      autoSwitchSubproject: false,
      allowManualPin: true,
      enableGitEvents: true,
      enableCommitEvents: true,
      enableMergeEvents: true,
      enableCheckoutEvents: false,
      checkoutDebounceSeconds: defaultCheckoutDebounceSeconds,
      checkoutDailyLimit: defaultCheckoutDailyLimit,
      enableAutoExtraction: true,
      autoExtractionMode: DEFAULT_AUTO_EXTRACT_MODE,
      autoConfirmMinConfidence: 0.85,
      autoConfirmAllowedEventTypes: [...defaultAutoConfirmAllowedEventTypes],
      autoConfirmKeywordAllowlist: [...defaultAutoConfirmKeywordAllowlist],
      autoConfirmKeywordDenylist: [...defaultAutoConfirmKeywordDenylist],
      autoExtractionBatchSize: 20,
      searchDefaultMode: DEFAULT_SEARCH_MODE,
      searchHybridAlpha: 0.6,
      searchHybridBeta: 0.4,
      searchDefaultLimit: 20,
      githubKeyPrefix: DEFAULT_GITHUB_PREFIX,
      localKeyPrefix: DEFAULT_LOCAL_PREFIX,
      autoCreateProjectSubprojects: true,
      enableMonorepoResolution: false,
      monorepoDetectionLevel: DEFAULT_MONOREPO_DETECTION_LEVEL,
      monorepoMode: DEFAULT_MONOREPO_MODE,
      monorepoRootMarkers: DEFAULT_MONOREPO_ROOT_MARKERS,
      monorepoWorkspaceGlobs: DEFAULT_MONOREPO_GLOBS,
      monorepoExcludeGlobs: DEFAULT_MONOREPO_EXCLUDE_GLOBS,
      monorepoMaxDepth: DEFAULT_MONOREPO_MAX_DEPTH,
    };
  }
  return {
    resolutionOrder: parseResolutionOrder(settings.resolutionOrder),
    autoCreateProject: settings.autoCreateProject,
    autoCreateProjectSubprojects: settings.autoCreateProjectSubprojects,
    autoSwitchRepo: settings.autoSwitchRepo,
    autoSwitchSubproject: settings.autoSwitchSubproject,
    allowManualPin: settings.allowManualPin,
    enableGitEvents: settings.enableGitEvents,
    enableCommitEvents: settings.enableCommitEvents,
    enableMergeEvents: settings.enableMergeEvents,
    enableCheckoutEvents: settings.enableCheckoutEvents,
    checkoutDebounceSeconds: parseNonNegativeInt(
      settings.checkoutDebounceSeconds,
      defaultCheckoutDebounceSeconds
    ),
    checkoutDailyLimit: parsePositiveInt(settings.checkoutDailyLimit, defaultCheckoutDailyLimit),
    enableAutoExtraction: settings.enableAutoExtraction,
    autoExtractionMode: settings.autoExtractionMode || DEFAULT_AUTO_EXTRACT_MODE,
    autoConfirmMinConfidence: Math.min(
      Math.max(Number(settings.autoConfirmMinConfidence ?? 0.85), 0),
      1
    ),
    autoConfirmAllowedEventTypes: parseStringArray(
      settings.autoConfirmAllowedEventTypes,
      [...defaultAutoConfirmAllowedEventTypes]
    ),
    autoConfirmKeywordAllowlist: parseStringArray(
      settings.autoConfirmKeywordAllowlist,
      [...defaultAutoConfirmKeywordAllowlist]
    ),
    autoConfirmKeywordDenylist: parseStringArray(
      settings.autoConfirmKeywordDenylist,
      [...defaultAutoConfirmKeywordDenylist]
    ),
    autoExtractionBatchSize: parsePositiveInt(settings.autoExtractionBatchSize, 20),
    searchDefaultMode: settings.searchDefaultMode || DEFAULT_SEARCH_MODE,
    searchHybridAlpha: Math.min(Math.max(Number(settings.searchHybridAlpha ?? 0.6), 0), 1),
    searchHybridBeta: Math.min(Math.max(Number(settings.searchHybridBeta ?? 0.4), 0), 1),
    searchDefaultLimit: parsePositiveInt(settings.searchDefaultLimit, 20),
    githubKeyPrefix: settings.githubKeyPrefix || DEFAULT_GITHUB_PREFIX,
    localKeyPrefix: settings.localKeyPrefix || DEFAULT_LOCAL_PREFIX,
    enableMonorepoResolution: settings.enableMonorepoResolution,
    monorepoDetectionLevel: parseDetectionLevel(
      settings.monorepoDetectionLevel,
      DEFAULT_MONOREPO_DETECTION_LEVEL
    ),
    monorepoMode: parseMonorepoMode(settings.monorepoMode),
    monorepoRootMarkers: parseStringArray(
      settings.monorepoRootMarkers,
      DEFAULT_MONOREPO_ROOT_MARKERS
    ),
    monorepoWorkspaceGlobs: parseStringArray(
      settings.monorepoWorkspaceGlobs,
      DEFAULT_MONOREPO_GLOBS
    ),
    monorepoExcludeGlobs: parseStringArray(
      settings.monorepoExcludeGlobs,
      DEFAULT_MONOREPO_EXCLUDE_GLOBS
    ),
    monorepoMaxDepth: parsePositiveInt(settings.monorepoMaxDepth, DEFAULT_MONOREPO_MAX_DEPTH),
  };
}

export function normalizeGithubSelector(
  input: ResolveProjectInput
): { normalized: string; withHost?: string } | null {
  const github = input.github_remote;
  if (!github) {
    return null;
  }
  const normalized = (github.normalized || '').trim();
  if (normalized) {
    const host = (github.host || '').trim().toLowerCase();
    return host ? { normalized, withHost: `${host}/${normalized}` } : { normalized };
  }
  const owner = (github.owner || '').trim();
  const repo = (github.repo || '').trim();
  if (!owner || !repo) {
    return null;
  }
  const parsed = `${owner}/${repo}`;
  const host = (github.host || '').trim().toLowerCase();
  return host ? { normalized: parsed, withHost: `${host}/${parsed}` } : { normalized: parsed };
}

function toPosixPath(input: string): string {
  return input.replace(/\\/g, '/');
}

function normalizePath(input: string): string {
  return toPosixPath(input).replace(/\/{2,}/g, '/').trim();
}

function normalizeRelativePath(input: string): string | null {
  const raw = normalizePath(input)
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (!raw || raw === '.') {
    return null;
  }
  const segments = raw.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }
  return segments.join('/');
}

function normalizeGlobPattern(glob: string): string | null {
  const normalized = normalizeRelativePath(glob);
  if (!normalized) {
    return null;
  }
  return normalized;
}

function toSegmentRegex(patternSegment: string): RegExp {
  const escaped = patternSegment.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+');
  return new RegExp(`^${escaped}$`, 'i');
}

function deriveSubpathFromRelativePath(relativePath: string, globs: string[]): string | null {
  const normalizedRelative = normalizeRelativePath(relativePath);
  if (!normalizedRelative) {
    return null;
  }
  const relativeSegments = normalizedRelative.split('/');
  for (const glob of globs) {
    const normalizedGlob = normalizeGlobPattern(glob);
    if (!normalizedGlob) {
      continue;
    }
    const globSegments = normalizedGlob.split('/');
    if (relativeSegments.length < globSegments.length) {
      continue;
    }
    let matches = true;
    for (let index = 0; index < globSegments.length; index += 1) {
      if (!toSegmentRegex(globSegments[index]).test(relativeSegments[index])) {
        matches = false;
        break;
      }
    }
    if (!matches) {
      continue;
    }
    return relativeSegments.slice(0, globSegments.length).join('/');
  }
  return null;
}

function deriveRelativePathFromRepoRoot(input: ResolveProjectInput): string | null {
  const direct = normalizeRelativePath(input.relative_path || '');
  if (direct) {
    return direct;
  }
  if (!input.repo_root || !input.cwd) {
    return null;
  }
  const from = normalizePath(input.repo_root);
  const to = normalizePath(input.cwd);
  if (!from || !to) {
    return null;
  }
  const relative = toPosixPath(path.relative(from, to));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return normalizeRelativePath(relative);
}

export function resolveMonorepoSubpath(
  input: ResolveProjectInput,
  settings: Pick<
    EffectiveWorkspaceSettings,
    'monorepoWorkspaceGlobs' | 'monorepoMaxDepth' | 'monorepoMode'
  >
): string | null {
  if (settings.monorepoMode === MonorepoMode.repo_only) {
    return null;
  }

  const globs = settings.monorepoWorkspaceGlobs.length
    ? settings.monorepoWorkspaceGlobs
    : DEFAULT_MONOREPO_GLOBS;
  const maxDepth = settings.monorepoMaxDepth > 0 ? settings.monorepoMaxDepth : DEFAULT_MONOREPO_MAX_DEPTH;
  const orderedCandidates: string[] = [];

  if (input.monorepo?.candidate_subpaths) {
    orderedCandidates.push(...input.monorepo.candidate_subpaths);
  }
  const derivedRelative = deriveRelativePathFromRepoRoot(input);
  if (derivedRelative) {
    orderedCandidates.push(derivedRelative);
  }

  for (const candidate of orderedCandidates) {
    const derived = deriveSubpathFromRelativePath(candidate, globs);
    if (!derived) {
      continue;
    }
    const depth = derived.split('/').length;
    if (depth > maxDepth) {
      continue;
    }
    return derived;
  }

  return null;
}

export function composeMonorepoProjectKey(
  baseProjectKey: string,
  subpath: string | null,
  mode: MonorepoMode
): string {
  if (!subpath || mode === MonorepoMode.repo_only) {
    return baseProjectKey;
  }
  return mode === MonorepoMode.repo_colon_subpath
    ? `${baseProjectKey}:${subpath}`
    : `${baseProjectKey}#${subpath}`;
}

export function buildGithubExternalIdCandidates(
  selector: { normalized: string; withHost?: string },
  subpath?: string | null,
  options?: { includeBase?: boolean }
): string[] {
  const includeBase = options?.includeBase ?? true;
  const values = new Set<string>();
  const bases = selector.withHost
    ? [selector.normalized, selector.withHost]
    : [selector.normalized];
  for (const base of bases) {
    if (includeBase) {
      values.add(base);
    }
    if (subpath) {
      values.add(`${base}#${subpath}`);
      values.add(`${base}:${subpath}`);
    }
  }
  return [...values];
}

export function toGithubMappingExternalId(normalizedRepo: string, subpath?: string | null): string {
  if (!subpath) {
    return normalizedRepo;
  }
  return `${normalizedRepo}#${subpath}`;
}
