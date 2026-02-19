import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

export type RuntimeLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type RuntimeConfig = {
  claustrumHome: string;
  baseUrl: string;
  apiKey: string;
  bearerToken: string;
  workspaceKey: string;
  deviceLabel: string;
  requestTimeoutMs: number;
  requestRetryCount: number;
  logLevel: RuntimeLogLevel;
  autoUpdate: boolean;
  updateChannel: 'stable' | 'beta';
  updateRepo: string;
};

const envSchema = z
  .object({
    CLAUSTRUM_HOME: z.string().trim().optional(),
    CLAUSTRUM_BASE_URL: z.string().trim().optional(),
    CLAUSTRUM_API_KEY: z.string().trim().optional(),
    CLAUSTRUM_AUTH_TOKEN: z.string().trim().optional(),
    CLAUSTRUM_WORKSPACE_KEY: z.string().trim().optional(),
    CLAUSTRUM_DEVICE_LABEL: z.string().trim().optional(),
    CLAUSTRUM_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).optional(),
    CLAUSTRUM_REQUEST_RETRY_COUNT: z.coerce.number().int().min(0).max(2).optional(),
    CLAUSTRUM_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    CLAUSTRUM_AUTO_UPDATE: z.enum(['true', 'false']).optional(),
    CLAUSTRUM_UPDATE_CHANNEL: z.enum(['stable', 'beta']).optional(),
    CLAUSTRUM_UPDATE_REPO: z.string().trim().optional(),
  })
  .passthrough();

const DEFAULT_HOME = path.join(os.homedir(), '.claustrum');
export const MAX_TOTAL_LOG_BYTES = 10 * 1024 * 1024;
export const MAX_INFO_LOG_BYTES = 5 * 1024 * 1024;
export const MAX_ERROR_LOG_BYTES = 5 * 1024 * 1024;
export const DEFAULT_UPDATE_REPO = 'stephen-kim/claustrum';

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { requireBaseUrl?: boolean } = {}
): RuntimeConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid Claustrum runtime config: ${detail}`);
  }

  const values = parsed.data;
  const requireBaseUrl = options.requireBaseUrl ?? true;
  const baseUrlRaw = values.CLAUSTRUM_BASE_URL || '';
  if (requireBaseUrl && !baseUrlRaw) {
    throw new Error('Invalid Claustrum runtime config: CLAUSTRUM_BASE_URL is required.');
  }
  if (baseUrlRaw) {
    const parsedUrl = z.string().url('CLAUSTRUM_BASE_URL must be a valid URL').safeParse(baseUrlRaw);
    if (!parsedUrl.success) {
      throw new Error(
        `Invalid Claustrum runtime config: CLAUSTRUM_BASE_URL: ${parsedUrl.error.issues[0]?.message || 'invalid URL'}`
      );
    }
  }
  const baseUrl = baseUrlRaw.replace(/\/+$/, '');
  return {
    claustrumHome: values.CLAUSTRUM_HOME || DEFAULT_HOME,
    baseUrl,
    apiKey: values.CLAUSTRUM_API_KEY || '',
    bearerToken: values.CLAUSTRUM_AUTH_TOKEN || '',
    workspaceKey: values.CLAUSTRUM_WORKSPACE_KEY || 'personal',
    deviceLabel: values.CLAUSTRUM_DEVICE_LABEL || os.hostname(),
    requestTimeoutMs: values.CLAUSTRUM_REQUEST_TIMEOUT_MS ?? 15000,
    requestRetryCount: values.CLAUSTRUM_REQUEST_RETRY_COUNT ?? 1,
    logLevel: values.CLAUSTRUM_LOG_LEVEL || 'error',
    autoUpdate: values.CLAUSTRUM_AUTO_UPDATE !== 'false',
    updateChannel: values.CLAUSTRUM_UPDATE_CHANNEL || 'stable',
    updateRepo: values.CLAUSTRUM_UPDATE_REPO || DEFAULT_UPDATE_REPO,
  };
}

export function getRuntimePaths(claustrumHome: string) {
  const adapterDir = path.join(claustrumHome, 'adapter');
  return {
    homeDir: claustrumHome,
    binDir: path.join(claustrumHome, 'bin'),
    adapterDir,
    versionsDir: path.join(adapterDir, 'versions'),
    currentSymlink: path.join(adapterDir, 'current'),
    logsDir: path.join(claustrumHome, 'logs'),
    stateFile: path.join(claustrumHome, 'state.json'),
    lockFile: path.join(claustrumHome, 'update.lock'),
    launcherPath: path.join(claustrumHome, 'bin', 'claustrum-mcp'),
  };
}

export function assertHttpsBaseUrl(baseUrl: string): { secure: boolean; warning?: string } {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol === 'https:') {
      return { secure: true };
    }
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    if (parsed.protocol === 'http:' && localHosts.has(parsed.hostname)) {
      return { secure: false, warning: 'Using HTTP for localhost only.' };
    }
    return {
      secure: false,
      warning:
        'Non-HTTPS CLAUSTRUM_BASE_URL detected. Production deployments should use HTTPS only.',
    };
  } catch {
    return {
      secure: false,
      warning: 'Unable to parse CLAUSTRUM_BASE_URL for HTTPS enforcement.',
    };
  }
}
