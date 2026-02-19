import { memoryTypeSchema } from '@claustrum/shared';
import type { Logger } from './logger.js';
import type { SessionState } from './context-policy.js';
import {
  attachSubpathMetadata,
  shouldUseCurrentSubpathBoost,
  type MonorepoContextMode,
} from './monorepo-context-mode.js';
import type {
  ContextBundleResponse,
  MemoryRow,
  ProjectSummary,
  RawSearchMatch,
  ResolveResponse,
  WorkspaceSettingsResponse,
} from './types.js';
import { toolArgSchemas, type ToolSchemaName } from './tool-input-schemas.js';
import { handleIntegrationToolCall } from './tool-call-integrations.js';

type EnsureContextResult = {
  workspaceKey: string;
  projectKey: string;
  repoKey: string | null;
  subprojectKey: string | null;
  pinMode: boolean;
};

export type TextResult = { content: Array<{ type: 'text'; text: string }> };

export type ToolHandlerDeps = {
  defaultWorkspaceKey: string;
  getActiveWorkspaceKey: () => string | null;
  setActiveWorkspaceKey: (key: string | null) => void;
  sessionState: SessionState;
  logger: Logger;
  toErrorMessage: (error: unknown) => string;
  textResult: (text: string) => TextResult;
  ensureGitHooksInstalledForCwd: (workspaceKey: string) => Promise<void>;
  listProjects: (workspaceKey: string) => Promise<ProjectSummary[]>;
  getWorkspaceSettings: () => Promise<WorkspaceSettingsResponse>;
  resolveProject: (options: {
    manualProjectKey?: string;
    includeMonorepo: boolean;
  }) => Promise<ResolveResponse>;
  setSessionProject: (projectKey: string, pinMode: boolean) => void;
  ensureContext: () => Promise<EnsureContextResult>;
  resolveProjectKeyOverride: (projectKey: string, workspaceKey: string) => Promise<string>;
  requestJson: <T>(
    pathname: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
    }
  ) => Promise<T>;
};

