import path from 'node:path';
import { access, readFile, stat } from 'node:fs/promises';

const DEFAULT_TTL_MS = 5000;

type WorkspaceDiscovery = {
  globs: string[];
};

type WorkspaceCacheEntry = {
  expiresAt: number;
  value: WorkspaceDiscovery;
};

const workspaceCache = new Map<string, WorkspaceCacheEntry>();

export type MonorepoDetectionSettings = {
  monorepoDetectionLevel: number;
  monorepoWorkspaceGlobs: string[];
  monorepoExcludeGlobs: string[];
  monorepoRootMarkers: string[];
  monorepoMaxDepth: number;
};

export async function detectSubproject(
  repoRoot: string,
  cwd: string,
  settings: MonorepoDetectionSettings
): Promise<string | null> {
  const normalizedRepoRoot = path.resolve(repoRoot);
  const normalizedCwd = path.resolve(cwd);
  const relativePath = normalizeRelativePath(path.relative(normalizedRepoRoot, normalizedCwd));
  const level = clampLevel(settings.monorepoDetectionLevel);
  const maxDepth = clampPositiveInt(settings.monorepoMaxDepth, 3);

  if (level === 0 || !relativePath) {
    return null;
  }
  if (depthOf(relativePath) > maxDepth) {
    return null;
  }
  if (matchesAnyGlob(relativePath, settings.monorepoExcludeGlobs)) {
    return null;
  }

  if (level >= 2) {
    const discovered = await discoverWorkspaceGlobs(normalizedRepoRoot, settings.monorepoRootMarkers);
    const byWorkspaces = await findCandidateFromGlobs(
      normalizedRepoRoot,
      relativePath,
      discovered.globs,
      settings.monorepoExcludeGlobs,
      maxDepth
    );
    if (byWorkspaces) {
      return byWorkspaces;
    }
  }

  if (level >= 1) {
    const byDefaultGlobs = await findCandidateFromGlobs(
      normalizedRepoRoot,
      relativePath,
      settings.monorepoWorkspaceGlobs,
      settings.monorepoExcludeGlobs,
      maxDepth
    );
    if (byDefaultGlobs) {
      return byDefaultGlobs;
    }
  }

  if (level >= 3) {
    const fallback = await findNearestPackageSubpath(
      normalizedRepoRoot,
      normalizedCwd,
      settings.monorepoExcludeGlobs,
      maxDepth
    );
    if (fallback) {
      return fallback;
    }
  }

  return null;
}

async function findCandidateFromGlobs(
  repoRoot: string,
  relativePath: string,
  globs: string[],
  excludeGlobs: string[],
  maxDepth: number
): Promise<string | null> {
  for (const globPattern of globs) {
    const normalizedGlob = normalizeGlob(globPattern);
    if (!normalizedGlob || normalizedGlob.startsWith('!')) {
      continue;
    }
    const candidate = deriveCandidateFromGlob(relativePath, normalizedGlob);
    if (!candidate) {
      continue;
    }
    if (depthOf(candidate) > maxDepth) {
      continue;
    }
    if (matchesAnyGlob(candidate, excludeGlobs)) {
      continue;
    }
    if (!(await isDirectory(path.join(repoRoot, candidate)))) {
      continue;
    }
    return candidate;
  }
  return null;
}

function deriveCandidateFromGlob(relativePath: string, globPattern: string): string | null {
  const relativeSegments = relativePath.split('/');
  let matchedDepth: number | null = null;

  for (let depth = 1; depth <= relativeSegments.length; depth += 1) {
    const prefix = relativeSegments.slice(0, depth).join('/');
    if (globMatch(prefix, globPattern)) {
      matchedDepth = depth;
      break;
    }
  }

  if (!matchedDepth) {
    return null;
  }

  const candidateDepth = Math.min(Math.max(matchedDepth, 2), relativeSegments.length);
  return relativeSegments.slice(0, candidateDepth).join('/');
}

async function discoverWorkspaceGlobs(
  repoRoot: string,
  rootMarkers: string[]
): Promise<WorkspaceDiscovery> {
  const markerSignature = [...new Set(rootMarkers.map((marker) => marker.trim()).filter(Boolean))]
    .sort()
    .join('|');
  const cacheKey = `${repoRoot}::${markerSignature}`;
  const now = Date.now();
  const cached = workspaceCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const [markerDetected, pnpmGlobs, packageJsonGlobs] = await Promise.all([
    hasAnyMarker(repoRoot, rootMarkers),
    readPnpmWorkspaceGlobs(repoRoot),
    readPackageJsonWorkspaceGlobs(repoRoot),
  ]);

  const globs = [
    ...pnpmGlobs,
    ...packageJsonGlobs,
  ];
  const deduped = [...new Set(globs.map(normalizeGlob).filter(Boolean) as string[])];
  const value: WorkspaceDiscovery = {
    globs: markerDetected || deduped.length > 0 ? deduped : [],
  };
  workspaceCache.set(cacheKey, {
    value,
    expiresAt: now + DEFAULT_TTL_MS,
  });
  return value;
}

