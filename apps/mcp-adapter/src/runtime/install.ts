import { chmod, cp, lstat, mkdir, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ADAPTER_VERSION } from './version.js';

type RuntimePaths = {
  homeDir: string;
  binDir: string;
  adapterDir: string;
  versionsDir: string;
  currentSymlink: string;
  logsDir: string;
  stateFile: string;
  lockFile: string;
  launcherPath: string;
};

export async function ensureRuntimeLayout(paths: RuntimePaths): Promise<void> {
  await mkdir(paths.homeDir, { recursive: true });
  await mkdir(paths.binDir, { recursive: true });
  await mkdir(paths.adapterDir, { recursive: true });
  await mkdir(paths.versionsDir, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });
}

export async function ensureCurrentVersionInstalled(args: {
  paths: RuntimePaths;
  sourceDistDir: string;
  version?: string;
}): Promise<{ version: string; versionDir: string }> {
  const version = args.version || ADAPTER_VERSION;
  const versionDir = path.join(args.paths.versionsDir, `v${version}`);
  const normalizedSource = path.resolve(args.sourceDistDir);
  const normalizedTarget = path.resolve(versionDir);

  try {
    await lstat(versionDir);
  } catch {
    if (normalizedSource !== normalizedTarget) {
      await cp(normalizedSource, versionDir, { recursive: true });
    }
    await writeFile(
      path.join(versionDir, 'manifest.json'),
      `${JSON.stringify({ version, installed_at: new Date().toISOString() }, null, 2)}\n`,
      'utf8'
    );
  }

  await switchCurrentSymlink(args.paths.currentSymlink, versionDir);
  await ensureThinLauncher(args.paths.launcherPath, args.paths.currentSymlink);

  return { version, versionDir };
}

export async function switchCurrentSymlink(currentSymlink: string, versionDir: string): Promise<void> {
  const currentDir = path.dirname(currentSymlink);
  await mkdir(currentDir, { recursive: true });
  const tempLink = `${currentSymlink}.next`;

  await rm(tempLink, { force: true });
  await symlink(versionDir, tempLink, process.platform === 'win32' ? 'junction' : 'dir');

  try {
    await rename(tempLink, currentSymlink);
  } catch {
    await rm(currentSymlink, { force: true });
    await rename(tempLink, currentSymlink);
  }
}

export async function resolveCurrentVersionDir(currentSymlink: string): Promise<string | null> {
  try {
    const statInfo = await lstat(currentSymlink);
    if (statInfo.isSymbolicLink()) {
      const target = await readlink(currentSymlink);
      return path.resolve(path.dirname(currentSymlink), target);
    }
    if (statInfo.isDirectory()) {
      return currentSymlink;
    }
    return null;
  } catch {
    return null;
  }
}

export async function ensureThinLauncher(launcherPath: string, currentSymlink: string): Promise<void> {
  const script = `#!/bin/sh\nexec node "${currentSymlink}/bridge-main.js" "$@"\n`;
  await writeFile(launcherPath, script, 'utf8');
  await chmod(launcherPath, 0o755);

  if (process.platform === 'win32') {
    const cmdPath = `${launcherPath}.cmd`;
    const cmdScript = `@echo off\r\nnode "${currentSymlink}\\bridge-main.js" %*\r\n`;
    await writeFile(cmdPath, cmdScript, 'utf8');
  }
}
