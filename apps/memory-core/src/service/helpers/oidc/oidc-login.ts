import { OidcSyncMode, ProjectRole, WorkspaceRole } from '@prisma/client';
import { issueSessionToken } from '../../../security/session-token.js';
import { issueOidcStateToken, verifyOidcStateToken } from '../../../security/oidc-state-token.js';
import { AuthorizationError, AuthenticationError, NotFoundError, ValidationError } from '../../errors.js';
import { getEffectiveWorkspaceSettings } from '../../workspace-resolution.js';
import {
  buildAccessAuditParams,
  resolveAccessAuditAction,
} from '../access-audit-helpers.js';
import { fetchDiscovery, resolveIdentityClaims } from './oidc-discovery.js';
import {
  chooseHigherProjectRole,
  chooseHigherWorkspaceRole,
  normalizeIssuer,
  nowIso,
  toProjectRole,
  toWorkspaceRole,
  type OidcBaseDeps,
} from './oidc-types.js';
import {
  nonceValue,
  pkceCodeChallenge,
  pkceCodeVerifier,
  resolveRedirectUri,
} from './oidc-login-utils.js';

export async function startOidcLoginHandler(
  deps: OidcBaseDeps,
  args: {
    workspaceKey: string;
    requestBaseUrl?: string;
    providerId?: string;
  }
): Promise<{
  authorization_url: string;
  state: string;
  provider: {
    id: string;
    name: string;
    issuer_url: string;
    claim_groups_name: string;
    claim_groups_format: 'id' | 'name';
  };
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  const provider = await deps.prisma.oidcProvider.findFirst({
    where: {
      workspaceId: workspace.id,
      enabled: true,
      ...(args.providerId ? { id: args.providerId } : {}),
    },
    orderBy: [{ createdAt: 'asc' }],
  });
  if (!provider) {
    throw new NotFoundError('No enabled OIDC provider configured for this workspace');
  }
  if (!provider.discoveryEnabled) {
    throw new ValidationError('OIDC provider with discovery disabled is not supported in this build');
  }

  const discovery = await fetchDiscovery(provider.issuerUrl);
  const redirectUri = resolveRedirectUri({
    workspaceKey: workspace.key,
    requestBaseUrl: args.requestBaseUrl,
    configuredBaseUrl: deps.securityConfig.publicBaseUrl,
  });

  const verifier = pkceCodeVerifier();
  const challenge = pkceCodeChallenge(verifier);
  const nonce = nonceValue();
  const state = issueOidcStateToken({
    workspaceKey: workspace.key,
    providerId: provider.id,
    codeVerifier: verifier,
    nonce,
    redirectUri,
    secret: deps.securityConfig.oneTimeTokenSecret,
    ttlSeconds: 600,
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    scope: provider.scopes.trim() || 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    nonce,
  });

  return {
    authorization_url: `${discovery.authorization_endpoint}?${params.toString()}`,
    state,
    provider: {
      id: provider.id,
      name: provider.name,
      issuer_url: provider.issuerUrl,
      claim_groups_name: provider.claimGroupsName,
      claim_groups_format: provider.claimGroupsFormat,
    },
  };
}

