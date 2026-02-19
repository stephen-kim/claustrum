import type { PrismaClient, WorkspaceRole } from '@prisma/client';
import type { AuthContext } from '../auth.js';
import {
  normalizeLegacyProjectRole,
  requireProjectMembership,
  requireWorkspaceMembership,
  workspaceRoleAtLeast,
  projectRoleAtLeast,
} from '../permissions.js';
import { AuthorizationError } from './errors.js';

function assertApiKeyWorkspaceScope(auth: AuthContext, workspaceId: string): void {
  if (auth.authMethod !== 'api_key') {
    return;
  }
  if (auth.projectAccessBypass || auth.user.envAdmin) {
    return;
  }
  if (auth.apiKeyWorkspaceId && auth.apiKeyWorkspaceId !== workspaceId) {
    throw new AuthorizationError('API key is scoped to a different workspace.');
  }
}

export async function assertWorkspaceAccess(
  prisma: PrismaClient,
  auth: AuthContext,
  workspaceId: string,
  minRole: WorkspaceRole = 'MEMBER'
): Promise<{ role: WorkspaceRole }> {
  assertApiKeyWorkspaceScope(auth, workspaceId);
  const membership = await requireWorkspaceMembership({
    prisma,
    auth,
    workspaceId,
  });
  if (!membership) {
    throw new AuthorizationError('Workspace access denied');
  }
  if (!workspaceRoleAtLeast(membership.role, minRole)) {
    throw new AuthorizationError(`Workspace role ${minRole} or higher required`);
  }
  return membership;
}

export async function assertWorkspaceAdmin(
  prisma: PrismaClient,
  auth: AuthContext,
  workspaceId: string
): Promise<void> {
  await assertWorkspaceAccess(prisma, auth, workspaceId, 'ADMIN');
}

export async function assertProjectAccess(
  prisma: PrismaClient,
  auth: AuthContext,
  workspaceId: string,
  projectId: string,
  minRole: 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER' = 'READER'
): Promise<void> {
  assertApiKeyWorkspaceScope(auth, workspaceId);
  const membership = await requireProjectMembership({
    prisma,
    auth,
    workspaceId,
    projectId,
  });
  if (!membership) {
    throw new AuthorizationError('Project access denied');
  }
  const normalized = normalizeLegacyProjectRole(membership.role);
  if (!projectRoleAtLeast(normalized, minRole)) {
    throw new AuthorizationError(`Project role ${minRole} or higher required`);
  }
}

export function isWorkspaceAdminRole(role: WorkspaceRole): boolean {
  return role === 'ADMIN' || role === 'OWNER';
}

export async function assertRawAccess(
  prisma: PrismaClient,
  auth: AuthContext,
  workspaceId: string,
  projectId?: string
): Promise<void> {
  if (auth.projectAccessBypass || auth.user.envAdmin) {
    return;
  }
  if (projectId) {
    const settings = await prisma.workspaceSettings.findUnique({
      where: { workspaceId },
      select: { rawAccessMinRole: true },
    });
    const minRole = settings?.rawAccessMinRole || 'WRITER';
    await assertProjectAccess(prisma, auth, workspaceId, projectId, minRole);
    return;
  }
  await assertWorkspaceAccess(prisma, auth, workspaceId, 'ADMIN');
}
