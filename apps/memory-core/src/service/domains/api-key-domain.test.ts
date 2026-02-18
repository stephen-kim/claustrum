import test from 'node:test';
import assert from 'node:assert/strict';
import { GoneError } from '../errors.js';
import { issueOneTimeKeyToken } from '../../security/one-time-key-token.js';
import { viewOneTimeApiKeyDomain } from './api-key-domain.js';
import type { AuthInviteApiKeyDeps } from './auth-invite-api-key-shared.js';

test('viewOneTimeApiKeyDomain rejects when atomic consume fails', async () => {
  const now = Date.now();
  const token = issueOneTimeKeyToken({
    apiKeyId: 'api-key-1',
    apiKey: 'plain-key-123',
    userId: 'user-1',
    expiresAtUnixMs: now + 60_000,
    secret: 'unit-secret',
  });

  const deps = {
    prisma: {
      apiKeyOneTimeToken: {
        findUnique: async () => ({
          id: 'token-row-1',
          apiKeyId: 'api-key-1',
          usedAt: null,
          expiresAt: new Date(now + 60_000),
          createdByUserId: 'admin-1',
          apiKey: { userId: 'user-1' },
        }),
        updateMany: async () => ({ count: 0 }),
      },
    },
    securityConfig: {
      apiKeyHashSecret: 'unused',
      oneTimeTokenSecret: 'unit-secret',
      oneTimeTokenTtlSeconds: 900,
      githubStateSecret: 'unused',
      publicBaseUrl: undefined,
      inviteBaseUrl: undefined,
      githubAppId: undefined,
      githubAppPrivateKey: undefined,
      githubAppWebhookSecret: undefined,
      githubAppName: undefined,
      githubAppUrl: undefined,
    },
    getWorkspaceByKey: async () => {
      throw new Error('not used');
    },
    normalizeInviteProjectRoles: () => ({}),
    resolveAuditWorkspaceForUser: async () => null,
    canManageUserKeys: async () => true,
    recordAudit: async () => undefined,
  } as unknown as AuthInviteApiKeyDeps;

  await assert.rejects(
    () =>
      viewOneTimeApiKeyDomain(deps, {
        token,
      }),
    (error) => error instanceof GoneError && error.message.includes('already used')
  );
});
