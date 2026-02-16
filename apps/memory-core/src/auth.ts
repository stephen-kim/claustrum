import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '@context-sync/shared';

export type AuthContext = {
  user: AuthenticatedUser;
  projectAccessBypass: boolean;
};

export async function authenticateBearerToken(args: {
  prisma: PrismaClient;
  token: string;
  envApiKeys: string[];
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
    };
  }

  const apiKey = await args.prisma.apiKey.findFirst({
    where: {
      key: token,
      revokedAt: null,
    },
    include: {
      user: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  return {
    user: {
      id: apiKey.user.id,
      email: apiKey.user.email,
      displayName: apiKey.user.name,
      source: 'database',
    },
    projectAccessBypass: false,
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
