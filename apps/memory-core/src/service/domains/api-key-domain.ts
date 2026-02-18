import {
  Prisma,
  type ProjectRole,
  type WorkspaceRole,
  type AuthContext,
  assertProjectAccess,
  assertWorkspaceAdmin,
  assertWorkspaceAccess,
  AuthenticationError,
  AuthorizationError,
  GoneError,
  NotFoundError,
  ValidationError,
  hashPassword,
  verifyPassword,
  issueSessionToken,
  generateApiKey,
  generateInvitationToken,
  hashApiKey,
  hashOneTimeToken,
  issueOneTimeKeyToken,
  verifyOneTimeKeyToken,
  type AuthInviteApiKeyDeps,
} from './auth-invite-api-key-shared.js';

export async function createSelfApiKeyDomain(
  deps: AuthInviteApiKeyDeps,
  args: { auth: AuthContext; label?: string; ip?: string }
): Promise<{
  id: string;
  label: string | null;
  api_key: string;
}> {
  if (!args.auth.user.id || args.auth.user.source !== 'database') {
    throw new AuthorizationError('Only authenticated users can create API keys.');
  }
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey, deps.securityConfig.apiKeyHashSecret);
  const created = await deps.prisma.apiKey.create({
    data: {
      key: null,
      keyHash,
      userId: args.auth.user.id,
      createdByUserId: args.auth.user.id,
      label: args.label?.trim() || 'self-generated',
    },
    select: {
      id: true,
      label: true,
    },
  });
  const auditWorkspace = await deps.resolveAuditWorkspaceForUser(args.auth.user.id);
  if (auditWorkspace) {
    await deps.recordAudit({
      workspaceId: auditWorkspace.id,
      workspaceKey: auditWorkspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'api_key.created',
      target: {
        target_user_id: args.auth.user.id,
        api_key_id: created.id,
        actor_user_id: args.auth.user.id,
        ip: args.ip || null,
      },
    });
  }
  return {
    id: created.id,
    label: created.label,
    api_key: plainKey,
  };
}

export async function listOwnApiKeysDomain(
  deps: AuthInviteApiKeyDeps,
  args: { auth: AuthContext }
): Promise<{
  keys: Array<{
    id: string;
    label: string | null;
    created_at: Date;
    last_used_at: Date | null;
    revoked_at: Date | null;
    created_by_user_id: string | null;
  }>;
}> {
  const keys = await deps.prisma.apiKey.findMany({
    where: {
      userId: args.auth.user.id,
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdByUserId: true,
    },
  });
  return {
    keys: keys.map((key) => ({
      id: key.id,
      label: key.label,
      created_at: key.createdAt,
      last_used_at: key.lastUsedAt,
      revoked_at: key.revokedAt,
      created_by_user_id: key.createdByUserId,
    })),
  };
}

export async function listUserApiKeysDomain(
  deps: AuthInviteApiKeyDeps,
  args: { auth: AuthContext; userId: string }
): Promise<{
  user_id: string;
  keys: Array<{
    id: string;
    label: string | null;
    created_at: Date;
    last_used_at: Date | null;
    revoked_at: Date | null;
    created_by_user_id: string | null;
  }>;
}> {
  if (!(await deps.canManageUserKeys(args.auth, args.userId))) {
    throw new AuthorizationError('Not allowed to view API keys for this user.');
  }
  const keys = await deps.prisma.apiKey.findMany({
    where: {
      userId: args.userId,
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdByUserId: true,
    },
  });
  return {
    user_id: args.userId,
    keys: keys.map((key) => ({
      id: key.id,
      label: key.label,
      created_at: key.createdAt,
      last_used_at: key.lastUsedAt,
      revoked_at: key.revokedAt,
      created_by_user_id: key.createdByUserId,
    })),
  };
}

export async function revokeApiKeyDomain(
  deps: AuthInviteApiKeyDeps,
  args: { auth: AuthContext; apiKeyId: string; ip?: string }
): Promise<{ revoked: true; api_key_id: string }> {
  const row = await deps.prisma.apiKey.findUnique({
    where: { id: args.apiKeyId },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
    },
  });
  if (!row) {
    throw new NotFoundError('API key not found');
  }
  if (!(await deps.canManageUserKeys(args.auth, row.userId))) {
    throw new AuthorizationError('Not allowed to revoke this API key.');
  }
  if (!row.revokedAt) {
    await deps.prisma.apiKey.update({
      where: { id: row.id },
      data: {
        revokedAt: new Date(),
      },
    });
  }
  const auditWorkspace = await deps.resolveAuditWorkspaceForUser(row.userId);
  if (auditWorkspace) {
    await deps.recordAudit({
      workspaceId: auditWorkspace.id,
      workspaceKey: auditWorkspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'api_key.revoked',
      target: {
        target_user_id: row.userId,
        api_key_id: row.id,
        actor_user_id: args.auth.user.id,
        ip: args.ip || null,
      },
    });
  }
  return {
    revoked: true,
    api_key_id: row.id,
  };
}

