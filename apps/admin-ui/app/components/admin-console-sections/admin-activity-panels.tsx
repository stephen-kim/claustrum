'use client';

import { AuditLogsPanel } from '../audit-logs-panel';
import { CiEventsPanel } from '../ci-events-panel';
import { ImportsPanel } from '../imports-panel';
import { MemoriesPanel } from '../memories-panel';
import { RawEventsPanel } from '../raw-events-panel';
import { RawSearchPanel } from '../raw-search-panel';
import { ContextDebugPanel } from '../context-debug-panel';
import { LlmUsagePanel } from '../llm-usage-panel';
import type { ImportItem, MemoryItem, Project } from '../../lib/types';
import type { AdminAuthInviteApiKeyActions } from '../admin-console-domains/use-admin-auth-invite-api-key-actions';
import type { AdminAuthInviteApiKeyState } from '../admin-console-domains/use-admin-auth-invite-api-key-state';
import type { AdminMemorySearchActions } from '../admin-console-domains/use-admin-memory-search-actions';
import type { AdminMemorySearchState } from '../admin-console-domains/use-admin-memory-search-state';
import type { AdminWorkspaceProjectState } from '../admin-console-domains/use-admin-workspace-project-state';

type Props = {
  selectedWorkspace: string;
  selectedProject: string;
  projects: Project[];
  workspaceState: AdminWorkspaceProjectState;
  authState: AdminAuthInviteApiKeyState;
  authActions: AdminAuthInviteApiKeyActions;
  memoryState: AdminMemorySearchState;
  memoryActions: AdminMemorySearchActions;
  selectedMemory: MemoryItem | null;
  selectedImport: ImportItem | null;
};

