import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Logger, parseLogLevel } from './logger.js';
import { detectGitContext } from './git-context.js';
import { decideContextTransition, splitProjectKey, type SessionState } from './context-policy.js';
import { detectSubproject } from './monorepo-detection.js';
import { resolveProjectKeyByContextMode, type MonorepoContextMode } from './monorepo-context-mode.js';
import { runCaptureCommand, runInstallHooksCommand } from './capture-mode.js';
import { tools } from './tools.js';
import { handleToolCall } from './tool-call-handler.js';
import { loadConfig } from './config.js';
import type {
  ProjectSummary,
  ResolveResponse,
  WorkspaceSettingsResponse,
} from './types.js';

const config = loadConfig();
const MEMORY_CORE_URL = config.memoryCoreUrl;
const MEMORY_CORE_API_KEY = config.memoryCoreApiKey;
const DEFAULT_WORKSPACE_KEY = config.defaultWorkspaceKey;
const logger = new Logger(parseLogLevel(config.logLevel));
const installedHookRepos = new Set<string>();
const MANAGED_HOOK_MARKER = '# claustrum-managed hook';
const CLI_SCRIPT_PATH = path.resolve(process.argv[1] || '');

let activeWorkspaceKey: string | null = null;
const sessionState: SessionState = {
  currentProjectKey: null,
  currentRepoKey: null,
  currentSubprojectKey: null,
  pinMode: false,
};

