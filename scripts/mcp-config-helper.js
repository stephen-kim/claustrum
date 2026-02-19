#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

const DEFAULT_PROFILE = 'claustrum';
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');
const DEFAULT_ADAPTER_COMMAND = path.join(os.homedir(), '.claustrum', 'bin', 'claustrum-mcp');
const DEFAULT_ADAPTER_ARGS = [];

const CLIENTS = [
  {
    id: 'codex',
    label: 'OpenAI Codex',
    format: 'toml',
    configPath: () => path.join(os.homedir(), '.codex', 'config.toml'),
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    format: 'json',
    containerKey: 'mcpServers',
    configPath: () => path.join(os.homedir(), '.claude', 'mcp_servers.json'),
  },
  {
    id: 'cursor',
    label: 'Cursor',
    format: 'json',
    containerKey: 'mcpServers',
    serverOverrides: { type: 'stdio' },
    configPath: () => path.join(os.homedir(), '.cursor', 'mcp.json'),
  },
  {
    id: 'antigravity',
    label: 'Google Antigravity',
    format: 'json',
    containerKey: 'mcpServers',
    configPath: () => path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
  },
];

function parseArgs(argv) {
  const options = {
    write: false,
    force: false,
    help: false,
    interactive: false,
    nonInteractive: false,
    yes: false,
    profile: DEFAULT_PROFILE,
    adapterCommand: DEFAULT_ADAPTER_COMMAND,
    adapterArgs: DEFAULT_ADAPTER_ARGS.join(' '),
    configPath: DEFAULT_CONFIG_PATH,
    clients: '',
    configPathExplicit: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') {
      continue;
    }
    if (token === '--write') {
      options.write = true;
      continue;
    }
    if (token === '--force') {
      options.force = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }
    if (token === '--interactive') {
      options.interactive = true;
      continue;
    }
    if (token === '--non-interactive') {
      options.nonInteractive = true;
      continue;
    }
    if (token === '--yes' || token === '-y') {
      options.yes = true;
      continue;
    }
    if (token.startsWith('--profile=')) {
      options.profile = token.split('=').slice(1).join('=').trim() || DEFAULT_PROFILE;
      continue;
    }
    if (token === '--profile') {
      options.profile = (argv[i + 1] || '').trim() || DEFAULT_PROFILE;
      i += 1;
      continue;
    }
    if (token.startsWith('--config=')) {
      options.configPath = path.resolve(token.split('=').slice(1).join('=').trim());
      options.configPathExplicit = true;
      continue;
    }
    if (token === '--config') {
      options.configPath = path.resolve((argv[i + 1] || '').trim());
      options.configPathExplicit = true;
      i += 1;
      continue;
    }
    if (token.startsWith('--adapter-command=')) {
      options.adapterCommand = token.split('=').slice(1).join('=').trim() || DEFAULT_ADAPTER_COMMAND;
      continue;
    }
    if (token === '--adapter-command') {
      options.adapterCommand = (argv[i + 1] || '').trim() || DEFAULT_ADAPTER_COMMAND;
      i += 1;
      continue;
    }
    if (token.startsWith('--adapter-args=')) {
      options.adapterArgs = token.split('=').slice(1).join('=').trim() || DEFAULT_ADAPTER_ARGS.join(' ');
      continue;
    }
    if (token === '--adapter-args') {
      options.adapterArgs = (argv[i + 1] || '').trim() || DEFAULT_ADAPTER_ARGS.join(' ');
      i += 1;
      continue;
    }
    if (token.startsWith('--clients=')) {
      options.clients = token.split('=').slice(1).join('=').trim();
      continue;
    }
    if (token === '--clients') {
      options.clients = (argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
  }

  return options;
}

function printHelp() {
  const lines = [
    'Claustrum MCP config helper',
    '',
    'Usage:',
    '  node scripts/mcp-config-helper.js [options]',
    '',
    'Interactive mode (recommended):',
    '  node scripts/mcp-config-helper.js',
    '',
    'Options:',
    '  --interactive          Force interactive wizard.',
    '  --non-interactive      Disable interactive wizard.',
    '  --write                Append snippet into config file.',
    '  --yes, -y              Skip confirmation in non-interactive mode.',
    '  --force                Overwrite existing profile block when used with --write.',
    '  --clients <csv>        Target clients. ex) codex,claude-code,cursor',
    '  --profile <name>       MCP profile name (default: claustrum).',
    `  --adapter-command <v>  MCP adapter command (default: ${DEFAULT_ADAPTER_COMMAND}).`,
    '  --adapter-args <v>     MCP adapter args string.',
    '  --config <path>        Config file path (default: ~/.codex/config.toml).',
    '  --help, -h             Show this help.',
    '',
    'Clients:',
    `  ${CLIENTS.map((client) => client.id).join(', ')}`,
  ];
  console.log(lines.join('\n'));
}

function splitArgs(raw) {
  return String(raw || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAdapterCommand(options) {
  const command = String(options.adapterCommand || '').trim() || DEFAULT_ADAPTER_COMMAND;
  const args = splitArgs(options.adapterArgs);
  const finalArgs = args.length > 0 ? args : [...DEFAULT_ADAPTER_ARGS];
  return { command, args: finalArgs, note: null };
}

function escapeTomlString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function renderCodexSnippet(options) {
  const adapter = getAdapterCommand(options);
  const profile = escapeTomlString(options.profile);

  const snippet = [
    `[mcp_servers.${profile}]`,
    `command = "${escapeTomlString(adapter.command)}"`,
    `args = [${adapter.args.map((arg) => `"${escapeTomlString(arg)}"`).join(', ')}]`,
    '',
  ].join('\n');

  return { snippet, adapter };
}

function replaceProfileBlock(content, profile) {
  const escaped = profile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockRegex = new RegExp(`\\n?\\[mcp_servers\\.${escaped}\\][\\s\\S]*?(?=\\n\\[mcp_servers\\.|$)`, 'm');
  return content.replace(blockRegex, '\n');
}

function updateConfigFile(configPath, profile, snippet, force) {
  const marker = `[mcp_servers.${profile}]`;
  const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';

  if (existing.includes(marker) && !force) {
    return { updated: false, reason: 'profile_exists' };
  }

  let next = existing;
  if (existing.includes(marker) && force) {
    next = replaceProfileBlock(existing, profile);
  }

  if (next.length > 0 && !next.endsWith('\n')) {
    next += '\n';
  }
  next += `\n${snippet}`;

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, next, 'utf8');
  return { updated: true };
}

function ensureJsonContainer(root, containerKey) {
  const keys = containerKey.split('.');
  let cursor = root;
  for (const key of keys) {
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  return cursor;
}

function backupFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${stamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function updateJsonClientConfig(filePath, client, profile, serverDef) {
  const backupPath = backupFileIfExists(filePath);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
  let json = {};
  if (existing) {
    json = JSON.parse(existing);
  }
  const container = ensureJsonContainer(json, client.containerKey || 'mcpServers');
  container[profile] = {
    ...serverDef,
    ...(client.serverOverrides || {}),
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  return { backupPath, changed: true };
}

function parseClientIds(value) {
  const normalized = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const validIds = new Set(CLIENTS.map((client) => client.id));
  const picked = normalized.filter((id) => validIds.has(id));
  return Array.from(new Set(picked));
}

function getClientById(id) {
  return CLIENTS.find((client) => client.id === id);
}

async function promptLine(rl, label, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  if (!answer) {
    return defaultValue;
  }
  return answer;
}

async function confirmPrompt(rl, label, defaultYes = true) {
  const suffix = defaultYes ? ' [Y/n]' : ' [y/N]';
  const answer = (await rl.question(`${label}${suffix}: `)).trim().toLowerCase();
  if (!answer) {
    return defaultYes;
  }
  return answer === 'y' || answer === 'yes';
}

function clearRenderedLines(lineCount) {
  for (let i = 0; i < lineCount; i += 1) {
    process.stdout.write('\x1b[1A'); // cursor up
    process.stdout.write('\x1b[2K'); // clear line
  }
}

function renderClientSelection(clients, selectedIds, cursorIndex) {
  const lines = [];
  lines.push('');
  lines.push('Select MCP clients (Space=toggle, ↑/↓=move, Enter=confirm):');
  for (let i = 0; i < clients.length; i += 1) {
    const client = clients[i];
    const focused = i === cursorIndex ? '>' : ' ';
    const checked = selectedIds.has(client.id) ? '[x]' : '[ ]';
    lines.push(` ${focused} ${checked} ${client.label} (${client.id})`);
  }
  lines.push('');
  lines.push('Tip: at least one client must be selected.');
  process.stdout.write(`${lines.join('\n')}\n`);
  return lines.length + 1;
}

function selectClientsInteractive(clients) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error('Interactive client selection requires a TTY terminal.'));
      return;
    }

    let cursorIndex = 0;
    let renderedLines = 0;
    const selectedIds = new Set(['codex']);

    const redraw = () => {
      if (renderedLines > 0) {
        clearRenderedLines(renderedLines);
      }
      renderedLines = renderClientSelection(clients, selectedIds, cursorIndex);
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      if (renderedLines > 0) {
        clearRenderedLines(renderedLines);
      }
    };

    const onData = (chunk) => {
      const key = chunk.toString('utf8');

      if (key === '\u0003') {
        cleanup();
        reject(new Error('Canceled by user (Ctrl+C).'));
        return;
      }

      if (key === '\r' || key === '\n') {
        if (selectedIds.size === 0) {
          redraw();
          return;
        }
        cleanup();
        resolve(Array.from(selectedIds));
        return;
      }

      if (key === ' ') {
        const id = clients[cursorIndex].id;
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
        } else {
          selectedIds.add(id);
        }
        redraw();
        return;
      }

      if (key === '\u001b[A') {
        cursorIndex = (cursorIndex - 1 + clients.length) % clients.length;
        redraw();
        return;
      }

      if (key === '\u001b[B') {
        cursorIndex = (cursorIndex + 1) % clients.length;
        redraw();
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
    redraw();
  });
}

function createServerDefinition(adapter, options) {
  return {
    command: adapter.command,
    args: adapter.args,
  };
}

async function runInteractiveWizard(options) {
  console.log('Claustrum MCP Setup Wizard');
  console.log('');
  console.log('Auth/API key guide:');
  console.log('1) Configure adapter runtime env (MEMORY_CORE_URL, MEMORY_CORE_API_KEY, MEMORY_CORE_WORKSPACE_KEY).');
  console.log('2) Open Admin UI if you need to issue a new API key.');
  console.log('3) This helper only writes MCP command/args into client config.');
  console.log('');

  const selectedClientIds = await selectClientsInteractive(CLIENTS);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const adapterCommand = await promptLine(rl, 'Adapter command', options.adapterCommand);
    const adapterArgs = await promptLine(rl, 'Adapter args', options.adapterArgs);
    const profile = await promptLine(rl, 'MCP server profile name', options.profile);

    const effectiveOptions = {
      ...options,
      adapterCommand,
      adapterArgs,
      profile,
    };

    console.log('');
    console.log('Planned changes:');
    for (const id of selectedClientIds) {
      const client = getClientById(id);
      if (!client) {
        continue;
      }
      console.log(`- ${client.label}: ${client.configPath()}`);
    }
    console.log(`- Profile: ${effectiveOptions.profile}`);
    console.log(`- Adapter command: ${effectiveOptions.adapterCommand}`);
    console.log(`- Adapter args: ${effectiveOptions.adapterArgs}`);
    console.log('- Env block: not written by this helper.');
    console.log('- Existing config files will be backed up before writing.');
    console.log('');

    const confirmed = await confirmPrompt(rl, 'Apply configuration now?', true);
    if (!confirmed) {
      console.error('[claustrum:mcp-helper] canceled by user.');
      return;
    }

    await applyToClients(selectedClientIds, effectiveOptions, true);
  } finally {
    rl.close();
  }
}

