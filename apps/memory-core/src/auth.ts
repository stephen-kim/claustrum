import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@claustrum/shared';
import { hashApiKey, legacyHashApiKey } from './security/api-key.js';
import { verifySessionToken } from './security/session-token.js';

export type AuthContext = {
  user: AuthenticatedUser;
  projectAccessBypass: boolean;
  authMethod: 'session' | 'api_key' | 'env_admin';
  mustChangePassword: boolean;
  apiKeyId?: string;
  apiKeyWorkspaceId?: string;
};

export async function authenticateBearerToken(args: {
  prisma: PrismaClient;
  token: string;
  envApiKeys: string[];
  sessionSecret: string;
  apiKeyHashSecret: string;
}): Promise<AuthContext | null> {
  const token = args.token.trim();
  if (!token) {
    return null;
  }

  if (args.envApiKeys.includes(token)) {
    return {
      user: {
        id: 'env-admin',
        email: 'env-admin@local',
        displayName: 'Environment Admin',
        source: 'env',
        envAdmin: true,
      },
      projectAccessBypass: true,
      authMethod: 'env_admin',
      mustChangePassword: false,
    };
  }

  const sessionPayload = verifySessionToken(token, args.sessionSecret);
  if (sessionPayload) {
    const user = await args.prisma.user.findUnique({
      where: { id: sessionPayload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        mustChangePassword: true,
      },
    });
    if (!user) {
      return null;
    }
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.name,
        source: 'database',
      },
      projectAccessBypass: false,
      authMethod: 'session',
      mustChangePassword: user.mustChangePassword,
    };
  }

  const hashed = hashApiKey(token, args.apiKeyHashSecret);
  const legacyHashed = legacyHashApiKey(token);
  let apiKey = await args.prisma.apiKey.findFirst({
    where: {
      keyHash: {
        in: [hashed, legacyHashed],
      },
      revokedAt: null,
    },
    include: {
      user: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  if (apiKey.revokedAt) {
    return null;
  }
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (Math.random() < 0.2) {
    void args.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: {
          lastUsedAt: new Date(),
        },
      })
      .catch(() => {});
  }

  return {
    user: {
      id: apiKey.user.id,
      email: apiKey.user.email,
      displayName: apiKey.user.name,
      source: 'database',
    },
    projectAccessBypass: false,
    authMethod: 'api_key',
    mustChangePassword: apiKey.user.mustChangePassword,
    apiKeyId: apiKey.id,
    apiKeyWorkspaceId: apiKey.workspaceId,
  };
}

export function extractBearerToken(headerValue?: string): string | null {
  if (!headerValue) {
    return null;
  }
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }
  return match[1].trim();
}
