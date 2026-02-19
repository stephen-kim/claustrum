'use client';

import type { FormEvent } from 'react';
import type {
  ActiveWorkEventItem,
  ActiveWorkItem,
  ContextBundleResponse,
  DecisionKeywordPolicy,
  ImportItem,
  LlmUsageResponse,
  MemoryItem,
  StagedMemoryItem,
} from '../../lib/types';
import { toISOString } from '../../lib/utils';
import type { AdminMemorySearchState } from './use-admin-memory-search-state';
import { createAdminMemorySearchContextActions } from './use-admin-memory-search-actions-context';
import { createAdminMemorySearchRawAuditActions } from './use-admin-memory-search-actions-raw-audit';
import type { AdminCallApi, AdminCallApiRaw } from './types';
import { parseLineSeparatedValues } from './types';

type MemorySearchDeps = {
  callApi: AdminCallApi;
  callApiRaw: AdminCallApiRaw;
  selectedWorkspace: string;
  selectedProject: string;
  state: AdminMemorySearchState;
  setError: (message: string | null) => void;
};

export function useAdminMemorySearchActions(deps: MemorySearchDeps) {
  const { callApi, callApiRaw, selectedWorkspace, selectedProject, state, setError } = deps;

  async function loadDecisionKeywordPolicies(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<{ workspace_key: string; policies: DecisionKeywordPolicy[] }>(
      `/v1/decision-keyword-policies?${query.toString()}`
    );
    state.setKeywordPolicies(data.policies);
  }

  async function createDecisionKeywordPolicy(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !state.keywordPolicyName.trim()) {
      return;
    }
    await callApi('/v1/decision-keyword-policies', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        name: state.keywordPolicyName.trim(),
        positive_keywords: parseLineSeparatedValues(state.keywordPositiveText),
        negative_keywords: parseLineSeparatedValues(state.keywordNegativeText),
        file_path_positive_patterns: parseLineSeparatedValues(state.keywordPathPositiveText),
        file_path_negative_patterns: parseLineSeparatedValues(state.keywordPathNegativeText),
        weight_positive: Math.max(state.keywordWeightPositive || 0, 0),
        weight_negative: Math.max(state.keywordWeightNegative || 0, 0),
        enabled: state.keywordPolicyEnabled,
        reason: state.keywordPolicyReason.trim() || undefined,
      }),
    });
    await loadDecisionKeywordPolicies(selectedWorkspace);
  }

  async function patchDecisionKeywordPolicy(
    policyId: string,
    patch: Partial<{
      name: string;
      positive_keywords: string[];
      negative_keywords: string[];
      file_path_positive_patterns: string[];
      file_path_negative_patterns: string[];
      weight_positive: number;
      weight_negative: number;
      enabled: boolean;
    }>
  ) {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/decision-keyword-policies/${encodeURIComponent(policyId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        ...patch,
        reason: state.keywordPolicyReason.trim() || undefined,
      }),
    });
    await loadDecisionKeywordPolicies(selectedWorkspace);
  }

  async function deleteDecisionKeywordPolicy(policyId: string) {
    if (!selectedWorkspace) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
    });
    const reason = state.keywordPolicyReason.trim();
    if (reason) {
      query.set('reason', reason);
    }
    await callApi(`/v1/decision-keyword-policies/${encodeURIComponent(policyId)}?${query.toString()}`, {
      method: 'DELETE',
    });
    await loadDecisionKeywordPolicies(selectedWorkspace);
  }

  async function loadDecisions(workspaceKey: string, event?: FormEvent) {
    event?.preventDefault();
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      limit: String(Math.min(Math.max(state.decisionLimit, 1), 500)),
      mode: 'hybrid',
    });
    if (state.decisionProjectFilter.trim()) {
      query.set('project_key', state.decisionProjectFilter.trim());
    }
    if (state.decisionStatusFilter) {
      query.set('status', state.decisionStatusFilter);
    }
    if (state.decisionConfidenceMinFilter.trim()) {
      query.set('confidence_min', state.decisionConfidenceMinFilter.trim());
    }
    if (state.decisionConfidenceMaxFilter.trim()) {
      query.set('confidence_max', state.decisionConfidenceMaxFilter.trim());
    }
    const data = await callApi<{ decisions: MemoryItem[] }>(`/v1/decisions?${query.toString()}`);
    state.setDecisions(data.decisions);
  }

  async function setDecisionStatus(decisionId: string, status: 'confirmed' | 'rejected') {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/decisions/${encodeURIComponent(decisionId)}/${status === 'confirmed' ? 'confirm' : 'reject'}`, {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
      }),
    });
    await loadDecisions(selectedWorkspace);
  }

  async function loadImports(workspaceKey: string) {
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      limit: '40',
    });
    const data = await callApi<{ imports: ImportItem[] }>(`/v1/imports?${query.toString()}`);
    state.setImports(data.imports);
    if (!data.imports.some((item) => item.id === state.selectedImportId)) {
      state.setSelectedImportId(data.imports[0]?.id || '');
    }
  }

  async function uploadImport(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace || !state.importFile) {
      return;
    }
    const form = new FormData();
    form.set('workspace_key', selectedWorkspace);
    form.set('source', state.importSource);
    if (state.importUseSelectedProject && selectedProject) {
      form.set('project_key', selectedProject);
    }
    form.set('file', state.importFile);

    await callApi<{ import_id: string }>('/v1/imports', {
      method: 'POST',
      body: form,
    });
    state.setImportFile(null);
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
    state.setStagedMemories(data.staged_memories);
    state.setSelectedStagedIds(data.staged_memories.map((item) => item.id));
  }

  async function commitImport(importId: string) {
    await callApi(`/v1/imports/${encodeURIComponent(importId)}/commit`, {
      method: 'POST',
      body: JSON.stringify({
        staged_ids: state.selectedStagedIds,
        project_key: selectedProject || undefined,
      }),
    });
    if (selectedWorkspace) {
      await Promise.all([loadImports(selectedWorkspace), runMemorySearch()]);
    }
  }

  function toggleStagedMemory(id: string, checked: boolean) {
    state.setSelectedStagedIds((current) => {
      if (checked) {
        if (current.includes(id)) {
          return current;
        }
        return [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  }

  const rawAuditActions = createAdminMemorySearchRawAuditActions({
    callApi,
    callApiRaw,
    selectedWorkspace,
    selectedProject,
    state,
    setError,
  });

  async function loadLlmUsage(workspaceKey: string, event?: FormEvent) {
    event?.preventDefault();
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      group_by: state.llmUsageGroupBy,
    });
    const fromIso = toISOString(state.llmUsageFrom);
    const toIso = toISOString(state.llmUsageTo);
    if (fromIso) {
      query.set('from', fromIso);
    }
    if (toIso) {
      query.set('to', toIso);
    }
    const data = await callApi<LlmUsageResponse>(`/v1/usage/llm?${query.toString()}`);
    state.setLlmUsageItems(data.items || []);
    state.setLlmUsageTotals(
      data.totals || {
        event_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_cents: 0,
      }
    );
  }

  async function runMemorySearch(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      limit: String(state.queryLimit),
      mode: state.queryMode,
    });
    if (state.scopeSelectedProject && selectedProject) {
      query.set('project_key', selectedProject);
    }
    if (state.queryType) {
      query.set('type', state.queryType);
    }
    if (state.queryText.trim()) {
      query.set('q', state.queryText.trim());
    }
    if (state.queryStatus) {
      query.set('status', state.queryStatus);
    }
    if (state.querySource) {
      query.set('source', state.querySource);
    }
    if (state.queryConfidenceMin.trim()) {
      query.set('confidence_min', state.queryConfidenceMin.trim());
    }
    if (state.queryConfidenceMax.trim()) {
      query.set('confidence_max', state.queryConfidenceMax.trim());
    }
    if (state.querySince) {
      const iso = toISOString(state.querySince);
      if (iso) {
        query.set('since', iso);
      }
    }

    const data = await callApi<{ memories: MemoryItem[] }>(`/v1/memories?${query.toString()}`);
    state.setMemories(data.memories);
    if (!data.memories.some((memory) => memory.id === state.selectedMemoryId)) {
      state.setSelectedMemoryId(data.memories[0]?.id || '');
    }
  }

  const contextActions = createAdminMemorySearchContextActions({
    callApi,
    selectedWorkspace,
    selectedProject,
    state,
    setError,
    runMemorySearch,
  });

  return {
    loadDecisionKeywordPolicies,
    createDecisionKeywordPolicy,
    patchDecisionKeywordPolicy,
    deleteDecisionKeywordPolicy,
    loadDecisions,
    setDecisionStatus,
    loadImports,
    uploadImport,
    parseImport,
    extractImport,
    loadStagedMemories,
    commitImport,
    toggleStagedMemory,
    ...rawAuditActions,
    loadLlmUsage,
    runMemorySearch,
    ...contextActions,
  };
}

export type AdminMemorySearchActions = ReturnType<typeof useAdminMemorySearchActions>;
