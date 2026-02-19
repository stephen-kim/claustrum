import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { acquireUpdateLock } from './runtime/lock.js';

test('acquireUpdateLock prevents concurrent update execution', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'claustrum-lock-'));
  const lockPath = path.join(tempDir, 'update.lock');

  const first = await acquireUpdateLock(lockPath);
  assert.ok(first, 'first lock should be acquired');

  const second = await acquireUpdateLock(lockPath);
  assert.equal(second, null, 'second lock acquisition should fail while first is held');

  await first?.release();
  const third = await acquireUpdateLock(lockPath);
  assert.ok(third, 'lock should be acquirable after release');
  await third?.release();
});
