'use client';

import type { FormEvent } from 'react';
import type { AccessTimelineItem, AuditLogItem, RawEventItem, RawMessageDetail, RawSearchMatch } from '../../lib/types';
import { toISOString } from '../../lib/utils';
import type { AdminMemorySearchState } from './use-admin-memory-search-state';
import type { AdminCallApi, AdminCallApiRaw } from './types';

type RawAuditDeps = {
  callApi: AdminCallApi;
  callApiRaw: AdminCallApiRaw;
  selectedWorkspace: string;
  selectedProject: string;
  state: AdminMemorySearchState;
  setError: (message: string | null) => void;
};

export function createAdminMemorySearchRawAuditActions(deps: RawAuditDeps) {
  const { callApi, callApiRaw, selectedWorkspace, selectedProject, state, setError } = deps;

  async function runRawSearch(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace || !state.rawQuery.trim()) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      q: state.rawQuery.trim(),
      limit: String(Math.min(Math.max(state.rawLimit, 1), 20)),
      max_chars: '500',
    });
    if (state.rawUseSelectedProject && selectedProject) {
      query.set('project_key', selectedProject);
    }
    const data = await callApi<{ matches: RawSearchMatch[] }>(`/v1/raw/search?${query.toString()}`);
    state.setRawMatches(data.matches);
    if (!data.matches.some((item) => item.message_id === state.selectedRawMessageId)) {
      state.setSelectedRawMessageId('');
      state.setRawMessageDetail(null);
    }
  }

  async function viewRawMessage(messageId: string) {
    const query = new URLSearchParams({ max_chars: '700' });
    const result = await callApi<RawMessageDetail>(
      `/v1/raw/messages/${encodeURIComponent(messageId)}?${query.toString()}`
    );
    state.setSelectedRawMessageId(messageId);
    state.setRawMessageDetail(result);
  }

  async function loadRawEvents(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedWorkspace) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
      limit: String(Math.min(Math.max(state.rawEventLimit, 1), 500)),
    });
    if (state.rawEventProjectFilter.trim()) {
      query.set('project_key', state.rawEventProjectFilter.trim());
    }
    if (state.rawEventTypeFilter) {
      query.set('event_type', state.rawEventTypeFilter);
    }
    if (state.rawEventCommitShaFilter.trim()) {
      query.set('commit_sha', state.rawEventCommitShaFilter.trim());
    }
    const fromIso = state.rawEventFrom ? toISOString(state.rawEventFrom) : null;
    const toIso = state.rawEventTo ? toISOString(state.rawEventTo) : null;
    if (fromIso) {
      query.set('from', fromIso);
    }
    if (toIso) {
      query.set('to', toIso);
    }
    const data = await callApi<{ events: RawEventItem[] }>(`/v1/raw-events?${query.toString()}`);
    state.setRawEvents(data.events);
  }

  async function loadAuditLogs(workspaceKey: string) {
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      limit: String(Math.min(Math.max(state.auditLimit, 1), 200)),
    });
    if (state.auditProjectKey.trim()) {
      query.set('project_key', state.auditProjectKey.trim());
    }
    if (state.auditActionKey.trim()) {
      query.set('action_key', state.auditActionKey.trim());
    }
    if (state.auditActionPrefix.trim()) {
      query.set('action_prefix', state.auditActionPrefix.trim());
    }
    if (state.auditActorUserId.trim()) {
      query.set('actor_user_id', state.auditActorUserId.trim());
    }
    const data = await callApi<{ logs: AuditLogItem[] }>(`/v1/audit-logs?${query.toString()}`);
    state.setAuditLogs(data.logs);
  }

  async function loadAccessTimeline(workspaceKey: string, event?: FormEvent) {
    event?.preventDefault();
    if (!workspaceKey) {
      return;
    }
    state.setAccessTimelineLoading(true);
    try {
      const data = await fetchAccessTimelinePage(workspaceKey, null);
      state.setAccessTimelineItems(data.items);
      state.setAccessTimelineCursor(data.next_cursor);
      state.setAccessTimelineHasMore(Boolean(data.next_cursor));
    } finally {
      state.setAccessTimelineLoading(false);
    }
  }

  async function exportAccessTimeline(workspaceKey: string) {
    if (!workspaceKey) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      format: state.accessTimelineExportFormat,
    });
    if (state.accessTimelineProjectKey.trim()) {
      query.set('project_key', state.accessTimelineProjectKey.trim());
    }
    if (state.accessTimelineSource) {
      query.set('source', state.accessTimelineSource);
    }
    if (state.accessTimelineAction) {
      query.set('action', state.accessTimelineAction);
    }
    const fromIso = state.accessTimelineFrom ? toISOString(state.accessTimelineFrom) : null;
    const toIso = state.accessTimelineTo ? toISOString(state.accessTimelineTo) : null;
    if (fromIso) {
      query.set('from', fromIso);
    }
    if (toIso) {
      query.set('to', toIso);
    }

    const response = await callApiRaw(`/v1/audit/export?${query.toString()}`, {
      method: 'GET',
    });
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename =
      filenameMatch?.[1] ||
      `audit-export.${state.accessTimelineExportFormat === 'json' ? 'json' : 'csv'}`;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function loadMoreAccessTimeline(workspaceKey: string) {
    if (!workspaceKey || !state.accessTimelineCursor || state.accessTimelineLoading) {
      return;
    }
    state.setAccessTimelineLoading(true);
    try {
      const data = await fetchAccessTimelinePage(workspaceKey, state.accessTimelineCursor);
      state.setAccessTimelineItems((current) => [...current, ...data.items]);
      state.setAccessTimelineCursor(data.next_cursor);
      state.setAccessTimelineHasMore(Boolean(data.next_cursor));
    } finally {
      state.setAccessTimelineLoading(false);
    }
  }

  async function fetchAccessTimelinePage(workspaceKey: string, cursor: string | null): Promise<{
    items: AccessTimelineItem[];
    next_cursor: string | null;
  }> {
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      limit: String(Math.min(Math.max(state.accessTimelineLimit, 1), 200)),
    });
    if (state.accessTimelineProjectKey.trim()) {
      query.set('project_key', state.accessTimelineProjectKey.trim());
    }
    if (state.accessTimelineUserId.trim()) {
      query.set('user_id', state.accessTimelineUserId.trim());
    }
    if (state.accessTimelineSource) {
      query.set('source', state.accessTimelineSource);
    }
    if (state.accessTimelineAction) {
      query.set('action', state.accessTimelineAction);
    }
    const fromIso = state.accessTimelineFrom ? toISOString(state.accessTimelineFrom) : null;
    const toIso = state.accessTimelineTo ? toISOString(state.accessTimelineTo) : null;
    if (fromIso) {
      query.set('from', fromIso);
    }
    if (toIso) {
      query.set('to', toIso);
    }
    if (cursor) {
      query.set('cursor', cursor);
    }
    return callApi<{ items: AccessTimelineItem[]; next_cursor: string | null }>(
      `/v1/audit/access-timeline?${query.toString()}`
    );
  }

  async function submitCiEvent(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    let metadata: Record<string, unknown> | undefined;
    if (state.ciMetadata.trim()) {
      try {
        metadata = JSON.parse(state.ciMetadata) as Record<string, unknown>;
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
        status: state.ciStatus,
        provider: state.ciProvider,
        project_key: state.ciUseSelectedProject && selectedProject ? selectedProject : undefined,
        workflow_name: state.ciWorkflowName.trim() || undefined,
        workflow_run_id: state.ciWorkflowRunId.trim() || undefined,
        workflow_run_url: state.ciWorkflowRunUrl.trim() || undefined,
        repository: state.ciRepository.trim() || undefined,
        branch: state.ciBranch.trim() || undefined,
        sha: state.ciSha.trim() || undefined,
        event_name: state.ciEventName.trim() || undefined,
        job_name: state.ciJobName.trim() || undefined,
        message: state.ciMessage.trim() || undefined,
        metadata,
      }),
    });

    state.setAuditActionPrefix('ci.');
    await loadAuditLogs(selectedWorkspace);
  }

  return {
    runRawSearch,
    viewRawMessage,
    loadRawEvents,
    submitCiEvent,
    loadAuditLogs,
    loadAccessTimeline,
    loadMoreAccessTimeline,
    exportAccessTimeline,
  };
}
