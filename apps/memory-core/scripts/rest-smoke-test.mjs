#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.MEMORY_CORE_HOST || '127.0.0.1';
const PORT = Number(process.env.MEMORY_CORE_PORT || 18080);
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = process.env.MEMORY_CORE_API_KEY || 'dev-admin-key-change-me';

function resolveAppRoot() {
  const __filename = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(__filename), '..');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for REST smoke test.');
  }

  const appRoot = resolveAppRoot();
  const distEntry = path.join(appRoot, 'dist', 'http-server.js');
  const srcEntry = path.join(appRoot, 'src', 'http-server.ts');

  const hasDist = fs.existsSync(distEntry);
  const command = process.execPath;
  const args = hasDist ? [distEntry] : ['--import', 'tsx', srcEntry];

  const child = spawn(command, args, {
    cwd: appRoot,
    env: {
      ...process.env,
      MEMORY_CORE_HOST: HOST,
      MEMORY_CORE_PORT: String(PORT),
      MEMORY_CORE_API_KEY: API_KEY,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  child.stderr.on('data', () => {});

  try {
    await waitForHealthcheck();
    await runFlow();
    console.error('[memory-core:test] REST smoke test passed');
  } finally {
    child.kill('SIGTERM');
  }
}

async function runFlow() {
  const workspaceKey = `smoke-ws-${Date.now()}`;
  const note = `smoke-note-${Date.now()}`;
  const manualProjectKey = `manual-${Date.now()}`;

  await callApi('/v1/workspaces', {
    method: 'POST',
    body: JSON.stringify({
      key: workspaceKey,
      name: 'Smoke Workspace',
    }),
  });

  await callApi('/v1/workspace-settings', {
    method: 'PUT',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      resolution_order: ['github_remote', 'repo_root_slug', 'manual'],
      auto_create_project: true,
      github_key_prefix: 'github:',
      local_key_prefix: 'local:',
      reason: 'initial resolver policy setup',
    }),
  });

  const workspaceAudit = await callApi(
    `/v1/audit-logs?${new URLSearchParams({
      workspace_key: workspaceKey,
      action_prefix: 'workspace_settings.',
      limit: '10',
    }).toString()}`
  );
  assert.ok(Array.isArray(workspaceAudit.logs), 'Expected workspace settings audit logs');
  assert.ok(
    workspaceAudit.logs.some(
      (log) => log.action === 'workspace_settings.update' && log.target?.reason === 'initial resolver policy setup'
    ),
    'Expected workspace settings update audit reason'
  );

  await callApi('/v1/integrations', {
    method: 'PUT',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      provider: 'slack',
      enabled: true,
      config: {
        action_prefixes: ['git.', 'integration.'],
        format: 'compact',
        include_target_json: false,
        mask_secrets: true,
        routes: [{ action_prefix: 'git.', channel: '#audit-devflow', min_severity: 'medium' }],
        severity_rules: [{ action_prefix: 'integration.', severity: 'high' }],
      },
      reason: 'enable workspace slack routing',
    }),
  });
  const integrationSettings = await callApi(
    `/v1/integrations?${new URLSearchParams({ workspace_key: workspaceKey }).toString()}`
  );
  assert.equal(integrationSettings.integrations?.slack?.enabled, true);
  assert.equal(integrationSettings.integrations?.slack?.format, 'compact');

  const githubFirst = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      github_remote: {
        host: 'github.com',
        owner: 'acme',
        repo: 'rocket',
        normalized: 'acme/rocket',
      },
    }),
  });
  assert.equal(githubFirst.resolution, 'github_remote');
  assert.equal(githubFirst.created, true);
  assert.equal(githubFirst.project.key, 'github:acme/rocket');

  const githubSecond = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      github_remote: {
        normalized: 'acme/rocket',
      },
    }),
  });
  assert.equal(githubSecond.resolution, 'github_remote');
  assert.ok(githubSecond.matched_mapping_id);
  assert.equal(githubSecond.project.key, 'github:acme/rocket');

  const monoSuffix = `${Date.now()}`;
  await callApi('/v1/workspace-settings', {
    method: 'PUT',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      resolution_order: ['github_remote', 'repo_root_slug', 'manual'],
      auto_create_project: true,
      auto_create_project_subprojects: true,
      github_key_prefix: 'github:',
      local_key_prefix: 'local:',
      enable_monorepo_resolution: true,
      monorepo_mode: 'repo_hash_subpath',
      monorepo_workspace_globs: ['apps/*', 'packages/*'],
      monorepo_root_markers: ['pnpm-workspace.yaml', 'turbo.json'],
      monorepo_max_depth: 3,
    }),
  });

  const monorepoResolved = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      github_remote: {
        normalized: `acme/mono-${monoSuffix}`,
      },
      repo_root: '/repo',
      cwd: '/repo/apps/memory-core/src',
      relative_path: 'apps/memory-core/src',
      monorepo: {
        enabled: true,
        candidate_subpaths: ['apps/memory-core'],
      },
    }),
  });
  assert.equal(monorepoResolved.resolution, 'github_remote');
  assert.equal(monorepoResolved.project.key, `github:acme/mono-${monoSuffix}#apps/memory-core`);

  await callApi('/v1/workspace-settings', {
    method: 'PUT',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      resolution_order: ['github_remote', 'repo_root_slug', 'manual'],
      auto_create_project: true,
      auto_create_project_subprojects: true,
      github_key_prefix: 'github:',
      local_key_prefix: 'local:',
      enable_monorepo_resolution: true,
      monorepo_mode: 'repo_colon_subpath',
      monorepo_workspace_globs: ['services/*'],
      monorepo_max_depth: 3,
    }),
  });

  const customGlobResolved = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      github_remote: {
        normalized: `acme/service-${monoSuffix}`,
      },
      relative_path: 'services/gateway/http',
    }),
  });
  assert.equal(customGlobResolved.project.key, `github:acme/service-${monoSuffix}:services/gateway`);

  await callApi('/v1/workspace-settings', {
    method: 'PUT',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      resolution_order: ['github_remote', 'repo_root_slug', 'manual'],
      auto_create_project: true,
      auto_create_project_subprojects: false,
      github_key_prefix: 'github:',
      local_key_prefix: 'local:',
      enable_monorepo_resolution: true,
      monorepo_mode: 'repo_hash_subpath',
      monorepo_workspace_globs: ['apps/*'],
      monorepo_max_depth: 3,
    }),
  });

  const subprojectDisabled = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      github_remote: {
        normalized: `acme/no-sub-${monoSuffix}`,
      },
      relative_path: 'apps/adapter/src',
      monorepo: {
        enabled: true,
        candidate_subpaths: ['apps/adapter'],
      },
    }),
  });
  assert.equal(subprojectDisabled.project.key, `github:acme/no-sub-${monoSuffix}`);

  const slugFirst = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      repo_root_slug: 'video-transcriber',
    }),
  });
  assert.equal(slugFirst.resolution, 'repo_root_slug');
  assert.equal(slugFirst.created, true);
  assert.equal(slugFirst.project.key, 'local:video-transcriber');

  const slugSecond = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      repo_root_slug: 'video-transcriber',
    }),
  });
  assert.equal(slugSecond.resolution, 'repo_root_slug');
  assert.ok(slugSecond.matched_mapping_id);

  await callApi('/v1/projects', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      key: manualProjectKey,
      name: 'Manual Project',
    }),
  });

  const manualResolved = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      manual_project_key: manualProjectKey,
    }),
  });
  assert.equal(manualResolved.resolution, 'manual');
  assert.equal(manualResolved.project.key, manualProjectKey);

  await callApi('/v1/workspace-settings', {
    method: 'PUT',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      auto_create_project: false,
      resolution_order: ['github_remote', 'repo_root_slug', 'manual'],
      github_key_prefix: 'github:',
      local_key_prefix: 'local:',
    }),
  });

  const disabledAutoCreate = await callApiRaw('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      repo_root_slug: `missing-${Date.now()}`,
    }),
  });
  assert.equal(disabledAutoCreate.status, 404);

  await callApi('/v1/memories', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      project_key: githubSecond.project.key,
      type: 'note',
      content: note,
      metadata: { source: 'rest-smoke-test' },
    }),
  });

  await callApi('/v1/git-events', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      project_key: githubSecond.project.key,
      event: 'commit',
      branch: 'main',
      commit_hash: 'abcdef0123456789',
      message: 'smoke commit',
      metadata: { source: 'rest-smoke-test' },
    }),
  });
  const gitAudit = await callApi(
    `/v1/audit-logs?${new URLSearchParams({
      workspace_key: workspaceKey,
      action_prefix: 'git.',
      limit: '10',
    }).toString()}`
  );
  assert.ok(Array.isArray(gitAudit.logs), 'Expected git audit logs');
  assert.ok(
    gitAudit.logs.some((log) => log.action === 'git.commit'),
    'Expected git.commit audit entry'
  );

  await callApi('/v1/ci-events', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      project_key: githubSecond.project.key,
      status: 'failure',
      provider: 'github_actions',
      workflow_name: 'CI',
      workflow_run_id: String(Date.now()),
      workflow_run_url: `https://github.com/acme/repo/actions/runs/${Date.now()}`,
      repository: 'acme/repo',
      branch: 'main',
      sha: 'abcdef0123456789',
      event_name: 'push',
      job_name: 'test',
      message: 'unit tests failed',
      metadata: { source: 'rest-smoke-test' },
    }),
  });

  const ciAudit = await callApi(
    `/v1/audit-logs?${new URLSearchParams({
      workspace_key: workspaceKey,
      action_prefix: 'ci.',
      limit: '10',
    }).toString()}`
  );
  assert.ok(Array.isArray(ciAudit.logs), 'Expected ci audit logs');
  assert.ok(
    ciAudit.logs.some((log) => log.action === 'ci.failure'),
    'Expected ci.failure audit entry'
  );

  const query = new URLSearchParams({
    workspace_key: workspaceKey,
    project_key: githubSecond.project.key,
    q: note,
    limit: '5',
  });

  const memoriesResult = await callApi(`/v1/memories?${query.toString()}`);
  const memories = Array.isArray(memoriesResult.memories) ? memoriesResult.memories : [];
  assert.ok(memories.some((item) => item.content === note), 'Expected saved memory in recall result');

  const codexJsonl = [
    JSON.stringify({
      type: 'session_meta',
      payload: { id: `smoke-session-${Date.now()}`, title: 'Smoke Import Session' },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        role: 'user',
        content: [{ type: 'input_text', text: 'Decision: adopt postgres for production memory core.' }],
      },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Constraint: never expose full raw transcript through MCP.' }],
      },
    }),
  ].join('\n');

  const importResult = await callApiMultipart('/v1/imports', {
    workspace_key: workspaceKey,
    project_key: githubSecond.project.key,
    source: 'codex',
    fileName: 'smoke-codex.jsonl',
    fileContent: codexJsonl,
  });
  assert.ok(importResult.import_id, 'Expected import_id from upload');

  await callApi(`/v1/imports/${importResult.import_id}/parse`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await callApi(`/v1/imports/${importResult.import_id}/extract`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const staged = await callApi(`/v1/imports/${importResult.import_id}/staged`);
  assert.ok(
    Array.isArray(staged.staged_memories) && staged.staged_memories.length > 0,
    'Expected staged memories after extract'
  );

  const stagedIds = staged.staged_memories.slice(0, 2).map((item) => item.id);
  await callApi(`/v1/imports/${importResult.import_id}/commit`, {
    method: 'POST',
    body: JSON.stringify({
      staged_ids: stagedIds,
      project_key: githubSecond.project.key,
    }),
  });

  const claudeJson = JSON.stringify({
    conversation_id: `claude-smoke-${Date.now()}`,
    title: 'Claude Smoke Session',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    messages: [
      {
        role: 'human',
        content: [
          {
            type: 'text',
            text: 'Goal: ship a stable Claude import parser with reliable role normalization for production memory-core.',
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Decision: preserve memories-first recall while keeping raw search snippet-only with audit logging.',
          },
        ],
      },
    ],
  });

  const claudeImport = await callApiMultipart('/v1/imports', {
    workspace_key: workspaceKey,
    project_key: githubSecond.project.key,
    source: 'claude',
    fileName: 'smoke-claude.json',
    fileContent: claudeJson,
  });
  assert.ok(claudeImport.import_id, 'Expected claude import_id from upload');

  await callApi(`/v1/imports/${claudeImport.import_id}/parse`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await callApi(`/v1/imports/${claudeImport.import_id}/extract`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const claudeStaged = await callApi(`/v1/imports/${claudeImport.import_id}/staged`);
  assert.ok(
    Array.isArray(claudeStaged.staged_memories) && claudeStaged.staged_memories.length > 0,
    'Expected staged memories after claude extract'
  );

  const rawQuery = new URLSearchParams({
    workspace_key: workspaceKey,
    project_key: githubSecond.project.key,
    q: 'postgres',
    limit: '5',
    max_chars: '400',
  });
  const rawSearch = await callApi(`/v1/raw/search?${rawQuery.toString()}`);
  assert.ok(Array.isArray(rawSearch.matches) && rawSearch.matches.length > 0, 'Expected raw search matches');
  assert.ok(rawSearch.matches[0].snippet.length <= 400, 'Expected snippet max_chars enforcement');

  const claudeRawQuery = new URLSearchParams({
    workspace_key: workspaceKey,
    project_key: githubSecond.project.key,
    q: 'stable Claude import parser',
    limit: '5',
    max_chars: '400',
  });
  const claudeRawSearch = await callApi(`/v1/raw/search?${claudeRawQuery.toString()}`);
  assert.ok(
    Array.isArray(claudeRawSearch.matches) && claudeRawSearch.matches.length > 0,
    'Expected claude raw search matches'
  );
  assert.ok(
    claudeRawSearch.matches.some((item) => /stable Claude import parser/i.test(item.snippet)),
    'Expected claude snippet content in raw search result'
  );

  const rawMessageId = rawSearch.matches[0].message_id;
  const rawView = await callApi(`/v1/raw/messages/${rawMessageId}?max_chars=300`);
  assert.equal(rawView.message_id, rawMessageId);
  assert.ok(rawView.snippet.length <= 300, 'Expected raw view max_chars enforcement');

  const audits = await callApi(
    `/v1/audit-logs?${new URLSearchParams({
      workspace_key: workspaceKey,
      action_prefix: 'raw.',
      limit: '20',
    }).toString()}`
  );
  const actions = (audits.logs || []).map((entry) => entry.action);
  assert.ok(actions.includes('raw.search'), 'Expected raw.search audit log');
  assert.ok(actions.includes('raw.view'), 'Expected raw.view audit log');
}

async function waitForHealthcheck() {
  const start = Date.now();
  const timeoutMs = 20000;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(300);
  }

  throw new Error(`memory-core healthcheck timed out: ${BASE_URL}/healthz`);
}

async function callApi(pathname, init = {}) {
  const result = await callApiRaw(pathname, init);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.body.error || `${result.status} ${result.statusText}`);
  }
  return result.body;
}

async function callApiRaw(pathname, init = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${API_KEY}`,
      ...(init.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  return {
    status: response.status,
    statusText: response.statusText,
    body,
  };
}

async function callApiMultipart(pathname, args) {
  const form = new FormData();
  form.set('workspace_key', args.workspace_key);
  form.set('source', args.source);
  if (args.project_key) {
    form.set('project_key', args.project_key);
  }
  form.set('file', new Blob([args.fileContent], { type: 'application/jsonl' }), args.fileName);

  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    body: form,
    headers: {
      authorization: `Bearer ${API_KEY}`,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `${response.status} ${response.statusText}`);
  }
  return body;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error('[memory-core:test] failed', error);
  process.exit(1);
});
