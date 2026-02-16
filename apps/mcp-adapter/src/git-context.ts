import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GitRemoteInfo = {
  host: string;
  owner: string;
  repo: string;
  normalized: string;
};

export type GitContext = {
  github_remote?: GitRemoteInfo;
  repo_root_slug?: string;
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

export async function detectGitContext(cwd: string): Promise<GitContext> {
  const [remoteUrl, repoRoot] = await Promise.all([
    safeGitExec(cwd, ['remote', 'get-url', 'origin']),
    safeGitExec(cwd, ['rev-parse', '--show-toplevel']),
  ]);

  const context: GitContext = {};

  if (remoteUrl) {
    const parsedRemote = parseGitRemoteUrl(remoteUrl);
    if (parsedRemote) {
      context.github_remote = parsedRemote;
    }
  }

  if (repoRoot) {
    const base = path.basename(repoRoot.trim());
    if (base) {
      context.repo_root_slug = slugifyRepoRootName(base);
    }
  }

  return context;
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
