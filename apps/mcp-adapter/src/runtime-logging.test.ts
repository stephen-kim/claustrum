import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readdir, stat } from 'node:fs/promises';
import { RuntimeFileLogger } from './runtime/logging.js';

test('RuntimeFileLogger rotates logs and keeps total size capped', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'claustrum-logs-'));
  const logger = new RuntimeFileLogger({
    logsDir: tempDir,
    level: 'debug',
    maxInfoBytes: 1024,
    maxErrorBytes: 1024,
    maxTotalBytes: 2048,
    writeToStderr: false,
  });

  const originalStdout = process.stdout.write;
  let stdoutWrites = 0;
  process.stdout.write = ((...args: unknown[]) => {
    stdoutWrites += 1;
    return originalStdout.apply(process.stdout, args as never);
  }) as typeof process.stdout.write;

  try {
    for (let index = 0; index < 200; index += 1) {
      logger.info(`info-${index} ${'x'.repeat(120)}`);
      logger.error(`error-${index} ${'y'.repeat(120)}`);
    }
    await logger.drain();
  } finally {
    process.stdout.write = originalStdout;
  }

  assert.equal(stdoutWrites, 0, 'logger must not write to stdout');

  const files = await readdir(tempDir);
  let total = 0;
  for (const file of files) {
    const info = await stat(path.join(tempDir, file));
    total += info.size;
  }

  assert.ok(total <= 2048, `expected total log size <= 2048 bytes, got ${total}`);
});
