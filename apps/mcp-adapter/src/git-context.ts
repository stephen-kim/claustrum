import path from 'node:path';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_MONOREPO_MARKERS = [
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'lerna.json',
];
const DEFAULT_MONOREPO_GLOBS = ['apps/*', 'packages/*'];
const DEFAULT_MONOREPO_MAX_DEPTH = 3;

export type DetectGitContextOptions = {
  monorepoRootMarkers?: string[];
  monorepoWorkspaceGlobs?: string[];
  monorepoMaxDepth?: number;
  enableMonorepoDetection?: boolean;
};

export type GitRemoteInfo = {
  host: string;
  owner: string;
  repo: string;
  normalized: string;
};

export type GitContext = {
  github_remote?: GitRemoteInfo;
  repo_root_slug?: string;
  repo_root?: string;
  cwd?: string;
  relative_path?: string;
  monorepo?: {
    enabled?: boolean;
    candidate_subpaths?: string[];
  };
};

export function parseGitRemoteUrl(remoteUrl: string): GitRemoteInfo | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) {
    return null;
  }

  const sshLike = trimmed.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshLike) {
    return buildRemoteInfo(sshLike[1], sshLike[2], sshLike[3]);
  }

  const sshProto = trimmed.match(/^ssh:\/\/(?:[^@]+@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshProto) {
    return buildRemoteInfo(sshProto[1], sshProto[2], sshProto[3]);
  }

  const httpLike = trimmed.match(/^(?:https?|git):\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i);
  if (httpLike) {
    return buildRemoteInfo(httpLike[1], httpLike[2], httpLike[3]);
  }

  return null;
}

export function slugifyRepoRootName(input: string): string {
  const lowered = input.trim().toLowerCase();
  if (!lowered) {
    return 'project';
  }
  const slug = lowered
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/-{2,}/g, '-');
  return slug || 'project';
}

export async function detectGitContext(
  cwd: string,
  options: DetectGitContextOptions = {}
): Promise<GitContext> {
  const absoluteCwd = path.resolve(cwd);
  const [remoteUrl, repoRoot] = await Promise.all([
    safeGitExec(absoluteCwd, ['remote', 'get-url', 'origin']),
    safeGitExec(absoluteCwd, ['rev-parse', '--show-toplevel']),
  ]);

  const context: GitContext = {
    cwd: absoluteCwd,
  };

  if (remoteUrl) {
    const parsedRemote = parseGitRemoteUrl(remoteUrl);
    if (parsedRemote) {
      context.github_remote = parsedRemote;
    }
  }

  if (repoRoot) {
    const normalizedRepoRoot = path.resolve(repoRoot.trim());
    context.repo_root = normalizedRepoRoot;

    const base = path.basename(normalizedRepoRoot);
    if (base) {
      context.repo_root_slug = slugifyRepoRootName(base);
    }

    const relativePath = deriveRelativePath(absoluteCwd, normalizedRepoRoot);
    if (relativePath) {
      context.relative_path = relativePath;
    }

    const markerCandidates =
      options.monorepoRootMarkers && options.monorepoRootMarkers.length > 0
        ? options.monorepoRootMarkers
        : DEFAULT_MONOREPO_MARKERS;
    const globCandidates =
      options.monorepoWorkspaceGlobs && options.monorepoWorkspaceGlobs.length > 0
        ? options.monorepoWorkspaceGlobs
        : DEFAULT_MONOREPO_GLOBS;
    const maxDepth =
      typeof options.monorepoMaxDepth === 'number' && options.monorepoMaxDepth > 0
        ? options.monorepoMaxDepth
        : DEFAULT_MONOREPO_MAX_DEPTH;
    const shouldDetectMonorepo = options.enableMonorepoDetection !== false;
    const hasMonorepoMarker = shouldDetectMonorepo
      ? await hasAnyMarker(normalizedRepoRoot, markerCandidates)
      : false;
    if (hasMonorepoMarker && relativePath) {
      const candidate = deriveMonorepoCandidateSubpath(
        relativePath,
        globCandidates,
        maxDepth
      );
      if (candidate) {
        context.monorepo = {
          enabled: true,
          candidate_subpaths: [candidate],
        };
      }
    }
  }

  return context;
}

export function deriveRelativePath(cwd: string, repoRoot: string): string | null {
  const relative = path.relative(repoRoot, cwd);
  if (!relative || relative === '.' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  const normalized = normalizePath(relative);
  return normalized || null;
}

export function deriveMonorepoCandidateSubpath(
  relativePath: string,
  globs: string[] = DEFAULT_MONOREPO_GLOBS,
  maxDepth = DEFAULT_MONOREPO_MAX_DEPTH
): string | null {
  const normalizedRelative = normalizePath(relativePath);
  if (!normalizedRelative) {
    return null;
  }
  const segments = normalizedRelative.split('/');
  for (const glob of globs) {
    const globSegments = normalizePath(glob)?.split('/');
    if (!globSegments || segments.length < globSegments.length) {
      continue;
    }
    let matched = true;
    for (let index = 0; index < globSegments.length; index += 1) {
      const pattern = globSegments[index];
      const candidate = segments[index];
      const escapedPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]+');
      const regex = new RegExp(`^${escapedPattern}$`, 'i');
      if (!regex.test(candidate)) {
        matched = false;
        break;
      }
    }
    if (!matched) {
      continue;
    }
    const subpath = segments.slice(0, globSegments.length).join('/');
    if (subpath.split('/').length <= maxDepth) {
      return subpath;
    }
  }
  return null;
}

async function safeGitExec(cwd: string, args: string[]): Promise<string | null> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000,
    });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

function buildRemoteInfo(hostInput: string, ownerInput: string, repoInput: string): GitRemoteInfo {
  const host = hostInput.trim().toLowerCase();
  const owner = ownerInput.trim();
  const repo = repoInput.trim().replace(/\.git$/i, '');
  return {
    host,
    owner,
    repo,
    normalized: `${owner}/${repo}`,
  };
}

async function hasAnyMarker(repoRoot: string, markers: string[]): Promise<boolean> {
  const checks = await Promise.all(
    markers.map(async (marker) => {
      try {
        await access(path.join(repoRoot, marker));
        return true;
      } catch {
        return false;
      }
    })
  );
  return checks.some(Boolean);
}

function normalizePath(input: string): string | null {
  const normalized = input
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')
    .trim();
  if (!normalized || normalized === '.') {
    return null;
  }
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }
  return segments.join('/');
}
