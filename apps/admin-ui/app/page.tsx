'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminSessionSidebar } from './components/admin-session-sidebar';
import { AuditLogsPanel } from './components/audit-logs-panel';
import { CiEventsPanel } from './components/ci-events-panel';
import { IntegrationsPanel } from './components/integrations-panel';
import { ImportsPanel } from './components/imports-panel';
import { MemoriesPanel } from './components/memories-panel';
import { ProjectMappingsPanel } from './components/project-mappings-panel';
import { ProjectMembersPanel } from './components/project-members-panel';
import { ProjectsPanel } from './components/projects-panel';
import { RawEventsPanel } from './components/raw-events-panel';
import { RawSearchPanel } from './components/raw-search-panel';
import { ResolutionSettingsPanel } from './components/resolution-settings-panel';
import {
  RESOLUTION_KINDS,
  type AuditLogItem,
  type ImportItem,
  type ImportSource,
  type IntegrationProvider,
  type MonorepoMode,
  type IntegrationSettingsResponse,
  type MemoryItem,
  type Project,
  type ProjectMapping,
  type ProjectMember,
  type RawMessageDetail,
  type RawEventItem,
  type RawEventType,
  type RawSearchMatch,
  type ResolutionKind,
  type StagedMemoryItem,
  type User,
  type Workspace,
  type WorkspaceSettings,
} from './lib/types';
import { isSubprojectKey, toISOString } from './lib/utils';

const API_BASE_URL = (process.env.NEXT_PUBLIC_MEMORY_CORE_URL || '').trim();

