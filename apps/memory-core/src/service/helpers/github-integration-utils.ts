import type {
  GithubAccountType,
  GithubRepositorySelection,
} from '@prisma/client';
import type { GithubAppInstallationResponse } from './github/github-api-client.js';
import { ValidationError } from '../errors.js';

export function normalizeProjectKeyPrefix(prefix: string): string {
  const value = String(prefix || '').trim();
  return value || 'github:';
}

export function normalizeGithubRepoFullName(fullName: string): string | null {
  const normalized = String(fullName || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\s+/g, '');
  if (!normalized || !normalized.includes('/')) {
    return null;
  }
  const [owner, repo] = normalized.split('/', 2);
  if (!owner || !repo) {
    return null;
  }
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

export function parseGithubBigInt(value: string, fieldName: string): bigint {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new ValidationError(`${fieldName} must be a numeric string.`);
  }
  return BigInt(normalized);
}

export function resolveInstallBaseUrl(config: {
  githubAppName?: string;
  githubAppUrl?: string;
}): string {
  const explicitUrl = (config.githubAppUrl || '').trim();
  if (explicitUrl) {
    return `${explicitUrl.replace(/\/+$/, '')}/installations/new`;
  }
  const appName = (config.githubAppName || '').trim();
  if (appName) {
    return `https://github.com/apps/${encodeURIComponent(appName)}/installations/new`;
  }
  throw new ValidationError(
    'GitHub App is not configured. Set GITHUB_APP_NAME or GITHUB_APP_URL.'
  );
}

export function requireGithubAppConfig(config: {
  githubAppId?: string;
  githubAppPrivateKey?: string;
}): {
  appId: string;
  privateKey: string;
} {
  const appId = (config.githubAppId || '').trim();
  const privateKey = (config.githubAppPrivateKey || '').trim();
  if (!appId || !privateKey) {
    throw new ValidationError(
      'GitHub App credentials are missing. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.'
    );
  }
  return { appId, privateKey };
}

export function normalizeInstallationPayload(payload: GithubAppInstallationResponse): {
  accountType: GithubAccountType;
  accountLogin: string;
  repositorySelection: GithubRepositorySelection;
  permissions: Record<string, string>;
} {
  const accountType = payload.account?.type === 'Organization' ? 'Organization' : 'User';
  const accountLogin = (payload.account?.login || '').trim();
  if (!accountLogin) {
    throw new ValidationError(
      'GitHub installation payload is missing account login.'
    );
  }

  const selectionRaw = (payload.repository_selection || '').trim().toLowerCase();
  const repositorySelection: GithubRepositorySelection =
    selectionRaw === 'all'
      ? 'all'
      : selectionRaw === 'selected'
      ? 'selected'
      : 'unknown';

  return {
    accountType,
    accountLogin,
    repositorySelection,
    permissions: toStringMap(payload.permissions),
  };
}

export function toStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string') {
      out[key] = item;
    }
  }
  return out;
}
