import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type RuntimeState = {
  current_version: string | null;
  last_update_check_at: string | null;
  update_etag: string | null;
  update_channel: 'stable' | 'beta';
};

const DEFAULT_STATE: RuntimeState = {
  current_version: null,
  last_update_check_at: null,
  update_etag: null,
  update_channel: 'stable',
};

export async function readRuntimeState(statePath: string): Promise<RuntimeState> {
  try {
    const raw = await readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<RuntimeState>;
    return {
      current_version: parsed.current_version ?? null,
      last_update_check_at: parsed.last_update_check_at ?? null,
      update_etag: parsed.update_etag ?? null,
      update_channel: parsed.update_channel === 'beta' ? 'beta' : 'stable',
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function writeRuntimeState(statePath: string, next: RuntimeState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  const tempPath = `${statePath}.tmp-${process.pid}-${Date.now()}`;
  const body = `${JSON.stringify(next, null, 2)}\n`;
  await writeFile(tempPath, body, 'utf8');
  await rename(tempPath, statePath);
}