function parseLineSeparatedValues(input: string): string[] {
  return input
    .split(/\r?\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function Page() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [newWorkspaceKey, setNewWorkspaceKey] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectViewFilter, setProjectViewFilter] = useState<'all' | 'repo_only' | 'subprojects_only'>('all');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');

  const [queryText, setQueryText] = useState('');
  const [queryType, setQueryType] = useState('');
  const [queryMode, setQueryMode] = useState<'hybrid' | 'keyword' | 'semantic'>('hybrid');
  const [queryStatus, setQueryStatus] = useState<'' | 'draft' | 'confirmed' | 'rejected'>('');
  const [querySource, setQuerySource] = useState<'' | 'auto' | 'human' | 'import'>('');
  const [queryConfidenceMin, setQueryConfidenceMin] = useState('');
  const [queryConfidenceMax, setQueryConfidenceMax] = useState('');
  const [querySince, setQuerySince] = useState('');
  const [queryLimit, setQueryLimit] = useState(50);
  const [scopeSelectedProject, setScopeSelectedProject] = useState(true);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [selectedMemoryId, setSelectedMemoryId] = useState('');
  const [selectedMemoryDraftContent, setSelectedMemoryDraftContent] = useState('');

  const [newMemoryType, setNewMemoryType] = useState('note');
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryMetadata, setNewMemoryMetadata] = useState('{"source":"admin-ui"}');

  const [resolutionOrder, setResolutionOrder] = useState<ResolutionKind[]>(RESOLUTION_KINDS);
  const [autoCreateProject, setAutoCreateProject] = useState(true);
  const [autoCreateProjectSubprojects, setAutoCreateProjectSubprojects] = useState(true);
  const [autoSwitchRepo, setAutoSwitchRepo] = useState(true);
  const [autoSwitchSubproject, setAutoSwitchSubproject] = useState(false);
  const [allowManualPin, setAllowManualPin] = useState(true);
  const [enableGitEvents, setEnableGitEvents] = useState(true);
  const [enableCommitEvents, setEnableCommitEvents] = useState(true);
  const [enableMergeEvents, setEnableMergeEvents] = useState(true);
  const [enableCheckoutEvents, setEnableCheckoutEvents] = useState(false);
  const [checkoutDebounceSeconds, setCheckoutDebounceSeconds] = useState(30);
  const [checkoutDailyLimit, setCheckoutDailyLimit] = useState(200);
  const [enableAutoExtraction, setEnableAutoExtraction] = useState(true);
  const [autoExtractionMode, setAutoExtractionMode] = useState<'draft_only' | 'auto_confirm'>(
    'draft_only'
  );
  const [autoConfirmMinConfidence, setAutoConfirmMinConfidence] = useState(0.85);
  const [autoConfirmAllowedEventTypesText, setAutoConfirmAllowedEventTypesText] = useState(
    'post_commit\npost_merge'
  );
  const [autoConfirmKeywordAllowlistText, setAutoConfirmKeywordAllowlistText] = useState(
    'migrate\nswitch\nremove\ndeprecate\nrename\nrefactor'
  );
  const [autoConfirmKeywordDenylistText, setAutoConfirmKeywordDenylistText] = useState(
    'wip\ntmp\ndebug\ntest\ntry'
  );
  const [autoExtractionBatchSize, setAutoExtractionBatchSize] = useState(20);
  const [searchDefaultMode, setSearchDefaultMode] = useState<'hybrid' | 'keyword' | 'semantic'>(
    'hybrid'
  );
  const [searchHybridAlpha, setSearchHybridAlpha] = useState(0.6);
  const [searchHybridBeta, setSearchHybridBeta] = useState(0.4);
  const [searchDefaultLimit, setSearchDefaultLimit] = useState(20);
  const [githubPrefix, setGithubPrefix] = useState('github:');
  const [localPrefix, setLocalPrefix] = useState('local:');
  const [enableMonorepoResolution, setEnableMonorepoResolution] = useState(false);
  const [monorepoDetectionLevel, setMonorepoDetectionLevel] = useState(2);
  const [monorepoMode, setMonorepoMode] = useState<MonorepoMode>('repo_hash_subpath');
  const [monorepoWorkspaceGlobsText, setMonorepoWorkspaceGlobsText] = useState('apps/*\npackages/*');
  const [monorepoExcludeGlobsText, setMonorepoExcludeGlobsText] = useState(
    '**/node_modules/**\n**/.git/**\n**/dist/**\n**/build/**\n.next/**'
  );
  const [monorepoRootMarkersText, setMonorepoRootMarkersText] = useState(
    'pnpm-workspace.yaml\nturbo.json\nnx.json\nlerna.json'
  );
  const [monorepoMaxDepth, setMonorepoMaxDepth] = useState(3);
  const [workspaceSettingsReason, setWorkspaceSettingsReason] = useState('');
  const [draggingKind, setDraggingKind] = useState<ResolutionKind | null>(null);

  const [mappings, setMappings] = useState<ProjectMapping[]>([]);
  const [newMappingKind, setNewMappingKind] = useState<ResolutionKind>('github_remote');
  const [newMappingExternalId, setNewMappingExternalId] = useState('');
  const [newMappingProjectKey, setNewMappingProjectKey] = useState('');
  const [newMappingPriority, setNewMappingPriority] = useState('');
  const [newMappingEnabled, setNewMappingEnabled] = useState(true);
  const [mappingReason, setMappingReason] = useState('');

  const [imports, setImports] = useState<ImportItem[]>([]);
  const [selectedImportId, setSelectedImportId] = useState('');
  const [importSource, setImportSource] = useState<ImportSource>('codex');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUseSelectedProject, setImportUseSelectedProject] = useState(true);
  const [stagedMemories, setStagedMemories] = useState<StagedMemoryItem[]>([]);
  const [selectedStagedIds, setSelectedStagedIds] = useState<string[]>([]);

  const [rawQuery, setRawQuery] = useState('');
  const [rawLimit, setRawLimit] = useState(10);
  const [rawUseSelectedProject, setRawUseSelectedProject] = useState(true);
  const [rawMatches, setRawMatches] = useState<RawSearchMatch[]>([]);
  const [selectedRawMessageId, setSelectedRawMessageId] = useState('');
  const [rawMessageDetail, setRawMessageDetail] = useState<RawMessageDetail | null>(null);
  const [rawEventProjectFilter, setRawEventProjectFilter] = useState('');
  const [rawEventTypeFilter, setRawEventTypeFilter] = useState<'' | RawEventType>('');
  const [rawEventCommitShaFilter, setRawEventCommitShaFilter] = useState('');
  const [rawEventFrom, setRawEventFrom] = useState('');
  const [rawEventTo, setRawEventTo] = useState('');
  const [rawEventLimit, setRawEventLimit] = useState(100);
  const [rawEvents, setRawEvents] = useState<RawEventItem[]>([]);

  const [ciStatus, setCiStatus] = useState<'success' | 'failure'>('failure');
  const [ciProvider, setCiProvider] = useState<'github_actions' | 'generic'>('github_actions');
  const [ciUseSelectedProject, setCiUseSelectedProject] = useState(true);
  const [ciWorkflowName, setCiWorkflowName] = useState('CI');
  const [ciWorkflowRunId, setCiWorkflowRunId] = useState('');
  const [ciWorkflowRunUrl, setCiWorkflowRunUrl] = useState('');
  const [ciRepository, setCiRepository] = useState('');
  const [ciBranch, setCiBranch] = useState('');
  const [ciSha, setCiSha] = useState('');
  const [ciEventName, setCiEventName] = useState('push');
  const [ciJobName, setCiJobName] = useState('');
  const [ciMessage, setCiMessage] = useState('');
  const [ciMetadata, setCiMetadata] = useState('{"source":"admin-ui"}');

  const [auditActionPrefix, setAuditActionPrefix] = useState('ci.');
  const [auditLimit, setAuditLimit] = useState(50);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [integrationStates, setIntegrationStates] = useState<IntegrationSettingsResponse['integrations']>({
    notion: { enabled: false, configured: false, source: 'none', has_token: false, write_enabled: false },
    jira: { enabled: false, configured: false, source: 'none', has_api_token: false },
    confluence: { enabled: false, configured: false, source: 'none', has_api_token: false },
    linear: { enabled: false, configured: false, source: 'none', has_api_key: false },
    slack: { enabled: false, configured: false, source: 'none', has_webhook: false, format: 'detailed' },
    audit_reasoner: {
      enabled: false,
      configured: false,
      source: 'none',
      has_api_key: false,
      provider_order: ['openai', 'claude', 'gemini'],
      has_openai_api_key: false,
      has_claude_api_key: false,
      has_gemini_api_key: false,
    },
  });
  const [notionEnabled, setNotionEnabled] = useState(false);
  const [notionToken, setNotionToken] = useState('');
  const [notionParentPageId, setNotionParentPageId] = useState('');
  const [notionWriteEnabled, setNotionWriteEnabled] = useState(false);
  const [notionWriteOnCommit, setNotionWriteOnCommit] = useState(false);
  const [notionWriteOnMerge, setNotionWriteOnMerge] = useState(false);
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraWriteOnCommit, setJiraWriteOnCommit] = useState(false);
  const [jiraWriteOnMerge, setJiraWriteOnMerge] = useState(false);
  const [confluenceEnabled, setConfluenceEnabled] = useState(false);
  const [confluenceBaseUrl, setConfluenceBaseUrl] = useState('');
  const [confluenceEmail, setConfluenceEmail] = useState('');
  const [confluenceToken, setConfluenceToken] = useState('');
  const [confluenceWriteOnCommit, setConfluenceWriteOnCommit] = useState(false);
  const [confluenceWriteOnMerge, setConfluenceWriteOnMerge] = useState(false);
  const [linearEnabled, setLinearEnabled] = useState(false);
  const [linearApiUrl, setLinearApiUrl] = useState('');
  const [linearApiKey, setLinearApiKey] = useState('');
  const [linearWriteOnCommit, setLinearWriteOnCommit] = useState(false);
  const [linearWriteOnMerge, setLinearWriteOnMerge] = useState(false);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackDefaultChannel, setSlackDefaultChannel] = useState('');
  const [slackActionPrefixes, setSlackActionPrefixes] = useState(
    'workspace_settings.,project_mapping.,integration.,git.,ci.'
  );
  const [slackFormat, setSlackFormat] = useState<'compact' | 'detailed'>('detailed');
  const [slackIncludeTargetJson, setSlackIncludeTargetJson] = useState(true);
  const [slackMaskSecrets, setSlackMaskSecrets] = useState(true);
  const [slackRoutesJson, setSlackRoutesJson] = useState('[]');
  const [slackSeverityRulesJson, setSlackSeverityRulesJson] = useState('[]');
  const [auditReasonerEnabled, setAuditReasonerEnabled] = useState(false);
  const [auditReasonerOrderCsv, setAuditReasonerOrderCsv] = useState('openai,claude,gemini');
  const [auditReasonerOpenAiModel, setAuditReasonerOpenAiModel] = useState('');
  const [auditReasonerOpenAiBaseUrl, setAuditReasonerOpenAiBaseUrl] = useState('');
  const [auditReasonerOpenAiApiKey, setAuditReasonerOpenAiApiKey] = useState('');
  const [auditReasonerClaudeModel, setAuditReasonerClaudeModel] = useState('');
  const [auditReasonerClaudeBaseUrl, setAuditReasonerClaudeBaseUrl] = useState('');
  const [auditReasonerClaudeApiKey, setAuditReasonerClaudeApiKey] = useState('');
  const [auditReasonerGeminiModel, setAuditReasonerGeminiModel] = useState('');
  const [auditReasonerGeminiBaseUrl, setAuditReasonerGeminiBaseUrl] = useState('');
  const [auditReasonerGeminiApiKey, setAuditReasonerGeminiApiKey] = useState('');
  const [integrationReason, setIntegrationReason] = useState('');
  const missingCoreUrl = !API_BASE_URL;

  useEffect(() => {
    const stored = window.localStorage.getItem('memory-core-admin-key');
    if (stored) {
      setApiKeyInput(stored);
      setApiKey(stored);
    }
  }, []);

  const selectedMemory = useMemo(
    () => memories.find((memory) => memory.id === selectedMemoryId) || null,
    [memories, selectedMemoryId]
  );
  const selectedImport = useMemo(
    () => imports.find((item) => item.id === selectedImportId) || null,
    [imports, selectedImportId]
  );
  useEffect(() => {
    setSelectedMemoryDraftContent(selectedMemory?.content || '');
  }, [selectedMemory]);
  const filteredProjects = useMemo(() => {
    if (projectViewFilter === 'repo_only') {
      return projects.filter((project) => !isSubprojectKey(project.key));
    }
    if (projectViewFilter === 'subprojects_only') {
      return projects.filter((project) => isSubprojectKey(project.key));
    }
    return projects;
  }, [projectViewFilter, projects]);
  const notionLocked = integrationStates.notion.locked === true;
  const jiraLocked = integrationStates.jira.locked === true;
  const confluenceLocked = integrationStates.confluence.locked === true;
  const linearLocked = integrationStates.linear.locked === true;
  const slackLocked = integrationStates.slack.locked === true;
  const auditReasonerLocked = integrationStates.audit_reasoner.locked === true;

  useEffect(() => {
    if (!apiKey || missingCoreUrl) {
      return;
    }
    void initializeData().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, missingCoreUrl]);

  useEffect(() => {
    if (!apiKey || !selectedWorkspace || missingCoreUrl) {
      setProjects([]);
      setMembers([]);
      setMemories([]);
      setMappings([]);
      setImports([]);
      setSelectedImportId('');
      setStagedMemories([]);
      setSelectedStagedIds([]);
      setRawMatches([]);
      setRawMessageDetail(null);
      setRawEvents([]);
      setAuditLogs([]);
      setIntegrationStates({
        notion: { enabled: false, configured: false, source: 'none', has_token: false, write_enabled: false },
        jira: { enabled: false, configured: false, source: 'none', has_api_token: false },
        confluence: { enabled: false, configured: false, source: 'none', has_api_token: false },
        linear: { enabled: false, configured: false, source: 'none', has_api_key: false },
        slack: { enabled: false, configured: false, source: 'none', has_webhook: false, format: 'detailed' },
        audit_reasoner: {
          enabled: false,
          configured: false,
          source: 'none',
          has_api_key: false,
          provider_order: ['openai', 'claude', 'gemini'],
          has_openai_api_key: false,
          has_claude_api_key: false,
          has_gemini_api_key: false,
        },
      });
      setNotionEnabled(false);
      setNotionToken('');
      setNotionParentPageId('');
      setNotionWriteEnabled(false);
      setNotionWriteOnCommit(false);
      setNotionWriteOnMerge(false);
      setJiraEnabled(false);
      setJiraBaseUrl('');
      setJiraEmail('');
      setJiraToken('');
      setJiraWriteOnCommit(false);
      setJiraWriteOnMerge(false);
      setConfluenceEnabled(false);
      setConfluenceBaseUrl('');
      setConfluenceEmail('');
      setConfluenceToken('');
      setConfluenceWriteOnCommit(false);
      setConfluenceWriteOnMerge(false);
      setLinearEnabled(false);
      setLinearApiUrl('');
      setLinearApiKey('');
      setLinearWriteOnCommit(false);
      setLinearWriteOnMerge(false);
      setSlackEnabled(false);
      setSlackWebhookUrl('');
      setSlackDefaultChannel('');
      setSlackActionPrefixes('workspace_settings.,project_mapping.,integration.,git.,ci.');
      setSlackFormat('detailed');
      setSlackIncludeTargetJson(true);
      setSlackMaskSecrets(true);
      setSlackRoutesJson('[]');
      setSlackSeverityRulesJson('[]');
      setAuditReasonerEnabled(false);
      setAuditReasonerOrderCsv('openai,claude,gemini');
      setAuditReasonerOpenAiModel('');
      setAuditReasonerOpenAiBaseUrl('');
      setAuditReasonerOpenAiApiKey('');
      setAuditReasonerClaudeModel('');
      setAuditReasonerClaudeBaseUrl('');
      setAuditReasonerClaudeApiKey('');
      setAuditReasonerGeminiModel('');
      setAuditReasonerGeminiBaseUrl('');
      setAuditReasonerGeminiApiKey('');
      setResolutionOrder(RESOLUTION_KINDS);
      setAutoCreateProject(true);
      setAutoCreateProjectSubprojects(true);
      setAutoSwitchRepo(true);
      setAutoSwitchSubproject(false);
      setAllowManualPin(true);
      setEnableGitEvents(true);
      setEnableCommitEvents(true);
      setEnableMergeEvents(true);
      setEnableCheckoutEvents(false);
      setCheckoutDebounceSeconds(30);
      setCheckoutDailyLimit(200);
      setEnableAutoExtraction(true);
      setAutoExtractionMode('draft_only');
      setAutoConfirmMinConfidence(0.85);
      setAutoConfirmAllowedEventTypesText('post_commit\npost_merge');
      setAutoConfirmKeywordAllowlistText('migrate\nswitch\nremove\ndeprecate\nrename\nrefactor');
      setAutoConfirmKeywordDenylistText('wip\ntmp\ndebug\ntest\ntry');
      setAutoExtractionBatchSize(20);
      setSearchDefaultMode('hybrid');
      setSearchHybridAlpha(0.6);
      setSearchHybridBeta(0.4);
      setSearchDefaultLimit(20);
      setGithubPrefix('github:');
      setLocalPrefix('local:');
      setEnableMonorepoResolution(false);
      setMonorepoDetectionLevel(2);
      setMonorepoMode('repo_hash_subpath');
      setMonorepoWorkspaceGlobsText('apps/*\npackages/*');
      setMonorepoExcludeGlobsText(
        '**/node_modules/**\n**/.git/**\n**/dist/**\n**/build/**\n.next/**'
      );
      setMonorepoRootMarkersText('pnpm-workspace.yaml\nturbo.json\nnx.json\nlerna.json');
      setMonorepoMaxDepth(3);
      return;
    }
    void Promise.all([
      loadProjects(selectedWorkspace),
      loadWorkspaceSettings(selectedWorkspace),
      loadProjectMappings(selectedWorkspace),
      loadImports(selectedWorkspace),
      loadRawEvents(),
      loadAuditLogs(selectedWorkspace),
      loadIntegrations(selectedWorkspace),
    ]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, selectedWorkspace, missingCoreUrl]);

  useEffect(() => {
    if (!apiKey || !selectedWorkspace || !selectedProject || missingCoreUrl) {
      setMembers([]);
      return;
    }
    void loadMembers(selectedWorkspace, selectedProject).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, selectedWorkspace, selectedProject, missingCoreUrl]);

  useEffect(() => {
    if (!apiKey || !selectedImportId || missingCoreUrl) {
      setStagedMemories([]);
      setSelectedStagedIds([]);
      return;
    }
    void loadStagedMemories(selectedImportId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, selectedImportId, missingCoreUrl]);

  async function initializeData() {
    await Promise.all([loadWorkspaces(), loadUsers()]);
  }

  async function loadWorkspaces() {
    const data = await callApi<{ workspaces: Workspace[] }>('/v1/workspaces');
    setWorkspaces(data.workspaces);
    if (!selectedWorkspace && data.workspaces.length > 0) {
      setSelectedWorkspace(data.workspaces[0].key);
    }
  }

  async function loadUsers() {
    const data = await callApi<{ users: User[] }>('/v1/users');
    setUsers(data.users);
  }

  async function loadProjects(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<{ projects: Project[] }>(`/v1/projects?${query.toString()}`);
    setProjects(data.projects);
    if (!data.projects.some((project) => project.key === selectedProject)) {
      setSelectedProject(data.projects[0]?.key || '');
    }
    if (!newMappingProjectKey && data.projects.length > 0) {
      setNewMappingProjectKey(data.projects[0].key);
    }
  }

  async function loadMembers(workspaceKey: string, projectKey: string) {
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      project_key: projectKey,
    });
    const data = await callApi<{ members: ProjectMember[] }>(`/v1/project-members?${query.toString()}`);
    setMembers(data.members);
  }

  async function loadWorkspaceSettings(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const settings = await callApi<WorkspaceSettings>(`/v1/workspace-settings?${query.toString()}`);
    setResolutionOrder(settings.resolution_order);
    setAutoCreateProject(settings.auto_create_project);
    setAutoCreateProjectSubprojects(settings.auto_create_project_subprojects);
    setAutoSwitchRepo(settings.auto_switch_repo ?? true);
    setAutoSwitchSubproject(settings.auto_switch_subproject ?? false);
    setAllowManualPin(settings.allow_manual_pin ?? true);
    setEnableGitEvents(settings.enable_git_events ?? true);
    setEnableCommitEvents(settings.enable_commit_events ?? true);
    setEnableMergeEvents(settings.enable_merge_events ?? true);
    setEnableCheckoutEvents(settings.enable_checkout_events ?? false);
    setCheckoutDebounceSeconds(settings.checkout_debounce_seconds ?? 30);
    setCheckoutDailyLimit(settings.checkout_daily_limit ?? 200);
    setEnableAutoExtraction(settings.enable_auto_extraction ?? true);
    setAutoExtractionMode(settings.auto_extraction_mode ?? 'draft_only');
    setAutoConfirmMinConfidence(settings.auto_confirm_min_confidence ?? 0.85);
    setAutoConfirmAllowedEventTypesText(
      (settings.auto_confirm_allowed_event_types || ['post_commit', 'post_merge']).join('\n')
    );
    setAutoConfirmKeywordAllowlistText(
      (settings.auto_confirm_keyword_allowlist || [
        'migrate',
        'switch',
        'remove',
        'deprecate',
        'rename',
        'refactor',
      ]).join('\n')
    );
    setAutoConfirmKeywordDenylistText(
      (settings.auto_confirm_keyword_denylist || ['wip', 'tmp', 'debug', 'test', 'try']).join('\n')
    );
    setAutoExtractionBatchSize(settings.auto_extraction_batch_size ?? 20);
    setSearchDefaultMode(settings.search_default_mode ?? 'hybrid');
    setQueryMode(settings.search_default_mode ?? 'hybrid');
    setSearchHybridAlpha(settings.search_hybrid_alpha ?? 0.6);
    setSearchHybridBeta(settings.search_hybrid_beta ?? 0.4);
    setSearchDefaultLimit(settings.search_default_limit ?? 20);
    setGithubPrefix(settings.github_key_prefix);
    setLocalPrefix(settings.local_key_prefix);
    setEnableMonorepoResolution(settings.enable_monorepo_resolution);
    setMonorepoDetectionLevel(settings.monorepo_detection_level ?? 2);
    setMonorepoMode(settings.monorepo_mode);
    setMonorepoWorkspaceGlobsText((settings.monorepo_workspace_globs || []).join('\n'));
    setMonorepoExcludeGlobsText((settings.monorepo_exclude_globs || []).join('\n'));
    setMonorepoRootMarkersText((settings.monorepo_root_markers || []).join('\n'));
    setMonorepoMaxDepth(settings.monorepo_max_depth || 3);
  }

  async function saveWorkspaceSettings() {
    if (!selectedWorkspace) {
      return;
    }
    const reason = workspaceSettingsReason.trim();
    await callApi('/v1/workspace-settings', {
      method: 'PUT',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        resolution_order: resolutionOrder,
        auto_create_project: autoCreateProject,
        auto_create_project_subprojects: autoCreateProjectSubprojects,
        auto_switch_repo: autoSwitchRepo,
        auto_switch_subproject: autoSwitchSubproject,
        allow_manual_pin: allowManualPin,
        enable_git_events: enableGitEvents,
        enable_commit_events: enableCommitEvents,
        enable_merge_events: enableMergeEvents,
        enable_checkout_events: enableCheckoutEvents,
        checkout_debounce_seconds: Math.min(Math.max(checkoutDebounceSeconds || 0, 0), 3600),
        checkout_daily_limit: Math.min(Math.max(checkoutDailyLimit || 1, 1), 50000),
        enable_auto_extraction: enableAutoExtraction,
        auto_extraction_mode: autoExtractionMode,
        auto_confirm_min_confidence: Math.min(Math.max(autoConfirmMinConfidence || 0, 0), 1),
        auto_confirm_allowed_event_types: parseLineSeparatedValues(autoConfirmAllowedEventTypesText),
        auto_confirm_keyword_allowlist: parseLineSeparatedValues(autoConfirmKeywordAllowlistText),
        auto_confirm_keyword_denylist: parseLineSeparatedValues(autoConfirmKeywordDenylistText),
        auto_extraction_batch_size: Math.min(Math.max(autoExtractionBatchSize || 1, 1), 2000),
        search_default_mode: searchDefaultMode,
        search_hybrid_alpha: Math.min(Math.max(searchHybridAlpha || 0, 0), 1),
        search_hybrid_beta: Math.min(Math.max(searchHybridBeta || 0, 0), 1),
        search_default_limit: Math.min(Math.max(searchDefaultLimit || 1, 1), 500),
        github_key_prefix: githubPrefix,
        local_key_prefix: localPrefix,
        enable_monorepo_resolution: enableMonorepoResolution,
        monorepo_detection_level: Math.min(Math.max(monorepoDetectionLevel || 2, 0), 3),
        monorepo_mode: monorepoMode,
        monorepo_workspace_globs: parseLineSeparatedValues(monorepoWorkspaceGlobsText),
        monorepo_exclude_globs: parseLineSeparatedValues(monorepoExcludeGlobsText),
        monorepo_root_markers: parseLineSeparatedValues(monorepoRootMarkersText),
        monorepo_max_depth: Math.min(Math.max(monorepoMaxDepth || 3, 1), 12),
        reason: reason || undefined,
      }),
    });
    await loadWorkspaceSettings(selectedWorkspace);
  }

  async function loadProjectMappings(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<{ mappings: ProjectMapping[] }>(`/v1/project-mappings?${query.toString()}`);
    setMappings(data.mappings);
  }

  async function createProjectMapping(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !newMappingProjectKey || !newMappingExternalId.trim()) {
      return;
    }
    const reason = mappingReason.trim();
    await callApi('/v1/project-mappings', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        project_key: newMappingProjectKey,
        kind: newMappingKind,
        external_id: newMappingExternalId.trim(),
        priority: newMappingPriority ? Number(newMappingPriority) : undefined,
        is_enabled: newMappingEnabled,
        reason: reason || undefined,
      }),
    });
    setNewMappingExternalId('');
    setNewMappingPriority('');
    await loadProjectMappings(selectedWorkspace);
  }

  async function patchMapping(id: string, patch: Record<string, unknown>) {
    const reason = mappingReason.trim();
    await callApi('/v1/project-mappings', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        ...patch,
        reason: reason || undefined,
      }),
    });
    if (selectedWorkspace) {
      await loadProjectMappings(selectedWorkspace);
    }
  }

  async function loadImports(workspaceKey: string) {
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      limit: '40',
    });
    const data = await callApi<{ imports: ImportItem[] }>(`/v1/imports?${query.toString()}`);
    setImports(data.imports);
    if (!data.imports.some((item) => item.id === selectedImportId)) {
      setSelectedImportId(data.imports[0]?.id || '');
    }
  }

  async function uploadImport(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !importFile) {
      return;
    }
    const form = new FormData();
    form.set('workspace_key', selectedWorkspace);
    form.set('source', importSource);
    if (importUseSelectedProject && selectedProject) {
      form.set('project_key', selectedProject);
    }
    form.set('file', importFile);

    await callApi<{ import_id: string }>('/v1/imports', {
      method: 'POST',
      body: form,
    });
    setImportFile(null);
    await loadImports(selectedWorkspace);
  }

  async function parseImport(importId: string) {
    await callApi(`/v1/imports/${encodeURIComponent(importId)}/parse`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (selectedWorkspace) {
      await loadImports(selectedWorkspace);
    }
  }

  async function extractImport(importId: string) {
    await callApi(`/v1/imports/${encodeURIComponent(importId)}/extract`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await loadStagedMemories(importId);
    if (selectedWorkspace) {
      await loadImports(selectedWorkspace);
    }
  }

  async function loadStagedMemories(importId: string) {
    const data = await callApi<{ staged_memories: StagedMemoryItem[] }>(
      `/v1/imports/${encodeURIComponent(importId)}/staged`
    );
    setStagedMemories(data.staged_memories);
    setSelectedStagedIds(data.staged_memories.map((item) => item.id));
  }

  async function commitImport(importId: string) {
    await callApi(`/v1/imports/${encodeURIComponent(importId)}/commit`, {
      method: 'POST',
      body: JSON.stringify({
        staged_ids: selectedStagedIds,
        project_key: selectedProject || undefined,
      }),
    });
    if (selectedWorkspace) {
      await Promise.all([loadImports(selectedWorkspace), runMemorySearch()]);
    }
  }

  function toggleStagedMemory(id: string, checked: boolean) {
    setSelectedStagedIds((current) => {
      if (checked) {
        if (current.includes(id)) {
          return current;
        }
        return [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  }

  async function runRawSearch(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace || !rawQuery.trim()) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      q: rawQuery.trim(),
      limit: String(Math.min(Math.max(rawLimit, 1), 20)),
      max_chars: '500',
    });
    if (rawUseSelectedProject && selectedProject) {
      query.set('project_key', selectedProject);
    }
    const data = await callApi<{ matches: RawSearchMatch[] }>(`/v1/raw/search?${query.toString()}`);
    setRawMatches(data.matches);
    if (!data.matches.some((item) => item.message_id === selectedRawMessageId)) {
      setSelectedRawMessageId('');
      setRawMessageDetail(null);
    }
  }

  async function viewRawMessage(messageId: string) {
    const query = new URLSearchParams({ max_chars: '700' });
    const result = await callApi<RawMessageDetail>(
      `/v1/raw/messages/${encodeURIComponent(messageId)}?${query.toString()}`
    );
    setSelectedRawMessageId(messageId);
    setRawMessageDetail(result);
  }

  async function loadRawEvents(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      limit: String(Math.min(Math.max(rawEventLimit, 1), 500)),
    });
    if (rawEventProjectFilter.trim()) {
      query.set('project_key', rawEventProjectFilter.trim());
    }
    if (rawEventTypeFilter) {
      query.set('event_type', rawEventTypeFilter);
    }
    if (rawEventCommitShaFilter.trim()) {
      query.set('commit_sha', rawEventCommitShaFilter.trim());
    }
    const fromIso = rawEventFrom ? toISOString(rawEventFrom) : null;
    const toIso = rawEventTo ? toISOString(rawEventTo) : null;
    if (fromIso) {
      query.set('from', fromIso);
    }
    if (toIso) {
      query.set('to', toIso);
    }
    const data = await callApi<{ events: RawEventItem[] }>(`/v1/raw-events?${query.toString()}`);
    setRawEvents(data.events);
  }

  async function submitCiEvent(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    let metadata: Record<string, unknown> | undefined;
    if (ciMetadata.trim()) {
      try {
        metadata = JSON.parse(ciMetadata) as Record<string, unknown>;
      } catch (parseError) {
        setError(
          parseError instanceof Error
            ? `ci metadata JSON parse error: ${parseError.message}`
            : 'ci metadata JSON parse error'
        );
        return;
      }
    }

    await callApi('/v1/ci-events', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        status: ciStatus,
        provider: ciProvider,
        project_key: ciUseSelectedProject && selectedProject ? selectedProject : undefined,
        workflow_name: ciWorkflowName.trim() || undefined,
        workflow_run_id: ciWorkflowRunId.trim() || undefined,
        workflow_run_url: ciWorkflowRunUrl.trim() || undefined,
        repository: ciRepository.trim() || undefined,
        branch: ciBranch.trim() || undefined,
        sha: ciSha.trim() || undefined,
        event_name: ciEventName.trim() || undefined,
        job_name: ciJobName.trim() || undefined,
        message: ciMessage.trim() || undefined,
        metadata,
      }),
    });

    setAuditActionPrefix('ci.');
    await loadAuditLogs(selectedWorkspace);
  }

  async function loadAuditLogs(workspaceKey: string) {
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      limit: String(Math.min(Math.max(auditLimit, 1), 200)),
    });
    if (auditActionPrefix.trim()) {
      query.set('action_prefix', auditActionPrefix.trim());
    }
    const data = await callApi<{ logs: AuditLogItem[] }>(`/v1/audit-logs?${query.toString()}`);
    setAuditLogs(data.logs);
  }

  async function loadIntegrations(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<IntegrationSettingsResponse>(`/v1/integrations?${query.toString()}`);
    const normalizedIntegrations: IntegrationSettingsResponse['integrations'] = {
      ...data.integrations,
      audit_reasoner: data.integrations.audit_reasoner || {
        enabled: false,
        configured: false,
        source: 'none',
        has_api_key: false,
        provider_order: ['openai', 'claude', 'gemini'],
        has_openai_api_key: false,
        has_claude_api_key: false,
        has_gemini_api_key: false,
      },
    };
    setIntegrationStates(normalizedIntegrations);

    const notion = normalizedIntegrations.notion;
    setNotionEnabled(notion.enabled);
    setNotionParentPageId(notion.default_parent_page_id || '');
    setNotionWriteEnabled(Boolean(notion.write_enabled));
    setNotionWriteOnCommit(Boolean(notion.write_on_commit));
    setNotionWriteOnMerge(Boolean(notion.write_on_merge));
    setNotionToken('');

    const jira = normalizedIntegrations.jira;
    setJiraEnabled(jira.enabled);
    setJiraBaseUrl(jira.base_url || '');
    setJiraEmail(jira.email || '');
    setJiraWriteOnCommit(Boolean(jira.write_on_commit));
    setJiraWriteOnMerge(Boolean(jira.write_on_merge));
    setJiraToken('');

    const confluence = normalizedIntegrations.confluence;
    setConfluenceEnabled(confluence.enabled);
    setConfluenceBaseUrl(confluence.base_url || '');
    setConfluenceEmail(confluence.email || '');
    setConfluenceWriteOnCommit(Boolean(confluence.write_on_commit));
    setConfluenceWriteOnMerge(Boolean(confluence.write_on_merge));
    setConfluenceToken('');

    const linear = normalizedIntegrations.linear;
    setLinearEnabled(linear.enabled);
    setLinearApiUrl(linear.api_url || '');
    setLinearWriteOnCommit(Boolean(linear.write_on_commit));
    setLinearWriteOnMerge(Boolean(linear.write_on_merge));
    setLinearApiKey('');

    const slack = normalizedIntegrations.slack;
    setSlackEnabled(slack.enabled);
    setSlackDefaultChannel(slack.default_channel || '');
    setSlackActionPrefixes(
      (slack.action_prefixes || []).join(',') ||
        'workspace_settings.,project_mapping.,integration.,git.,ci.'
    );
    setSlackFormat(slack.format === 'compact' ? 'compact' : 'detailed');
    setSlackIncludeTargetJson(slack.include_target_json !== false);
    setSlackMaskSecrets(slack.mask_secrets !== false);
    setSlackRoutesJson(JSON.stringify(slack.routes || [], null, 2));
    setSlackSeverityRulesJson(JSON.stringify(slack.severity_rules || [], null, 2));
    setSlackWebhookUrl('');

    const reasoner = normalizedIntegrations.audit_reasoner || {
      enabled: false,
      configured: false,
      source: 'none' as const,
      has_api_key: false,
      provider_order: ['openai', 'claude', 'gemini'] as Array<'openai' | 'claude' | 'gemini'>,
      has_openai_api_key: false,
      has_claude_api_key: false,
      has_gemini_api_key: false,
    };
    const providerOrder =
      reasoner.provider_order && reasoner.provider_order.length > 0
        ? reasoner.provider_order
        : (['openai', 'claude', 'gemini'] as Array<'openai' | 'claude' | 'gemini'>);
    setAuditReasonerEnabled(reasoner.enabled);
    setAuditReasonerOrderCsv(providerOrder.join(','));
    setAuditReasonerOpenAiModel(reasoner.openai_model || '');
    setAuditReasonerOpenAiBaseUrl(reasoner.openai_base_url || '');
    setAuditReasonerOpenAiApiKey('');
    setAuditReasonerClaudeModel(reasoner.claude_model || '');
    setAuditReasonerClaudeBaseUrl(reasoner.claude_base_url || '');
    setAuditReasonerClaudeApiKey('');
    setAuditReasonerGeminiModel(reasoner.gemini_model || '');
    setAuditReasonerGeminiBaseUrl(reasoner.gemini_base_url || '');
    setAuditReasonerGeminiApiKey('');
  }

  async function saveIntegration(
    provider: IntegrationProvider,
    payload: {
      enabled: boolean;
      config: Record<string, unknown>;
      reason?: string;
    }
  ) {
    if (!selectedWorkspace) {
      return;
    }
    if (integrationStates[provider].locked) {
      setError(
        `${provider} integration is locked by server policy (MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS).`
      );
      return;
    }
    await callApi('/v1/integrations', {
      method: 'PUT',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        provider,
        enabled: payload.enabled,
        config: payload.config,
        reason: payload.reason?.trim() || undefined,
      }),
    });
    await loadIntegrations(selectedWorkspace);
  }

  async function saveNotionIntegration(event: FormEvent) {
    event.preventDefault();
    const config: Record<string, unknown> = {
      default_parent_page_id: notionParentPageId.trim(),
      write_enabled: notionWriteEnabled,
      write_on_commit: notionWriteOnCommit,
      write_on_merge: notionWriteOnMerge,
    };
    if (notionToken.trim()) {
      config.token = notionToken.trim();
    }
    await saveIntegration('notion', {
      enabled: notionEnabled,
      config,
      reason: integrationReason,
    });
  }

  async function saveJiraIntegration(event: FormEvent) {
    event.preventDefault();
    const config: Record<string, unknown> = {
      base_url: jiraBaseUrl.trim(),
      email: jiraEmail.trim(),
      write_on_commit: jiraWriteOnCommit,
      write_on_merge: jiraWriteOnMerge,
    };
    if (jiraToken.trim()) {
      config.api_token = jiraToken.trim();
    }
    await saveIntegration('jira', {
      enabled: jiraEnabled,
      config,
      reason: integrationReason,
    });
  }

  async function saveConfluenceIntegration(event: FormEvent) {
    event.preventDefault();
    const config: Record<string, unknown> = {
      base_url: confluenceBaseUrl.trim(),
      email: confluenceEmail.trim(),
      write_on_commit: confluenceWriteOnCommit,
      write_on_merge: confluenceWriteOnMerge,
    };
    if (confluenceToken.trim()) {
      config.api_token = confluenceToken.trim();
    }
    await saveIntegration('confluence', {
      enabled: confluenceEnabled,
      config,
      reason: integrationReason,
    });
  }

  async function saveLinearIntegration(event: FormEvent) {
    event.preventDefault();
    const config: Record<string, unknown> = {
      api_url: linearApiUrl.trim(),
      write_on_commit: linearWriteOnCommit,
      write_on_merge: linearWriteOnMerge,
    };
    if (linearApiKey.trim()) {
      config.api_key = linearApiKey.trim();
    }
    await saveIntegration('linear', {
      enabled: linearEnabled,
      config,
      reason: integrationReason,
    });
  }

  async function saveSlackIntegration(event: FormEvent) {
    event.preventDefault();
    let routes: unknown = [];
    let severityRules: unknown = [];
    try {
      routes = slackRoutesJson.trim() ? JSON.parse(slackRoutesJson) : [];
      severityRules = slackSeverityRulesJson.trim() ? JSON.parse(slackSeverityRulesJson) : [];
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? `slack JSON parse error: ${parseError.message}`
          : 'slack JSON parse error'
      );
      return;
    }

    const config: Record<string, unknown> = {
      default_channel: slackDefaultChannel.trim(),
      action_prefixes: slackActionPrefixes
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      format: slackFormat,
      include_target_json: slackIncludeTargetJson,
      mask_secrets: slackMaskSecrets,
      routes,
      severity_rules: severityRules,
    };
    if (slackWebhookUrl.trim()) {
      config.webhook_url = slackWebhookUrl.trim();
    }

    await saveIntegration('slack', {
      enabled: slackEnabled,
      config,
      reason: integrationReason,
    });
  }

  async function saveAuditReasonerIntegration(event: FormEvent) {
    event.preventDefault();
    const providerOrder = auditReasonerOrderCsv
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item): item is 'openai' | 'claude' | 'gemini' => {
        return item === 'openai' || item === 'claude' || item === 'gemini';
      })
      .filter((item, index, array) => array.indexOf(item) === index);
    if (providerOrder.length === 0) {
      setError('audit_reasoner provider order is required (openai/claude/gemini).');
      return;
    }
    const config: Record<string, unknown> = {
      provider_order: providerOrder,
      openai_model: auditReasonerOpenAiModel.trim() || null,
      openai_base_url: auditReasonerOpenAiBaseUrl.trim() || null,
      claude_model: auditReasonerClaudeModel.trim() || null,
      claude_base_url: auditReasonerClaudeBaseUrl.trim() || null,
      gemini_model: auditReasonerGeminiModel.trim() || null,
      gemini_base_url: auditReasonerGeminiBaseUrl.trim() || null,
    };
    if (auditReasonerOpenAiApiKey.trim()) {
      config.openai_api_key = auditReasonerOpenAiApiKey.trim();
    }
    if (auditReasonerClaudeApiKey.trim()) {
      config.claude_api_key = auditReasonerClaudeApiKey.trim();
    }
    if (auditReasonerGeminiApiKey.trim()) {
      config.gemini_api_key = auditReasonerGeminiApiKey.trim();
    }
    await saveIntegration('audit_reasoner', {
      enabled: auditReasonerEnabled,
      config,
      reason: integrationReason,
    });
  }

  async function runMemorySearch(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      limit: String(queryLimit),
      mode: queryMode,
    });
    if (scopeSelectedProject && selectedProject) {
      query.set('project_key', selectedProject);
    }
    if (queryType) {
      query.set('type', queryType);
    }
    if (queryText.trim()) {
      query.set('q', queryText.trim());
    }
    if (queryStatus) {
      query.set('status', queryStatus);
    }
    if (querySource) {
      query.set('source', querySource);
    }
    if (queryConfidenceMin.trim()) {
      query.set('confidence_min', queryConfidenceMin.trim());
    }
    if (queryConfidenceMax.trim()) {
      query.set('confidence_max', queryConfidenceMax.trim());
    }
    if (querySince) {
      const iso = toISOString(querySince);
      if (iso) {
        query.set('since', iso);
      }
    }

    const data = await callApi<{ memories: MemoryItem[] }>(`/v1/memories?${query.toString()}`);
    setMemories(data.memories);
    if (!data.memories.some((memory) => memory.id === selectedMemoryId)) {
      setSelectedMemoryId(data.memories[0]?.id || '');
    }
  }

  async function updateSelectedMemoryStatus(status: 'draft' | 'confirmed' | 'rejected') {
    if (!selectedMemoryId) {
      return;
    }
    await callApi(`/v1/memories/${encodeURIComponent(selectedMemoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
      }),
    });
    await runMemorySearch();
  }

  async function saveSelectedMemoryContent() {
    if (!selectedMemoryId) {
      return;
    }
    await callApi(`/v1/memories/${encodeURIComponent(selectedMemoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: selectedMemoryDraftContent.trim(),
      }),
    });
    await runMemorySearch();
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    await callApi('/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify({
        key: newWorkspaceKey.trim(),
        name: newWorkspaceName.trim(),
      }),
    });
    setNewWorkspaceKey('');
    setNewWorkspaceName('');
    await loadWorkspaces();
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await callApi('/v1/users', {
      method: 'POST',
      body: JSON.stringify({
        email: newUserEmail.trim(),
        name: newUserName.trim() || undefined,
      }),
    });
    setNewUserEmail('');
    setNewUserName('');
    await loadUsers();
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace) {
      return;
    }
    await callApi('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        key: newProjectKey.trim(),
        name: newProjectName.trim(),
      }),
    });
    setNewProjectKey('');
    setNewProjectName('');
    await loadProjects(selectedWorkspace);
  }

  async function addProjectMember(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !selectedProject) {
      return;
    }
    await callApi('/v1/project-members', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        project_key: selectedProject,
        email: inviteEmail.trim(),
        role: inviteRole,
      }),
    });
    setInviteEmail('');
    await loadMembers(selectedWorkspace, selectedProject);
  }

  async function createMemory(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !selectedProject) {
      return;
    }
    let metadata: Record<string, unknown> | undefined;
    if (newMemoryMetadata.trim()) {
      try {
        metadata = JSON.parse(newMemoryMetadata) as Record<string, unknown>;
      } catch (metadataError) {
        setError(
          metadataError instanceof Error
            ? `metadata JSON parse error: ${metadataError.message}`
            : 'metadata JSON parse error'
        );
        return;
      }
    }
    await callApi('/v1/memories', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        project_key: selectedProject,
        type: newMemoryType,
        content: newMemoryContent.trim(),
        metadata,
      }),
    });
    setNewMemoryContent('');
    await runMemorySearch();
  }

  async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
    if (!apiKey) {
      throw new Error('Set API key first.');
    }
    if (missingCoreUrl) {
      throw new Error(
        'NEXT_PUBLIC_MEMORY_CORE_URL is not set. Define it in your environment (e.g. http://localhost:8080).'
      );
    }

    setBusy(true);
    setError(null);
    try {
      const headers = new Headers(init?.headers || {});
      const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
      if (!headers.has('authorization')) {
        headers.set('authorization', `Bearer ${apiKey}`);
      }
      if (!isFormData && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `${response.status} ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : String(requestError);
      setError(message);
      throw requestError;
    } finally {
      setBusy(false);
    }
  }

  function submitApiKey(event: FormEvent) {
    event.preventDefault();
    const value = apiKeyInput.trim();
    setApiKey(value);
    window.localStorage.setItem('memory-core-admin-key', value);
  }

  return (
    <main className="dashboard">
      <AdminSessionSidebar
        apiBaseUrl={API_BASE_URL}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        submitApiKey={submitApiKey}
        initializeData={initializeData}
        workspaces={workspaces}
        selectedWorkspace={selectedWorkspace}
        setSelectedWorkspace={setSelectedWorkspace}
        createWorkspace={createWorkspace}
        newWorkspaceKey={newWorkspaceKey}
        setNewWorkspaceKey={setNewWorkspaceKey}
        newWorkspaceName={newWorkspaceName}
        setNewWorkspaceName={setNewWorkspaceName}
        createUser={createUser}
        newUserEmail={newUserEmail}
        setNewUserEmail={setNewUserEmail}
        newUserName={newUserName}
        setNewUserName={setNewUserName}
        users={users}
      />

      <section className="content">
        <section className="panel">
          <div className="panel-body">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Memory Core Admin Console</h1>
                <p className="muted">Workspace governance, integrations, import pipeline, and audit visibility.</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                {busy ? 'working...' : 'ready'} • workspace: <strong>{selectedWorkspace || '-'}</strong> • project:{' '}
                <strong>{selectedProject || '-'}</strong>
              </div>
            </div>
          </div>
        </section>

        <ResolutionSettingsPanel
          resolutionOrder={resolutionOrder}
          setResolutionOrder={setResolutionOrder}
          autoCreateProject={autoCreateProject}
          setAutoCreateProject={setAutoCreateProject}
          autoCreateProjectSubprojects={autoCreateProjectSubprojects}
          setAutoCreateProjectSubprojects={setAutoCreateProjectSubprojects}
          autoSwitchRepo={autoSwitchRepo}
          setAutoSwitchRepo={setAutoSwitchRepo}
          autoSwitchSubproject={autoSwitchSubproject}
          setAutoSwitchSubproject={setAutoSwitchSubproject}
          allowManualPin={allowManualPin}
          setAllowManualPin={setAllowManualPin}
          enableGitEvents={enableGitEvents}
          setEnableGitEvents={setEnableGitEvents}
          enableCommitEvents={enableCommitEvents}
          setEnableCommitEvents={setEnableCommitEvents}
          enableMergeEvents={enableMergeEvents}
          setEnableMergeEvents={setEnableMergeEvents}
          enableCheckoutEvents={enableCheckoutEvents}
          setEnableCheckoutEvents={setEnableCheckoutEvents}
          checkoutDebounceSeconds={checkoutDebounceSeconds}
          setCheckoutDebounceSeconds={setCheckoutDebounceSeconds}
          checkoutDailyLimit={checkoutDailyLimit}
          setCheckoutDailyLimit={setCheckoutDailyLimit}
          enableAutoExtraction={enableAutoExtraction}
          setEnableAutoExtraction={setEnableAutoExtraction}
          autoExtractionMode={autoExtractionMode}
          setAutoExtractionMode={setAutoExtractionMode}
          autoConfirmMinConfidence={autoConfirmMinConfidence}
          setAutoConfirmMinConfidence={setAutoConfirmMinConfidence}
          autoConfirmAllowedEventTypesText={autoConfirmAllowedEventTypesText}
          setAutoConfirmAllowedEventTypesText={setAutoConfirmAllowedEventTypesText}
          autoConfirmKeywordAllowlistText={autoConfirmKeywordAllowlistText}
          setAutoConfirmKeywordAllowlistText={setAutoConfirmKeywordAllowlistText}
          autoConfirmKeywordDenylistText={autoConfirmKeywordDenylistText}
          setAutoConfirmKeywordDenylistText={setAutoConfirmKeywordDenylistText}
          autoExtractionBatchSize={autoExtractionBatchSize}
          setAutoExtractionBatchSize={setAutoExtractionBatchSize}
          searchDefaultMode={searchDefaultMode}
          setSearchDefaultMode={setSearchDefaultMode}
          searchHybridAlpha={searchHybridAlpha}
          setSearchHybridAlpha={setSearchHybridAlpha}
          searchHybridBeta={searchHybridBeta}
          setSearchHybridBeta={setSearchHybridBeta}
          searchDefaultLimit={searchDefaultLimit}
          setSearchDefaultLimit={setSearchDefaultLimit}
          githubPrefix={githubPrefix}
          setGithubPrefix={setGithubPrefix}
          localPrefix={localPrefix}
          setLocalPrefix={setLocalPrefix}
          enableMonorepoResolution={enableMonorepoResolution}
          setEnableMonorepoResolution={setEnableMonorepoResolution}
          monorepoDetectionLevel={monorepoDetectionLevel}
          setMonorepoDetectionLevel={setMonorepoDetectionLevel}
          monorepoMode={monorepoMode}
          setMonorepoMode={setMonorepoMode}
          monorepoWorkspaceGlobsText={monorepoWorkspaceGlobsText}
          setMonorepoWorkspaceGlobsText={setMonorepoWorkspaceGlobsText}
          monorepoExcludeGlobsText={monorepoExcludeGlobsText}
          setMonorepoExcludeGlobsText={setMonorepoExcludeGlobsText}
          monorepoRootMarkersText={monorepoRootMarkersText}
          setMonorepoRootMarkersText={setMonorepoRootMarkersText}
          monorepoMaxDepth={monorepoMaxDepth}
          setMonorepoMaxDepth={setMonorepoMaxDepth}
          workspaceSettingsReason={workspaceSettingsReason}
          setWorkspaceSettingsReason={setWorkspaceSettingsReason}
          saveWorkspaceSettings={saveWorkspaceSettings}
          draggingKind={draggingKind}
          setDraggingKind={setDraggingKind}
        />

        <IntegrationsPanel
          integrationStates={integrationStates}
          integrationReason={integrationReason}
          setIntegrationReason={setIntegrationReason}
          notionLocked={notionLocked}
          notionEnabled={notionEnabled}
          setNotionEnabled={setNotionEnabled}
          notionWriteEnabled={notionWriteEnabled}
          setNotionWriteEnabled={setNotionWriteEnabled}
          notionWriteOnCommit={notionWriteOnCommit}
          setNotionWriteOnCommit={setNotionWriteOnCommit}
          notionWriteOnMerge={notionWriteOnMerge}
          setNotionWriteOnMerge={setNotionWriteOnMerge}
          notionParentPageId={notionParentPageId}
          setNotionParentPageId={setNotionParentPageId}
          notionToken={notionToken}
          setNotionToken={setNotionToken}
          saveNotionIntegration={saveNotionIntegration}
          jiraLocked={jiraLocked}
          jiraEnabled={jiraEnabled}
          setJiraEnabled={setJiraEnabled}
          jiraWriteOnCommit={jiraWriteOnCommit}
          setJiraWriteOnCommit={setJiraWriteOnCommit}
          jiraWriteOnMerge={jiraWriteOnMerge}
          setJiraWriteOnMerge={setJiraWriteOnMerge}
          jiraBaseUrl={jiraBaseUrl}
          setJiraBaseUrl={setJiraBaseUrl}
          jiraEmail={jiraEmail}
          setJiraEmail={setJiraEmail}
          jiraToken={jiraToken}
          setJiraToken={setJiraToken}
          saveJiraIntegration={saveJiraIntegration}
          confluenceLocked={confluenceLocked}
          confluenceEnabled={confluenceEnabled}
          setConfluenceEnabled={setConfluenceEnabled}
          confluenceWriteOnCommit={confluenceWriteOnCommit}
          setConfluenceWriteOnCommit={setConfluenceWriteOnCommit}
          confluenceWriteOnMerge={confluenceWriteOnMerge}
          setConfluenceWriteOnMerge={setConfluenceWriteOnMerge}
          confluenceBaseUrl={confluenceBaseUrl}
          setConfluenceBaseUrl={setConfluenceBaseUrl}
          confluenceEmail={confluenceEmail}
          setConfluenceEmail={setConfluenceEmail}
          confluenceToken={confluenceToken}
          setConfluenceToken={setConfluenceToken}
          saveConfluenceIntegration={saveConfluenceIntegration}
          linearLocked={linearLocked}
          linearEnabled={linearEnabled}
          setLinearEnabled={setLinearEnabled}
          linearWriteOnCommit={linearWriteOnCommit}
          setLinearWriteOnCommit={setLinearWriteOnCommit}
          linearWriteOnMerge={linearWriteOnMerge}
          setLinearWriteOnMerge={setLinearWriteOnMerge}
          linearApiUrl={linearApiUrl}
          setLinearApiUrl={setLinearApiUrl}
          linearApiKey={linearApiKey}
          setLinearApiKey={setLinearApiKey}
          saveLinearIntegration={saveLinearIntegration}
          slackLocked={slackLocked}
          slackEnabled={slackEnabled}
          setSlackEnabled={setSlackEnabled}
          slackWebhookUrl={slackWebhookUrl}
          setSlackWebhookUrl={setSlackWebhookUrl}
          slackDefaultChannel={slackDefaultChannel}
          setSlackDefaultChannel={setSlackDefaultChannel}
          slackActionPrefixes={slackActionPrefixes}
          setSlackActionPrefixes={setSlackActionPrefixes}
          slackFormat={slackFormat}
          setSlackFormat={setSlackFormat}
          slackIncludeTargetJson={slackIncludeTargetJson}
          setSlackIncludeTargetJson={setSlackIncludeTargetJson}
          slackMaskSecrets={slackMaskSecrets}
          setSlackMaskSecrets={setSlackMaskSecrets}
          slackRoutesJson={slackRoutesJson}
          setSlackRoutesJson={setSlackRoutesJson}
          slackSeverityRulesJson={slackSeverityRulesJson}
          setSlackSeverityRulesJson={setSlackSeverityRulesJson}
          saveSlackIntegration={saveSlackIntegration}
          auditReasonerLocked={auditReasonerLocked}
          auditReasonerEnabled={auditReasonerEnabled}
          setAuditReasonerEnabled={setAuditReasonerEnabled}
          auditReasonerOrderCsv={auditReasonerOrderCsv}
          setAuditReasonerOrderCsv={setAuditReasonerOrderCsv}
          auditReasonerOpenAiModel={auditReasonerOpenAiModel}
          setAuditReasonerOpenAiModel={setAuditReasonerOpenAiModel}
          auditReasonerOpenAiBaseUrl={auditReasonerOpenAiBaseUrl}
          setAuditReasonerOpenAiBaseUrl={setAuditReasonerOpenAiBaseUrl}
          auditReasonerOpenAiApiKey={auditReasonerOpenAiApiKey}
          setAuditReasonerOpenAiApiKey={setAuditReasonerOpenAiApiKey}
          auditReasonerClaudeModel={auditReasonerClaudeModel}
          setAuditReasonerClaudeModel={setAuditReasonerClaudeModel}
          auditReasonerClaudeBaseUrl={auditReasonerClaudeBaseUrl}
          setAuditReasonerClaudeBaseUrl={setAuditReasonerClaudeBaseUrl}
          auditReasonerClaudeApiKey={auditReasonerClaudeApiKey}
          setAuditReasonerClaudeApiKey={setAuditReasonerClaudeApiKey}
          auditReasonerGeminiModel={auditReasonerGeminiModel}
          setAuditReasonerGeminiModel={setAuditReasonerGeminiModel}
          auditReasonerGeminiBaseUrl={auditReasonerGeminiBaseUrl}
          setAuditReasonerGeminiBaseUrl={setAuditReasonerGeminiBaseUrl}
          auditReasonerGeminiApiKey={auditReasonerGeminiApiKey}
          setAuditReasonerGeminiApiKey={setAuditReasonerGeminiApiKey}
          saveAuditReasonerIntegration={saveAuditReasonerIntegration}
        />

        <ProjectMappingsPanel
          mappingReason={mappingReason}
          setMappingReason={setMappingReason}
          createProjectMapping={createProjectMapping}
          newMappingKind={newMappingKind}
          setNewMappingKind={setNewMappingKind}
          newMappingProjectKey={newMappingProjectKey}
          setNewMappingProjectKey={setNewMappingProjectKey}
          newMappingExternalId={newMappingExternalId}
          setNewMappingExternalId={setNewMappingExternalId}
          newMappingPriority={newMappingPriority}
          setNewMappingPriority={setNewMappingPriority}
          newMappingEnabled={newMappingEnabled}
          setNewMappingEnabled={setNewMappingEnabled}
          projects={projects}
          mappings={mappings}
          patchMapping={patchMapping}
        />

        <ProjectsPanel
          projects={filteredProjects}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
          projectViewFilter={projectViewFilter}
          setProjectViewFilter={setProjectViewFilter}
          createProject={createProject}
          newProjectKey={newProjectKey}
          setNewProjectKey={setNewProjectKey}
          newProjectName={newProjectName}
          setNewProjectName={setNewProjectName}
        />

        <ProjectMembersPanel
          addProjectMember={addProjectMember}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          members={members}
        />

        <MemoriesPanel
          runMemorySearch={runMemorySearch}
          queryText={queryText}
          setQueryText={setQueryText}
          queryType={queryType}
          setQueryType={setQueryType}
          queryMode={queryMode}
          setQueryMode={setQueryMode}
          queryStatus={queryStatus}
          setQueryStatus={setQueryStatus}
          querySource={querySource}
          setQuerySource={setQuerySource}
          queryConfidenceMin={queryConfidenceMin}
          setQueryConfidenceMin={setQueryConfidenceMin}
          queryConfidenceMax={queryConfidenceMax}
          setQueryConfidenceMax={setQueryConfidenceMax}
          querySince={querySince}
          setQuerySince={setQuerySince}
          queryLimit={queryLimit}
          setQueryLimit={setQueryLimit}
          scopeSelectedProject={scopeSelectedProject}
          setScopeSelectedProject={setScopeSelectedProject}
          memories={memories}
          setSelectedMemoryId={setSelectedMemoryId}
          createMemory={createMemory}
          newMemoryType={newMemoryType}
          setNewMemoryType={setNewMemoryType}
          selectedProject={selectedProject}
          newMemoryContent={newMemoryContent}
          setNewMemoryContent={setNewMemoryContent}
          newMemoryMetadata={newMemoryMetadata}
          setNewMemoryMetadata={setNewMemoryMetadata}
          selectedMemory={selectedMemory}
          selectedMemoryDraftContent={selectedMemoryDraftContent}
          setSelectedMemoryDraftContent={setSelectedMemoryDraftContent}
          updateSelectedMemoryStatus={updateSelectedMemoryStatus}
          saveSelectedMemoryContent={saveSelectedMemoryContent}
        />

        <ImportsPanel
          uploadImport={uploadImport}
          importSource={importSource}
          setImportSource={setImportSource}
          setImportFile={setImportFile}
          importUseSelectedProject={importUseSelectedProject}
          setImportUseSelectedProject={setImportUseSelectedProject}
          imports={imports}
          setSelectedImportId={setSelectedImportId}
          parseImport={parseImport}
          extractImport={extractImport}
          loadStagedMemories={loadStagedMemories}
          selectedImport={selectedImport}
          stagedMemories={stagedMemories}
          selectedStagedIds={selectedStagedIds}
          toggleStagedMemory={toggleStagedMemory}
          selectedImportId={selectedImportId}
          commitImport={commitImport}
        />

        <RawSearchPanel
          runRawSearch={runRawSearch}
          rawQuery={rawQuery}
          setRawQuery={setRawQuery}
          rawLimit={rawLimit}
          setRawLimit={setRawLimit}
          rawUseSelectedProject={rawUseSelectedProject}
          setRawUseSelectedProject={setRawUseSelectedProject}
          rawMatches={rawMatches}
          viewRawMessage={viewRawMessage}
          rawMessageDetail={rawMessageDetail}
        />

        <RawEventsPanel
          selectedWorkspace={selectedWorkspace}
          projects={projects}
          rawEventProjectFilter={rawEventProjectFilter}
          setRawEventProjectFilter={setRawEventProjectFilter}
          rawEventTypeFilter={rawEventTypeFilter}
          setRawEventTypeFilter={setRawEventTypeFilter}
          rawEventCommitShaFilter={rawEventCommitShaFilter}
          setRawEventCommitShaFilter={setRawEventCommitShaFilter}
          rawEventFrom={rawEventFrom}
          setRawEventFrom={setRawEventFrom}
          rawEventTo={rawEventTo}
          setRawEventTo={setRawEventTo}
          rawEventLimit={rawEventLimit}
          setRawEventLimit={setRawEventLimit}
          rawEvents={rawEvents}
          loadRawEvents={loadRawEvents}
        />

        <CiEventsPanel
          submitCiEvent={submitCiEvent}
          ciStatus={ciStatus}
          setCiStatus={setCiStatus}
          ciProvider={ciProvider}
          setCiProvider={setCiProvider}
          ciUseSelectedProject={ciUseSelectedProject}
          setCiUseSelectedProject={setCiUseSelectedProject}
          ciWorkflowName={ciWorkflowName}
          setCiWorkflowName={setCiWorkflowName}
          ciWorkflowRunId={ciWorkflowRunId}
          setCiWorkflowRunId={setCiWorkflowRunId}
          ciWorkflowRunUrl={ciWorkflowRunUrl}
          setCiWorkflowRunUrl={setCiWorkflowRunUrl}
          ciRepository={ciRepository}
          setCiRepository={setCiRepository}
          ciBranch={ciBranch}
          setCiBranch={setCiBranch}
          ciSha={ciSha}
          setCiSha={setCiSha}
          ciEventName={ciEventName}
          setCiEventName={setCiEventName}
          ciJobName={ciJobName}
          setCiJobName={setCiJobName}
          ciMessage={ciMessage}
          setCiMessage={setCiMessage}
          ciMetadata={ciMetadata}
          setCiMetadata={setCiMetadata}
        />

        <AuditLogsPanel
          auditActionPrefix={auditActionPrefix}
          setAuditActionPrefix={setAuditActionPrefix}
          auditLimit={auditLimit}
          setAuditLimit={setAuditLimit}
          selectedWorkspace={selectedWorkspace}
          loadAuditLogs={loadAuditLogs}
          auditLogs={auditLogs}
        />
        {error ? <div className="error">{error}</div> : null}
        {missingCoreUrl ? (
          <div className="error">
            NEXT_PUBLIC_MEMORY_CORE_URL is missing. Set it to a browser-reachable memory-core URL.
          </div>
        ) : null}
      </section>
    </main>
  );
}
