import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertHttpsBaseUrl, getRuntimePaths, loadRuntimeConfig } from './runtime/constants.js';
import { ensureCurrentVersionInstalled, ensureRuntimeLayout } from './runtime/install.js';
import { RuntimeFileLogger } from './runtime/logging.js';
import { runStdioBridge } from './runtime/bridge.js';
import { runBackgroundUpdateCheck } from './runtime/updater.js';
import { clearApiKeyFromState, readStateFile, writeStateFile } from './runtime/state-file.js';

type CliCommand = 'run' | 'login' | 'logout';

function maskKey(value: string): string {
  if (!value) {
    return 'missing';
  }
  if (value.length <= 8) {
    return '****';
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function parseFlag(argv: string[], key: string): string | null {
  const prefixed = `${key}=`;
  const inline = argv.find((item) => item.startsWith(prefixed));
  if (inline) {
    return inline.slice(prefixed.length).trim() || null;
  }
  const idx = argv.findIndex((item) => item === key);
  if (idx >= 0 && argv[idx + 1]) {
    return argv[idx + 1].trim() || null;
  }
  return null;
}

function resolveCommand(argv: string[]): CliCommand {
  const first = argv[0] || '';
  if (first === 'login') {
    return 'login';
  }
  if (first === 'logout') {
    return 'logout';
  }
  return 'run';
}

async function handleLogin(args: {
  argv: string[];
  workspaceKeyDefault: string;
  deviceLabelDefault: string;
  stateFile: string;
  logger: RuntimeFileLogger;
}): Promise<void> {
  const apiKey = parseFlag(args.argv, '--api-key');
  if (!apiKey) {
    throw new Error('Missing --api-key. Usage: claustrum-mcp login --api-key <key> [--workspace-key <key>]');
  }
  const workspaceKey = parseFlag(args.argv, '--workspace-key') || args.workspaceKeyDefault || 'personal';
  const deviceLabel = parseFlag(args.argv, '--device-label') || args.deviceLabelDefault || os.hostname();

  // TODO Phase 2:
  // Replace API key storage with refresh token + OS keychain integration.
  await writeStateFile(
    { stateFile: args.stateFile },
    {
      workspace_key: workspaceKey,
      api_key: apiKey,
      device_label: deviceLabel,
      last_updated_at: new Date().toISOString(),
    },
    args.logger
  );
  process.stderr.write(
    `[claustrum-mcp:info] Login saved for workspace=${workspaceKey} device=${deviceLabel} key=${maskKey(apiKey)}\n`
  );
}

async function handleLogout(args: { stateFile: string; logger: RuntimeFileLogger }): Promise<void> {
  await clearApiKeyFromState({ stateFile: args.stateFile }, args.logger);
  process.stderr.write('[claustrum-mcp:info] Local API key cleared.\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const command = resolveCommand(argv);
  const flags = new Set(argv);
  const noUpdate = flags.has('--no-update');
  const installOnly = flags.has('--install-only');

  const config = loadRuntimeConfig(process.env, {
    requireBaseUrl: command === 'run' && !installOnly,
  });
  const paths = getRuntimePaths(config.claustrumHome);
  const logger = new RuntimeFileLogger({
    logsDir: paths.logsDir,
    level: config.logLevel,
  });

  await ensureRuntimeLayout(paths);

  if (command === 'login') {
    await handleLogin({
      argv,
      workspaceKeyDefault: config.workspaceKey,
      deviceLabelDefault: config.deviceLabel,
      stateFile: paths.stateFile,
      logger,
    });
    return;
  }

  if (command === 'logout') {
    await handleLogout({
      stateFile: paths.stateFile,
      logger,
    });
    return;
  }

  const sourceDistDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
  const installed = await ensureCurrentVersionInstalled({
    paths,
    sourceDistDir,
  });

  if (config.baseUrl) {
    const httpsStatus = assertHttpsBaseUrl(config.baseUrl);
    if (httpsStatus.warning) {
      logger.warn(httpsStatus.warning);
    }
  }

  if (!noUpdate && !installOnly) {
    void runBackgroundUpdateCheck({
      config,
      paths,
      currentVersion: installed.version,
      logger,
    });
  }

  if (installOnly) {
    logger.info(`Claustrum MCP runtime installed at ${installed.versionDir}`);
    return;
  }

  const state = await readStateFile({ stateFile: paths.stateFile }, logger);
  const apiKey = (state.api_key || config.apiKey || '').trim();
  if (!apiKey) {
    throw new Error('Missing API key. Run: claustrum-mcp login --api-key <key>');
  }

  const workspaceKey = (state.workspace_key || config.workspaceKey || 'personal').trim();
  const deviceLabel = (state.device_label || config.deviceLabel || os.hostname()).trim();

  await runStdioBridge({
    config: {
      baseUrl: config.baseUrl,
      apiKey,
      bearerToken: config.bearerToken,
      workspaceKey,
      deviceLabel,
      timeoutMs: config.requestTimeoutMs,
      retryCount: config.requestRetryCount,
    },
    logger,
  });

  await logger.drain();
}

main().catch((error) => {
  process.stderr.write(`[claustrum-mcp:error] startup failed ${String(error)}\n`);
  process.exit(1);
});