export async function handleToolCall(
  request: { params: { name: string; arguments?: unknown } },
  deps: ToolHandlerDeps
): Promise<TextResult> {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments || {}) as Record<string, unknown>;
  const parsedArgsResult = parseToolArgs(toolName, rawArgs);
  if (!parsedArgsResult.ok) {
    return deps.textResult(parsedArgsResult.message);
  }
  const args = parsedArgsResult.args;

  if (toolName === 'set_workspace') {
    const key = String(args.key || '').trim();
    if (!key) {
      return deps.textResult('Missing key');
    }
    await deps.listProjects(key);
    deps.setActiveWorkspaceKey(key);
    deps.sessionState.currentProjectKey = null;
    deps.sessionState.currentRepoKey = null;
    deps.sessionState.currentSubprojectKey = null;
    deps.sessionState.pinMode = false;
    try {
      await deps.ensureGitHooksInstalledForCwd(key);
    } catch (error) {
      deps.logger.warn('git hook install skipped on set_workspace', deps.toErrorMessage(error));
    }
    return deps.textResult(`Workspace selected: ${key}`);
  }

  if (toolName === 'set_project') {
    const key = String(args.key || '').trim();
    if (!key) {
      return deps.textResult('Missing key');
    }
    const workspaceSettings = await deps.getWorkspaceSettings();
    if (!workspaceSettings.allow_manual_pin) {
      return deps.textResult('Manual pin is disabled by workspace policy.');
    }
    const resolved = await deps.resolveProject({
      manualProjectKey: key,
      includeMonorepo: false,
    });
    deps.setSessionProject(resolved.project.key, true);
    return deps.textResult(
      `Project selected: ${resolved.project.key} (${resolved.resolution}, pin=true)`
    );
  }

  if (toolName === 'unset_project_pin') {
    deps.sessionState.pinMode = false;
    return deps.textResult('Pin mode disabled');
  }

  if (toolName === 'get_current_project') {
    return deps.textResult(
      JSON.stringify(
        {
          workspace_key: deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey,
          current_project_key: deps.sessionState.currentProjectKey,
          current_repo_key: deps.sessionState.currentRepoKey,
          current_subproject_key: deps.sessionState.currentSubprojectKey,
          pin_mode: deps.sessionState.pinMode,
        },
        null,
        2
      )
    );
  }

  if (toolName === 'remember') {
    const context = await deps.ensureContext();
    const workspaceSettings = await deps.getWorkspaceSettings();
    const monorepoContextMode: MonorepoContextMode =
      workspaceSettings.monorepo_context_mode === 'shared_repo'
        ? 'shared_repo'
        : workspaceSettings.monorepo_context_mode;
    const type = memoryTypeSchema.parse(args.type);
    const content = String(args.content || '').trim();
    if (!content) {
      return deps.textResult('Missing content');
    }
    const metadata =
      args.metadata && typeof args.metadata === 'object'
        ? (args.metadata as Record<string, unknown>)
        : undefined;

    await preloadContextBundle({
      deps,
      workspaceKey: context.workspaceKey,
      projectKey: context.projectKey,
      currentSubpath: context.subprojectKey || undefined,
    });

    const mergedMetadata = attachSubpathMetadata({
      mode: monorepoContextMode,
      metadata,
      subpath: context.subprojectKey,
      enabled: workspaceSettings.monorepo_subpath_metadata_enabled !== false,
    });

    const memory = await deps.requestJson<{ id: string }>('/v1/memories', {
      method: 'POST',
      body: {
        workspace_key: context.workspaceKey,
        project_key: context.projectKey,
        type,
        content,
        metadata: mergedMetadata,
      },
    });
    return deps.textResult(`Stored memory ${memory.id} in ${context.projectKey}`);
  }

  if (toolName === 'recall') {
    const context = await deps.ensureContext();
    const workspaceSettings = await deps.getWorkspaceSettings();
    const monorepoContextMode: MonorepoContextMode =
      workspaceSettings.monorepo_context_mode === 'shared_repo'
        ? 'shared_repo'
        : workspaceSettings.monorepo_context_mode;
    const projectOverride = args.project_key ? String(args.project_key).trim() : '';
    const queryProjectKey = projectOverride
      ? await deps.resolveProjectKeyOverride(projectOverride, context.workspaceKey)
      : context.projectKey;

    await preloadContextBundle({
      deps,
      workspaceKey: context.workspaceKey,
      projectKey: queryProjectKey,
      query: args.q ? String(args.q) : undefined,
      currentSubpath: context.subprojectKey || undefined,
    });

    const query = new URLSearchParams({
      workspace_key: context.workspaceKey,
      project_key: queryProjectKey,
      mode: 'hybrid',
    });
    if (args.q) {
      query.set('q', String(args.q));
    }
    if (args.type) {
      query.set('type', memoryTypeSchema.parse(args.type));
    }
    if (typeof args.limit === 'number') {
      query.set('limit', String(args.limit));
    }
    if (args.since) {
      query.set('since', String(args.since));
    }
    if (args.mode) {
      const mode = String(args.mode).trim();
      if (mode === 'keyword' || mode === 'semantic' || mode === 'hybrid') {
        query.set('mode', mode);
      }
    }
    if (
      shouldUseCurrentSubpathBoost({
        mode: monorepoContextMode,
        enabled: workspaceSettings.monorepo_subpath_boost_enabled !== false,
        currentSubpath: context.subprojectKey,
      })
    ) {
      query.set('current_subpath', String(context.subprojectKey));
    }

    const response = await deps.requestJson<{ memories: MemoryRow[] }>(
      `/v1/memories?${query.toString()}`,
      {
        method: 'GET',
      }
    );

    const lines = response.memories.map((memory) => {
      return `[${memory.createdAt}] [${memory.project.workspace.key}/${memory.project.key}] [${memory.type}] ${memory.content}`;
    });
    return deps.textResult(lines.length > 0 ? lines.join('\n') : 'No memories found');
  }

  if (toolName === 'list_projects') {
    const workspaceKey = String(
      args.workspace_key || deps.getActiveWorkspaceKey() || deps.defaultWorkspaceKey
    ).trim();
    const projects = await deps.listProjects(workspaceKey);
    const text = projects.map((project) => `${project.key}\t${project.name}`).join('\n');
    return deps.textResult(text || 'No projects');
  }

  if (toolName === 'context_bundle') {
    const context = await deps.ensureContext();
    const projectOverride = args.project_key ? String(args.project_key).trim() : '';
    const queryProjectKey = projectOverride
      ? await deps.resolveProjectKeyOverride(projectOverride, context.workspaceKey)
      : context.projectKey;
    const query = new URLSearchParams({
      workspace_key: context.workspaceKey,
      project_key: queryProjectKey,
      mode: args.mode === 'debug' ? 'debug' : 'default',
    });
    if (args.q) {
      query.set('q', String(args.q));
    }
    if (typeof args.budget === 'number' && Number.isFinite(args.budget)) {
      query.set('budget', String(Math.min(Math.max(Math.round(args.budget), 300), 8000)));
    }
    const currentSubpath = String(args.current_subpath || '').trim() || context.subprojectKey || '';
    if (currentSubpath) {
      query.set('current_subpath', currentSubpath);
    }
    const bundle = await deps.requestJson<ContextBundleResponse>(
      `/v1/context/bundle?${query.toString()}`,
      {
        method: 'GET',
      }
    );
    return deps.textResult(JSON.stringify(bundle, null, 2));
  }

  if (toolName === 'search_raw') {
    const context = await deps.ensureContext();
    const q = String(args.q || '').trim();
    if (!q) {
      return deps.textResult('q is required');
    }

    const workspaceKey = context.workspaceKey;
    const projectKey = args.project_key ? String(args.project_key).trim() : context.projectKey || '';
    const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 20) : 10;

    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      q,
      limit: String(limit),
      max_chars: '500',
    });
    if (projectKey) {
      query.set('project_key', projectKey);
    }
    const response = await deps.requestJson<{ matches: RawSearchMatch[] }>(
      `/v1/raw/search?${query.toString()}`,
      {
        method: 'GET',
      }
    );
    const lines = response.matches.map((match) => {
      const scope = match.project_key ? `${workspaceKey}/${match.project_key}` : workspaceKey;
      return `[${match.created_at}] [${scope}] [${match.role}] ${match.snippet}`;
    });
    return deps.textResult(lines.length > 0 ? lines.join('\n') : 'No raw snippet matches');
  }

  const integrationResult = await handleIntegrationToolCall({
    toolName,
    toolArgs: args,
    deps,
  });
  if (integrationResult) {
    return integrationResult;
  }

  return deps.textResult(`Unknown tool: ${toolName}`);
}

