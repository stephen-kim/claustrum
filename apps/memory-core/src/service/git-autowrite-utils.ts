import { getConfigBoolean } from './integration-utils.js';

export function shouldAutoWriteForGitEvent(
  config: Record<string, unknown>,
  event: 'commit' | 'merge' | 'checkout'
): boolean {
  if (event === 'commit') {
    return getConfigBoolean(config, 'write_on_commit') === true;
  }
  if (event === 'merge') {
    return getConfigBoolean(config, 'write_on_merge') === true;
  }
  return false;
}

export function buildGitAutoWriteTitle(args: {
  projectKey: string;
  event: 'commit' | 'merge' | 'checkout';
  commitHash?: string;
}): string {
  const shortCommit = args.commitHash ? args.commitHash.slice(0, 7) : '';
  const suffix = shortCommit ? ` ${shortCommit}` : '';
  return `[${args.event}] ${args.projectKey}${suffix}`.slice(0, 200);
}

export function buildGitAutoWriteContent(args: {
  workspaceKey: string;
  projectKey: string;
  event: 'commit' | 'merge' | 'checkout';
  branch?: string;
  commitHash?: string;
  message?: string;
  metadata: Record<string, unknown>;
}): string {
  const lines = [
    `workspace: ${args.workspaceKey}`,
    `project: ${args.projectKey}`,
    `event: ${args.event}`,
    `branch: ${args.branch || 'unknown'}`,
    `commit: ${args.commitHash || 'n/a'}`,
    `message: ${args.message || '(empty)'}`,
    '',
    `metadata: ${JSON.stringify(args.metadata || {})}`,
    `created_at: ${new Date().toISOString()}`,
  ];
  return lines.join('\n');
}
