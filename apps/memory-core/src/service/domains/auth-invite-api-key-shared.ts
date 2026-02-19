import {
  Prisma,
  type PrismaClient,
  type ProjectRole,
  type WorkspaceRole,
} from '@prisma/client';
import type { AuthContext } from '../../auth.js';
import { assertProjectAccess, assertWorkspaceAdmin, assertWorkspaceAccess } from '../access-control.js';
import {
  AuthenticationError,
  AuthorizationError,
  GoneError,
  NotFoundError,
  ValidationError,
} from '../errors.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { issueSessionToken } from '../../security/session-token.js';
import {
  generateApiKey,
  generateInvitationToken,
  buildApiKeyPrefix,
  hashApiKey,
  hashOneTimeToken,
} from '../../security/api-key.js';
import { issueOneTimeKeyToken, verifyOneTimeKeyToken } from '../../security/one-time-key-token.js';

export type SecurityConfig = {
  apiKeyHashSecret: string;
  oneTimeTokenSecret: string;
  oneTimeTokenTtlSeconds: number;
  publicBaseUrl?: string;
  inviteBaseUrl?: string;
};

export type AuthInviteApiKeyDeps = {
  prisma: PrismaClient;
  securityConfig: SecurityConfig;
  getWorkspaceByKey: (workspaceKey: string) => Promise<{ id: string; key: string }>;
  normalizeInviteProjectRoles: (input: unknown) => Record<string, ProjectRole>;
  resolveAuditWorkspaceForUser: (userId: string) => Promise<{ id: string; key: string } | null>;
  canManageUserKeys: (auth: AuthContext, targetUserId: string) => Promise<boolean>;
  recordAudit: (args: {
    workspaceId: string;
    projectId?: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
  }) => Promise<void>;
};

export {
  Prisma,
  type PrismaClient,
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
};