export function AdminActivityPanels(props: Props) {
  return (
    <>
      <MemoriesPanel
        runMemorySearch={props.memoryActions.runMemorySearch}
        queryText={props.memoryState.queryText}
        setQueryText={props.memoryState.setQueryText}
        queryType={props.memoryState.queryType}
        setQueryType={props.memoryState.setQueryType}
        queryMode={props.memoryState.queryMode}
        setQueryMode={props.memoryState.setQueryMode}
        queryStatus={props.memoryState.queryStatus}
        setQueryStatus={props.memoryState.setQueryStatus}
        querySource={props.memoryState.querySource}
        setQuerySource={props.memoryState.setQuerySource}
        queryConfidenceMin={props.memoryState.queryConfidenceMin}
        setQueryConfidenceMin={props.memoryState.setQueryConfidenceMin}
        queryConfidenceMax={props.memoryState.queryConfidenceMax}
        setQueryConfidenceMax={props.memoryState.setQueryConfidenceMax}
        querySince={props.memoryState.querySince}
        setQuerySince={props.memoryState.setQuerySince}
        queryLimit={props.memoryState.queryLimit}
        setQueryLimit={props.memoryState.setQueryLimit}
        scopeSelectedProject={props.memoryState.scopeSelectedProject}
        setScopeSelectedProject={props.memoryState.setScopeSelectedProject}
        memories={props.memoryState.memories}
        setSelectedMemoryId={props.memoryState.setSelectedMemoryId}
        createMemory={props.memoryActions.createMemory}
        newMemoryType={props.memoryState.newMemoryType}
        setNewMemoryType={props.memoryState.setNewMemoryType}
        selectedProject={props.selectedProject}
        newMemoryContent={props.memoryState.newMemoryContent}
        setNewMemoryContent={props.memoryState.setNewMemoryContent}
        newMemoryMetadata={props.memoryState.newMemoryMetadata}
        setNewMemoryMetadata={props.memoryState.setNewMemoryMetadata}
        selectedMemory={props.selectedMemory}
        selectedMemoryDraftContent={props.memoryState.selectedMemoryDraftContent}
        setSelectedMemoryDraftContent={props.memoryState.setSelectedMemoryDraftContent}
        updateSelectedMemoryStatus={props.memoryActions.updateSelectedMemoryStatus}
        saveSelectedMemoryContent={props.memoryActions.saveSelectedMemoryContent}
      />

      <ImportsPanel
        uploadImport={props.memoryActions.uploadImport}
        importSource={props.memoryState.importSource}
        setImportSource={props.memoryState.setImportSource}
        setImportFile={props.memoryState.setImportFile}
        importUseSelectedProject={props.memoryState.importUseSelectedProject}
        setImportUseSelectedProject={props.memoryState.setImportUseSelectedProject}
        imports={props.memoryState.imports}
        setSelectedImportId={props.memoryState.setSelectedImportId}
        parseImport={props.memoryActions.parseImport}
        extractImport={props.memoryActions.extractImport}
        loadStagedMemories={props.memoryActions.loadStagedMemories}
        selectedImport={props.selectedImport}
        stagedMemories={props.memoryState.stagedMemories}
        selectedStagedIds={props.memoryState.selectedStagedIds}
        toggleStagedMemory={props.memoryActions.toggleStagedMemory}
        selectedImportId={props.memoryState.selectedImportId}
        commitImport={props.memoryActions.commitImport}
      />

      <RawSearchPanel
        runRawSearch={props.memoryActions.runRawSearch}
        rawQuery={props.memoryState.rawQuery}
        setRawQuery={props.memoryState.setRawQuery}
        rawLimit={props.memoryState.rawLimit}
        setRawLimit={props.memoryState.setRawLimit}
        rawUseSelectedProject={props.memoryState.rawUseSelectedProject}
        setRawUseSelectedProject={props.memoryState.setRawUseSelectedProject}
        rawMatches={props.memoryState.rawMatches}
        viewRawMessage={props.memoryActions.viewRawMessage}
        rawMessageDetail={props.memoryState.rawMessageDetail}
      />

      <RawEventsPanel
        selectedWorkspace={props.selectedWorkspace}
        projects={props.projects}
        rawEventProjectFilter={props.memoryState.rawEventProjectFilter}
        setRawEventProjectFilter={props.memoryState.setRawEventProjectFilter}
        rawEventTypeFilter={props.memoryState.rawEventTypeFilter}
        setRawEventTypeFilter={props.memoryState.setRawEventTypeFilter}
        rawEventCommitShaFilter={props.memoryState.rawEventCommitShaFilter}
        setRawEventCommitShaFilter={props.memoryState.setRawEventCommitShaFilter}
        rawEventFrom={props.memoryState.rawEventFrom}
        setRawEventFrom={props.memoryState.setRawEventFrom}
        rawEventTo={props.memoryState.rawEventTo}
        setRawEventTo={props.memoryState.setRawEventTo}
        rawEventLimit={props.memoryState.rawEventLimit}
        setRawEventLimit={props.memoryState.setRawEventLimit}
        rawEvents={props.memoryState.rawEvents}
        loadRawEvents={props.memoryActions.loadRawEvents}
      />

      <CiEventsPanel
        submitCiEvent={props.memoryActions.submitCiEvent}
        ciStatus={props.memoryState.ciStatus}
        setCiStatus={props.memoryState.setCiStatus}
        ciProvider={props.memoryState.ciProvider}
        setCiProvider={props.memoryState.setCiProvider}
        ciUseSelectedProject={props.memoryState.ciUseSelectedProject}
        setCiUseSelectedProject={props.memoryState.setCiUseSelectedProject}
        ciWorkflowName={props.memoryState.ciWorkflowName}
        setCiWorkflowName={props.memoryState.setCiWorkflowName}
        ciWorkflowRunId={props.memoryState.ciWorkflowRunId}
        setCiWorkflowRunId={props.memoryState.setCiWorkflowRunId}
        ciWorkflowRunUrl={props.memoryState.ciWorkflowRunUrl}
        setCiWorkflowRunUrl={props.memoryState.setCiWorkflowRunUrl}
        ciRepository={props.memoryState.ciRepository}
        setCiRepository={props.memoryState.setCiRepository}
        ciBranch={props.memoryState.ciBranch}
        setCiBranch={props.memoryState.setCiBranch}
        ciSha={props.memoryState.ciSha}
        setCiSha={props.memoryState.setCiSha}
        ciEventName={props.memoryState.ciEventName}
        setCiEventName={props.memoryState.setCiEventName}
        ciJobName={props.memoryState.ciJobName}
        setCiJobName={props.memoryState.setCiJobName}
        ciMessage={props.memoryState.ciMessage}
        setCiMessage={props.memoryState.setCiMessage}
        ciMetadata={props.memoryState.ciMetadata}
        setCiMetadata={props.memoryState.setCiMetadata}
      />

      <AuditLogsPanel
        selectedWorkspace={props.selectedWorkspace}
        projects={props.projects}
        auditActionPrefix={props.memoryState.auditActionPrefix}
        setAuditActionPrefix={props.memoryState.setAuditActionPrefix}
        auditActionKey={props.memoryState.auditActionKey}
        setAuditActionKey={props.memoryState.setAuditActionKey}
        auditProjectKey={props.memoryState.auditProjectKey}
        setAuditProjectKey={props.memoryState.setAuditProjectKey}
        auditActorUserId={props.memoryState.auditActorUserId}
        setAuditActorUserId={props.memoryState.setAuditActorUserId}
        auditLimit={props.memoryState.auditLimit}
        setAuditLimit={props.memoryState.setAuditLimit}
        auditLogs={props.memoryState.auditLogs}
        loadAuditLogs={props.memoryActions.loadAuditLogs}
        accessTimelineProjectKey={props.memoryState.accessTimelineProjectKey}
        setAccessTimelineProjectKey={props.memoryState.setAccessTimelineProjectKey}
        accessTimelineUserId={props.memoryState.accessTimelineUserId}
        setAccessTimelineUserId={props.memoryState.setAccessTimelineUserId}
        accessTimelineSource={props.memoryState.accessTimelineSource}
        setAccessTimelineSource={props.memoryState.setAccessTimelineSource}
        accessTimelineAction={props.memoryState.accessTimelineAction}
        setAccessTimelineAction={props.memoryState.setAccessTimelineAction}
        accessTimelineFrom={props.memoryState.accessTimelineFrom}
        setAccessTimelineFrom={props.memoryState.setAccessTimelineFrom}
        accessTimelineTo={props.memoryState.accessTimelineTo}
        setAccessTimelineTo={props.memoryState.setAccessTimelineTo}
        accessTimelineLimit={props.memoryState.accessTimelineLimit}
        setAccessTimelineLimit={props.memoryState.setAccessTimelineLimit}
        accessTimelineItems={props.memoryState.accessTimelineItems}
        accessTimelineHasMore={props.memoryState.accessTimelineHasMore}
        accessTimelineLoading={props.memoryState.accessTimelineLoading}
        accessTimelineExportFormat={props.memoryState.accessTimelineExportFormat}
        setAccessTimelineExportFormat={props.memoryState.setAccessTimelineExportFormat}
        loadAccessTimeline={props.memoryActions.loadAccessTimeline}
        loadMoreAccessTimeline={props.memoryActions.loadMoreAccessTimeline}
        exportAccessTimeline={props.memoryActions.exportAccessTimeline}
      />

      <LlmUsagePanel
        selectedWorkspace={props.selectedWorkspace}
        groupBy={props.memoryState.llmUsageGroupBy}
        setGroupBy={props.memoryState.setLlmUsageGroupBy}
        from={props.memoryState.llmUsageFrom}
        setFrom={props.memoryState.setLlmUsageFrom}
        to={props.memoryState.llmUsageTo}
        setTo={props.memoryState.setLlmUsageTo}
        totals={props.memoryState.llmUsageTotals}
        items={props.memoryState.llmUsageItems}
        loadUsage={props.memoryActions.loadLlmUsage}
      />

      <ContextDebugPanel
        selectedWorkspace={props.selectedWorkspace}
        selectedProject={props.selectedProject}
        contextBundleQuery={props.memoryState.contextBundleQuery}
        setContextBundleQuery={props.memoryState.setContextBundleQuery}
        contextBundleCurrentSubpath={props.memoryState.contextBundleCurrentSubpath}
        setContextBundleCurrentSubpath={props.memoryState.setContextBundleCurrentSubpath}
        contextBundleBudget={props.memoryState.contextBundleBudget}
        setContextBundleBudget={props.memoryState.setContextBundleBudget}
        contextBundleDefault={props.memoryState.contextBundleDefault}
        contextBundleDebug={props.memoryState.contextBundleDebug}
        loadContextBundle={props.memoryActions.loadContextBundle}
        personaRecommendation={props.memoryState.personaRecommendation}
        recommendPersona={props.memoryActions.loadPersonaRecommendation}
        contextPersona={props.authState.contextPersona}
        setContextPersona={props.authState.setContextPersona}
        saveContextPersona={props.authActions.saveContextPersona}
        activeWorkItems={props.memoryState.activeWorkItems}
        activeWorkEvents={props.memoryState.activeWorkEvents}
        selectedActiveWorkId={props.memoryState.selectedActiveWorkId}
        setSelectedActiveWorkId={props.memoryState.setSelectedActiveWorkId}
        activeWorkIncludeClosed={props.memoryState.activeWorkIncludeClosed}
        setActiveWorkIncludeClosed={props.memoryState.setActiveWorkIncludeClosed}
        refreshActiveWork={() => props.memoryActions.loadProjectActiveWork(props.selectedProject)}
        refreshActiveWorkEvents={() => props.memoryActions.loadProjectActiveWorkEvents(props.selectedProject)}
        updateActiveWorkStatus={props.memoryActions.updateProjectActiveWorkStatus}
      />
    </>
  );
}
