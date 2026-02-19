import type { PrismaClient } from '@prisma/client';

export type Workspace = { id: string; key: string };

export type RetryPolicy = {
  maxAttempts: number;
  backoffSec: number[];
};

export type EventFilter = {
  includePrefixes: string[];
  excludeActions: string[];
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  backoffSec: [1, 5, 30, 120, 600],
};

export const SECURITY_PREFIXES = [
  'auth.',
  'access.',
  'api_key.',
  'oidc.',
  'github.permissions.',
  'security.',
  'raw.',
  'audit.',
] as const;

export type AuditSinkDeps = {
  prisma: PrismaClient;
  getWorkspaceByKey: (workspaceKey: string) => Promise<Workspace>;
  recordAudit: (args: {
    workspaceId: string;
    projectId?: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
    correlationId?: string;
  }) => Promise<void>;
};

export type AuditSinkListItem = {
  id: string;
  type: 'webhook' | 'http';
  name: string;
  enabled: boolean;
  endpoint_url: string;
  has_secret: boolean;
  event_filter: {
    include_prefixes: string[];
    exclude_actions: string[];
  };
  retry_policy: {
    max_attempts: number;
    backoff_sec: number[];
  };
  created_at: string;
  updated_at: string;
};
