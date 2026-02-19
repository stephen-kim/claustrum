'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminSessionSidebar } from './admin-session-sidebar';
import { AdminActivityPanels } from './admin-console-sections/admin-activity-panels';
import { AdminManagementPanels } from './admin-console-sections/admin-management-panels';
import { useAdminAuthInviteApiKeyActions } from './admin-console-domains/use-admin-auth-invite-api-key-actions';
import { useAdminAuthInviteApiKeyState } from './admin-console-domains/use-admin-auth-invite-api-key-state';
import { useAdminIntegrationsOutboundActions } from './admin-console-domains/use-admin-integrations-outbound-actions';
import { useAdminIntegrationsOutboundState } from './admin-console-domains/use-admin-integrations-outbound-state';
import { useAdminMemorySearchActions } from './admin-console-domains/use-admin-memory-search-actions';
import { useAdminMemorySearchState } from './admin-console-domains/use-admin-memory-search-state';
import { useAdminGlobalRulesActions } from './admin-console-domains/use-admin-global-rules-actions';
import { useAdminGlobalRulesState } from './admin-console-domains/use-admin-global-rules-state';
import { useAdminWorkspaceProjectActions } from './admin-console-domains/use-admin-workspace-project-actions';
import { useAdminWorkspaceProjectState } from './admin-console-domains/use-admin-workspace-project-state';
import { isSubprojectKey } from '../lib/utils';

const API_BASE_URL = (process.env.NEXT_PUBLIC_MEMORY_CORE_URL || '').trim();
const SESSION_TOKEN_STORAGE_KEY = 'claustrum-admin-session-token';

