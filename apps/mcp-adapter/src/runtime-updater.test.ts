import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readlink, symlink, writeFile } from 'node:fs/promises';
import { RuntimeFileLogger } from './runtime/logging.js';
import { runBackgroundUpdateCheck } from './runtime/updater.js';

function responseJson(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

test('runBackgroundUpdateCheck keeps current version when SHA256 mismatches', async () => {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), 'claustrum-update-'));
  const versionsDir = path.join(tempHome, 'adapter', 'versions');
  const currentSymlink = path.join(tempHome, 'adapter', 'current');
  const paths = {
    versionsDir,
    currentSymlink,
    stateFile: path.join(tempHome, 'state.json'),
    lockFile: path.join(tempHome, 'update.lock'),
  };
  await mkdir(path.join(versionsDir, 'v0.1.4'), { recursive: true });
  await writeFile(path.join(versionsDir, 'v0.1.4', 'bridge-main.js'), 'console.error("ok")\n', 'utf8');
  await writeFile(path.join(versionsDir, 'v0.1.4', 'manifest.json'), '{}\n', 'utf8');
  await writeFile(path.join(tempHome, 'state.json'), JSON.stringify({ current_version: '0.1.4' }), 'utf8');

  await symlink(path.join(versionsDir, 'v0.1.4'), currentSymlink, 'dir');

  const logger = new RuntimeFileLogger({
    logsDir: path.join(tempHome, 'logs'),
    level: 'debug',
    writeToStderr: false,
  });

  const release = {
    tag_name: 'v0.1.5',
    prerelease: false,
    assets: [
      {
        name: 'claustrum-mcp-adapter-v0.1.5.js',
        browser_download_url: 'https://example.invalid/adapter.js',
      },
      {
        name: 'SHA256SUMS',
        browser_download_url: 'https://example.invalid/SHA256SUMS',
      },
    ],
  };

  const fetchImpl: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/releases/latest')) {
      return responseJson(release, {
        headers: { etag: 'W/"test"' },
      });
    }
    if (url.endsWith('/SHA256SUMS')) {
      return new Response('0000000000000000000000000000000000000000000000000000000000000000  claustrum-mcp-adapter-v0.1.5.js\n', {
        status: 200,
      });
    }
    if (url.endsWith('/adapter.js')) {
      return new Response('console.error("new")\n', { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  await runBackgroundUpdateCheck({
    fetchImpl,
    config: {
      claustrumHome: tempHome,
      baseUrl: 'https://api.example.com',
      apiKey: 'secret',
      bearerToken: '',
      workspaceKey: 'personal',
      deviceLabel: 'test-device',
      requestTimeoutMs: 1000,
      requestRetryCount: 0,
      logLevel: 'error',
      autoUpdate: true,
      updateChannel: 'stable',
      updateRepo: 'stephen-kim/claustrum',
    },
    paths,
    currentVersion: '0.1.4',
    logger,
  });

  await logger.drain();
  const currentTarget = await readlink(currentSymlink);
  assert.equal(path.basename(currentTarget), 'v0.1.4');
});
