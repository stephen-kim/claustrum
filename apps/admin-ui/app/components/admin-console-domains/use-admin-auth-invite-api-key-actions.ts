'use client';

import type { FormEvent } from 'react';
import type { ApiKeyItem, User, WorkspaceMember, WorkspaceRole } from '../../lib/types';
import type { AdminAuthInviteApiKeyState } from './use-admin-auth-invite-api-key-state';
import type { AdminCallApi } from './types';

type AuthInviteApiKeyDeps = {
  callApi: AdminCallApi;
  selectedWorkspace: string;
  state: AdminAuthInviteApiKeyState;
  setError: (message: string | null) => void;
};

function resolveDeviceLabel(prefix: string): string {
  if (typeof window === 'undefined') {
    return `${prefix}-unknown`;
  }
  const platform = (navigator.platform || 'browser').replace(/\s+/g, '-');
  const host = (window.location.hostname || 'localhost').replace(/\s+/g, '-');
  return `${prefix}-${platform}-${host}`.slice(0, 120);
}

export function useAdminAuthInviteApiKeyActions(deps: AuthInviteApiKeyDeps) {
  const {
    callApi,
    selectedWorkspace,
    state,
    setError,
  } = deps;
  const {
    selectedApiKeyUserId,
    workspaceMemberEmail,
    workspaceMemberRole,
    workspaceInviteEmail,
    workspaceInviteRole,
    workspaceInviteProjectRolesJson,
    newUserEmail,
    newUserName,
    selfApiKeyLabel,
    contextPersona,
    setUsers,
    setWorkspaceMembers,
    setSelectedApiKeyUserId,
    setSelectedUserApiKeys,
    setWorkspaceMemberEmail,
    setLatestInviteUrl,
    setLatestInviteExpiresAt,
    setWorkspaceInviteEmail,
    setSelfApiKeys,
    setSelfApiKeyLabel,
    setContextPersona,
    setGeneratedSelfApiKey,
    setLatestOneTimeUrl,
    setLatestOneTimeExpiresAt,
  } = state;

  async function loadUsers() {
    const data = await callApi<{ users: User[] }>('/v1/users');
    setUsers(data.users);
  }

  async function loadWorkspaceMembers(workspaceKey: string) {
    const data = await callApi<{ members: WorkspaceMember[] }>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/members`
    );
    setWorkspaceMembers(data.members);
    if (data.members.length === 0) {
      setSelectedApiKeyUserId('');
      setSelectedUserApiKeys([]);
      return;
    }
    if (
      data.members.length > 0 &&
      !data.members.some((member) => member.user.id === selectedApiKeyUserId)
    ) {
      setSelectedApiKeyUserId(data.members[0].user.id);
    }
  }

  async function loadOwnApiKeys() {
    const data = await callApi<{ keys: ApiKeyItem[] }>('/v1/api-keys');
    setSelfApiKeys(data.keys);
  }

  async function loadUserApiKeys(userId: string) {
    const data = await callApi<{ user_id: string; keys: ApiKeyItem[] }>(
      `/v1/users/${encodeURIComponent(userId)}/api-keys`
    );
    setSelectedUserApiKeys(data.keys);
  }

  async function loadContextPersona() {
    const data = await callApi<{ context_persona: 'neutral' | 'author' | 'reviewer' | 'architect' }>(
      '/v1/auth/context-persona'
    );
    setContextPersona(data.context_persona);
  }

  async function saveContextPersona() {
    await callApi('/v1/auth/context-persona', {
      method: 'PUT',
      body: JSON.stringify({
        context_persona: contextPersona,
      }),
    });
    await loadContextPersona();
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
    state.setNewUserEmail('');
    state.setNewUserName('');
    await loadUsers();
  }

  async function addWorkspaceMember(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !workspaceMemberEmail.trim()) {
      return;
    }
    await callApi(`/v1/workspaces/${encodeURIComponent(selectedWorkspace)}/members`, {
      method: 'POST',
      body: JSON.stringify({
        email: workspaceMemberEmail.trim(),
        role: workspaceMemberRole,
      }),
    });
    setWorkspaceMemberEmail('');
    await Promise.all([loadWorkspaceMembers(selectedWorkspace), loadOwnApiKeys()]);
  }

  async function createWorkspaceInvite(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !workspaceInviteEmail.trim()) {
      return;
    }
    let projectRoles: Record<string, string> | undefined;
    const raw = workspaceInviteProjectRolesJson.trim();
    if (raw && raw !== '{}') {
      try {
        projectRoles = JSON.parse(raw) as Record<string, string>;
      } catch (parseError) {
        setError(
          parseError instanceof Error
            ? `invite project_roles JSON parse error: ${parseError.message}`
            : 'invite project_roles JSON parse error'
        );
        return;
      }
    }
    const result = await callApi<{ invite_url: string; expires_at: string }>(
      `/v1/workspaces/${encodeURIComponent(selectedWorkspace)}/invite`,
      {
        method: 'POST',
        body: JSON.stringify({
          email: workspaceInviteEmail.trim(),
          role: workspaceInviteRole,
          project_roles: projectRoles,
        }),
      }
    );
    setLatestInviteUrl(result.invite_url);
    setLatestInviteExpiresAt(result.expires_at);
    setWorkspaceInviteEmail('');
  }

  async function updateWorkspaceMemberRole(userId: string, role: WorkspaceRole) {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/workspaces/${encodeURIComponent(selectedWorkspace)}/members/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
    await loadWorkspaceMembers(selectedWorkspace);
  }

  async function removeWorkspaceMember(userId: string) {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/workspaces/${encodeURIComponent(selectedWorkspace)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    await Promise.all([loadWorkspaceMembers(selectedWorkspace), loadOwnApiKeys()]);
  }

  async function createSelfApiKey(event: FormEvent) {
    event.preventDefault();
    const result = await callApi<{ id: string; label?: string | null; api_key: string }>('/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify({
        label: selfApiKeyLabel.trim() || undefined,
        device_label: resolveDeviceLabel('admin-ui'),
      }),
    });
    setSelfApiKeyLabel('');
    setGeneratedSelfApiKey(result.api_key);
    await loadOwnApiKeys();
  }

  async function revokeSelfApiKey(apiKeyId: string) {
    await callApi(`/v1/api-keys/${encodeURIComponent(apiKeyId)}/revoke`, {
      method: 'POST',
    });
    await Promise.all([
      loadOwnApiKeys(),
      selectedApiKeyUserId ? loadUserApiKeys(selectedApiKeyUserId) : Promise.resolve(),
    ]);
  }

  async function revokeSelectedUserApiKey(apiKeyId: string) {
    if (!selectedApiKeyUserId) {
      return;
    }
    await callApi(`/v1/api-keys/${encodeURIComponent(apiKeyId)}/revoke`, {
      method: 'POST',
    });
    await loadUserApiKeys(selectedApiKeyUserId);
  }

  async function resetSelectedUserApiKeys() {
    if (!selectedApiKeyUserId) {
      return;
    }
    const result = await callApi<{ one_time_url: string; expires_at: string }>(
      `/v1/users/${encodeURIComponent(selectedApiKeyUserId)}/api-keys/reset`,
      {
        method: 'POST',
        body: JSON.stringify({
          device_label: resolveDeviceLabel(`reset-${selectedApiKeyUserId.slice(0, 8)}`),
        }),
      }
    );
    setLatestOneTimeUrl(result.one_time_url);
    setLatestOneTimeExpiresAt(result.expires_at);
    await loadUserApiKeys(selectedApiKeyUserId);
  }

  return {
    loadUsers,
    loadWorkspaceMembers,
    loadOwnApiKeys,
    loadUserApiKeys,
    loadContextPersona,
    saveContextPersona,
    createUser,
    addWorkspaceMember,
    createWorkspaceInvite,
    updateWorkspaceMemberRole,
    removeWorkspaceMember,
    createSelfApiKey,
    revokeSelfApiKey,
    revokeSelectedUserApiKey,
    resetSelectedUserApiKeys,
  };
}

export type AdminAuthInviteApiKeyActions = ReturnType<typeof useAdminAuthInviteApiKeyActions>;