export function AdminConsolePage(props: { logout: () => Promise<void> }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const missingCoreUrl = !API_BASE_URL;

  const authState = useAdminAuthInviteApiKeyState();
  const workspaceState = useAdminWorkspaceProjectState();
  const memoryState = useAdminMemorySearchState();
  const globalRulesState = useAdminGlobalRulesState();
  const integrationsState = useAdminIntegrationsOutboundState();

  async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
    if (!apiKey) {
      throw new Error('Not authenticated.');
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
      return response;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : String(requestError);
      setError(message);
      throw requestError;
    } finally {
      setBusy(false);
    }
  }

  async function callApiRaw(path: string, init?: RequestInit): Promise<Response> {
    const response = await authorizedFetch(path, init);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const message = body.error || `${response.status} ${response.statusText}`;
      setError(message);
      throw new Error(message);
    }
    return response;
  }

  async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await callApiRaw(path, init);
    try {
      return (await response.json()) as T;
    } catch {
      throw new Error('Expected JSON response but received a different format.');
    }
  }

  const authActions = useAdminAuthInviteApiKeyActions({
    callApi,
    selectedWorkspace: workspaceState.selectedWorkspace,
    state: authState,
    setError,
  });

  const workspaceActions = useAdminWorkspaceProjectActions({
    callApi,
    workspaceState,
    memoryState,
  });

  const memoryActions = useAdminMemorySearchActions({
    callApi,
    callApiRaw,
    selectedWorkspace: workspaceState.selectedWorkspace,
    selectedProject: workspaceState.selectedProject,
    state: memoryState,
    setError,
  });

  const globalRulesActions = useAdminGlobalRulesActions({
    callApi,
    selectedWorkspace: workspaceState.selectedWorkspace,
    state: globalRulesState,
  });

  const integrationsActions = useAdminIntegrationsOutboundActions({
    callApi,
    selectedWorkspace: workspaceState.selectedWorkspace,
    state: integrationsState,
    setError,
  });

  const selectedMemory = useMemo(
    () => memoryState.memories.find((memory) => memory.id === memoryState.selectedMemoryId) || null,
    [memoryState.memories, memoryState.selectedMemoryId]
  );

  const selectedImport = useMemo(
    () => memoryState.imports.find((item) => item.id === memoryState.selectedImportId) || null,
    [memoryState.imports, memoryState.selectedImportId]
  );

  const filteredProjects = useMemo(() => {
    if (workspaceState.projectViewFilter === 'repo_only') {
      return workspaceState.projects.filter((project) => !isSubprojectKey(project.key));
    }
    if (workspaceState.projectViewFilter === 'subprojects_only') {
      return workspaceState.projects.filter((project) => isSubprojectKey(project.key));
    }
    return workspaceState.projects;
  }, [workspaceState.projectViewFilter, workspaceState.projects]);

  useEffect(() => {
    const stored =
      window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ||
      window.localStorage.getItem('memory-core-admin-key');
    if (stored) {
      setApiKey(stored);
    }
  }, []);

  useEffect(() => {
    memoryState.setSelectedMemoryDraftContent(selectedMemory?.content || '');
  }, [memoryState, selectedMemory]);

  async function initializeData() {
    await Promise.all([
      workspaceActions.loadWorkspaces(),
      authActions.loadUsers(),
      authActions.loadContextPersona(),
    ]);
  }

  useEffect(() => {
    if (!apiKey || missingCoreUrl) {
      return;
    }
    void initializeData().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, missingCoreUrl]);

  useEffect(() => {
    if (!apiKey || !workspaceState.selectedWorkspace || missingCoreUrl) {
      workspaceState.resetWorkspaceScopedState();
      memoryState.resetWorkspaceScopedState();
      globalRulesState.resetWorkspaceScopedState();
      authState.resetWorkspaceScopedState();
      integrationsState.resetWorkspaceScopedState();
      return;
    }

    void Promise.all([
      workspaceActions.loadProjects(workspaceState.selectedWorkspace),
      workspaceActions.loadWorkspaceSettings(workspaceState.selectedWorkspace),
      workspaceActions.loadMonorepoSubprojectPolicies(workspaceState.selectedWorkspace),
      workspaceActions.loadWorkspaceSsoSettings(workspaceState.selectedWorkspace),
      authActions.loadWorkspaceMembers(workspaceState.selectedWorkspace),
      authActions.loadOwnApiKeys(),
      memoryActions.loadDecisionKeywordPolicies(workspaceState.selectedWorkspace),
      memoryActions.loadDecisions(workspaceState.selectedWorkspace),
      integrationsActions.loadWorkspaceOutboundSettings(workspaceState.selectedWorkspace),
      workspaceActions.loadProjectMappings(workspaceState.selectedWorkspace),
      workspaceActions.loadOidcProviders(workspaceState.selectedWorkspace),
      memoryActions.loadImports(workspaceState.selectedWorkspace),
      memoryActions.loadRawEvents(),
      memoryActions.loadAuditLogs(workspaceState.selectedWorkspace),
      memoryActions.loadAccessTimeline(workspaceState.selectedWorkspace),
      memoryActions.loadLlmUsage(workspaceState.selectedWorkspace),
      globalRulesActions.loadGlobalRules(globalRulesState.scope, globalRulesState.targetUserId),
      integrationsActions.loadIntegrations(workspaceState.selectedWorkspace),
      integrationsActions.loadGithubInstallation(workspaceState.selectedWorkspace),
      integrationsActions.loadGithubRepos(workspaceState.selectedWorkspace),
      integrationsActions.loadGithubUserLinks(workspaceState.selectedWorkspace),
      integrationsActions.loadGithubPermissionStatus(workspaceState.selectedWorkspace),
      integrationsActions.loadGithubCacheStatus(workspaceState.selectedWorkspace),
      integrationsActions.loadGithubWebhookDeliveries(workspaceState.selectedWorkspace),
      integrationsActions.loadGithubTeamMappings(workspaceState.selectedWorkspace),
      integrationsActions.loadAuditSinks(workspaceState.selectedWorkspace),
      integrationsActions.loadAuditDeliveries(workspaceState.selectedWorkspace),
      integrationsActions.loadDetectionRules(workspaceState.selectedWorkspace),
      integrationsActions.loadDetections(workspaceState.selectedWorkspace),
      integrationsActions.loadOutboundPolicy(
        workspaceState.selectedWorkspace,
        integrationsState.selectedOutboundIntegration
      ),
      integrationsActions.loadOutboundTemplateVariables(
        workspaceState.selectedWorkspace,
        integrationsState.selectedOutboundIntegration
      ),
    ]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiKey,
    workspaceState.selectedWorkspace,
    integrationsState.selectedOutboundIntegration,
    globalRulesState.scope,
    globalRulesState.targetUserId,
    missingCoreUrl,
  ]);

  useEffect(() => {
    if (!apiKey || !authState.selectedApiKeyUserId || missingCoreUrl) {
      authState.setSelectedUserApiKeys([]);
      return;
    }
    void authActions.loadUserApiKeys(authState.selectedApiKeyUserId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, authState.selectedApiKeyUserId, missingCoreUrl]);

  useEffect(() => {
    if (integrationsState.githubLinkUserId || authState.workspaceMembers.length === 0) {
      return;
    }
    integrationsState.setGithubLinkUserId(authState.workspaceMembers[0].user.id);
  }, [
    authState.workspaceMembers,
    integrationsState.githubLinkUserId,
    integrationsState.setGithubLinkUserId,
  ]);

  useEffect(() => {
    if (!apiKey || !workspaceState.selectedWorkspace || missingCoreUrl) {
      workspaceState.setOidcMappings([]);
      return;
    }
    void workspaceActions.loadOidcMappings(workspaceState.selectedWorkspace).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, workspaceState.selectedWorkspace, workspaceState.selectedOidcProviderId, missingCoreUrl]);

  useEffect(() => {
    const selected =
      workspaceState.oidcProviders.find((provider) => provider.id === workspaceState.selectedOidcProviderId) ||
      null;
    if (!selected) {
      return;
    }
    workspaceState.setOidcProviderName(selected.name);
    workspaceState.setOidcProviderIssuerUrl(selected.issuer_url);
    workspaceState.setOidcProviderClientId(selected.client_id);
    workspaceState.setOidcProviderClientSecret('');
    workspaceState.setOidcProviderDiscoveryEnabled(selected.discovery_enabled);
    workspaceState.setOidcProviderScopes(selected.scopes);
    workspaceState.setOidcClaimGroupsName(selected.claim_groups_name);
    workspaceState.setOidcClaimGroupsFormat(selected.claim_groups_format);
    workspaceState.setOidcProviderEnabled(selected.enabled);
  }, [workspaceState.selectedOidcProviderId, workspaceState.oidcProviders]);

  useEffect(() => {
    if (!apiKey || !workspaceState.selectedWorkspace || missingCoreUrl) {
      return;
    }
    void integrationsActions
      .loadAuditDeliveries(workspaceState.selectedWorkspace)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, workspaceState.selectedWorkspace, integrationsState.auditDeliveryStatusFilter, missingCoreUrl]);

  useEffect(() => {
    if (!apiKey || !workspaceState.selectedWorkspace || missingCoreUrl) {
      return;
    }
    void integrationsActions.loadDetections(workspaceState.selectedWorkspace).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, workspaceState.selectedWorkspace, integrationsState.detectionStatusFilter, missingCoreUrl]);

  useEffect(() => {
    if (!apiKey || !workspaceState.selectedWorkspace || !workspaceState.selectedProject || missingCoreUrl) {
      workspaceState.setMembers([]);
      memoryState.setActiveWorkItems([]);
      memoryState.setActiveWorkEvents([]);
      return;
    }
    void Promise.all([
      workspaceActions.loadMembers(workspaceState.selectedWorkspace, workspaceState.selectedProject),
      memoryActions.loadProjectActiveWork(workspaceState.selectedProject),
    ]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiKey,
    workspaceState.selectedWorkspace,
    workspaceState.selectedProject,
    memoryState.activeWorkIncludeClosed,
    missingCoreUrl,
  ]);

  useEffect(() => {
    if (!apiKey || !workspaceState.selectedWorkspace || !workspaceState.selectedProject || missingCoreUrl) {
      memoryState.setActiveWorkEvents([]);
      return;
    }
    void memoryActions.loadProjectActiveWorkEvents(workspaceState.selectedProject).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiKey,
    workspaceState.selectedWorkspace,
    workspaceState.selectedProject,
    memoryState.selectedActiveWorkId,
    missingCoreUrl,
  ]);

  useEffect(() => {
    if (!apiKey || !memoryState.selectedImportId || missingCoreUrl) {
      memoryState.setStagedMemories([]);
      memoryState.setSelectedStagedIds([]);
      return;
    }
    void memoryActions.loadStagedMemories(memoryState.selectedImportId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, memoryState.selectedImportId, missingCoreUrl]);

  return (
    <main className="dashboard">
      <AdminSessionSidebar
        apiBaseUrl={API_BASE_URL}
        initializeData={initializeData}
        logout={props.logout}
        workspaces={workspaceState.workspaces}
        selectedWorkspace={workspaceState.selectedWorkspace}
        setSelectedWorkspace={workspaceState.setSelectedWorkspace}
        createWorkspace={workspaceActions.createWorkspace}
        newWorkspaceKey={workspaceState.newWorkspaceKey}
        setNewWorkspaceKey={workspaceState.setNewWorkspaceKey}
        newWorkspaceName={workspaceState.newWorkspaceName}
        setNewWorkspaceName={workspaceState.setNewWorkspaceName}
        createUser={authActions.createUser}
        newUserEmail={authState.newUserEmail}
        setNewUserEmail={authState.setNewUserEmail}
        newUserName={authState.newUserName}
        setNewUserName={authState.setNewUserName}
        users={authState.users}
      />

      <section className="content">
        <section className="panel">
          <div className="panel-body">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="/brand/logo-white.svg"
                  alt="Claustrum logo"
                  width={34}
                  height={34}
                  className="rounded-md border border-border/60 bg-black/40 p-1"
                />
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Claustrum Admin Console</h1>
                  <p className="muted">
                    Workspace governance, integrations, import pipeline, and audit visibility.
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                {busy ? 'working...' : 'ready'} • workspace: <strong>{workspaceState.selectedWorkspace || '-'}</strong>{' '}
                • project: <strong>{workspaceState.selectedProject || '-'}</strong>
              </div>
            </div>
          </div>
        </section>

        <AdminManagementPanels
          selectedWorkspace={workspaceState.selectedWorkspace}
          filteredProjects={filteredProjects}
          authState={authState}
          authActions={authActions}
          workspaceState={workspaceState}
          workspaceActions={workspaceActions}
          memoryState={memoryState}
          memoryActions={memoryActions}
          globalRulesState={globalRulesState}
          globalRulesActions={globalRulesActions}
          integrationsState={integrationsState}
          integrationsActions={integrationsActions}
        />

        <AdminActivityPanels
          selectedWorkspace={workspaceState.selectedWorkspace}
          selectedProject={workspaceState.selectedProject}
          projects={workspaceState.projects}
          workspaceState={workspaceState}
          authState={authState}
          authActions={authActions}
          memoryState={memoryState}
          memoryActions={memoryActions}
          selectedMemory={selectedMemory}
          selectedImport={selectedImport}
        />

        {error ? <div className="error">{error}</div> : null}
        {missingCoreUrl ? (
          <div className="error">
            `NEXT_PUBLIC_MEMORY_CORE_URL` is not configured. Set it in `.env` for `apps/admin-ui`.
          </div>
        ) : null}
      </section>
    </main>
  );
}
