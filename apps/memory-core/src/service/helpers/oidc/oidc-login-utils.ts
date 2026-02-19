import { createHash, randomBytes } from 'node:crypto';
import { ValidationError } from '../../errors.js';

export function pkceCodeVerifier(): string {
  return randomBytes(48).toString('base64url');
}

export function pkceCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function nonceValue(): string {
  return randomBytes(24).toString('base64url');
}

export function resolveRedirectUri(args: {
  workspaceKey: string;
  requestBaseUrl?: string;
  configuredBaseUrl?: string;
}): string {
  const baseUrl = (args.configuredBaseUrl || args.requestBaseUrl || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new ValidationError('public base URL is required to start OIDC login');
  }
  return `${baseUrl}/v1/auth/oidc/${encodeURIComponent(args.workspaceKey)}/callback`;
}
