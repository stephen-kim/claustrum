import test from 'node:test';
import assert from 'node:assert/strict';
import type express from 'express';
import { createRateLimitMiddleware } from './rate-limit.js';

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  setHeader: (name: string, value: string) => void;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
  };
}

function createMockRequest(ip: string): express.Request {
  return {
    ip,
    socket: { remoteAddress: ip } as any,
    header: () => undefined,
  } as unknown as express.Request;
}

test('rate limiter allows requests up to configured max and then blocks with structured error', () => {
  const middleware = createRateLimitMiddleware({
    name: 'unit.test',
    max: 2,
    windowMs: 60_000,
    message: 'Too many requests',
  });
  const req = createMockRequest('203.0.113.5');
  const res1 = createMockResponse();
  let nextCount = 0;
  middleware(req, res1 as unknown as express.Response, () => {
    nextCount += 1;
  });
  const res2 = createMockResponse();
  middleware(req, res2 as unknown as express.Response, () => {
    nextCount += 1;
  });
  const res3 = createMockResponse();
  middleware(req, res3 as unknown as express.Response, () => {
    nextCount += 1;
  });

  assert.equal(nextCount, 2);
  assert.equal(res3.statusCode, 429);
  assert.equal(res3.headers['retry-after'] !== undefined, true);
  assert.equal(
    (res3.body as { error: { code: string; message: string } }).error.code,
    'rate_limited'
  );
  assert.equal(
    (res3.body as { error: { code: string; message: string } }).error.message,
    'Too many requests'
  );
  const details = (res3.body as { error: { details: { retry_after_sec: number } } }).error.details;
  assert.equal(typeof details.retry_after_sec, 'number');
  assert.equal(details.retry_after_sec >= 1, true);
});
