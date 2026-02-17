#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.MEMORY_CORE_HOST || '127.0.0.1';
const PORT = Number(process.env.MEMORY_CORE_PORT || 18081);
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = process.env.MEMORY_CORE_API_KEY || 'dev-admin-key-change-me';

function resolveAppRoot() {
  const __filename = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(__filename), '..');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for mock scenarios test.');
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

  let bootError = '';
  child.stderr.on('data', (chunk) => {
    bootError += String(chunk || '');
  });

  try {
    await waitForHealthcheck();
    await runMockScenarios();
    console.error('[memory-core:test:mock] mock scenarios passed');
  } catch (error) {
    if (bootError.trim()) {
      console.error('[memory-core:test:mock] server stderr:', bootError.trim());
    }
    throw error;
  } finally {
    child.kill('SIGTERM');
  }
}

async function runMockScenarios() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const workspaceKey = `mock-ws-${suffix}`;
  const alphaProjectKey = `alpha-${suffix}`;
  const betaProjectKey = `beta-${suffix}`;

  await callApi('/v1/workspaces', {
    method: 'POST',
    body: JSON.stringify({ key: workspaceKey, name: 'Mock Workspace' }),
  });

  await callApi('/v1/projects', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      key: alphaProjectKey,
      name: 'Alpha Project',
    }),
  });
  await callApi('/v1/projects', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      key: betaProjectKey,
      name: 'Beta Project',
    }),
  });

  const beforeMarker = await createMemoryBatch({
    workspaceKey,
    projectKey: alphaProjectKey,
    rows: [
      { type: 'note', content: `legacy baseline note ${suffix}` },
      { type: 'problem', content: `legacy timeout issue ${suffix}` },
      { type: 'constraint', content: `legacy max payload 2MB ${suffix}` },
    ],
  });

  await sleep(25);
  const sinceMarker = new Date().toISOString();
  await sleep(25);

  const afterMarker = await createMemoryBatch({
    workspaceKey,
    projectKey: alphaProjectKey,
    rows: [
      { type: 'note', content: `new latency investigation ${suffix}` },
      { type: 'decision', content: `new decision use postgres index ${suffix}` },
      { type: 'active_work', content: `new active task optimize recall path ${suffix}` },
    ],
  });

  await createMemoryBatch({
    workspaceKey,
    projectKey: betaProjectKey,
    rows: [
      { type: 'goal', content: `beta goal improve onboarding ${suffix}` },
      { type: 'note', content: `beta note release checklist ${suffix}` },
    ],
  });

  const projectScoped = await callApi(
    `/v1/memories?${new URLSearchParams({
      workspace_key: workspaceKey,
      project_key: alphaProjectKey,
      limit: '30',
    }).toString()}`
  );
  assert.ok(projectScoped.memories.every((m) => m.project.key === alphaProjectKey));

  const workspaceScoped = await callApi(
    `/v1/memories?${new URLSearchParams({
      workspace_key: workspaceKey,
      limit: '30',
    }).toString()}`
  );
  assert.ok(workspaceScoped.memories.some((m) => m.project.key === alphaProjectKey));
  assert.ok(workspaceScoped.memories.some((m) => m.project.key === betaProjectKey));

  const typeFiltered = await callApi(
    `/v1/memories?${new URLSearchParams({
      workspace_key: workspaceKey,
      project_key: alphaProjectKey,
      type: 'decision',
      limit: '10',
    }).toString()}`
  );
  assert.ok(typeFiltered.memories.length >= 1);
  assert.ok(typeFiltered.memories.every((m) => m.type === 'decision'));

  const qFiltered = await callApi(
    `/v1/memories?${new URLSearchParams({
      workspace_key: workspaceKey,
      q: `latency investigation`,
      limit: '10',
    }).toString()}`
  );
  assert.ok(qFiltered.memories.some((m) => m.content.includes(`latency investigation ${suffix}`)));

  const sinceFiltered = await callApi(
    `/v1/memories?${new URLSearchParams({
      workspace_key: workspaceKey,
      project_key: alphaProjectKey,
      since: sinceMarker,
      limit: '20',
    }).toString()}`
  );
  const sinceContents = sinceFiltered.memories.map((m) => m.content);
  for (const row of afterMarker) {
    assert.ok(sinceContents.some((content) => content === row.content));
  }
  for (const row of beforeMarker) {
    assert.ok(!sinceContents.some((content) => content === row.content));
  }

  const limited = await callApi(
    `/v1/memories?${new URLSearchParams({
      workspace_key: workspaceKey,
      limit: '2',
    }).toString()}`
  );
  assert.equal(limited.memories.length, 2);

  await callApi('/v1/workspace-settings', {
    method: 'PUT',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      resolution_order: ['github_remote', 'repo_root_slug', 'manual'],
      auto_create_project: true,
      github_key_prefix: 'github:',
      local_key_prefix: 'local:',
      reason: 'mock resolver setup',
    }),
  });

  const githubResolved = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      github_remote: {
        host: 'github.com',
        owner: 'acme',
        repo: `repo-${suffix}`,
        normalized: `acme/repo-${suffix}`,
      },
    }),
  });
  assert.equal(githubResolved.resolution, 'github_remote');
  assert.equal(githubResolved.created, true);
  assert.equal(githubResolved.project.key, `github:acme/repo-${suffix}`);

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
      monorepo_max_depth: 3,
    }),
  });

  const githubMonorepoResolved = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      github_remote: {
        normalized: `acme/repo-${suffix}`,
      },
      relative_path: 'apps/service/src',
      monorepo: {
        enabled: true,
        candidate_subpaths: ['apps/service'],
      },
    }),
  });
  assert.equal(githubMonorepoResolved.project.key, `github:acme/repo-${suffix}#apps/service`);

  const repoResolved = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      repo_root_slug: `local-repo-${suffix}`,
    }),
  });
  assert.equal(repoResolved.resolution, 'repo_root_slug');

  const manualResolved = await callApi('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      manual_project_key: alphaProjectKey,
    }),
  });
  assert.equal(manualResolved.resolution, 'manual');
  assert.equal(manualResolved.project.key, alphaProjectKey);

  await callApi('/v1/workspace-settings', {
    method: 'PUT',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      resolution_order: ['github_remote', 'repo_root_slug', 'manual'],
      auto_create_project: false,
      github_key_prefix: 'github:',
      local_key_prefix: 'local:',
    }),
  });

  const missingResolve = await callApiRaw('/v1/resolve-project', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      repo_root_slug: `missing-${suffix}`,
    }),
  });
  assert.equal(missingResolve.status, 404);

  const ciEvent = await callApi('/v1/ci-events', {
    method: 'POST',
    body: JSON.stringify({
      workspace_key: workspaceKey,
      project_key: alphaProjectKey,
      status: 'success',
      provider: 'github_actions',
      workflow_name: 'mock-ci',
      workflow_run_id: suffix,
      repository: `acme/repo-${suffix}`,
      branch: 'main',
      sha: `${suffix}abcdef0`,
      event_name: 'push',
      job_name: 'mock-job',
      metadata: { source: 'mock-scenarios-test' },
    }),
  });
  assert.equal(ciEvent.action, 'ci.success');

  const codexJsonl = [
    JSON.stringify({
      type: 'session_meta',
      payload: { id: `mock-session-${suffix}`, title: `Mock Session ${suffix}` },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        role: 'user',
        content: [{ type: 'input_text', text: `Goal: improve test coverage ${suffix}` }],
      },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        role: 'assistant',
        content: [{ type: 'output_text', text: `Constraint: keep recall snippet-only ${suffix}` }],
      },
    }),
  ].join('\n');

  const importResult = await callApiMultipart('/v1/imports', {
    workspace_key: workspaceKey,
    project_key: alphaProjectKey,
    source: 'codex',
    fileName: `mock-codex-${suffix}.jsonl`,
    fileContent: codexJsonl,
  });

  const importId = importResult.import_id;
  assert.ok(importId);

  await callApi(`/v1/imports/${encodeURIComponent(importId)}/parse`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await callApi(`/v1/imports/${encodeURIComponent(importId)}/extract`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const staged = await callApi(`/v1/imports/${encodeURIComponent(importId)}/staged`);
  assert.ok(Array.isArray(staged.staged_memories));
  assert.ok(staged.staged_memories.length >= 1);

  const stagedIds = staged.staged_memories.slice(0, 2).map((item) => item.id);
  await callApi(`/v1/imports/${encodeURIComponent(importId)}/commit`, {
    method: 'POST',
    body: JSON.stringify({
      staged_ids: stagedIds,
      project_key: alphaProjectKey,
    }),
  });

  const recallImported = await callApi(
    `/v1/memories?${new URLSearchParams({
      workspace_key: workspaceKey,
      project_key: alphaProjectKey,
      q: `${suffix}`,
      limit: '20',
    }).toString()}`
  );
  assert.ok(recallImported.memories.length >= 1);
}

async function createMemoryBatch(args) {
  const inserted = [];
  for (const row of args.rows) {
    const result = await callApi('/v1/memories', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: args.workspaceKey,
        project_key: args.projectKey,
        type: row.type,
        content: row.content,
        metadata: {
          source: 'mock-scenarios-test',
          batch: args.projectKey,
        },
      }),
    });
    inserted.push(result);
    await sleep(8);
  }
  return inserted;
}

async function callApiMultipart(pathname, payload) {
  const form = new FormData();
  form.set('workspace_key', payload.workspace_key);
  form.set('source', payload.source);
  if (payload.project_key) {
    form.set('project_key', payload.project_key);
  }
  form.set('file', new Blob([payload.fileContent], { type: 'application/octet-stream' }), payload.fileName);

  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${pathname}: ${text}`);
  }

  return response.json();
}

async function callApi(pathname, init = {}) {
  const response = await callApiRaw(pathname, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${pathname}: ${text}`);
  }
  return response.json();
}

async function callApiRaw(pathname, init = {}) {
  const headers = {
    authorization: `Bearer ${API_KEY}`,
    ...(init.headers || {}),
  };
  if (!(init.body instanceof FormData) && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  return fetch(`${BASE_URL}${pathname}`, {
    ...init,
    headers,
  });
}

async function waitForHealthcheck() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error(`memory-core healthcheck timed out: ${BASE_URL}/healthz`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error('[memory-core:test:mock] failed', error);
  process.exit(1);
});
