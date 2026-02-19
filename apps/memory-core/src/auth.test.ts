import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateBearerToken, extractBearerToken } from './auth.js';
import { hashApiKey } from './security/api-key.js';

test('authenticateBearerToken accepts valid hashed key', async () => {
  const token = 'claustrum_test_key';
  const expectedHash = hashApiKey(token, 'test-hash-secret');
  const prisma = {
    apiKey: {
      findFirst: async (args: { where: { keyHash?: { in: string[] } } }) => {
        if (!args.where.keyHash?.in?.includes(expectedHash)) {
          return null;
        }
        return {
          id: 'key-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          workspaceId: 'ws-1',
          user: { id: 'user-1', email: 'user@example.com', name: 'User' },
        };
      },
      update: async () => ({}),
    },
  };

  const random = Math.random;
  Math.random = () => 1;
  try {
    const auth = await authenticateBearerToken({
      prisma: prisma as never,
      token,
      envApiKeys: [],
      sessionSecret: 'test-secret',
      apiKeyHashSecret: 'test-hash-secret',
    });
    assert.ok(auth);
    assert.equal(auth?.user.id, 'user-1');
    assert.equal(auth?.projectAccessBypass, false);
    assert.equal(auth?.apiKeyId, 'key-1');
    assert.equal(auth?.apiKeyWorkspaceId, 'ws-1');
  } finally {
    Math.random = random;
  }
});

test('authenticateBearerToken rejects revoked or unknown key', async () => {
  const prisma = {
    apiKey: {
      findFirst: async () => ({
        id: 'key-revoked',
        revokedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: null,
        workspaceId: 'ws-1',
        user: { id: 'user-1', email: 'user@example.com', name: 'User' },
      }),
      update: async () => ({}),
    },
  };

  const auth = await authenticateBearerToken({
    prisma: prisma as never,
    token: 'missing-key',
    envApiKeys: [],
    sessionSecret: 'test-secret',
    apiKeyHashSecret: 'test-hash-secret',
  });
  assert.equal(auth, null);
});

test('authenticateBearerToken rejects expired key', async () => {
  const token = 'claustrum_test_key';
  const expectedHash = hashApiKey(token, 'test-hash-secret');
  const prisma = {
    apiKey: {
      findFirst: async (args: { where: { keyHash?: { in: string[] } } }) => {
        if (!args.where.keyHash?.in?.includes(expectedHash)) {
          return null;
        }
        return {
          id: 'key-expired',
          revokedAt: null,
          expiresAt: new Date(Date.now() - 60_000),
          workspaceId: 'ws-1',
          user: { id: 'user-1', email: 'user@example.com', name: 'User' },
        };
      },
      update: async () => ({}),
    },
  };

  const auth = await authenticateBearerToken({
    prisma: prisma as never,
    token,
    envApiKeys: [],
    sessionSecret: 'test-secret',
    apiKeyHashSecret: 'test-hash-secret',
  });
  assert.equal(auth, null);
});

test('extractBearerToken handles missing/malformed/valid headers', () => {
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken('Basic abc'), null);
  assert.equal(extractBearerToken('Bearer abc123'), 'abc123');
});