export async function resetUserApiKeysDomain(
  deps: AuthInviteApiKeyDeps,
  args: { auth: AuthContext; userId: string; requestBaseUrl?: string; ip?: string }
): Promise<{ one_time_url: string; expires_at: string }> {
  if (!(await deps.canManageUserKeys(args.auth, args.userId))) {
    throw new AuthorizationError('Not allowed to reset API keys for this user.');
  }
  const user = await deps.prisma.user.findUnique({
    where: { id: args.userId },
    select: { id: true },
  });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey, deps.securityConfig.apiKeyHashSecret);
  const expiresAt = new Date(Date.now() + deps.securityConfig.oneTimeTokenTtlSeconds * 1000);

  const result = await deps.prisma.$transaction(async (tx) => {
    await tx.apiKey.updateMany({
      where: {
        userId: args.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    const created = await tx.apiKey.create({
      data: {
        key: null,
        keyHash,
        label: 'reset-generated',
        userId: args.userId,
        createdByUserId: args.auth.user.id,
      },
      select: { id: true },
    });
    const token = issueOneTimeKeyToken({
      apiKeyId: created.id,
      apiKey: plainKey,
      userId: args.userId,
      expiresAtUnixMs: expiresAt.getTime(),
      secret: deps.securityConfig.oneTimeTokenSecret,
    });
    const tokenHash = hashOneTimeToken(token, deps.securityConfig.oneTimeTokenSecret);
    await tx.apiKeyOneTimeToken.create({
      data: {
        apiKeyId: created.id,
        tokenHash,
        expiresAt,
        createdByUserId: args.auth.user.id,
      },
    });
    return {
      apiKeyId: created.id,
      token,
    };
  });

  const baseUrl = (deps.securityConfig.publicBaseUrl || args.requestBaseUrl || '').replace(/\/$/, '');
  const oneTimeUrl = `${baseUrl}/v1/api-keys/one-time/${encodeURIComponent(result.token)}`;

  const auditWorkspace = await deps.resolveAuditWorkspaceForUser(args.userId);
  if (auditWorkspace) {
    await deps.recordAudit({
      workspaceId: auditWorkspace.id,
      workspaceKey: auditWorkspace.key,
      actorUserId: args.auth.user.id,
      actorUserEmail: args.auth.user.email,
      action: 'api_key.reset',
      target: {
        target_user_id: args.userId,
        api_key_id: result.apiKeyId,
        actor_user_id: args.auth.user.id,
        ip: args.ip || null,
      },
    });
  }

  return {
    one_time_url: oneTimeUrl,
    expires_at: expiresAt.toISOString(),
  };
}

export async function viewOneTimeApiKeyDomain(
  deps: AuthInviteApiKeyDeps,
  args: { token: string; ip?: string }
): Promise<{ api_key: string; api_key_id: string; expires_at: string }> {
  const tokenHash = hashOneTimeToken(args.token, deps.securityConfig.oneTimeTokenSecret);
  const row = await deps.prisma.apiKeyOneTimeToken.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      apiKeyId: true,
      usedAt: true,
      expiresAt: true,
      createdByUserId: true,
      apiKey: {
        select: {
          userId: true,
        },
      },
    },
  });
  if (!row) {
    throw new NotFoundError('One-time token not found');
  }
  if (row.usedAt) {
    throw new GoneError('One-time token already used');
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new GoneError('One-time token expired');
  }
  const payload = verifyOneTimeKeyToken(args.token, deps.securityConfig.oneTimeTokenSecret);
  if (!payload || payload.api_key_id !== row.apiKeyId) {
    throw new AuthorizationError('Invalid one-time token payload');
  }
  const consumedAt = new Date();
  // Single-use guarantee: claim token with compare-and-set semantics.
  // This prevents concurrent readers from reusing the same one-time payload.
  const consumed = await deps.prisma.apiKeyOneTimeToken.updateMany({
    where: {
      id: row.id,
      usedAt: null,
      expiresAt: {
        gt: consumedAt,
      },
    },
    data: {
      usedAt: consumedAt,
    },
  });
  if (consumed.count === 0) {
    throw new GoneError('One-time token already used');
  }

  const auditWorkspace = await deps.resolveAuditWorkspaceForUser(row.apiKey.userId);
  if (auditWorkspace) {
    await deps.recordAudit({
      workspaceId: auditWorkspace.id,
      workspaceKey: auditWorkspace.key,
      actorUserId: row.createdByUserId || row.apiKey.userId,
      action: 'api_key.one_time_view',
      target: {
        target_user_id: row.apiKey.userId,
        api_key_id: row.apiKeyId,
        actor_user_id: row.createdByUserId || row.apiKey.userId,
        ip: args.ip || null,
      },
    });
  }

  return {
    api_key: payload.api_key,
    api_key_id: row.apiKeyId,
    expires_at: row.expiresAt.toISOString(),
  };
}
