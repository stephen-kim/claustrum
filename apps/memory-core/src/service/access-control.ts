import type { PrismaClient, WorkspaceRole } from '@prisma/client';
import type { AuthContext } from '../auth.js';
import { hasProjectAccess, requireWorkspaceMembership } from '../permissions.js';
import { AuthorizationError } from './errors.js';

export async function assertWorkspaceAccess(
  prisma: PrismaClient,
  auth: AuthContext,
  workspaceId: string
): Promise<{ role: WorkspaceRole }> {
  const membership = await requireWorkspaceMembership({
    prisma,
    auth,
    workspaceId,
  });
  if (!membership) {
    throw new AuthorizationError('Workspace access denied');
  }
  return membership;
}

export async function assertWorkspaceAdmin(
  prisma: PrismaClient,
  auth: AuthContext,
  workspaceId: string
): Promise<void> {
  const membership = await requireWorkspaceMembership({
    prisma,
    auth,
    workspaceId,
  });
  if (!membership) {
    throw new AuthorizationError('Workspace access denied');
  }
  if (membership.role !== 'ADMIN' && membership.role !== 'OWNER') {
    throw new AuthorizationError('Workspace admin role required');
  }
}

export async function assertProjectAccess(
  prisma: PrismaClient,
  auth: AuthContext,
  workspaceId: string,
  projectId: string
): Promise<void> {
  const allowed = await hasProjectAccess({
    prisma,
    auth,
    workspaceId,
    projectId,
  });
  if (!allowed) {
    throw new AuthorizationError('Project access denied');
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
    const allowed = await hasProjectAccess({
      prisma,
      auth,
      workspaceId,
      projectId,
    });
    if (!allowed) {
      throw new AuthorizationError('Raw access requires admin or project member');
    }
    return;
  }
  const membership = await requireWorkspaceMembership({
    prisma,
    auth,
    workspaceId,
  });
  if (!membership) {
    throw new AuthorizationError('Workspace access denied');
  }
  if (membership.role !== 'ADMIN' && membership.role !== 'OWNER') {
    throw new AuthorizationError('Workspace admin role required for workspace-wide raw search');
  }
}