async function applyToClients(clientIds, options, forceReplace) {
  const { adapter, snippet } = renderCodexSnippet(options);
  const serverDef = createServerDefinition(adapter, options);

  if (adapter.note) {
    console.error(`[claustrum:mcp-helper] ${adapter.note}`);
  }

  const results = [];
  for (const id of clientIds) {
    const client = getClientById(id);
    if (!client) {
      continue;
    }
    const targetPath = options.configPathExplicit && clientIds.length === 1 ? options.configPath : client.configPath();
    try {
      if (client.format === 'toml') {
        const result = updateConfigFile(targetPath, options.profile, snippet, forceReplace || options.force);
        if (!result.updated) {
          throw new Error(`profile "${options.profile}" already exists (use --force)`);
        }
        results.push({ id, label: client.label, targetPath, backupPath: null, status: 'updated' });
        continue;
      }

      const updateResult = updateJsonClientConfig(targetPath, client, options.profile, serverDef);
      results.push({
        id,
        label: client.label,
        targetPath,
        backupPath: updateResult.backupPath,
        status: 'updated',
      });
    } catch (error) {
      results.push({
        id,
        label: client.label,
        targetPath,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('');
  console.log('Result:');
  for (const row of results) {
    if (row.status === 'updated') {
      console.log(`- ${row.label}: updated ${row.targetPath}`);
      if (row.backupPath) {
        console.log(`  backup: ${row.backupPath}`);
      }
    } else {
      console.log(`- ${row.label}: failed (${row.error})`);
    }
  }

  console.log('');
  console.log('Done. Restart selected clients to load the new MCP configuration.');
}

async function runNonInteractive(options) {
  const clientIds = parseClientIds(options.clients);
  const selectedClientIds = clientIds.length > 0 ? clientIds : ['codex'];

  if (!options.write) {
    const { snippet, adapter } = renderCodexSnippet(options);
    if (adapter.note) {
      console.error(`[claustrum:mcp-helper] ${adapter.note}`);
    }
    console.log(snippet);
    return;
  }

  if (options.configPathExplicit && selectedClientIds.length > 1) {
    throw new Error('--config can be used only when one client is selected.');
  }

  if (!options.yes && process.stdout.isTTY && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const confirmed = await confirmPrompt(
        rl,
        `Apply settings to ${selectedClientIds.join(', ')} with profile "${options.profile}"?`,
        true
      );
      if (!confirmed) {
        console.error('[claustrum:mcp-helper] canceled by user.');
        return;
      }
    } finally {
      rl.close();
    }
  }

  await applyToClients(selectedClientIds, options, true);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const noArgs = process.argv.slice(2).filter((token) => token !== '--').length === 0;
  const useInteractive =
    !options.nonInteractive && (options.interactive || (noArgs && process.stdin.isTTY && process.stdout.isTTY));

  if (useInteractive) {
    await runInteractiveWizard(options);
    return;
  }

  await runNonInteractive(options);
}

main().catch((error) => {
  console.error(`[claustrum:mcp-helper] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
