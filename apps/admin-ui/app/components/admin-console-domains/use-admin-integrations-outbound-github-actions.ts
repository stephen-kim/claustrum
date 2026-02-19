'use client';

import type {
  GithubInstallationStatus,
  GithubPermissionCacheStatusResponse,
  GithubPermissionPreviewResponse,
  GithubPermissionStatusResponse,
  GithubPermissionSyncResponse,
  GithubRepoLinksResponse,
  GithubTeamMappingsResponse,
  GithubUserLinksResponse,
  GithubWebhookEventsResponse,
} from '../../lib/types';
import type { AdminCallApi } from './types';
import type { AdminIntegrationsOutboundState } from './use-admin-integrations-outbound-state';

type GithubDeps = {
  callApi: AdminCallApi;
  state: AdminIntegrationsOutboundState;
};

export function createAdminIntegrationsOutboundGithubActions(deps: GithubDeps) {
  const { callApi, state } = deps;

  async function loadGithubInstallation(workspaceKey: string) {
    const data = await callApi<GithubInstallationStatus>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/installation`
    );
    state.setGithubInstallation(data.installation);
  }

  async function loadGithubRepos(workspaceKey: string) {
    const data = await callApi<GithubRepoLinksResponse>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/repos`
    );
    state.setGithubRepos(data.repos || []);
  }

  async function loadGithubUserLinks(workspaceKey: string) {
    const data = await callApi<GithubUserLinksResponse>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/user-links`
    );
    state.setGithubUserLinks(data.links || []);
  }

  async function createGithubUserLink(workspaceKey: string, userId: string, githubLogin: string) {
    await callApi(`/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/user-links`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        github_login: githubLogin,
      }),
    });
    await loadGithubUserLinks(workspaceKey);
  }

  async function deleteGithubUserLink(workspaceKey: string, userId: string) {
    await callApi(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/user-links/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
    await loadGithubUserLinks(workspaceKey);
  }

  async function loadGithubPermissionStatus(workspaceKey: string) {
    const data = await callApi<GithubPermissionStatusResponse>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/permission-status`
    );
    state.setGithubPermissionStatus(data);
    return data;
  }

  async function loadGithubCacheStatus(workspaceKey: string) {
    const data = await callApi<GithubPermissionCacheStatusResponse>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/cache-status`
    );
    state.setGithubPermissionCacheStatus(data);
    return data;
  }

  async function previewGithubPermissions(workspaceKey: string, repo: string) {
    const query = new URLSearchParams({ repo });
    const data = await callApi<GithubPermissionPreviewResponse>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/permission-preview?${query.toString()}`
    );
    state.setGithubPermissionPreview(data);
    return data;
  }

  async function loadGithubWebhookDeliveries(workspaceKey: string) {
    const data = await callApi<GithubWebhookEventsResponse>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/webhook-events`
    );
    state.setGithubWebhookDeliveries(data.deliveries || []);
  }

  async function loadGithubTeamMappings(workspaceKey: string) {
    const data = await callApi<GithubTeamMappingsResponse>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/team-mappings`
    );
    state.setGithubTeamMappings(data.mappings || []);
  }

  async function createGithubTeamMapping(args: {
    workspaceKey: string;
    input: {
      providerInstallationId?: string | null;
      githubTeamId: string;
      githubTeamSlug: string;
      githubOrgLogin: string;
      targetType: 'workspace' | 'project';
      targetKey: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER';
      enabled?: boolean;
      priority?: number;
    };
  }) {
    await callApi(`/v1/workspaces/${encodeURIComponent(args.workspaceKey)}/github/team-mappings`, {
      method: 'POST',
      body: JSON.stringify({
        provider_installation_id: args.input.providerInstallationId || null,
        github_team_id: args.input.githubTeamId,
        github_team_slug: args.input.githubTeamSlug,
        github_org_login: args.input.githubOrgLogin,
        target_type: args.input.targetType,
        target_key: args.input.targetKey,
        role: args.input.role,
        enabled: args.input.enabled ?? true,
        priority: args.input.priority ?? 100,
      }),
    });
    await loadGithubTeamMappings(args.workspaceKey);
  }

  async function patchGithubTeamMapping(args: {
    workspaceKey: string;
    mappingId: string;
    input: {
      providerInstallationId?: string | null;
      githubTeamId?: string;
      githubTeamSlug?: string;
      githubOrgLogin?: string;
      targetType?: 'workspace' | 'project';
      targetKey?: string;
      role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER';
      enabled?: boolean;
      priority?: number;
    };
  }) {
    await callApi(
      `/v1/workspaces/${encodeURIComponent(args.workspaceKey)}/github/team-mappings/${encodeURIComponent(args.mappingId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          provider_installation_id: args.input.providerInstallationId,
          github_team_id: args.input.githubTeamId,
          github_team_slug: args.input.githubTeamSlug,
          github_org_login: args.input.githubOrgLogin,
          target_type: args.input.targetType,
          target_key: args.input.targetKey,
          role: args.input.role,
          enabled: args.input.enabled,
          priority: args.input.priority,
        }),
      }
    );
    await loadGithubTeamMappings(args.workspaceKey);
  }

  async function deleteGithubTeamMapping(workspaceKey: string, mappingId: string) {
    await callApi(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/team-mappings/${encodeURIComponent(mappingId)}`,
      {
        method: 'DELETE',
      }
    );
    await loadGithubTeamMappings(workspaceKey);
  }

  async function syncGithubPermissions(args: {
    workspaceKey: string;
    dryRun?: boolean;
    projectKeyPrefix?: string;
    repos?: string[];
  }): Promise<GithubPermissionSyncResponse> {
    const data = await callApi<GithubPermissionSyncResponse>(
      `/v1/workspaces/${encodeURIComponent(args.workspaceKey)}/github/sync-permissions`,
      {
        method: 'POST',
        body: JSON.stringify({
          dry_run: args.dryRun === true,
          project_key_prefix: args.projectKeyPrefix?.trim() || undefined,
          repos: args.repos?.map((item) => item.trim()).filter((item) => item.length > 0),
        }),
      }
    );
    state.setGithubLastPermissionSyncResult(data);
    await Promise.all([
      loadGithubPermissionStatus(args.workspaceKey),
      loadGithubUserLinks(args.workspaceKey),
      loadGithubRepos(args.workspaceKey),
      loadGithubCacheStatus(args.workspaceKey),
    ]);
    return data;
  }

  async function generateGithubInstallUrl(workspaceKey: string): Promise<string> {
    const data = await callApi<{ url: string }>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/install-url`
    );
    state.setGithubInstallUrl(data.url);
    return data.url;
  }

  async function syncGithubRepos(workspaceKey: string): Promise<{
    count: number;
    projects_auto_created: number;
    projects_auto_linked: number;
  }> {
    const data = await callApi<{
      count: number;
      projects_auto_created: number;
      projects_auto_linked: number;
    }>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/github/sync-repos`,
      { method: 'POST' }
    );
    state.setGithubLastSyncSummary({
      count: data.count,
      projects_auto_created: data.projects_auto_created ?? 0,
      projects_auto_linked: data.projects_auto_linked ?? 0,
    });
    await Promise.all([loadGithubInstallation(workspaceKey), loadGithubRepos(workspaceKey)]);
    return data;
  }

  return {
    loadGithubInstallation,
    loadGithubRepos,
    loadGithubUserLinks,
    createGithubUserLink,
    deleteGithubUserLink,
    loadGithubPermissionStatus,
    loadGithubCacheStatus,
    previewGithubPermissions,
    loadGithubWebhookDeliveries,
    loadGithubTeamMappings,
    createGithubTeamMapping,
    patchGithubTeamMapping,
    deleteGithubTeamMapping,
    syncGithubPermissions,
    generateGithubInstallUrl,
    syncGithubRepos,
  };
}
