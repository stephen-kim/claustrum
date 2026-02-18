import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuditSinkUrl } from './audit-sink-helpers.js';
import { ValidationError } from '../errors.js';

test('normalizeAuditSinkUrl rejects private/local targets by default', () => {
  const previous = process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS;
  delete process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS;
  try {
    assert.throws(
      () => normalizeAuditSinkUrl('http://localhost:8080/hook'),
      (error) =>
        error instanceof ValidationError &&
        error.message.includes('local/private network')
    );
    assert.throws(
      () => normalizeAuditSinkUrl('http://10.0.0.5:9000/hook'),
      (error) =>
        error instanceof ValidationError &&
        error.message.includes('local/private network')
    );
  } finally {
    if (previous === undefined) {
      delete process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS;
    } else {
      process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS = previous;
    }
  }
});

test('normalizeAuditSinkUrl allows private targets with explicit override', () => {
  const previous = process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS;
  process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS = 'true';
  try {
    assert.equal(
      normalizeAuditSinkUrl('http://localhost:8080/hook'),
      'http://localhost:8080/hook'
    );
  } finally {
    if (previous === undefined) {
      delete process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS;
    } else {
      process.env.MEMORY_CORE_ALLOW_PRIVATE_AUDIT_SINK_URLS = previous;
    }
  }
});

test('normalizeAuditSinkUrl rejects embedded credentials', () => {
  assert.throws(
    () => normalizeAuditSinkUrl('https://user:pass@example.com/hook'),
    (error) => error instanceof ValidationError && error.message.includes('username/password')
  );
});
