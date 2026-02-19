'use client';

import type { FormEvent } from 'react';
import type {
  ActiveWorkEventItem,
  ActiveWorkItem,
  ContextBundleResponse,
  PersonaRecommendationResponse,
} from '../../lib/types';
import type { AdminMemorySearchState } from './use-admin-memory-search-state';
import type { AdminCallApi } from './types';

type ContextDeps = {
  callApi: AdminCallApi;
  selectedWorkspace: string;
  selectedProject: string;
  state: AdminMemorySearchState;
  setError: (message: string | null) => void;
  runMemorySearch: (event?: FormEvent) => Promise<void>;
};

export function createAdminMemorySearchContextActions(deps: ContextDeps) {
  const { callApi, selectedWorkspace, selectedProject, state, setError, runMemorySearch } = deps;

  async function loadContextBundle(mode: 'default' | 'debug', event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace || !selectedProject) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      project_key: selectedProject,
      mode,
      budget: String(Math.min(Math.max(state.contextBundleBudget || 300, 300), 8000)),
    });
    if (state.contextBundleQuery.trim()) {
      query.set('q', state.contextBundleQuery.trim());
    }
    if (state.contextBundleCurrentSubpath.trim()) {
      query.set('current_subpath', state.contextBundleCurrentSubpath.trim());
    }
    const bundle = await callApi<ContextBundleResponse>(`/v1/context/bundle?${query.toString()}`);
    if (mode === 'debug') {
      state.setContextBundleDebug(bundle);
      if (bundle.debug?.persona_recommended) {
        state.setPersonaRecommendation(bundle.debug.persona_recommended);
      }
      return;
    }
    state.setContextBundleDefault(bundle);
  }

  async function loadPersonaRecommendation(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace || !selectedProject) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      project_key: selectedProject,
    });
    if (state.contextBundleQuery.trim()) {
      query.set('q', state.contextBundleQuery.trim());
    }
    const recommendation = await callApi<PersonaRecommendationResponse>(
      `/v1/context/persona-recommendation?${query.toString()}`
    );
    state.setPersonaRecommendation(recommendation);
  }

  async function loadProjectActiveWork(projectKey?: string) {
    if (!selectedWorkspace) {
      return;
    }
    const effectiveProjectKey = (projectKey || selectedProject || '').trim();
    if (!effectiveProjectKey) {
      state.setActiveWorkItems([]);
      state.setActiveWorkEvents([]);
      state.setSelectedActiveWorkId('');
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      include_closed: String(state.activeWorkIncludeClosed),
      limit: '120',
    });
    const data = await callApi<{
      workspace_key: string;
      project_key: string;
      active_work: ActiveWorkItem[];
    }>(`/v1/projects/${encodeURIComponent(effectiveProjectKey)}/active-work?${query.toString()}`);
    state.setActiveWorkItems(data.active_work);
    if (!data.active_work.some((item) => item.id === state.selectedActiveWorkId)) {
      state.setSelectedActiveWorkId(data.active_work[0]?.id || '');
    }
  }

  async function loadProjectActiveWorkEvents(projectKey?: string) {
    if (!selectedWorkspace) {
      return;
    }
    const effectiveProjectKey = (projectKey || selectedProject || '').trim();
    if (!effectiveProjectKey) {
      state.setActiveWorkEvents([]);
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      limit: '200',
    });
    if (state.selectedActiveWorkId) {
      query.set('active_work_id', state.selectedActiveWorkId);
    }
    const data = await callApi<{
      workspace_key: string;
      project_key: string;
      events: ActiveWorkEventItem[];
    }>(`/v1/projects/${encodeURIComponent(effectiveProjectKey)}/active-work/events?${query.toString()}`);
    state.setActiveWorkEvents(data.events);
  }

  async function updateProjectActiveWorkStatus(
    action: 'confirm' | 'close' | 'reopen',
    activeWorkId: string
  ) {
    if (!selectedWorkspace || !selectedProject || !activeWorkId) {
      return;
    }
    await callApi(`/v1/active-work/${encodeURIComponent(activeWorkId)}/${action}`, {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        project_key: selectedProject,
      }),
    });
    await Promise.all([loadProjectActiveWork(selectedProject), loadProjectActiveWorkEvents(selectedProject)]);
  }

  async function updateSelectedMemoryStatus(status: 'draft' | 'confirmed' | 'rejected') {
    if (!state.selectedMemoryId) {
      return;
    }
    await callApi(`/v1/memories/${encodeURIComponent(state.selectedMemoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
      }),
    });
    await runMemorySearch();
  }

  async function saveSelectedMemoryContent() {
    if (!state.selectedMemoryId) {
      return;
    }
    await callApi(`/v1/memories/${encodeURIComponent(state.selectedMemoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: state.selectedMemoryDraftContent.trim(),
      }),
    });
    await runMemorySearch();
  }

  async function createMemory(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !selectedProject) {
      return;
    }
    let metadata: Record<string, unknown> | undefined;
    if (state.newMemoryMetadata.trim()) {
      try {
        metadata = JSON.parse(state.newMemoryMetadata) as Record<string, unknown>;
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
        type: state.newMemoryType,
        content: state.newMemoryContent.trim(),
        metadata,
      }),
    });
    state.setNewMemoryContent('');
    await runMemorySearch();
  }

  return {
    loadContextBundle,
    loadPersonaRecommendation,
    loadProjectActiveWork,
    loadProjectActiveWorkEvents,
    updateProjectActiveWorkStatus,
    updateSelectedMemoryStatus,
    saveSelectedMemoryContent,
    createMemory,
  };
}
