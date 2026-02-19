import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DEFAULT_UPDATE_REPO, type RuntimeConfig } from './constants.js';
import { acquireUpdateLock, readLockDebug } from './lock.js';
import { RuntimeFileLogger } from './logging.js';
import { maskSensitive } from './mask.js';
import { readRuntimeState, writeRuntimeState } from './state.js';
import { switchCurrentSymlink } from './install.js';

type RuntimePaths = {
  versionsDir: string;
  currentSymlink: string;
  stateFile: string;
  lockFile: string;
};

type GithubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GithubRelease = {
  tag_name: string;
  prerelease: boolean;
  assets: GithubReleaseAsset[];
};

const ALLOWED_REPOS = new Set([DEFAULT_UPDATE_REPO]);
const MIN_UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

function stripLeadingV(value: string): string {
  return value.replace(/^v/i, '');
}

function compareVersion(a: string, b: string): number {
  const ap = stripLeadingV(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const bp = stripLeadingV(b).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const max = Math.max(ap.length, bp.length);
  for (let i = 0; i < max; i += 1) {
    const left = ap[i] || 0;
    const right = bp[i] || 0;
    if (left !== right) {
      return left > right ? 1 : -1;
    }
  }
  return 0;
}

function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fetchJson<T>(fetchImpl: typeof fetch, url: string, headers: Record<string, string>) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers,
  });
  if (response.status === 304) {
    return { notModified: true as const, etag: response.headers.get('etag') || null, data: null as T | null };
  }
  if (!response.ok) {
    throw new Error(`GitHub update check failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as T;
  return { notModified: false as const, etag: response.headers.get('etag') || null, data };
}

function parseSha256Sums(file: string): Map<string, string> {
  const output = new Map<string, string>();
  const lines = file.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const matched = line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (!matched) {
      continue;
    }
    output.set(matched[2], matched[1].toLowerCase());
  }
  return output;
}

function pickAssets(release: GithubRelease): { runtimeAsset: GithubReleaseAsset; sumsAsset: GithubReleaseAsset } | null {
  const sumsAsset = release.assets.find((asset) => asset.name.toUpperCase() === 'SHA256SUMS');
  const runtimeAsset = release.assets.find((asset) => /claustrum-mcp-adapter-.*\.(m?js)$/i.test(asset.name));
  if (!runtimeAsset || !sumsAsset) {
    return null;
  }
  return { runtimeAsset, sumsAsset };
}

async function downloadBuffer(fetchImpl: typeof fetch, url: string): Promise<Buffer> {
  const response = await fetchImpl(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function getLatestRelease(args: {
  fetchImpl: typeof fetch;
  config: RuntimeConfig;
  etag: string | null;
}): Promise<{ release: GithubRelease | null; etag: string | null; notModified: boolean }> {
  const repo = args.config.updateRepo;
  const baseHeaders: Record<string, string> = {
    'accept': 'application/vnd.github+json',
    'user-agent': 'claustrum-mcp-updater',
  };
  if (args.etag) {
    baseHeaders['if-none-match'] = args.etag;
  }

  if (args.config.updateChannel === 'stable') {
    const response = await fetchJson<GithubRelease>(
      args.fetchImpl,
      `https://api.github.com/repos/${repo}/releases/latest`,
      baseHeaders
    );
    return {
      release: response.data,
      etag: response.etag,
      notModified: response.notModified,
    };
  }

  const response = await fetchJson<GithubRelease[]>(
    args.fetchImpl,
    `https://api.github.com/repos/${repo}/releases?per_page=5`,
    baseHeaders
  );
  const releases = response.data || [];
  const pick = releases.find((item) => item.prerelease) || releases[0] || null;
  return {
    release: pick,
    etag: response.etag,
    notModified: response.notModified,
  };
}

