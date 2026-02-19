'use client';

import { useState } from 'react';
import type {
  AccessTimelineItem,
  ActiveWorkEventItem,
  ActiveWorkItem,
  AuditLogItem,
  ContextBundleResponse,
  DecisionKeywordPolicy,
  ImportItem,
  ImportSource,
  LlmUsageGroupBy,
  LlmUsageItem,
  MemoryItem,
  ProjectRole,
  RawEventItem,
  RawEventType,
  RawMessageDetail,
  RawSearchMatch,
  PersonaRecommendationResponse,
  StagedMemoryItem,
} from '../../lib/types';

export function useAdminMemorySearchState() {
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

  const [enableActivityAutoLog, setEnableActivityAutoLog] = useState(true);
  const [enableDecisionExtraction, setEnableDecisionExtraction] = useState(true);
  const [decisionExtractionMode, setDecisionExtractionMode] = useState<'llm_only' | 'hybrid_priority'>(
    'llm_only'
  );
  const [decisionDefaultStatus, setDecisionDefaultStatus] = useState<'draft' | 'confirmed'>('draft');
  const [decisionAutoConfirmEnabled, setDecisionAutoConfirmEnabled] = useState(false);
  const [decisionAutoConfirmMinConfidence, setDecisionAutoConfirmMinConfidence] = useState(0.9);
  const [decisionBatchSize, setDecisionBatchSize] = useState(25);
  const [decisionBackfillDays, setDecisionBackfillDays] = useState(30);
  const [activeWorkStaleDays, setActiveWorkStaleDays] = useState(14);
  const [activeWorkAutoCloseEnabled, setActiveWorkAutoCloseEnabled] = useState(false);
  const [activeWorkAutoCloseDays, setActiveWorkAutoCloseDays] = useState(45);
  const [rawAccessMinRole, setRawAccessMinRole] = useState<ProjectRole>('WRITER');
  const [contextBundleQuery, setContextBundleQuery] = useState('');
  const [contextBundleCurrentSubpath, setContextBundleCurrentSubpath] = useState('');
  const [contextBundleBudget, setContextBundleBudget] = useState(1200);
  const [contextBundleDefault, setContextBundleDefault] = useState<ContextBundleResponse | null>(null);
  const [contextBundleDebug, setContextBundleDebug] = useState<ContextBundleResponse | null>(null);
  const [personaRecommendation, setPersonaRecommendation] =
    useState<PersonaRecommendationResponse | null>(null);
  const [activeWorkItems, setActiveWorkItems] = useState<ActiveWorkItem[]>([]);
  const [activeWorkEvents, setActiveWorkEvents] = useState<ActiveWorkEventItem[]>([]);
  const [selectedActiveWorkId, setSelectedActiveWorkId] = useState('');
  const [activeWorkIncludeClosed, setActiveWorkIncludeClosed] = useState(false);

  const [keywordPolicies, setKeywordPolicies] = useState<DecisionKeywordPolicy[]>([]);
  const [keywordPolicyName, setKeywordPolicyName] = useState('Default keywords');
  const [keywordPositiveText, setKeywordPositiveText] = useState(
    'migrate\nswitch\nremove\ndeprecate\nrename\nrefactor'
  );
  const [keywordNegativeText, setKeywordNegativeText] = useState('wip\ntmp\ndebug\ntest\ntry');
  const [keywordPathPositiveText, setKeywordPathPositiveText] = useState(
    'prisma/**\napps/memory-core/**\npackages/shared/**'
  );
  const [keywordPathNegativeText, setKeywordPathNegativeText] = useState(
    '**/*.test.*\n**/__tests__/**\n**/tmp/**'
  );
  const [keywordWeightPositive, setKeywordWeightPositive] = useState(1);
  const [keywordWeightNegative, setKeywordWeightNegative] = useState(1);
  const [keywordPolicyEnabled, setKeywordPolicyEnabled] = useState(true);
  const [keywordPolicyReason, setKeywordPolicyReason] = useState('');

  const [decisionProjectFilter, setDecisionProjectFilter] = useState('');
  const [decisions, setDecisions] = useState<MemoryItem[]>([]);
  const [decisionStatusFilter, setDecisionStatusFilter] = useState<'' | 'draft' | 'confirmed' | 'rejected'>(
    'draft'
  );
  const [decisionConfidenceMinFilter, setDecisionConfidenceMinFilter] = useState('');
  const [decisionConfidenceMaxFilter, setDecisionConfidenceMaxFilter] = useState('');
  const [decisionLimit, setDecisionLimit] = useState(50);

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
  const [auditActionKey, setAuditActionKey] = useState('');
  const [auditProjectKey, setAuditProjectKey] = useState('');
  const [auditActorUserId, setAuditActorUserId] = useState('');
  const [auditLimit, setAuditLimit] = useState(50);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [accessTimelineProjectKey, setAccessTimelineProjectKey] = useState('');
  const [accessTimelineUserId, setAccessTimelineUserId] = useState('');
  const [accessTimelineSource, setAccessTimelineSource] = useState<'' | 'manual' | 'github' | 'oidc' | 'system'>(
    ''
  );
  const [accessTimelineAction, setAccessTimelineAction] = useState<'' | 'add' | 'change' | 'remove'>('');
  const [accessTimelineFrom, setAccessTimelineFrom] = useState('');
  const [accessTimelineTo, setAccessTimelineTo] = useState('');
  const [accessTimelineLimit, setAccessTimelineLimit] = useState(50);
  const [accessTimelineItems, setAccessTimelineItems] = useState<AccessTimelineItem[]>([]);
  const [accessTimelineCursor, setAccessTimelineCursor] = useState<string | null>(null);
  const [accessTimelineHasMore, setAccessTimelineHasMore] = useState(false);
  const [accessTimelineLoading, setAccessTimelineLoading] = useState(false);
  const [accessTimelineExportFormat, setAccessTimelineExportFormat] = useState<'csv' | 'json'>('csv');
  const [llmUsageGroupBy, setLlmUsageGroupBy] = useState<LlmUsageGroupBy>('day');
  const [llmUsageFrom, setLlmUsageFrom] = useState('');
  const [llmUsageTo, setLlmUsageTo] = useState('');
  const [llmUsageItems, setLlmUsageItems] = useState<LlmUsageItem[]>([]);
  const [llmUsageTotals, setLlmUsageTotals] = useState<{
    event_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_cents: number;
  }>({
    event_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_cents: 0,
  });

  function resetWorkspaceScopedState() {
    setMemories([]);
    setSelectedMemoryId('');
    setSelectedMemoryDraftContent('');
    setEnableActivityAutoLog(true);
    setEnableDecisionExtraction(true);
    setDecisionExtractionMode('llm_only');
    setDecisionDefaultStatus('draft');
    setDecisionAutoConfirmEnabled(false);
    setDecisionAutoConfirmMinConfidence(0.9);
    setDecisionBatchSize(25);
    setDecisionBackfillDays(30);
    setActiveWorkStaleDays(14);
    setActiveWorkAutoCloseEnabled(false);
    setActiveWorkAutoCloseDays(45);
    setRawAccessMinRole('WRITER');
    setContextBundleQuery('');
    setContextBundleCurrentSubpath('');
    setContextBundleBudget(1200);
    setContextBundleDefault(null);
    setContextBundleDebug(null);
    setPersonaRecommendation(null);
    setActiveWorkItems([]);
    setActiveWorkEvents([]);
    setSelectedActiveWorkId('');
    setActiveWorkIncludeClosed(false);
    setKeywordPolicies([]);
    setDecisionProjectFilter('');
    setDecisionStatusFilter('draft');
    setDecisionConfidenceMinFilter('');
    setDecisionConfidenceMaxFilter('');
    setDecisionLimit(50);
    setImports([]);
    setSelectedImportId('');
    setImportSource('codex');
    setImportFile(null);
    setImportUseSelectedProject(true);
    setStagedMemories([]);
    setSelectedStagedIds([]);
    setRawMatches([]);
    setSelectedRawMessageId('');
    setRawMessageDetail(null);
    setRawEventProjectFilter('');
    setRawEventTypeFilter('');
    setRawEventCommitShaFilter('');
    setRawEventFrom('');
    setRawEventTo('');
    setRawEventLimit(100);
    setRawEvents([]);
    setCiStatus('failure');
    setCiProvider('github_actions');
    setCiUseSelectedProject(true);
    setCiWorkflowName('CI');
    setCiWorkflowRunId('');
    setCiWorkflowRunUrl('');
    setCiRepository('');
    setCiBranch('');
    setCiSha('');
    setCiEventName('push');
    setCiJobName('');
    setCiMessage('');
    setCiMetadata('{"source":"admin-ui"}');
    setAuditActionPrefix('ci.');
    setAuditActionKey('');
    setAuditProjectKey('');
    setAuditActorUserId('');
    setAuditLimit(50);
    setAuditLogs([]);
    setAccessTimelineProjectKey('');
    setAccessTimelineUserId('');
    setAccessTimelineSource('');
    setAccessTimelineAction('');
    setAccessTimelineFrom('');
    setAccessTimelineTo('');
    setAccessTimelineLimit(50);
    setAccessTimelineItems([]);
    setAccessTimelineCursor(null);
    setAccessTimelineHasMore(false);
    setAccessTimelineLoading(false);
    setAccessTimelineExportFormat('csv');
    setLlmUsageGroupBy('day');
    setLlmUsageFrom('');
    setLlmUsageTo('');
    setLlmUsageItems([]);
    setLlmUsageTotals({
      event_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_cents: 0,
    });
  }

  return {
    queryText,
    setQueryText,
    queryType,
    setQueryType,
    queryMode,
    setQueryMode,
    queryStatus,
    setQueryStatus,
    querySource,
    setQuerySource,
    queryConfidenceMin,
    setQueryConfidenceMin,
    queryConfidenceMax,
    setQueryConfidenceMax,
    querySince,
    setQuerySince,
    queryLimit,
    setQueryLimit,
    scopeSelectedProject,
    setScopeSelectedProject,
    memories,
    setMemories,
    selectedMemoryId,
    setSelectedMemoryId,
    selectedMemoryDraftContent,
    setSelectedMemoryDraftContent,
    newMemoryType,
    setNewMemoryType,
    newMemoryContent,
    setNewMemoryContent,
    newMemoryMetadata,
    setNewMemoryMetadata,
    enableActivityAutoLog,
    setEnableActivityAutoLog,
    enableDecisionExtraction,
    setEnableDecisionExtraction,
    decisionExtractionMode,
    setDecisionExtractionMode,
    decisionDefaultStatus,
    setDecisionDefaultStatus,
    decisionAutoConfirmEnabled,
    setDecisionAutoConfirmEnabled,
    decisionAutoConfirmMinConfidence,
    setDecisionAutoConfirmMinConfidence,
    decisionBatchSize,
    setDecisionBatchSize,
    decisionBackfillDays,
    setDecisionBackfillDays,
    activeWorkStaleDays,
    setActiveWorkStaleDays,
    activeWorkAutoCloseEnabled,
    setActiveWorkAutoCloseEnabled,
    activeWorkAutoCloseDays,
    setActiveWorkAutoCloseDays,
    rawAccessMinRole,
    setRawAccessMinRole,
    contextBundleQuery,
    setContextBundleQuery,
    contextBundleCurrentSubpath,
    setContextBundleCurrentSubpath,
    contextBundleBudget,
    setContextBundleBudget,
    contextBundleDefault,
    setContextBundleDefault,
    contextBundleDebug,
    setContextBundleDebug,
    personaRecommendation,
    setPersonaRecommendation,
    activeWorkItems,
    setActiveWorkItems,
    activeWorkEvents,
    setActiveWorkEvents,
    selectedActiveWorkId,
    setSelectedActiveWorkId,
    activeWorkIncludeClosed,
    setActiveWorkIncludeClosed,
    keywordPolicies,
    setKeywordPolicies,
    keywordPolicyName,
    setKeywordPolicyName,
    keywordPositiveText,
    setKeywordPositiveText,
    keywordNegativeText,
    setKeywordNegativeText,
    keywordPathPositiveText,
    setKeywordPathPositiveText,
    keywordPathNegativeText,
    setKeywordPathNegativeText,
    keywordWeightPositive,
    setKeywordWeightPositive,
    keywordWeightNegative,
    setKeywordWeightNegative,
    keywordPolicyEnabled,
    setKeywordPolicyEnabled,
    keywordPolicyReason,
    setKeywordPolicyReason,
    decisionProjectFilter,
    setDecisionProjectFilter,
    decisions,
    setDecisions,
    decisionStatusFilter,
    setDecisionStatusFilter,
    decisionConfidenceMinFilter,
    setDecisionConfidenceMinFilter,
    decisionConfidenceMaxFilter,
    setDecisionConfidenceMaxFilter,
    decisionLimit,
    setDecisionLimit,
    imports,
    setImports,
    selectedImportId,
    setSelectedImportId,
    importSource,
    setImportSource,
    importFile,
    setImportFile,
    importUseSelectedProject,
    setImportUseSelectedProject,
    stagedMemories,
    setStagedMemories,
    selectedStagedIds,
    setSelectedStagedIds,
    rawQuery,
    setRawQuery,
    rawLimit,
    setRawLimit,
    rawUseSelectedProject,
    setRawUseSelectedProject,
    rawMatches,
    setRawMatches,
    selectedRawMessageId,
    setSelectedRawMessageId,
    rawMessageDetail,
    setRawMessageDetail,
    rawEventProjectFilter,
    setRawEventProjectFilter,
    rawEventTypeFilter,
    setRawEventTypeFilter,
    rawEventCommitShaFilter,
    setRawEventCommitShaFilter,
    rawEventFrom,
    setRawEventFrom,
    rawEventTo,
    setRawEventTo,
    rawEventLimit,
    setRawEventLimit,
    rawEvents,
    setRawEvents,
    ciStatus,
    setCiStatus,
    ciProvider,
    setCiProvider,
    ciUseSelectedProject,
    setCiUseSelectedProject,
    ciWorkflowName,
    setCiWorkflowName,
    ciWorkflowRunId,
    setCiWorkflowRunId,
    ciWorkflowRunUrl,
    setCiWorkflowRunUrl,
    ciRepository,
    setCiRepository,
    ciBranch,
    setCiBranch,
    ciSha,
    setCiSha,
    ciEventName,
    setCiEventName,
    ciJobName,
    setCiJobName,
    ciMessage,
    setCiMessage,
    ciMetadata,
    setCiMetadata,
    auditActionPrefix,
    setAuditActionPrefix,
    auditActionKey,
    setAuditActionKey,
    auditProjectKey,
    setAuditProjectKey,
    auditActorUserId,
    setAuditActorUserId,
    auditLimit,
    setAuditLimit,
    auditLogs,
    setAuditLogs,
    accessTimelineProjectKey,
    setAccessTimelineProjectKey,
    accessTimelineUserId,
    setAccessTimelineUserId,
    accessTimelineSource,
    setAccessTimelineSource,
    accessTimelineAction,
    setAccessTimelineAction,
    accessTimelineFrom,
    setAccessTimelineFrom,
    accessTimelineTo,
    setAccessTimelineTo,
    accessTimelineLimit,
    setAccessTimelineLimit,
    accessTimelineItems,
    setAccessTimelineItems,
    accessTimelineCursor,
    setAccessTimelineCursor,
    accessTimelineHasMore,
    setAccessTimelineHasMore,
    accessTimelineLoading,
    setAccessTimelineLoading,
    accessTimelineExportFormat,
    setAccessTimelineExportFormat,
    llmUsageGroupBy,
    setLlmUsageGroupBy,
    llmUsageFrom,
    setLlmUsageFrom,
    llmUsageTo,
    setLlmUsageTo,
    llmUsageItems,
    setLlmUsageItems,
    llmUsageTotals,
    setLlmUsageTotals,
    resetWorkspaceScopedState,
  };
}

export type AdminMemorySearchState = ReturnType<typeof useAdminMemorySearchState>;