async function runMcpServer() {
  if (!MEMORY_CORE_URL) {
    throw new Error(
      'MEMORY_CORE_URL is required (e.g. http://memory-core:8080 in docker network).'
    );
  }
  if (!MEMORY_CORE_API_KEY.trim()) {
    throw new Error('MEMORY_CORE_API_KEY is required.');
  }

  const server = new Server(
    { name: 'claustrum-mcp-adapter', version: '0.2.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: { params: { name: string; arguments?: unknown } }) =>
      handleToolCall(request, {
        defaultWorkspaceKey: DEFAULT_WORKSPACE_KEY,
        getActiveWorkspaceKey: () => activeWorkspaceKey,
        setActiveWorkspaceKey: (key) => {
          activeWorkspaceKey = key;
        },
        sessionState,
        logger,
        toErrorMessage,
        textResult,
        ensureGitHooksInstalledForCwd,
        listProjects,
        getWorkspaceSettings,
        resolveProject,
        setSessionProject,
        ensureContext,
        resolveProjectKeyOverride,
        requestJson,
      })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

type EnsureContextResult = {
  workspaceKey: string;
  projectKey: string;
  repoKey: string | null;
  subprojectKey: string | null;
  pinMode: boolean;
};

async function ensureContext(): Promise<EnsureContextResult> {
  if (!activeWorkspaceKey) {
    activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
  }
  const workspaceSettings = await getWorkspaceSettings();
  const monorepoContextMode: MonorepoContextMode =
    workspaceSettings.monorepo_context_mode === 'shared_repo'
      ? 'shared_repo'
      : workspaceSettings.monorepo_context_mode;
  const gitContext = await detectGitContext(process.cwd(), {
    enableMonorepoDetection: false,
  });
  if (gitContext.repo_root) {
    await ensureGitHooksInstalled(gitContext.repo_root, activeWorkspaceKey || DEFAULT_WORKSPACE_KEY);
  }
  let repoResolved: ResolveResponse;
  try {
    repoResolved = await resolveProjectFromContext(gitContext, {
      includeMonorepo: false,
    });
  } catch (error) {
    if (sessionState.currentProjectKey) {
      return {
        workspaceKey: activeWorkspaceKey,
        projectKey: sessionState.currentProjectKey,
        repoKey: sessionState.currentRepoKey,
        subprojectKey: sessionState.currentSubprojectKey,
        pinMode: sessionState.pinMode,
      };
    }
    throw error;
  }
  activeWorkspaceKey = repoResolved.workspace_key;
  const repoProject = splitProjectKey(repoResolved.project.key);
  let detectedSubprojectKey: string | null = null;
  if (
    workspaceSettings.enable_monorepo_resolution === true &&
    gitContext.repo_root &&
    gitContext.cwd
  ) {
    detectedSubprojectKey = await detectSubproject(gitContext.repo_root, gitContext.cwd, {
      monorepoDetectionLevel: workspaceSettings.monorepo_detection_level ?? 2,
      monorepoWorkspaceGlobs: workspaceSettings.monorepo_workspace_globs ?? ['apps/*', 'packages/*'],
      monorepoExcludeGlobs:
        workspaceSettings.monorepo_exclude_globs ??
        ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '.next/**'],
      monorepoRootMarkers:
        workspaceSettings.monorepo_root_markers ??
        ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'],
      monorepoMaxDepth: workspaceSettings.monorepo_max_depth ?? 3,
    });
    if (detectedSubprojectKey) {
      gitContext.monorepo = {
        enabled: true,
        candidate_subpaths: [detectedSubprojectKey],
      };
    }
  }

  let splitResolvedProjectKey: string | null = null;
  if (detectedSubprojectKey && monorepoContextMode !== 'shared_repo') {
    try {
      const subprojectResolved = await resolveProjectFromContext(gitContext, {
        includeMonorepo: true,
      });
      splitResolvedProjectKey = subprojectResolved.project.key;
    } catch (error) {
      logger.warn('subproject resolution failed; falling back to repo project', toErrorMessage(error));
    }
  }
  const candidateProjectKey = resolveProjectKeyByContextMode({
    mode: monorepoContextMode,
    repoProjectKey: repoResolved.project.key,
    splitProjectKey: splitResolvedProjectKey,
  });

  const candidate = splitProjectKey(candidateProjectKey);
  const decision = decideContextTransition(
    sessionState,
    {
      autoSwitchRepo: workspaceSettings.auto_switch_repo,
      autoSwitchSubproject: workspaceSettings.auto_switch_subproject,
    },
    {
      projectKey: candidateProjectKey,
      repoKey: repoProject.repoKey || candidate.repoKey,
      subprojectKey: monorepoContextMode !== 'shared_repo' ? detectedSubprojectKey : null,
    }
  );

  applySessionState(decision.next);
  if (monorepoContextMode === 'shared_repo') {
    sessionState.currentSubprojectKey = detectedSubprojectKey;
  }
  if (decision.switched && sessionState.currentProjectKey) {
    console.error(`[memory-core] auto-switched project to ${sessionState.currentProjectKey}`);
  }

  if (!sessionState.currentProjectKey) {
    setSessionProject(candidateProjectKey, sessionState.pinMode);
    if (monorepoContextMode === 'shared_repo') {
      sessionState.currentSubprojectKey = detectedSubprojectKey;
    }
  }

  return {
    workspaceKey: activeWorkspaceKey,
    projectKey: sessionState.currentProjectKey || candidateProjectKey,
    repoKey: sessionState.currentRepoKey,
    subprojectKey: sessionState.currentSubprojectKey,
    pinMode: sessionState.pinMode,
  };
}

async function resolveProject(options: {
  manualProjectKey?: string;
  includeMonorepo: boolean;
}): Promise<ResolveResponse> {
  const gitContext = await detectGitContext(process.cwd(), {
    enableMonorepoDetection: false,
  });
  return resolveProjectFromContext(gitContext, options);
}

async function resolveProjectFromContext(
  gitContext: Awaited<ReturnType<typeof detectGitContext>>,
  options: {
    manualProjectKey?: string;
    includeMonorepo: boolean;
  }
): Promise<ResolveResponse> {
  if (!activeWorkspaceKey) {
    activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
  }

  const payload: Record<string, unknown> = {
    workspace_key: activeWorkspaceKey,
  };
  if (gitContext.github_remote) {
    payload.github_remote = gitContext.github_remote;
  }
  if (gitContext.repo_root_slug) {
    payload.repo_root_slug = gitContext.repo_root_slug;
  }
  if (gitContext.repo_root) {
    payload.repo_root = gitContext.repo_root;
  }
  if (gitContext.cwd) {
    payload.cwd = gitContext.cwd;
  }
  if (gitContext.relative_path) {
    payload.relative_path = gitContext.relative_path;
  }
  if (options.includeMonorepo && gitContext.monorepo?.candidate_subpaths?.length) {
    payload.monorepo = {
      enabled: gitContext.monorepo.enabled ?? true,
      candidate_subpaths: gitContext.monorepo.candidate_subpaths,
    };
  } else if (!options.includeMonorepo) {
    payload.monorepo = {
      enabled: false,
    };
  }
  if (options.manualProjectKey) {
    payload.manual_project_key = options.manualProjectKey;
  }

  return requestJson<ResolveResponse>('/v1/resolve-project', {
    method: 'POST',
    body: payload,
  });
}

async function resolveProjectKeyOverride(projectKey: string, workspaceKey: string): Promise<string> {
  const resolved = await requestJson<ResolveResponse>('/v1/resolve-project', {
    method: 'POST',
    body: {
      workspace_key: workspaceKey,
      manual_project_key: projectKey,
      monorepo: {
        enabled: false,
      },
    },
  });
  return resolved.project.key;
}

async function getWorkspaceSettings(): Promise<WorkspaceSettingsResponse> {
  if (!activeWorkspaceKey) {
    activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
  }
  const query = new URLSearchParams({
    workspace_key: activeWorkspaceKey,
  });
  return requestJson<WorkspaceSettingsResponse>(`/v1/workspace-settings?${query.toString()}`, {
    method: 'GET',
  });
}

function setSessionProject(projectKey: string, pinMode: boolean): void {
  const parsed = splitProjectKey(projectKey);
  sessionState.currentProjectKey = projectKey;
  sessionState.currentRepoKey = parsed.repoKey;
  sessionState.currentSubprojectKey = parsed.subprojectKey;
  sessionState.pinMode = pinMode;
}

function applySessionState(next: SessionState): void {
  sessionState.currentProjectKey = next.currentProjectKey;
  sessionState.currentRepoKey = next.currentRepoKey;
  sessionState.currentSubprojectKey = next.currentSubprojectKey;
  sessionState.pinMode = next.pinMode;
}

async function listProjects(workspaceKey: string): Promise<ProjectSummary[]> {
  const response = await requestJson<{ projects: ProjectSummary[] }>(
    `/v1/projects?workspace_key=${encodeURIComponent(workspaceKey)}`,
    {
      method: 'GET',
    }
  );
  return response.projects;
}

async function requestJson<T>(
  pathname: string,
  options: {
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
  }
): Promise<T> {
  const response = await fetch(`${MEMORY_CORE_URL}${pathname}`, {
    method: options.method,
    headers: {
      authorization: `Bearer ${MEMORY_CORE_API_KEY}`,
      'content-type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return payload as T;
}

function textResult(text: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text }] };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'unknown error';
}

async function ensureGitHooksInstalledForCwd(workspaceKey: string): Promise<void> {
  const gitContext = await detectGitContext(process.cwd(), {
    enableMonorepoDetection: false,
  });
  if (!gitContext.repo_root) {
    return;
  }
  await ensureGitHooksInstalled(gitContext.repo_root, workspaceKey);
}

async function ensureGitHooksInstalled(repoRoot: string, workspaceKey: string): Promise<void> {
  const cacheKey = `${repoRoot}::${workspaceKey}`;
  if (installedHookRepos.has(cacheKey)) {
    return;
  }

  const hooksDir = path.join(repoRoot, '.git', 'hooks');
  await mkdir(hooksDir, { recursive: true });

  const nodePath = shellEscape(process.execPath);
  const scriptPath = shellEscape(CLI_SCRIPT_PATH);
  const coreUrl = shellEscape(MEMORY_CORE_URL);
  const apiKey = shellEscape(MEMORY_CORE_API_KEY);
  const workspace = shellEscape(workspaceKey);

  const basePrefix = `MEMORY_CORE_URL=${coreUrl} MEMORY_CORE_API_KEY=${apiKey} MEMORY_CORE_WORKSPACE_KEY=${workspace} ${nodePath} ${scriptPath} capture`;
  const hookContents: Array<{ name: 'post-commit' | 'post-merge' | 'post-checkout'; body: string }> = [
    {
      name: 'post-commit',
      body: `${basePrefix} --event post_commit`,
    },
    {
      name: 'post-merge',
      body: `${basePrefix} --event post_merge --squash "$1"`,
    },
    {
      name: 'post-checkout',
      body: `${basePrefix} --event post_checkout --from-ref "$1" --to-ref "$2" --checkout-flag "$3"`,
    },
  ];

  for (const hook of hookContents) {
    const hookPath = path.join(hooksDir, hook.name);
    const content = `#!/bin/sh
${MANAGED_HOOK_MARKER}: ${hook.name}
(
  ${hook.body} >/dev/null 2>&1
) &
exit 0
`;
    await writeManagedHook(hookPath, content);
  }

  installedHookRepos.add(cacheKey);
}

async function writeManagedHook(hookPath: string, content: string): Promise<void> {
  let existing = '';
  try {
    existing = await readFile(hookPath, 'utf8');
  } catch {
    existing = '';
  }
  if (existing && !existing.includes(MANAGED_HOOK_MARKER)) {
    logger.warn(`existing hook is not managed by claustrum, skipped: ${hookPath}`);
    return;
  }
  await writeFile(hookPath, content, 'utf8');
  await chmod(hookPath, 0o755);
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function captureDeps() {
  return {
    memoryCoreUrl: MEMORY_CORE_URL,
    memoryCoreApiKey: MEMORY_CORE_API_KEY,
    defaultWorkspaceKey: DEFAULT_WORKSPACE_KEY,
    setActiveWorkspaceKey: (workspaceKey: string) => {
      activeWorkspaceKey = workspaceKey;
    },
    getWorkspaceSettings,
    resolveProjectFromContext,
    requestJson,
    ensureGitHooksInstalledForCwd,
    logger,
  };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'capture') {
    await runCaptureCommand(rest, captureDeps());
    return;
  }
  if (command === 'install-hooks') {
    await runInstallHooksCommand(rest, captureDeps());
    return;
  }
  await runMcpServer();
}

main().catch((error) => {
  logger.error('startup failed', error);
  process.exit(1);
});