async function hasAnyMarker(repoRoot: string, markers: string[]): Promise<boolean> {
  const effectiveMarkers = markers
    .map((marker) => marker.trim())
    .filter(Boolean);
  if (effectiveMarkers.length === 0) {
    return false;
  }

  for (const marker of effectiveMarkers) {
    try {
      await access(path.join(repoRoot, marker));
      return true;
    } catch {
      // continue
    }
  }
  return false;
}

async function readPnpmWorkspaceGlobs(repoRoot: string): Promise<string[]> {
  const filePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split(/\r?\n/g);
  const globs: string[] = [];
  let inPackages = false;
  let packagesIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inPackages) {
      const match = line.match(/^(\s*)packages\s*:\s*$/);
      if (match) {
        inPackages = true;
        packagesIndent = match[1].length;
      }
      continue;
    }

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const indent = line.match(/^(\s*)/)?.[1].length || 0;
    if (indent <= packagesIndent && !trimmed.startsWith('-')) {
      break;
    }
    const itemMatch = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
    if (itemMatch) {
      globs.push(itemMatch[1]);
    }
  }

  return globs;
}

async function readPackageJsonWorkspaceGlobs(repoRoot: string): Promise<string[]> {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  let content: string;
  try {
    content = await readFile(packageJsonPath, 'utf8');
  } catch {
    return [];
  }

  try {
    const parsed = JSON.parse(content) as {
      workspaces?: string[] | { packages?: string[] };
    };
    const workspaces = parsed.workspaces;
    if (Array.isArray(workspaces)) {
      return workspaces;
    }
    if (workspaces && Array.isArray(workspaces.packages)) {
      return workspaces.packages;
    }
  } catch {
    return [];
  }

  return [];
}

async function findNearestPackageSubpath(
  repoRoot: string,
  cwd: string,
  excludeGlobs: string[],
  maxDepth: number
): Promise<string | null> {
  const repoRootResolved = path.resolve(repoRoot);
  let current = path.resolve(cwd);
  while (current.startsWith(repoRootResolved)) {
    if (current === repoRootResolved) {
      return null;
    }
    const subpath = normalizeRelativePath(path.relative(repoRootResolved, current));
    if (subpath && depthOf(subpath) <= maxDepth && !matchesAnyGlob(subpath, excludeGlobs)) {
      try {
        await access(path.join(current, 'package.json'));
        return subpath;
      } catch {
        // continue upward
      }
    }
    const next = path.dirname(current);
    if (next === current) {
      return null;
    }
    current = next;
  }
  return null;
}

function normalizeGlob(glob: string): string | null {
  const normalized = glob
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')
    .trim();
  if (!normalized) {
    return null;
  }
  return normalized;
}

function normalizeRelativePath(value: string): string | null {
  const normalized = normalizeGlob(value);
  if (!normalized || normalized === '.') {
    return null;
  }
  if (normalized.startsWith('../') || normalized === '..' || path.isAbsolute(normalized)) {
    return null;
  }
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }
  return segments.join('/');
}

function depthOf(relativePath: string): number {
  return relativePath.split('/').filter(Boolean).length;
}

function matchesAnyGlob(relativePath: string, globs: string[]): boolean {
  const normalizedPath = normalizeRelativePath(relativePath);
  if (!normalizedPath) {
    return false;
  }
  return globs.some((globPattern) => {
    const normalizedGlob = normalizeGlob(globPattern);
    if (!normalizedGlob || normalizedGlob.startsWith('!')) {
      return false;
    }
    if (globMatch(normalizedPath, normalizedGlob)) {
      return true;
    }
    if (normalizedGlob.endsWith('/**')) {
      const plainPrefix = normalizedGlob.slice(0, -3).replace(/\/+$/, '');
      return normalizedPath === plainPrefix || normalizedPath.startsWith(`${plainPrefix}/`);
    }
    return false;
  });
}

function globMatch(candidate: string, pattern: string): boolean {
  const candidateNormalized = normalizeRelativePath(candidate);
  const patternNormalized = normalizeGlob(pattern);
  if (!candidateNormalized || !patternNormalized) {
    return false;
  }
  const tokenized = patternNormalized
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  const regex = new RegExp(`^${tokenized}$`, 'i');
  return regex.test(candidateNormalized);
}

function clampLevel(value: number): number {
  if (!Number.isInteger(value)) {
    return 2;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 3) {
    return 3;
  }
  return value;
}

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
