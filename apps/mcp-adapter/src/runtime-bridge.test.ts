import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { RuntimeFileLogger } from './runtime/logging.js';
import { proxyJsonRpcRequest } from './runtime/bridge.js';

test('proxyJsonRpcRequest returns JSON-RPC error when upstream is unreachable', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'claustrum-bridge-'));
  const logger = new RuntimeFileLogger({
    logsDir: tempDir,
    level: 'error',
    writeToStderr: false,
  });

  const result = await proxyJsonRpcRequest({
    request: {
      jsonrpc: '2.0',
      id: 'req-1',
      method: 'tools/list',
      params: {},
    },
    config: {
      baseUrl: 'https://claustrum.example.com',
      apiKey: 'token',
      bearerToken: '',
      timeoutMs: 50,
      retryCount: 1,
    },
    logger,
    fetchImpl: (async () => {
      throw new Error('network down');
    }) as typeof fetch,
  });

  await logger.drain();
  assert.ok(result);
  assert.equal(result?.error?.code, -32098);
  assert.equal(result?.id, 'req-1');
});

test('proxyJsonRpcRequest returns login guidance on upstream 401', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'claustrum-bridge-'));
  const logger = new RuntimeFileLogger({
    logsDir: tempDir,
    level: 'error',
    writeToStderr: false,
  });

  const result = await proxyJsonRpcRequest({
    request: {
      jsonrpc: '2.0',
      id: 'req-2',
      method: 'tools/list',
      params: {},
    },
    config: {
      baseUrl: 'https://claustrum.example.com',
      apiKey: 'token',
      bearerToken: '',
      timeoutMs: 500,
      retryCount: 0,
    },
    logger,
    fetchImpl: (async () => new Response('unauthorized', { status: 401 })) as typeof fetch,
  });

  await logger.drain();
  assert.ok(result);
  assert.equal(result?.error?.code, -32004);
  assert.match(String(result?.error?.message || ''), /login --api-key/i);
});
