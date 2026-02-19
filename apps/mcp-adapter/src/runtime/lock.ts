import { open, readFile, rm, writeFile } from 'node:fs/promises';

export type LockHandle = {
  path: string;
  release: () => Promise<void>;
};

export async function acquireUpdateLock(lockPath: string): Promise<LockHandle | null> {
  try {
    const fd = await open(lockPath, 'wx');
    const payload = JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() });
    await fd.writeFile(payload, 'utf8');
    await fd.close();
    return {
      path: lockPath,
      release: async () => {
        await rm(lockPath, { force: true });
      },
    };
  } catch {
    return null;
  }
}

export async function readLockDebug(lockPath: string): Promise<string | null> {
  try {
    const content = await readFile(lockPath, 'utf8');
    return content.trim();
  } catch {
    return null;
  }
}

export async function forceReleaseLock(lockPath: string): Promise<void> {
  await writeFile(lockPath, '', 'utf8').catch(() => undefined);
  await rm(lockPath, { force: true });
}
