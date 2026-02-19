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
  buildApiKeyPrefix,
  hashApiKey,
  hashOneTimeToken,
  issueOneTimeKeyToken,
  verifyOneTimeKeyToken,
  type AuthInviteApiKeyDeps,
} from './auth-invite-api-key-shared.js';

function parseOptionalExpiry(raw?: string): Date | null {
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw new ValidationError('expires_at must be a valid ISO datetime.');
  }
  if (parsed.getTime() <= Date.now()) {
    throw new ValidationError('expires_at must be in the future.');
  }
  return parsed;
}

function requireDeviceLabel(raw?: string): string {
  const label = (raw || '').trim();
  if (!label) {
    throw new ValidationError('device_label is required.');
  }
  if (label.length > 120) {
    throw new ValidationError('device_label must be 120 chars or fewer.');
  }
  return label;
}

async function resolveWorkspaceScopeForUser(args: {
  deps: AuthInviteApiKeyDeps;
  userId: string;
  workspaceKey?: string;
}): Promise<{ id: string; key: string }> {
  if (args.workspaceKey) {
    const workspace = await args.deps.getWorkspaceByKey(args.workspaceKey);
    const membership = await args.deps.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: args.userId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ValidationError('Target user is not a member of the selected workspace.');
    }
    return workspace;
  }

  const membership = await args.deps.prisma.workspaceMember.findFirst({
    where: { userId: args.userId },
    orderBy: [{ createdAt: 'asc' }],
    include: {
      workspace: {
        select: {
          id: true,
          key: true,
        },
      },
    },
  });
  if (!membership) {
    throw new ValidationError('No workspace membership found for user; provide workspace_key explicitly.');
  }
  return membership.workspace;
}

export async function createSelfApiKeyDomain(
  deps: AuthInviteApiKeyDeps,
  args: {
    auth: AuthContext;
    label?: string;
    workspaceKey?: string;
    deviceLabel: string;
    expiresAt?: string;
    ip?: string;
  }
): Promise<{
  id: string;
  label: string | null;
  workspace_key: string;
  key_prefix: string;
  device_label: string;
  expires_at: string | null;
  api_key: string;
}> {
  if (!args.auth.user.id || args.auth.user.source !== 'database') {
    throw new AuthorizationError('Only authenticated users can create API keys.');
  }
  const workspace = await resolveWorkspaceScopeForUser({
    deps,
    userId: args.auth.user.id,
    workspaceKey: args.workspaceKey,
  });
  const deviceLabel = requireDeviceLabel(args.deviceLabel);
  const expiresAt = parseOptionalExpiry(args.expiresAt);
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey, deps.securityConfig.apiKeyHashSecret);
  const keyPrefix = buildApiKeyPrefix(plainKey);
  const created = await deps.prisma.apiKey.create({
    data: {
      key: null,
      workspaceId: workspace.id,
      keyHash,
      keyPrefix,
      deviceLabel,
      expiresAt,
      userId: args.auth.user.id,
      createdByUserId: args.auth.user.id,
      label: args.label?.trim() || 'self-generated',
    },
    select: {
      id: true,
      label: true,
    },
  });
  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'api_key.created',
    target: {
      target_user_id: args.auth.user.id,
      api_key_id: created.id,
      actor_user_id: args.auth.user.id,
      device_label: deviceLabel,
      key_prefix: keyPrefix,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      ip: args.ip || null,
    },
  });
  return {
    id: created.id,
    label: created.label,
    workspace_key: workspace.key,
    key_prefix: keyPrefix,
    device_label: deviceLabel,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
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
    workspace_key: string;
    key_prefix: string;
    device_label: string;
    expires_at: Date | null;
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
      keyPrefix: true,
      deviceLabel: true,
      expiresAt: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdByUserId: true,
      workspace: {
        select: {
          key: true,
        },
      },
    },
  });
  return {
    keys: keys.map((key) => ({
      id: key.id,
      label: key.label,
      workspace_key: key.workspace.key,
      key_prefix: key.keyPrefix,
      device_label: key.deviceLabel,
      expires_at: key.expiresAt,
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
    workspace_key: string;
    key_prefix: string;
    device_label: string;
    expires_at: Date | null;
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
      keyPrefix: true,
      deviceLabel: true,
      expiresAt: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdByUserId: true,
      workspace: {
        select: {
          key: true,
        },
      },
    },
  });
  return {
    user_id: args.userId,
    keys: keys.map((key) => ({
      id: key.id,
      label: key.label,
      workspace_key: key.workspace.key,
      key_prefix: key.keyPrefix,
      device_label: key.deviceLabel,
      expires_at: key.expiresAt,
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
      workspaceId: true,
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
  const workspace = await deps.prisma.workspace.findUnique({
    where: { id: row.workspaceId },
    select: { id: true, key: true },
  });
  if (workspace) {
    await deps.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
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
  args: {
    auth: AuthContext;
    userId: string;
    workspaceKey?: string;
    deviceLabel: string;
    expiresAt?: string;
    requestBaseUrl?: string;
    ip?: string;
  }
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
  const workspace = await resolveWorkspaceScopeForUser({
    deps,
    userId: args.userId,
    workspaceKey: args.workspaceKey,
  });
  const deviceLabel = requireDeviceLabel(args.deviceLabel);

  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey, deps.securityConfig.apiKeyHashSecret);
  const expiresAt = parseOptionalExpiry(args.expiresAt);
  const oneTimeExpiresAt = new Date(Date.now() + deps.securityConfig.oneTimeTokenTtlSeconds * 1000);
  const keyPrefix = buildApiKeyPrefix(plainKey);

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
        workspaceId: workspace.id,
        keyPrefix,
        deviceLabel,
        expiresAt,
        createdByUserId: args.auth.user.id,
      },
      select: { id: true },
    });
    const token = issueOneTimeKeyToken({
      apiKeyId: created.id,
      apiKey: plainKey,
      userId: args.userId,
      expiresAtUnixMs: oneTimeExpiresAt.getTime(),
      secret: deps.securityConfig.oneTimeTokenSecret,
    });
    const tokenHash = hashOneTimeToken(token, deps.securityConfig.oneTimeTokenSecret);
    await tx.apiKeyOneTimeToken.create({
      data: {
        apiKeyId: created.id,
        tokenHash,
        expiresAt: oneTimeExpiresAt,
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

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'api_key.reset',
    target: {
      target_user_id: args.userId,
      api_key_id: result.apiKeyId,
      actor_user_id: args.auth.user.id,
      device_label: deviceLabel,
      key_prefix: keyPrefix,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      ip: args.ip || null,
    },
  });

  return {
    one_time_url: oneTimeUrl,
    expires_at: oneTimeExpiresAt.toISOString(),
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
