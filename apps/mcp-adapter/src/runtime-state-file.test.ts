import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { chmod, mkdtemp, stat } from 'node:fs/promises';
import { RuntimeFileLogger } from './runtime/logging.js';
import { readStateFile, writeStateFile } from './runtime/state-file.js';

test('state.json is written with 600 permissions and can be read back', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'claustrum-state-'));
  const stateFile = path.join(tempDir, 'state.json');
  const logger = new RuntimeFileLogger({
    logsDir: path.join(tempDir, 'logs'),
    level: 'error',
    writeToStderr: false,
  });

  await writeStateFile(
    { stateFile },
    {
      workspace_key: 'personal',
      api_key: 'clsk_live_example',
      device_label: 'Macbook-Pro',
      last_updated_at: new Date().toISOString(),
    },
    logger
  );
  await logger.drain();

  const info = await stat(stateFile);
  const mode = info.mode & 0o777;
  assert.equal(mode, 0o600);

  const loaded = await readStateFile({ stateFile }, logger);
  assert.equal(loaded.workspace_key, 'personal');
  assert.equal(loaded.device_label, 'Macbook-Pro');
});

test('readStateFile tightens insecure file permissions', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'claustrum-state-mode-'));
  const stateFile = path.join(tempDir, 'state.json');
  const logger = new RuntimeFileLogger({
    logsDir: path.join(tempDir, 'logs'),
    level: 'error',
    writeToStderr: false,
  });

  await writeStateFile(
    { stateFile },
    {
      workspace_key: 'personal',
      api_key: 'clsk_live_example',
      device_label: 'Macbook-Pro',
      last_updated_at: new Date().toISOString(),
    },
    logger
  );
  await chmod(stateFile, 0o644);
  await readStateFile({ stateFile }, logger);
  const fixed = await stat(stateFile);
  assert.equal(fixed.mode & 0o777, 0o600);
});
