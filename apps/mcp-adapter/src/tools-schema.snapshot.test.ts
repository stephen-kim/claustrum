import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { tools } from './tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNAPSHOT_PATH = path.resolve(
  __dirname,
  '__snapshots__/tools-schema.snapshot.json'
);

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }
  if (value && typeof value === 'object') {
    const result: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = normalizeJson(value[key] as JsonValue);
    }
    return result;
  }
  return value;
}

function serializeToolsSnapshot(): string {
  const normalized = normalizeJson(
    tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: tool.inputSchema as JsonValue,
    })) as JsonValue
  );
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

test('mcp tool schema snapshot stays stable', () => {
  const snapshot = serializeToolsSnapshot();
  if (process.env.UPDATE_SNAPSHOTS === '1') {
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, snapshot, 'utf8');
    return;
  }

  const expected = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
  assert.equal(
    snapshot,
    expected,
    'Tool schema snapshot changed. If intentional, run UPDATE_SNAPSHOTS=1 pnpm --filter @claustrum/mcp-adapter test'
  );
});