export async function finishOidcLoginHandler(
  deps: OidcBaseDeps,
  args: {
    workspaceKey: string;
    code: string;
    state: string;
    sessionSecret: string;
    sessionTtlSeconds: number;
  }
): Promise<{
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    must_change_password: boolean;
    email_verified: boolean;
  };
  workspace_key: string;
  provider: {
    id: string;
    name: string;
  };
  mapping: {
    sync_mode: OidcSyncMode;
    matched_mapping_ids: string[];
    applied_workspace_role: WorkspaceRole | null;
    applied_project_count: number;
    removed_project_count: number;
  };
}> {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  const statePayload = verifyOidcStateToken(args.state, deps.securityConfig.oneTimeTokenSecret);
  if (!statePayload) {
    throw new AuthenticationError('Invalid or expired OIDC state');
  }
  if (statePayload.workspace_key !== workspace.key) {
    throw new AuthenticationError('OIDC state workspace mismatch');
  }

  const provider = await deps.prisma.oidcProvider.findFirst({
    where: {
      id: statePayload.provider_id,
      workspaceId: workspace.id,
      enabled: true,
    },
  });
  if (!provider) {
    throw new NotFoundError('OIDC provider not found or disabled');
  }

  const discovery = await fetchDiscovery(provider.issuerUrl);
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      redirect_uri: statePayload.redirect_uri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: statePayload.code_verifier,
    }),
  });

  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenResponse.ok) {
    throw new AuthenticationError(
      tokenPayload.error_description || tokenPayload.error || 'OIDC token exchange failed'
    );
  }

  const claims = await resolveIdentityClaims({
    provider: {
      issuerUrl: provider.issuerUrl,
      clientId: provider.clientId,
      claimGroupsName: provider.claimGroupsName,
      claimGroupsFormat: provider.claimGroupsFormat,
    },
    discovery,
    idToken: tokenPayload.id_token,
    accessToken: tokenPayload.access_token,
    expectedNonce: statePayload.nonce,
  });

  const settings = await getEffectiveWorkspaceSettings(deps.prisma, workspace.id);

  const existingIdentity = await deps.prisma.userIdentity.findFirst({
    where: {
      providerId: provider.id,
      issuer: normalizeIssuer(claims.issuer),
      subject: claims.subject,
    },
    include: { user: true },
  });

  let user = existingIdentity?.user || null;
  if (!user && claims.email) {
    user = await deps.prisma.user.findUnique({ where: { email: claims.email } });
  }

  if (!user) {
    if (!settings.oidcAllowAutoProvision) {
      throw new AuthorizationError('OIDC auto provisioning is disabled for this workspace');
    }
    if (!claims.email) {
      throw new ValidationError('OIDC identity has no email; cannot auto-provision user');
    }
    user = await deps.prisma.user.create({
      data: {
        email: claims.email,
        name: claims.name || null,
        passwordHash: null,
        mustChangePassword: false,
        emailVerified: true,
      },
    });
  } else if (claims.email && claims.email !== user.email) {
    try {
      user = await deps.prisma.user.update({
        where: { id: user.id },
        data: {
          email: claims.email,
          name: claims.name || user.name,
          emailVerified: true,
        },
      });
    } catch {
      // Ignore email conflicts.
    }
  }

  await deps.prisma.userIdentity.upsert({
    where: {
      providerId_issuer_subject: {
        providerId: provider.id,
        issuer: normalizeIssuer(claims.issuer),
        subject: claims.subject,
      },
    },
    update: {
      userId: user.id,
      workspaceId: workspace.id,
      email: claims.email || null,
    },
    create: {
      userId: user.id,
      providerId: provider.id,
      workspaceId: workspace.id,
      issuer: normalizeIssuer(claims.issuer),
      subject: claims.subject,
      email: claims.email || null,
    },
  });

  const mappings = await deps.prisma.oidcGroupMapping.findMany({
    where: {
      workspaceId: workspace.id,
      providerId: provider.id,
      enabled: true,
      claimName: provider.claimGroupsName,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });

  const groupSet = new Set(claims.groups);
  const matchedMappings = mappings.filter((mapping) => groupSet.has(mapping.groupId));

  let desiredWorkspaceRole: WorkspaceRole | null = null;
  const desiredProjectRoles = new Map<string, ProjectRole>();

  for (const mapping of matchedMappings) {
    if (mapping.targetType === 'workspace' && (mapping.targetKey === workspace.key || mapping.targetKey === '*')) {
      desiredWorkspaceRole = chooseHigherWorkspaceRole(desiredWorkspaceRole, toWorkspaceRole(mapping.role));
      continue;
    }
    if (mapping.targetType === 'project') {
      const current = desiredProjectRoles.get(mapping.targetKey) || null;
      desiredProjectRoles.set(mapping.targetKey, chooseHigherProjectRole(current, toProjectRole(mapping.role)));
    }
  }

  const existingWorkspaceMember = await deps.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
  });

  let appliedWorkspaceRole: WorkspaceRole | null = existingWorkspaceMember?.role || null;
  const oidcCorrelationId = `oidc:${provider.id}:${claims.subject}`;
  const oidcEvidence = {
    provider_id: provider.id,
    claim_groups_name: provider.claimGroupsName,
    claim_groups_format: provider.claimGroupsFormat,
    matched_mapping_ids: matchedMappings.map((mapping) => mapping.id),
  };

  if (desiredWorkspaceRole) {
    const effectiveRole =
      existingWorkspaceMember?.role === 'OWNER' ? 'OWNER' : desiredWorkspaceRole;
    await deps.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: { role: effectiveRole },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: effectiveRole,
      },
    });
    const workspaceAction = resolveAccessAuditAction({
      kind: 'workspace',
      oldRole: existingWorkspaceMember?.role || null,
      newRole: effectiveRole,
    });
    if (workspaceAction) {
      await deps.recordAudit({
        workspaceId: workspace.id,
        workspaceKey: workspace.key,
        actorUserId: user.id,
        actorUserEmail: user.email,
        action: workspaceAction,
        target: buildAccessAuditParams({
          source: 'oidc',
          targetUserId: user.id,
          oldRole: existingWorkspaceMember?.role || null,
          newRole: effectiveRole,
          workspaceKey: workspace.key,
          correlationId: oidcCorrelationId,
          evidence: oidcEvidence,
        }),
      });
    }
    appliedWorkspaceRole = effectiveRole;
  } else if (!existingWorkspaceMember && settings.oidcAllowAutoProvision) {
    await deps.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'MEMBER',
      },
    });
    await deps.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: user.id,
      actorUserEmail: user.email,
      action: 'access.workspace_member.added',
      target: buildAccessAuditParams({
        source: 'oidc',
        targetUserId: user.id,
        oldRole: null,
        newRole: 'MEMBER',
        workspaceKey: workspace.key,
        correlationId: oidcCorrelationId,
        evidence: {
          ...oidcEvidence,
          auto_provision: true,
        },
      }),
    });
    appliedWorkspaceRole = 'MEMBER';
  } else if (settings.oidcSyncMode === OidcSyncMode.add_and_remove && existingWorkspaceMember?.role !== 'OWNER') {
    await deps.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
    });
    await deps.recordAudit({
      workspaceId: workspace.id,
      workspaceKey: workspace.key,
      actorUserId: user.id,
      actorUserEmail: user.email,
      action: 'access.workspace_member.removed',
      target: buildAccessAuditParams({
        source: 'oidc',
        targetUserId: user.id,
        oldRole: existingWorkspaceMember?.role || null,
        newRole: null,
        workspaceKey: workspace.key,
        correlationId: oidcCorrelationId,
        evidence: oidcEvidence,
      }),
    });
    appliedWorkspaceRole = null;
  }

  if (!appliedWorkspaceRole) {
    throw new AuthorizationError('User is not a member of the target workspace after OIDC mapping');
  }

  const desiredProjectKeys = Array.from(desiredProjectRoles.keys());
  const projects = desiredProjectKeys.length
    ? await deps.prisma.project.findMany({
        where: {
          workspaceId: workspace.id,
          key: { in: desiredProjectKeys },
        },
        select: { id: true, key: true },
      })
    : [];

  const projectByKey = new Map(projects.map((project) => [project.key, project.id]));
  for (const [projectKey, role] of desiredProjectRoles.entries()) {
    const projectId = projectByKey.get(projectKey);
    if (!projectId) {
      continue;
    }
    const existing = await deps.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
      select: { role: true },
    });
    const nextRole = existing?.role === 'OWNER' ? 'OWNER' : role;
    await deps.prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
      update: { role: nextRole },
      create: {
        projectId,
        userId: user.id,
        role: nextRole,
      },
    });
    const projectAction = resolveAccessAuditAction({
      kind: 'project',
      oldRole: existing?.role || null,
      newRole: nextRole,
    });
    if (projectAction) {
      await deps.recordAudit({
        workspaceId: workspace.id,
        projectId,
        workspaceKey: workspace.key,
        actorUserId: user.id,
        actorUserEmail: user.email,
        action: projectAction,
        target: buildAccessAuditParams({
          source: 'oidc',
          targetUserId: user.id,
          oldRole: existing?.role || null,
          newRole: nextRole,
          workspaceKey: workspace.key,
          projectKey,
          correlationId: oidcCorrelationId,
          evidence: oidcEvidence,
        }),
      });
    }
  }

  let removedProjectCount = 0;
  if (settings.oidcSyncMode === OidcSyncMode.add_and_remove) {
    const existingProjectMemberships = await deps.prisma.projectMember.findMany({
      where: {
        userId: user.id,
        project: {
          workspaceId: workspace.id,
        },
      },
      include: {
        project: {
          select: { key: true },
        },
      },
    });

    for (const membership of existingProjectMemberships) {
      if (desiredProjectRoles.has(membership.project.key) || membership.role === ProjectRole.OWNER) {
        continue;
      }
      await deps.prisma.projectMember.delete({
        where: {
          projectId_userId: {
            projectId: membership.projectId,
            userId: user.id,
          },
        },
      });
      await deps.recordAudit({
        workspaceId: workspace.id,
        projectId: membership.projectId,
        workspaceKey: workspace.key,
        actorUserId: user.id,
        actorUserEmail: user.email,
        action: 'access.project_member.removed',
        target: buildAccessAuditParams({
          source: 'oidc',
          targetUserId: user.id,
          oldRole: membership.role,
          newRole: null,
          workspaceKey: workspace.key,
          projectKey: membership.project.key,
          correlationId: oidcCorrelationId,
          evidence: oidcEvidence,
        }),
      });
      removedProjectCount += 1;
    }
  }

  const token = issueSessionToken({
    userId: user.id,
    secret: args.sessionSecret,
    ttlSeconds: args.sessionTtlSeconds,
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: user.id,
    actorUserEmail: user.email,
    action: 'auth.oidc.login',
    target: {
      workspace_key: workspace.key,
      provider_id: provider.id,
      issuer: claims.issuer,
      subject: claims.subject,
      group_count: claims.groups.length,
      synced_at: nowIso(),
    },
  });

  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: user.id,
    actorUserEmail: user.email,
    action: 'auth.oidc.mapping_applied',
    target: {
      workspace_key: workspace.key,
      provider_id: provider.id,
      sync_mode: settings.oidcSyncMode,
      matched_mapping_ids: matchedMappings.map((mapping) => mapping.id),
      applied_workspace_role: appliedWorkspaceRole,
      applied_project_count: desiredProjectRoles.size,
      removed_project_count: removedProjectCount,
      claim_groups_format: provider.claimGroupsFormat,
      claim_groups_name: provider.claimGroupsName,
    },
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      must_change_password: Boolean(user.mustChangePassword),
      email_verified: Boolean(user.emailVerified),
    },
    workspace_key: workspace.key,
    provider: {
      id: provider.id,
      name: provider.name,
    },
    mapping: {
      sync_mode: settings.oidcSyncMode,
      matched_mapping_ids: matchedMappings.map((mapping) => mapping.id),
      applied_workspace_role: appliedWorkspaceRole,
      applied_project_count: desiredProjectRoles.size,
      removed_project_count: removedProjectCount,
    },
  };
}
