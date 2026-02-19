import crypto from 'node:crypto';
import net from 'node:net';
import { Prisma } from '@prisma/client';
import { ValidationError } from '../errors.js';
import {
  DEFAULT_RETRY_POLICY,
  type AuditSinkListItem,
  type EventFilter,
  type RetryPolicy,
  SECURITY_PREFIXES,
} from './audit-sink-types.js';

export function toAuditSinkResponse(row: {
  id: string;
  type: 'webhook' | 'http';
  name: string;
  enabled: boolean;
  endpointUrl: string;
  secret: string;
  eventFilter: unknown;
  retryPolicy: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AuditSinkListItem {
  const filter = normalizeEventFilter(row.eventFilter as Record<string, unknown>);
  const retry = normalizeRetryPolicy(row.retryPolicy as Record<string, unknown>);
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    enabled: row.enabled,
    endpoint_url: row.endpointUrl,
    has_secret: Boolean(row.secret),
    event_filter: {
      include_prefixes: filter.includePrefixes,
      exclude_actions: filter.excludeActions,
    },
    retry_policy: {
      max_attempts: retry.maxAttempts,
      backoff_sec: retry.backoffSec,
    },
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function normalizeAuditSinkUrl(input: string): string {
  const value = String(input || '').trim();
  if (!value) {
    throw new ValidationError('endpoint_url is required.');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError('endpoint_url must be a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('endpoint_url must use http or https.');
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError('endpoint_url must not include username/password.');
  }
  if (!allowPrivateAuditSinkUrls() && isPrivateOrLocalHost(parsed.hostname)) {
    throw new ValidationError(
      'endpoint_url host points to local/private network. Set MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS=true only for trusted development setups.'
    );
  }
  return parsed.toString();
}

export function normalizeEventFilter(input: Record<string, unknown> | undefined): EventFilter {
  const includePrefixes = toStringArray(input?.include_prefixes);
  const excludeActions = toStringArray(input?.exclude_actions);
  return {
    includePrefixes,
    excludeActions,
  };
}

export function normalizeRetryPolicy(input: Record<string, unknown> | undefined): RetryPolicy {
  const rawMaxAttempts = Number(input?.max_attempts ?? DEFAULT_RETRY_POLICY.maxAttempts);
  const maxAttempts = Number.isInteger(rawMaxAttempts)
    ? Math.min(Math.max(rawMaxAttempts, 1), 20)
    : DEFAULT_RETRY_POLICY.maxAttempts;

  const backoffSec = Array.isArray(input?.backoff_sec)
    ? input.backoff_sec
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1)
        .map((value) => Math.floor(value))
        .slice(0, 20)
    : [];

  return {
    maxAttempts,
    backoffSec: backoffSec.length > 0 ? backoffSec : [...DEFAULT_RETRY_POLICY.backoffSec],
  };
}

export function shouldQueueByFilter(action: string, filter: EventFilter): boolean {
  if (filter.excludeActions.includes(action)) {
    return false;
  }
  if (filter.includePrefixes.length === 0) {
    return true;
  }
  return filter.includePrefixes.some((prefix) => action.startsWith(prefix));
}

export function isSecuritySinkCandidate(filter: EventFilter): boolean {
  if (filter.includePrefixes.length === 0) {
    return true;
  }
  return filter.includePrefixes.some((prefix) =>
    SECURITY_PREFIXES.some((securityPrefix) => prefix.startsWith(securityPrefix))
  );
}

export function pickBackoffSeconds(policy: RetryPolicy, attemptNumber: number): number {
  if (policy.backoffSec.length === 0) {
    return 60;
  }
  const index = Math.min(Math.max(attemptNumber - 1, 0), policy.backoffSec.length - 1);
  return policy.backoffSec[index];
}

export async function postSignedDelivery(args: {
  endpointUrl: string;
  secret: string;
  workspaceKey: string;
  actionKey: string;
  deliveryId: string;
  body: Record<string, unknown>;
}): Promise<Response> {
  const bodyJson = JSON.stringify(args.body);
  const signature = crypto.createHmac('sha256', args.secret).update(bodyJson).digest('hex');
  return fetch(args.endpointUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-claustrum-event': args.actionKey,
      'x-claustrum-workspace': args.workspaceKey,
      'x-claustrum-delivery': args.deliveryId,
      'x-claustrum-signature': `sha256=${signature}`,
      'user-agent': 'claustrum-audit-delivery/1.0',
    },
    body: bodyJson,
  });
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function toObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

export function toPrismaJson(input: Record<string, unknown>): Prisma.InputJsonValue {
  return input as Prisma.InputJsonValue;
}

function allowPrivateAuditSinkUrls(): boolean {
  const value = String(process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS || '')
    .trim()
    .toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) {
    return true;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  if (host === '::1') {
    return true;
  }
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    if (host.startsWith('127.')) {
      return true;
    }
    if (host.startsWith('10.')) {
      return true;
    }
    if (host.startsWith('192.168.')) {
      return true;
    }
    if (host.startsWith('169.254.')) {
      return true;
    }
    const secondOctet = Number(host.split('.')[1] || '');
    if (host.startsWith('172.') && Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
    return false;
  }
  if (ipVersion === 6) {
    return host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') || host === '::1';
  }
  return false;
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0)
    .slice(0, 200);
}