export async function runBackgroundUpdateCheck(args: {
  fetchImpl?: typeof fetch;
  config: RuntimeConfig;
  paths: RuntimePaths;
  currentVersion: string;
  logger: RuntimeFileLogger;
}): Promise<void> {
  if (!args.config.autoUpdate) {
    return;
  }
  if (!ALLOWED_REPOS.has(args.config.updateRepo)) {
    args.logger.warn(
      `Auto-update disabled: update repo ${maskSensitive(args.config.updateRepo)} is not in allowed list.`
    );
    return;
  }

  const lock = await acquireUpdateLock(args.paths.lockFile);
  if (!lock) {
    const debug = await readLockDebug(args.paths.lockFile);
    args.logger.debug('Skipping update check because lock is already held.', debug || '');
    return;
  }

  try {
    const state = await readRuntimeState(args.paths.stateFile);
    const now = Date.now();
    if (state.last_update_check_at) {
      const diff = now - Date.parse(state.last_update_check_at);
      if (Number.isFinite(diff) && diff >= 0 && diff < MIN_UPDATE_CHECK_INTERVAL_MS) {
        return;
      }
    }

    const fetchImpl = args.fetchImpl || fetch;
    const latest = await getLatestRelease({
      fetchImpl,
      config: args.config,
      etag: state.update_etag,
    });

    const baseState = {
      ...state,
      last_update_check_at: new Date().toISOString(),
      update_etag: latest.etag,
      update_channel: args.config.updateChannel,
    };

    if (latest.notModified || !latest.release) {
      await writeRuntimeState(args.paths.stateFile, baseState);
      return;
    }

    const releaseVersion = stripLeadingV(latest.release.tag_name);
    if (compareVersion(releaseVersion, args.currentVersion) <= 0) {
      await writeRuntimeState(args.paths.stateFile, {
        ...baseState,
        current_version: args.currentVersion,
      });
      return;
    }

    const assets = pickAssets(latest.release);
    if (!assets) {
      args.logger.warn(
        `Release ${latest.release.tag_name} does not contain expected runtime assets; skipping update.`
      );
      await writeRuntimeState(args.paths.stateFile, baseState);
      return;
    }

    const [runtimeBuffer, sumsBuffer] = await Promise.all([
      downloadBuffer(fetchImpl, assets.runtimeAsset.browser_download_url),
      downloadBuffer(fetchImpl, assets.sumsAsset.browser_download_url),
    ]);

    const checksums = parseSha256Sums(sumsBuffer.toString('utf8'));
    const expected = checksums.get(assets.runtimeAsset.name);
    const actual = sha256Buffer(runtimeBuffer);
    if (!expected || expected !== actual) {
      args.logger.error(
        `Checksum mismatch for ${assets.runtimeAsset.name}: expected=${expected || 'missing'} actual=${actual}`
      );
      await writeRuntimeState(args.paths.stateFile, baseState);
      return;
    }

    const versionDir = path.join(args.paths.versionsDir, `v${releaseVersion}`);
    try {
      await stat(versionDir);
    } catch {
      const tempDir = `${versionDir}.tmp-${Date.now()}`;
      await mkdir(tempDir, { recursive: true });
      await writeFile(path.join(tempDir, 'bridge-main.js'), runtimeBuffer);
      await writeFile(
        path.join(tempDir, 'manifest.json'),
        `${JSON.stringify({ version: releaseVersion, updated_at: new Date().toISOString() }, null, 2)}\n`,
        'utf8'
      );
      await rename(tempDir, versionDir).catch(async () => {
        await rm(tempDir, { recursive: true, force: true });
      });
    }

    await switchCurrentSymlink(args.paths.currentSymlink, versionDir);
    await writeRuntimeState(args.paths.stateFile, {
      ...baseState,
      current_version: releaseVersion,
    });
    args.logger.info(`Updated Claustrum MCP adapter to v${releaseVersion}`);
  } catch (error) {
    args.logger.error('Auto-update check failed', error);
  } finally {
    await lock.release();
  }
}
