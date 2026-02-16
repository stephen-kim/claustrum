import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import knex from 'knex';
import { resolveDatabaseConnection } from './db-connection.js';
import { normalizeProjectKey } from './project-key.js';
import { logger } from './logger.js';

type HookEvent = 'post-commit' | 'post-merge' | 'post-checkout';

async function main(): Promise<void> {
  const rawKey = process.env.CONTEXT_SYNC_PROJECT_KEY || '';
  const rawEvent = process.env.CONTEXT_SYNC_HOOK_EVENT || '';
  if (!rawKey || !rawEvent) {
    return;
  }

  const event = normalizeEvent(rawEvent);
  if (!event) {
    return;
  }

  const projectKey = normalizeProjectKey(rawKey);

  try {
    const payload = buildPayload(event);
    if (!payload) {
      return;
    }

    const forwarded = await forwardGitEventToMemoryCore({
      projectKey,
      hookEvent: event,
      payload,
    });
    if (forwarded) {
      return;
    }

    const db = knex({
      client: 'pg',
      connection: resolveDatabaseConnection(),
      pool: { min: 0, max: 2 },
    });

    try {
      await db('projects')
        .insert({
          key: projectKey,
          name: projectKey,
          tech_stack: [],
          metadata: {},
        })
        .onConflict('key')
        .ignore();

      await db('memory_entries').insert({
        id: randomUUID(),
        project_key: projectKey,
        type: payload.type,
        content: payload.content,
        metadata: payload.metadata,
        status: payload.status || null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } finally {
      await db.destroy();
    }
  } catch (error) {
    logger.warn('Git hook event capture failed', error);
  }
}

async function forwardGitEventToMemoryCore(args: {
  projectKey: string;
  hookEvent: HookEvent;
  payload: {
    type: 'decision' | 'active_work';
    content: string;
    metadata: Record<string, unknown>;
    status?: string;
  };
}): Promise<boolean> {
  const baseUrl = (process.env.MEMORY_CORE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.MEMORY_CORE_API_KEY || '').trim();
  const workspaceKey = (process.env.MEMORY_CORE_WORKSPACE_KEY || '').trim();
  if (!baseUrl || !apiKey || !workspaceKey) {
    return false;
  }

  const mappedEvent = mapHookEvent(args.hookEvent);
  if (!mappedEvent) {
    return false;
  }

  const metadata =
    args.payload.metadata && typeof args.payload.metadata === 'object' && !Array.isArray(args.payload.metadata)
      ? args.payload.metadata
      : {};

  try {
    const response = await fetch(`${baseUrl}/v1/git-events`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workspace_key: workspaceKey,
        project_key: args.projectKey,
        event: mappedEvent,
        branch: getMetadataString(metadata, 'branch'),
        commit_hash: getMetadataString(metadata, 'commit'),
        message: getMetadataString(metadata, 'message') || args.payload.content,
        metadata,
      }),
    });
    if (!response.ok) {
      logger.warn(`hook-event -> memory-core failed: ${response.status} ${response.statusText}`);
      return false;
    }
    return true;
  } catch (error) {
    logger.warn('hook-event -> memory-core failed', error);
    return false;
  }
}

function mapHookEvent(event: HookEvent): 'commit' | 'merge' | 'checkout' | null {
  if (event === 'post-commit') {
    return 'commit';
  }
  if (event === 'post-merge') {
    return 'merge';
  }
  if (event === 'post-checkout') {
    return 'checkout';
  }
  return null;
}

function getMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeEvent(value: string): HookEvent | null {
  if (value === 'post-commit' || value === 'post-merge' || value === 'post-checkout') {
    return value;
  }
  return null;
}

function buildPayload(event: HookEvent):
  | {
      type: 'decision' | 'active_work';
      content: string;
      metadata: Record<string, unknown>;
      status?: string;
    }
  | null {
  if (event === 'post-commit') {
    const commitHash = safeExec('git rev-parse HEAD');
    const commitMessage = safeExec('git log -1 --pretty=%B');
    const branch = safeExec('git branch --show-current');
    if (!commitHash) {
      return null;
    }
    return {
      type: 'decision',
      content: `Committed ${commitHash.slice(0, 7)} on ${branch || 'unknown branch'}: ${firstLine(commitMessage)}`,
      metadata: {
        event: 'commit',
        commit: commitHash,
        branch,
        message: commitMessage,
      },
    };
  }

  if (event === 'post-merge') {
    const branch = safeExec('git branch --show-current');
    const mergeMessage = safeExec('git log -1 --pretty=%B');
    return {
      type: 'decision',
      content: `Merged into ${branch || 'unknown branch'}: ${firstLine(mergeMessage) || 'merge commit detected'}`,
      metadata: {
        event: 'merge',
        branch,
        message: mergeMessage,
      },
    };
  }

  const branch = safeExec('git branch --show-current');
  if (!branch) {
    return null;
  }
  return {
    type: 'active_work',
    content: `Switched to branch ${branch}`,
    metadata: {
      event: 'checkout',
      branch,
    },
    status: 'active',
  };
}

function safeExec(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function firstLine(value: string): string {
  return value.split('\n')[0]?.trim() || '';
}

main().catch((error) => {
  logger.warn('hook-event crashed', error);
});
