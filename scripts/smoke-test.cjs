#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for smoke tests.');
  }

  const root = path.resolve(__dirname, '..');
  const distEntry = path.join(root, 'apps', 'mcp-adapter', 'dist', 'index.js');
  const srcEntry = path.join(root, 'apps', 'mcp-adapter', 'src', 'index.ts');

  const command = process.execPath;
  const args = fs.existsSync(distEntry)
    ? [distEntry]
    : ['--loader', 'tsx', srcEntry];

  const transport = new StdioClientTransport({
    command,
    args,
    env: {
      ...process.env,
    },
  });

  const client = new Client(
    { name: 'claustrum-smoke-test', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);

  try {
    const projectKey = `smoke-${Date.now()}`;
    const note = `smoke note ${Date.now()}`;

    await callTool(client, 'set_project', { key: projectKey, label: 'Smoke Test Project' });
    await callTool(client, 'remember', {
      type: 'note',
      content: note,
    });
    const recallResult = await callTool(client, 'recall', {
      query: note,
      project_key: projectKey,
      limit: 20,
    });

    const text = extractText(recallResult);
    assert(
      text.includes(note),
      `Expected recall output to contain remembered note. Output was:\n${text}`
    );

    console.error('[claustrum:test] smoke test passed');
  } finally {
    await client.close();
  }
}

async function callTool(client, name, args) {
  if (typeof client.callTool === 'function') {
    return client.callTool({ name, arguments: args });
  }

  return client.request(
    {
      method: 'tools/call',
      params: { name, arguments: args },
    },
    undefined
  );
}

function extractText(result) {
  if (!result || !Array.isArray(result.content)) {
    return '';
  }
  return result.content
    .filter((item) => item && item.type === 'text')
    .map((item) => item.text || '')
    .join('\n');
}

main().catch((error) => {
  console.error('[claustrum:test] failed:', error);
  process.exit(1);
});