function parseToolArgs(
  toolName: string,
  rawArgs: Record<string, unknown>
): { ok: true; args: Record<string, unknown> } | { ok: false; message: string } {
  const schema = toolArgSchemas[toolName as ToolSchemaName];
  if (!schema) {
    return { ok: true, args: rawArgs };
  }

  const parsed = schema.safeParse(rawArgs);
  if (parsed.success) {
    return { ok: true, args: parsed.data as Record<string, unknown> };
  }

  const details = parsed.error.issues
    .map((issue: { path: Array<string | number>; message: string }) => {
      const location = issue.path.length > 0 ? issue.path.join('.') : 'input';
      return `${location}: ${issue.message}`;
    })
    .join('; ');
  return { ok: false, message: `Invalid arguments for ${toolName}: ${details}` };
}

async function preloadContextBundle(args: {
  deps: ToolHandlerDeps;
  workspaceKey: string;
  projectKey: string;
  query?: string;
  currentSubpath?: string;
}): Promise<void> {
  try {
    const query = new URLSearchParams({
      workspace_key: args.workspaceKey,
      project_key: args.projectKey,
      mode: 'default',
      budget: '1200',
    });
    if (args.query && args.query.trim()) {
      query.set('q', args.query.trim());
    }
    if (args.currentSubpath && args.currentSubpath.trim()) {
      query.set('current_subpath', args.currentSubpath.trim());
    }
    await args.deps.requestJson<ContextBundleResponse>(`/v1/context/bundle?${query.toString()}`, {
      method: 'GET',
    });
  } catch (error) {
    args.deps.logger.warn('context bundle preload skipped', args.deps.toErrorMessage(error));
  }
}
