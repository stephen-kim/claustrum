import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RuntimeFileLogger } from './logging.js';

type RuntimePaths = {
  stateFile: string;
};

export type ClaustrumState = {
  workspace_key?: string;
  api_key?: string;
  device_label?: string;
  last_updated_at?: string;
};

export async function readStateFile(paths: RuntimePaths, logger: RuntimeFileLogger): Promise<ClaustrumState> {
  try {
    const info = await stat(paths.stateFile);
    const mode = info.mode & 0o777;
    if ((mode & 0o077) !== 0) {
      logger.warn(
        `state.json permission is too open (${mode.toString(8)}). Expected 600. Restricting now.`
      );
      await chmod(paths.stateFile, 0o600).catch(() => undefined);
    }
  } catch {
    return {};
  }

  try {
    const raw = await readFile(paths.stateFile, 'utf8');
    const parsed = JSON.parse(raw) as ClaustrumState;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export async function writeStateFile(
  paths: RuntimePaths,
  state: ClaustrumState,
  logger: RuntimeFileLogger
): Promise<void> {
  await mkdir(path.dirname(paths.stateFile), { recursive: true });
  const tempFile = `${paths.stateFile}.tmp-${process.pid}-${Date.now()}`;
  const body = `${JSON.stringify(state, null, 2)}\n`;
  await writeFile(tempFile, body, { encoding: 'utf8', mode: 0o600 });
  await chmod(tempFile, 0o600).catch(() => undefined);
  await rename(tempFile, paths.stateFile);
  await chmod(paths.stateFile, 0o600).catch(() => undefined);
  logger.info('Updated local Claustrum auth state file.');
}

export async function clearApiKeyFromState(paths: RuntimePaths, logger: RuntimeFileLogger): Promise<void> {
  const current = await readStateFile(paths, logger);
  delete current.api_key;
  current.last_updated_at = new Date().toISOString();
  await writeStateFile(paths, current, logger);
}

export async function removeStateFile(paths: RuntimePaths): Promise<void> {
  await rm(paths.stateFile, { force: true });
}
