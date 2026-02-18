import type express from 'express';
import { sendHttpError } from './error-shape.js';

type RateLimitOptions = {
  name: string;
  max: number;
  windowMs: number;
  message: string;
  keyResolver?: (req: express.Request) => string;
};

type BucketEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, BucketEntry>();
let cleanupTimer: NodeJS.Timeout | null = null;

function ensureCleanupTimer(): void {
  if (cleanupTimer) {
    return;
  }
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets.entries()) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, 60_000);
  cleanupTimer.unref();
}

export function createRateLimitMiddleware(options: RateLimitOptions): express.RequestHandler {
  ensureCleanupTimer();
  return (req, res, next) => {
    const keyPart = options.keyResolver ? options.keyResolver(req) : resolveClientKey(req);
    const bucketKey = `${options.name}:${keyPart}`;
    const now = Date.now();
    const existing = buckets.get(bucketKey);

    if (!existing || existing.resetAt <= now) {
      buckets.set(bucketKey, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return next();
    }

    existing.count += 1;
    if (existing.count <= options.max) {
      return next();
    }

    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    return sendHttpError({
      res,
      status: 429,
      code: 'rate_limited',
      message: options.message,
      details: {
        limit: options.max,
        window_ms: options.windowMs,
        retry_after_sec: retryAfterSec,
      },
    });
  };
}

function resolveClientKey(req: express.Request): string {
  const xff = req.header('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}
