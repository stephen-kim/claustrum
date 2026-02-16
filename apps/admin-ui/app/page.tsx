'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { IntegrationsPanel } from './components/integrations-panel';
import {
  MEMORY_TYPES,
  RESOLUTION_KINDS,
  type AuditLogItem,
  type ImportItem,
  type ImportSource,
  type IntegrationProvider,
  type IntegrationSettingsResponse,
  type MemoryItem,
  type Project,
  type ProjectMapping,
  type ProjectMember,
  type RawMessageDetail,
  type RawSearchMatch,
  type ResolutionKind,
  type StagedMemoryItem,
  type User,
  type Workspace,
  type WorkspaceSettings,
} from './lib/types';
import { kindDescription, reorderKinds, toISOString } from './lib/utils';

const API_BASE_URL = (process.env.NEXT_PUBLIC_MEMORY_CORE_URL || '').trim();

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
  const [newProjectKey, setNewProjectKey] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');

  const [queryText, setQueryText] = useState('');
  const [queryType, setQueryType] = useState('');
  const [querySince, setQuerySince] = useState('');
  const [queryLimit, setQueryLimit] = useState(50);
  const [scopeSelectedProject, setScopeSelectedProject] = useState(true);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [selectedMemoryId, setSelectedMemoryId] = useState('');

  const [newMemoryType, setNewMemoryType] = useState('note');
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryMetadata, setNewMemoryMetadata] = useState('{"source":"admin-ui"}');

  const [resolutionOrder, setResolutionOrder] = useState<ResolutionKind[]>(RESOLUTION_KINDS);
  const [autoCreateProject, setAutoCreateProject] = useState(true);
  const [githubPrefix, setGithubPrefix] = useState('github:');
  const [localPrefix, setLocalPrefix] = useState('local:');
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

  const [auditActionPrefix, setAuditActionPrefix] = useState('raw.');
  const [auditLimit, setAuditLimit] = useState(50);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [integrationStates, setIntegrationStates] = useState<IntegrationSettingsResponse['integrations']>({
    notion: { enabled: false, configured: false, source: 'none', has_token: false, write_enabled: false },
    jira: { enabled: false, configured: false, source: 'none', has_api_token: false },
    confluence: { enabled: false, configured: false, source: 'none', has_api_token: false },
    linear: { enabled: false, configured: false, source: 'none', has_api_key: false },
    slack: { enabled: false, configured: false, source: 'none', has_webhook: false, format: 'detailed' },
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
  const [slackActionPrefixes, setSlackActionPrefixes] = useState('workspace_settings.,project_mapping.,integration.,git.');
  const [slackFormat, setSlackFormat] = useState<'compact' | 'detailed'>('detailed');
  const [slackIncludeTargetJson, setSlackIncludeTargetJson] = useState(true);
  const [slackMaskSecrets, setSlackMaskSecrets] = useState(true);
  const [slackRoutesJson, setSlackRoutesJson] = useState('[]');
  const [slackSeverityRulesJson, setSlackSeverityRulesJson] = useState('[]');
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
  const notionLocked = integrationStates.notion.locked === true;
  const jiraLocked = integrationStates.jira.locked === true;
  const confluenceLocked = integrationStates.confluence.locked === true;
  const linearLocked = integrationStates.linear.locked === true;
  const slackLocked = integrationStates.slack.locked === true;

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
      setAuditLogs([]);
      setIntegrationStates({
        notion: { enabled: false, configured: false, source: 'none', has_token: false, write_enabled: false },
        jira: { enabled: false, configured: false, source: 'none', has_api_token: false },
        confluence: { enabled: false, configured: false, source: 'none', has_api_token: false },
        linear: { enabled: false, configured: false, source: 'none', has_api_key: false },
        slack: { enabled: false, configured: false, source: 'none', has_webhook: false, format: 'detailed' },
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
      setSlackActionPrefixes('workspace_settings.,project_mapping.,integration.,git.');
      setSlackFormat('detailed');
      setSlackIncludeTargetJson(true);
      setSlackMaskSecrets(true);
      setSlackRoutesJson('[]');
      setSlackSeverityRulesJson('[]');
      return;
    }
    void Promise.all([
      loadProjects(selectedWorkspace),
      loadWorkspaceSettings(selectedWorkspace),
      loadProjectMappings(selectedWorkspace),
      loadImports(selectedWorkspace),
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
    setGithubPrefix(settings.github_key_prefix);
    setLocalPrefix(settings.local_key_prefix);
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
        github_key_prefix: githubPrefix,
        local_key_prefix: localPrefix,
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
    setIntegrationStates(data.integrations);

    const notion = data.integrations.notion;
    setNotionEnabled(notion.enabled);
    setNotionParentPageId(notion.default_parent_page_id || '');
    setNotionWriteEnabled(Boolean(notion.write_enabled));
    setNotionWriteOnCommit(Boolean(notion.write_on_commit));
    setNotionWriteOnMerge(Boolean(notion.write_on_merge));
    setNotionToken('');

    const jira = data.integrations.jira;
    setJiraEnabled(jira.enabled);
    setJiraBaseUrl(jira.base_url || '');
    setJiraEmail(jira.email || '');
    setJiraWriteOnCommit(Boolean(jira.write_on_commit));
    setJiraWriteOnMerge(Boolean(jira.write_on_merge));
    setJiraToken('');

    const confluence = data.integrations.confluence;
    setConfluenceEnabled(confluence.enabled);
    setConfluenceBaseUrl(confluence.base_url || '');
    setConfluenceEmail(confluence.email || '');
    setConfluenceWriteOnCommit(Boolean(confluence.write_on_commit));
    setConfluenceWriteOnMerge(Boolean(confluence.write_on_merge));
    setConfluenceToken('');

    const linear = data.integrations.linear;
    setLinearEnabled(linear.enabled);
    setLinearApiUrl(linear.api_url || '');
    setLinearWriteOnCommit(Boolean(linear.write_on_commit));
    setLinearWriteOnMerge(Boolean(linear.write_on_merge));
    setLinearApiKey('');

    const slack = data.integrations.slack;
    setSlackEnabled(slack.enabled);
    setSlackDefaultChannel(slack.default_channel || '');
    setSlackActionPrefixes(
      (slack.action_prefixes || []).join(',') || 'workspace_settings.,project_mapping.,integration.,git.'
    );
    setSlackFormat(slack.format === 'compact' ? 'compact' : 'detailed');
    setSlackIncludeTargetJson(slack.include_target_json !== false);
    setSlackMaskSecrets(slack.mask_secrets !== false);
    setSlackRoutesJson(JSON.stringify(slack.routes || [], null, 2));
    setSlackSeverityRulesJson(JSON.stringify(slack.severity_rules || [], null, 2));
    setSlackWebhookUrl('');
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

  async function runMemorySearch(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      limit: String(queryLimit),
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

  function onDragStart(kind: ResolutionKind) {
    setDraggingKind(kind);
  }

  function onDropOn(kind: ResolutionKind) {
    if (!draggingKind || draggingKind === kind) {
      return;
    }
    setResolutionOrder((current) => reorderKinds(current, draggingKind, kind));
    setDraggingKind(null);
  }

  return (
    <main className="dashboard">
      <aside className="panel">
        <div className="panel-body">
          <div className="panel-title">Admin Session</div>
          <form className="stack" onSubmit={submitApiKey}>
            <label>
              <div className="muted">Memory Core URL</div>
              <input value={API_BASE_URL} readOnly />
            </label>
            <label>
              <div className="muted">Admin API Key</div>
              <input
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder="dev-admin-key-change-me"
              />
            </label>
            <div className="toolbar">
              <button className="primary" type="submit">
                Connect
              </button>
              <button className="ghost" type="button" onClick={() => void initializeData()}>
                Refresh
              </button>
            </div>
          </form>

          <div className="panel-title">Workspaces</div>
          <div className="list">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                className={workspace.key === selectedWorkspace ? 'active' : ''}
                onClick={() => setSelectedWorkspace(workspace.key)}
              >
                <strong>{workspace.name}</strong>
                <div className="muted">{workspace.key}</div>
              </button>
            ))}
          </div>
          <form className="stack" onSubmit={createWorkspace}>
            <input
              value={newWorkspaceKey}
              onChange={(event) => setNewWorkspaceKey(event.target.value)}
              placeholder="workspace key"
              required
            />
            <input
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              placeholder="workspace name"
              required
            />
            <button type="submit">Create Workspace</button>
          </form>

          <div className="panel-title">Users</div>
          <form className="stack" onSubmit={createUser}>
            <input
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              placeholder="user@email.com"
              required
            />
            <input
              value={newUserName}
              onChange={(event) => setNewUserName(event.target.value)}
              placeholder="display name (optional)"
            />
            <button type="submit">Create User</button>
          </form>
          <div className="list">
            {users.map((user) => (
              <button key={user.id} type="button">
                <strong>{user.email}</strong>
                <div className="muted">{user.name || 'no name'}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="content">
        <article className="panel">
          <div className="panel-body">
            <div className="panel-title">Project Resolution Settings</div>
            <div className="muted">Drag to reorder: 1 &gt; 2 &gt; 3</div>
            <div className="drag-list">
              {resolutionOrder.map((kind) => (
                <div
                  key={kind}
                  className="drag-item"
                  draggable
                  onDragStart={() => onDragStart(kind)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDropOn(kind)}
                >
                  <strong>{kind}</strong>
                  <div className="muted">{kindDescription(kind)}</div>
                </div>
              ))}
            </div>
            <label className="muted">
              <input
                type="checkbox"
                checked={autoCreateProject}
                onChange={(event) => setAutoCreateProject(event.target.checked)}
              />{' '}
              auto create project when mapping is missing
            </label>
            <div className="row">
              <label>
                <div className="muted">GitHub Prefix</div>
                <input
                  value={githubPrefix}
                  onChange={(event) => setGithubPrefix(event.target.value)}
                  placeholder="github:"
                />
              </label>
              <label>
                <div className="muted">Local Prefix</div>
                <input
                  value={localPrefix}
                  onChange={(event) => setLocalPrefix(event.target.value)}
                  placeholder="local:"
                />
              </label>
            </div>
            <label>
              <div className="muted">Reason (for audit log)</div>
              <input
                value={workspaceSettingsReason}
                onChange={(event) => setWorkspaceSettingsReason(event.target.value)}
                placeholder="why this setting changed"
              />
            </label>
            <div className="toolbar">
              <button className="primary" type="button" onClick={() => void saveWorkspaceSettings()}>
                Save Resolution Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setResolutionOrder(RESOLUTION_KINDS);
                  setAutoCreateProject(true);
                  setGithubPrefix('github:');
                  setLocalPrefix('local:');
                }}
              >
                Reset Default
              </button>
            </div>
          </div>
        </article>

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
        />

        <article className="panel">
          <div className="panel-body">
            <div className="panel-title">Project Mappings</div>
            <label>
              <div className="muted">Reason (for add/update audit)</div>
              <input
                value={mappingReason}
                onChange={(event) => setMappingReason(event.target.value)}
                placeholder="why this mapping changed"
              />
            </label>
            <form className="stack" onSubmit={createProjectMapping}>
              <div className="row">
                <select value={newMappingKind} onChange={(event) => setNewMappingKind(event.target.value as ResolutionKind)}>
                  {RESOLUTION_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <select value={newMappingProjectKey} onChange={(event) => setNewMappingProjectKey(event.target.value)}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.key}>
                      {project.key}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <input
                  value={newMappingExternalId}
                  onChange={(event) => setNewMappingExternalId(event.target.value)}
                  placeholder="external id (owner/repo or slug)"
                  required
                />
                <input
                  value={newMappingPriority}
                  onChange={(event) => setNewMappingPriority(event.target.value)}
                  placeholder="priority (optional)"
                />
              </div>
              <label className="muted">
                <input
                  type="checkbox"
                  checked={newMappingEnabled}
                  onChange={(event) => setNewMappingEnabled(event.target.checked)}
                />{' '}
                enabled
              </label>
              <button type="submit">Add Mapping</button>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>External Id</th>
                    <th>Project</th>
                    <th>Priority</th>
                    <th>Enabled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td>{mapping.kind}</td>
                      <td>
                        <input
                          defaultValue={mapping.external_id}
                          onBlur={(event) => {
                            const value = event.target.value.trim();
                            if (value && value !== mapping.external_id) {
                              void patchMapping(mapping.id, { external_id: value });
                            }
                          }}
                        />
                      </td>
                      <td>
                        <select
                          value={mapping.project.key}
                          onChange={(event) => void patchMapping(mapping.id, { project_key: event.target.value })}
                        >
                          {projects.map((project) => (
                            <option key={project.id} value={project.key}>
                              {project.key}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          defaultValue={mapping.priority}
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (!Number.isNaN(value) && value !== mapping.priority) {
                              void patchMapping(mapping.id, { priority: value });
                            }
                          }}
                        />
                      </td>
                      <td>
                        <label className="muted">
                          <input
                            type="checkbox"
                            checked={mapping.is_enabled}
                            onChange={(event) => void patchMapping(mapping.id, { is_enabled: event.target.checked })}
                          />
                        </label>
                      </td>
                      <td>
                        <div className="inline-actions">
                          <button
                            type="button"
                            onClick={() =>
                              void patchMapping(mapping.id, { priority: Math.max(0, mapping.priority - 1) })
                            }
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => void patchMapping(mapping.id, { priority: mapping.priority + 1 })}
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-body">
            <div className="panel-title">Projects</div>
            <div className="list">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={project.key === selectedProject ? 'active' : ''}
                  onClick={() => setSelectedProject(project.key)}
                >
                  <strong>{project.name}</strong>
                  <div className="muted">{project.key}</div>
                </button>
              ))}
            </div>
            <form className="row" onSubmit={createProject}>
              <input
                value={newProjectKey}
                onChange={(event) => setNewProjectKey(event.target.value)}
                placeholder="project key"
                required
              />
              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="project name"
                required
              />
              <button type="submit">Create Project</button>
            </form>
          </div>
        </article>

        <article className="panel">
          <div className="panel-body">
            <div className="panel-title">Project Members</div>
            <form className="row" onSubmit={addProjectMember}>
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="member email"
                required
              />
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button type="submit">Invite Member</button>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        {member.user.email}
                        <div className="muted">{member.user.name || 'no name'}</div>
                      </td>
                      <td>
                        <span className="pill">{member.role}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-body">
            <div className="panel-title">Memories</div>
            <form className="stack" onSubmit={runMemorySearch}>
              <div className="row">
                <input
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  placeholder="search content"
                />
                <select value={queryType} onChange={(event) => setQueryType(event.target.value)}>
                  <option value="">All types</option>
                  {MEMORY_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <input
                  type="datetime-local"
                  value={querySince}
                  onChange={(event) => setQuerySince(event.target.value)}
                />
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={queryLimit}
                  onChange={(event) => setQueryLimit(Number(event.target.value))}
                />
              </div>
              <label className="muted">
                <input
                  type="checkbox"
                  checked={scopeSelectedProject}
                  onChange={(event) => setScopeSelectedProject(event.target.checked)}
                />{' '}
                scope to selected project
              </label>
              <div className="toolbar">
                <button className="primary" type="submit">
                  Search
                </button>
                <button className="ghost" type="button" onClick={() => void runMemorySearch()}>
                  Refresh
                </button>
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Type</th>
                    <th>Scope</th>
                    <th>Content</th>
                  </tr>
                </thead>
                <tbody>
                  {memories.map((memory) => (
                    <tr key={memory.id} onClick={() => setSelectedMemoryId(memory.id)}>
                      <td>{new Date(memory.createdAt).toLocaleString()}</td>
                      <td>
                        <span className="pill">{memory.type}</span>
                      </td>
                      <td>
                        {memory.project.workspace.key}/{memory.project.key}
                      </td>
                      <td>{memory.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel-title">Create Memory</div>
            <form className="stack" onSubmit={createMemory}>
              <div className="row">
                <select value={newMemoryType} onChange={(event) => setNewMemoryType(event.target.value)}>
                  {MEMORY_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <input value={selectedProject} readOnly />
              </div>
              <textarea
                value={newMemoryContent}
                onChange={(event) => setNewMemoryContent(event.target.value)}
                placeholder="memory content"
                required
              />
              <textarea
                value={newMemoryMetadata}
                onChange={(event) => setNewMemoryMetadata(event.target.value)}
                placeholder='{"source":"admin-ui"}'
              />
              <button type="submit">Store Memory</button>
            </form>

            <div className="panel-title">Memory Detail</div>
            {selectedMemory ? (
              <pre>{JSON.stringify(selectedMemory, null, 2)}</pre>
            ) : (
              <div className="muted">Select a memory row to inspect details.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-body">
            <div className="panel-title">Imports</div>
            <form className="stack" onSubmit={uploadImport}>
              <div className="row">
                <select value={importSource} onChange={(event) => setImportSource(event.target.value as ImportSource)}>
                  <option value="codex">codex</option>
                  <option value="claude">claude</option>
                  <option value="generic">generic</option>
                </select>
                <input
                  type="file"
                  onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                  required
                />
              </div>
              <label className="muted">
                <input
                  type="checkbox"
                  checked={importUseSelectedProject}
                  onChange={(event) => setImportUseSelectedProject(event.target.checked)}
                />{' '}
                bind imported raw session to selected project when possible
              </label>
              <button type="submit">Upload Import</button>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>File</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((item) => (
                    <tr key={item.id} onClick={() => setSelectedImportId(item.id)}>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                      <td>{item.source}</td>
                      <td>
                        <span className="pill">{item.status}</span>
                      </td>
                      <td>{item.fileName}</td>
                      <td>
                        <div className="inline-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedImportId(item.id);
                              void parseImport(item.id);
                            }}
                          >
                            parse
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedImportId(item.id);
                              void extractImport(item.id);
                            }}
                          >
                            extract
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedImportId(item.id);
                              void loadStagedMemories(item.id);
                            }}
                          >
                            staged
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel-title">Staged Memories</div>
            {selectedImport ? (
              <div className="muted">
                selected import: <strong>{selectedImport.fileName}</strong> ({selectedImport.status})
              </div>
            ) : (
              <div className="muted">Select an import row.</div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Type</th>
                    <th>Project</th>
                    <th>Content</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedMemories.map((candidate) => (
                    <tr key={candidate.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStagedIds.includes(candidate.id)}
                          onChange={(event) => toggleStagedMemory(candidate.id, event.target.checked)}
                        />
                      </td>
                      <td>{candidate.type}</td>
                      <td>{candidate.project?.key || '-'}</td>
                      <td>{candidate.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="toolbar">
              <button
                type="button"
                className="primary"
                disabled={!selectedImportId || selectedStagedIds.length === 0}
                onClick={() => void commitImport(selectedImportId)}
              >
                Commit Selected ({selectedStagedIds.length})
              </button>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-body">
            <div className="panel-title">Raw Search (Snippet Only)</div>
            <form className="stack" onSubmit={runRawSearch}>
              <div className="row">
                <input
                  value={rawQuery}
                  onChange={(event) => setRawQuery(event.target.value)}
                  placeholder="query text"
                  required
                />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rawLimit}
                  onChange={(event) => setRawLimit(Number(event.target.value))}
                />
              </div>
              <label className="muted">
                <input
                  type="checkbox"
                  checked={rawUseSelectedProject}
                  onChange={(event) => setRawUseSelectedProject(event.target.checked)}
                />{' '}
                scope raw search to selected project
              </label>
              <div className="toolbar">
                <button className="primary" type="submit">
                  Search Raw Snippets
                </button>
              </div>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Role</th>
                    <th>Scope</th>
                    <th>Snippet</th>
                    <th>View</th>
                  </tr>
                </thead>
                <tbody>
                  {rawMatches.map((match) => (
                    <tr key={match.message_id}>
                      <td>{new Date(match.created_at).toLocaleString()}</td>
                      <td>{match.role}</td>
                      <td>{match.project_key || '-'}</td>
                      <td>{match.snippet}</td>
                      <td>
                        <button type="button" onClick={() => void viewRawMessage(match.message_id)}>
                          open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-title">Raw Message Detail</div>
            {rawMessageDetail ? (
              <pre>{JSON.stringify(rawMessageDetail, null, 2)}</pre>
            ) : (
              <div className="muted">Select a raw search row and open message to view audited snippet.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-body">
            <div className="panel-title">Audit Logs</div>
            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedWorkspace) {
                  return;
                }
                void loadAuditLogs(selectedWorkspace);
              }}
            >
              <input
                value={auditActionPrefix}
                onChange={(event) => setAuditActionPrefix(event.target.value)}
                placeholder="action prefix (e.g. raw.)"
              />
              <input
                type="number"
                min={1}
                max={200}
                value={auditLimit}
                onChange={(event) => setAuditLimit(Number(event.target.value))}
              />
              <button type="submit">Refresh Audit</button>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>{log.action}</td>
                      <td>{log.actorUserId}</td>
                      <td>
                        <pre>{JSON.stringify(log.target, null, 2)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
        {error ? <div className="error">{error}</div> : null}
        {missingCoreUrl ? (
          <div className="error">
            NEXT_PUBLIC_MEMORY_CORE_URL is missing. Set it to a browser-reachable memory-core URL.
          </div>
        ) : null}
        <div className="muted">
          {busy ? 'working...' : 'ready'} • workspace:{' '}
          <strong>{selectedWorkspace || '-'}</strong> • project: <strong>{selectedProject || '-'}</strong>
        </div>
      </section>
    </main>
  );
}
