import type { PrismaClient, WorkspaceRole } from '@prisma/client';
import type { AuthContext } from './auth.js';

export async function requireWorkspaceMembership(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspaceId: string;
}): Promise<{ role: WorkspaceRole } | null> {
  if (args.auth.projectAccessBypass || args.auth.user.envAdmin) {
    return { role: 'OWNER' };
  }

  const membership = await args.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: args.workspaceId,
        userId: args.auth.user.id,
      },
    },
    select: { role: true },
  });

  return membership;
}

export async function hasProjectAccess(args: {
  prisma: PrismaClient;
  auth: AuthContext;
  workspaceId: string;
  projectId: string;
}): Promise<boolean> {
  const workspaceMembership = await requireWorkspaceMembership({
    prisma: args.prisma,
    auth: args.auth,
    workspaceId: args.workspaceId,
  });

  if (!workspaceMembership) {
    return false;
  }

  if (workspaceMembership.role === 'OWNER' || workspaceMembership.role === 'ADMIN') {
    return true;
  }

  const projectMembership = await args.prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: args.projectId,
        userId: args.auth.user.id,
      },
    },
    select: { id: true },
  });

  return Boolean(projectMembership);
}
