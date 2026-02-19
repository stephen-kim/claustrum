'use client';

import type { FormEvent } from 'react';
import type {
  MonorepoSubprojectPolicy,
  OidcGroupMapping,
  OidcProvider,
  Project,
  ProjectMapping,
  ProjectMember,
  ProjectRole,
  Workspace,
} from '../../lib/types';
import { isSubprojectKey } from '../../lib/utils';
import type { AdminMemorySearchState } from './use-admin-memory-search-state';
import type { AdminWorkspaceProjectState } from './use-admin-workspace-project-state';
import { createWorkspaceSettingsActions } from './use-admin-workspace-settings-actions';
import type { AdminCallApi } from './types';
import { parseLineSeparatedValues } from './types';

type WorkspaceProjectDeps = {
  callApi: AdminCallApi;
  workspaceState: AdminWorkspaceProjectState;
  memoryState: AdminMemorySearchState;
};

export function useAdminWorkspaceProjectActions(deps: WorkspaceProjectDeps) {
  const { callApi, workspaceState, memoryState } = deps;
  const workspaceSettingsActions = createWorkspaceSettingsActions({
    callApi,
    workspaceState,
    memoryState,
  });

  async function loadWorkspaces() {
    const data = await callApi<{ workspaces: Workspace[] }>('/v1/workspaces');
    workspaceState.setWorkspaces(data.workspaces);
    if (!workspaceState.selectedWorkspace && data.workspaces.length > 0) {
      workspaceState.setSelectedWorkspace(data.workspaces[0].key);
    }
  }

  async function loadProjects(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<{ projects: Project[] }>(`/v1/projects?${query.toString()}`);
    workspaceState.setProjects(data.projects);
    if (!data.projects.some((project) => project.key === workspaceState.selectedProject)) {
      workspaceState.setSelectedProject(data.projects[0]?.key || '');
    }
    if (!workspaceState.newMappingProjectKey && data.projects.length > 0) {
      workspaceState.setNewMappingProjectKey(data.projects[0].key);
    }
    if (!workspaceState.newMonorepoPolicyRepoKey) {
      const repoProject = data.projects.find((project) => !isSubprojectKey(project.key));
      if (repoProject) {
        workspaceState.setNewMonorepoPolicyRepoKey(repoProject.key);
      }
    }
  }

  async function loadMembers(workspaceKey: string, projectKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<{ members: ProjectMember[] }>(
      `/v1/projects/${encodeURIComponent(projectKey)}/members?${query.toString()}`
    );
    workspaceState.setMembers(data.members);
  }

  const { loadWorkspaceSettings, saveWorkspaceSettings } = workspaceSettingsActions;

  async function loadProjectMappings(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<{ mappings: ProjectMapping[] }>(`/v1/project-mappings?${query.toString()}`);
    workspaceState.setMappings(data.mappings);
  }

  async function loadMonorepoSubprojectPolicies(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<{ policies: MonorepoSubprojectPolicy[] }>(
      `/v1/monorepo-subproject-policies?${query.toString()}`
    );
    workspaceState.setMonorepoSubprojectPolicies(data.policies || []);
  }

  async function createMonorepoSubprojectPolicy(event?: FormEvent) {
    event?.preventDefault();
    if (!workspaceState.selectedWorkspace) {
      return;
    }
    const repoKey = workspaceState.newMonorepoPolicyRepoKey.trim();
    const subpath = workspaceState.newMonorepoPolicySubpath.trim();
    if (!repoKey || !subpath) {
      return;
    }
    await callApi('/v1/monorepo-subproject-policies', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
        repo_key: repoKey,
        subpath,
        enabled: workspaceState.newMonorepoPolicyEnabled,
        reason: workspaceState.monorepoPolicyReason.trim() || undefined,
      }),
    });
    workspaceState.setNewMonorepoPolicySubpath('');
    await loadMonorepoSubprojectPolicies(workspaceState.selectedWorkspace);
  }

  async function patchMonorepoSubprojectPolicy(id: string, enabled: boolean) {
    if (!workspaceState.selectedWorkspace) {
      return;
    }
    await callApi(`/v1/monorepo-subproject-policies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
        enabled,
        reason: workspaceState.monorepoPolicyReason.trim() || undefined,
      }),
    });
    await loadMonorepoSubprojectPolicies(workspaceState.selectedWorkspace);
  }

  async function removeMonorepoSubprojectPolicy(id: string) {
    if (!workspaceState.selectedWorkspace) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: workspaceState.selectedWorkspace,
    });
    const reason = workspaceState.monorepoPolicyReason.trim();
    if (reason) {
      query.set('reason', reason);
    }
    await callApi(
      `/v1/monorepo-subproject-policies/${encodeURIComponent(id)}?${query.toString()}`,
      {
        method: 'DELETE',
      }
    );
    await loadMonorepoSubprojectPolicies(workspaceState.selectedWorkspace);
  }

  async function createProjectMapping(event: FormEvent) {
    event.preventDefault();
    if (
      !workspaceState.selectedWorkspace ||
      !workspaceState.newMappingProjectKey ||
      !workspaceState.newMappingExternalId.trim()
    ) {
      return;
    }
    const reason = workspaceState.mappingReason.trim();
    await callApi('/v1/project-mappings', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
        project_key: workspaceState.newMappingProjectKey,
        kind: workspaceState.newMappingKind,
        external_id: workspaceState.newMappingExternalId.trim(),
        priority: workspaceState.newMappingPriority ? Number(workspaceState.newMappingPriority) : undefined,
        is_enabled: workspaceState.newMappingEnabled,
        reason: reason || undefined,
      }),
    });
    workspaceState.setNewMappingExternalId('');
    workspaceState.setNewMappingPriority('');
    await loadProjectMappings(workspaceState.selectedWorkspace);
  }

  async function patchMapping(id: string, patch: Record<string, unknown>) {
    const reason = workspaceState.mappingReason.trim();
    await callApi('/v1/project-mappings', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        ...patch,
        reason: reason || undefined,
      }),
    });
    if (workspaceState.selectedWorkspace) {
      await loadProjectMappings(workspaceState.selectedWorkspace);
    }
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    await callApi('/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify({
        key: workspaceState.newWorkspaceKey.trim(),
        name: workspaceState.newWorkspaceName.trim(),
      }),
    });
    workspaceState.setNewWorkspaceKey('');
    workspaceState.setNewWorkspaceName('');
    await loadWorkspaces();
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!workspaceState.selectedWorkspace) {
      return;
    }
    await callApi('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
        key: workspaceState.newProjectKey.trim(),
        name: workspaceState.newProjectName.trim(),
      }),
    });
    workspaceState.setNewProjectKey('');
    workspaceState.setNewProjectName('');
    await loadProjects(workspaceState.selectedWorkspace);
  }

  async function bootstrapProjectContext(projectKey: string) {
    if (!workspaceState.selectedWorkspace || !projectKey) {
      return;
    }
    await callApi(`/v1/projects/${encodeURIComponent(projectKey)}/bootstrap`, {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
      }),
    });
  }

  async function recomputeProjectActiveWork(projectKey: string) {
    if (!workspaceState.selectedWorkspace || !projectKey) {
      return;
    }
    await callApi(`/v1/projects/${encodeURIComponent(projectKey)}/recompute-active-work`, {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
      }),
    });
  }

  async function addProjectMember(event: FormEvent) {
    event.preventDefault();
    if (!workspaceState.selectedWorkspace || !workspaceState.selectedProject) {
      return;
    }
    await callApi(`/v1/projects/${encodeURIComponent(workspaceState.selectedProject)}/members`, {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
        email: workspaceState.inviteEmail.trim(),
        role: workspaceState.inviteRole,
      }),
    });
    workspaceState.setInviteEmail('');
    await loadMembers(workspaceState.selectedWorkspace, workspaceState.selectedProject);
  }

  async function updateProjectMemberRole(userId: string, role: ProjectRole) {
    if (!workspaceState.selectedWorkspace || !workspaceState.selectedProject) {
      return;
    }
    await callApi(
      `/v1/projects/${encodeURIComponent(workspaceState.selectedProject)}/members/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          workspace_key: workspaceState.selectedWorkspace,
          role,
        }),
      }
    );
    await loadMembers(workspaceState.selectedWorkspace, workspaceState.selectedProject);
  }

  async function removeProjectMember(userId: string) {
    if (!workspaceState.selectedWorkspace || !workspaceState.selectedProject) {
      return;
    }
    const query = new URLSearchParams({ workspace_key: workspaceState.selectedWorkspace });
    await callApi(
      `/v1/projects/${encodeURIComponent(workspaceState.selectedProject)}/members/${encodeURIComponent(userId)}?${query.toString()}`,
      {
        method: 'DELETE',
      }
    );
    await loadMembers(workspaceState.selectedWorkspace, workspaceState.selectedProject);
  }

  async function loadWorkspaceSsoSettings(workspaceKey: string) {
    const result = await callApi<{
      workspace_key: string;
      oidc_sync_mode: 'add_only' | 'add_and_remove';
      oidc_allow_auto_provision: boolean;
    }>(`/v1/workspaces/${encodeURIComponent(workspaceKey)}/sso-settings`);
    workspaceState.setOidcSyncMode(result.oidc_sync_mode);
    workspaceState.setOidcAllowAutoProvision(result.oidc_allow_auto_provision);
  }

  async function saveWorkspaceSsoSettings() {
    if (!workspaceState.selectedWorkspace) {
      return;
    }
    await callApi(`/v1/workspaces/${encodeURIComponent(workspaceState.selectedWorkspace)}/sso-settings`, {
      method: 'PUT',
      body: JSON.stringify({
        oidc_sync_mode: workspaceState.oidcSyncMode,
        oidc_allow_auto_provision: workspaceState.oidcAllowAutoProvision,
        reason: workspaceState.oidcSettingsReason.trim() || undefined,
      }),
    });
    await loadWorkspaceSsoSettings(workspaceState.selectedWorkspace);
  }

  async function loadOidcProviders(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const result = await callApi<{ providers: OidcProvider[] }>(`/v1/oidc/providers?${query.toString()}`);
    workspaceState.setOidcProviders(result.providers);
    if (!workspaceState.selectedOidcProviderId && result.providers.length > 0) {
      workspaceState.setSelectedOidcProviderId(result.providers[0].id);
    }
  }

  async function saveOidcProvider(event: FormEvent) {
    event.preventDefault();
    if (!workspaceState.selectedWorkspace) {
      return;
    }

    const body = {
      workspace_key: workspaceState.selectedWorkspace,
      name: workspaceState.oidcProviderName.trim(),
      issuer_url: workspaceState.oidcProviderIssuerUrl.trim(),
      client_id: workspaceState.oidcProviderClientId.trim(),
      client_secret: workspaceState.oidcProviderClientSecret.trim(),
      discovery_enabled: workspaceState.oidcProviderDiscoveryEnabled,
      scopes: workspaceState.oidcProviderScopes.trim() || 'openid profile email',
      claim_groups_name: workspaceState.oidcClaimGroupsName.trim() || 'groups',
      claim_groups_format: workspaceState.oidcClaimGroupsFormat,
      enabled: workspaceState.oidcProviderEnabled,
      reason: workspaceState.oidcSettingsReason.trim() || undefined,
    };

    if (workspaceState.selectedOidcProviderId) {
      await callApi(`/v1/oidc/providers/${encodeURIComponent(workspaceState.selectedOidcProviderId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    } else {
      await callApi('/v1/oidc/providers', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }
    workspaceState.setOidcProviderClientSecret('');
    await loadOidcProviders(workspaceState.selectedWorkspace);
  }

  async function loadOidcMappings(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    if (workspaceState.selectedOidcProviderId) {
      query.set('provider_id', workspaceState.selectedOidcProviderId);
    }
    const result = await callApi<{ mappings: OidcGroupMapping[] }>(
      `/v1/oidc/group-mappings?${query.toString()}`
    );
    workspaceState.setOidcMappings(result.mappings);
  }

  async function createOidcMapping(event: FormEvent) {
    event.preventDefault();
    if (!workspaceState.selectedWorkspace || !workspaceState.selectedOidcProviderId) {
      return;
    }
    await callApi('/v1/oidc/group-mappings', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
        provider_id: workspaceState.selectedOidcProviderId,
        claim_name: workspaceState.oidcMappingClaimName.trim() || undefined,
        group_id: workspaceState.oidcMappingGroupId.trim(),
        group_display_name: workspaceState.oidcMappingDisplayName.trim(),
        target_type: workspaceState.oidcMappingTargetType,
        target_key: workspaceState.oidcMappingTargetKey.trim(),
        role: workspaceState.oidcMappingRole,
        priority: Number(workspaceState.oidcMappingPriority || '100'),
        enabled: workspaceState.oidcMappingEnabled,
        reason: workspaceState.oidcSettingsReason.trim() || undefined,
      }),
    });
    workspaceState.setOidcMappingGroupId('');
    workspaceState.setOidcMappingDisplayName('');
    workspaceState.setOidcMappingTargetKey('');
    await loadOidcMappings(workspaceState.selectedWorkspace);
  }

  async function patchOidcMapping(id: string, patch: Record<string, unknown>) {
    if (!workspaceState.selectedWorkspace || !workspaceState.selectedOidcProviderId) {
      return;
    }
    await callApi(`/v1/oidc/group-mappings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        workspace_key: workspaceState.selectedWorkspace,
        provider_id: workspaceState.selectedOidcProviderId,
        ...patch,
        reason: workspaceState.oidcSettingsReason.trim() || undefined,
      }),
    });
    await loadOidcMappings(workspaceState.selectedWorkspace);
  }

  async function deleteOidcMapping(id: string) {
    if (!workspaceState.selectedWorkspace) {
      return;
    }
    const query = new URLSearchParams({ workspace_key: workspaceState.selectedWorkspace });
    const reason = workspaceState.oidcSettingsReason.trim();
    if (reason) {
      query.set('reason', reason);
    }
    await callApi(`/v1/oidc/group-mappings/${encodeURIComponent(id)}?${query.toString()}`, {
      method: 'DELETE',
    });
    await loadOidcMappings(workspaceState.selectedWorkspace);
  }

  return {
    loadWorkspaces,
    loadProjects,
    loadMembers,
    loadWorkspaceSettings,
    saveWorkspaceSettings,
    loadProjectMappings,
    loadMonorepoSubprojectPolicies,
    createMonorepoSubprojectPolicy,
    patchMonorepoSubprojectPolicy,
    removeMonorepoSubprojectPolicy,
    createProjectMapping,
    patchMapping,
    createWorkspace,
    createProject,
    bootstrapProjectContext,
    recomputeProjectActiveWork,
    addProjectMember,
    updateProjectMemberRole,
    removeProjectMember,
    loadWorkspaceSsoSettings,
    saveWorkspaceSsoSettings,
    loadOidcProviders,
    saveOidcProvider,
    loadOidcMappings,
    createOidcMapping,
    patchOidcMapping,
    deleteOidcMapping,
  };
}

export type AdminWorkspaceProjectActions = ReturnType<typeof useAdminWorkspaceProjectActions>;
