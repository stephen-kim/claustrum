'use client';

import { ApiKeysPanel } from '../api-keys-panel';
import { DecisionKeywordPoliciesPanel } from '../decision-keyword-policies-panel';
import { DecisionsPanel } from '../decisions-panel';
import { ProjectMappingsPanel } from '../project-mappings-panel';
import { ProjectMembersPanel } from '../project-members-panel';
import { ProjectsPanel } from '../projects-panel';
import { ResolutionSettingsPanel } from '../resolution-settings-panel';
import { WorkspaceMembersPanel } from '../workspace-members-panel';
import { GlobalRulesPanel } from '../global-rules-panel';
import type { Project } from '../../lib/types';
import type { AdminAuthInviteApiKeyActions } from '../admin-console-domains/use-admin-auth-invite-api-key-actions';
import type { AdminAuthInviteApiKeyState } from '../admin-console-domains/use-admin-auth-invite-api-key-state';
import type { AdminGlobalRulesActions } from '../admin-console-domains/use-admin-global-rules-actions';
import type { AdminGlobalRulesState } from '../admin-console-domains/use-admin-global-rules-state';
import type { AdminIntegrationsOutboundActions } from '../admin-console-domains/use-admin-integrations-outbound-actions';
import type { AdminIntegrationsOutboundState } from '../admin-console-domains/use-admin-integrations-outbound-state';
import type { AdminMemorySearchActions } from '../admin-console-domains/use-admin-memory-search-actions';
import type { AdminMemorySearchState } from '../admin-console-domains/use-admin-memory-search-state';
import type { AdminWorkspaceProjectActions } from '../admin-console-domains/use-admin-workspace-project-actions';
import type { AdminWorkspaceProjectState } from '../admin-console-domains/use-admin-workspace-project-state';
import { AdminIntegrationsSection } from './admin-integrations-section';

export type AdminManagementPanelsProps = {
  selectedWorkspace: string;
  filteredProjects: Project[];
  authState: AdminAuthInviteApiKeyState;
  authActions: AdminAuthInviteApiKeyActions;
  workspaceState: AdminWorkspaceProjectState;
  workspaceActions: AdminWorkspaceProjectActions;
  memoryState: AdminMemorySearchState;
  memoryActions: AdminMemorySearchActions;
  globalRulesState: AdminGlobalRulesState;
  globalRulesActions: AdminGlobalRulesActions;
  integrationsState: AdminIntegrationsOutboundState;
  integrationsActions: AdminIntegrationsOutboundActions;
};

export function AdminManagementPanels(props: AdminManagementPanelsProps) {
  return (
    <>
      <ResolutionSettingsPanel
        resolutionOrder={props.workspaceState.resolutionOrder}
        setResolutionOrder={props.workspaceState.setResolutionOrder}
        autoCreateProject={props.workspaceState.autoCreateProject}
        setAutoCreateProject={props.workspaceState.setAutoCreateProject}
        autoCreateProjectSubprojects={props.workspaceState.autoCreateProjectSubprojects}
        setAutoCreateProjectSubprojects={props.workspaceState.setAutoCreateProjectSubprojects}
        autoSwitchRepo={props.workspaceState.autoSwitchRepo}
        setAutoSwitchRepo={props.workspaceState.setAutoSwitchRepo}
        autoSwitchSubproject={props.workspaceState.autoSwitchSubproject}
        setAutoSwitchSubproject={props.workspaceState.setAutoSwitchSubproject}
        allowManualPin={props.workspaceState.allowManualPin}
        setAllowManualPin={props.workspaceState.setAllowManualPin}
        enableGitEvents={props.workspaceState.enableGitEvents}
        setEnableGitEvents={props.workspaceState.setEnableGitEvents}
        enableCommitEvents={props.workspaceState.enableCommitEvents}
        setEnableCommitEvents={props.workspaceState.setEnableCommitEvents}
        enableMergeEvents={props.workspaceState.enableMergeEvents}
        setEnableMergeEvents={props.workspaceState.setEnableMergeEvents}
        enableCheckoutEvents={props.workspaceState.enableCheckoutEvents}
        setEnableCheckoutEvents={props.workspaceState.setEnableCheckoutEvents}
        checkoutDebounceSeconds={props.workspaceState.checkoutDebounceSeconds}
        setCheckoutDebounceSeconds={props.workspaceState.setCheckoutDebounceSeconds}
        checkoutDailyLimit={props.workspaceState.checkoutDailyLimit}
        setCheckoutDailyLimit={props.workspaceState.setCheckoutDailyLimit}
        enableActivityAutoLog={props.memoryState.enableActivityAutoLog}
        setEnableActivityAutoLog={props.memoryState.setEnableActivityAutoLog}
        enableDecisionExtraction={props.memoryState.enableDecisionExtraction}
        setEnableDecisionExtraction={props.memoryState.setEnableDecisionExtraction}
        decisionExtractionMode={props.memoryState.decisionExtractionMode}
        setDecisionExtractionMode={props.memoryState.setDecisionExtractionMode}
        decisionDefaultStatus={props.memoryState.decisionDefaultStatus}
        setDecisionDefaultStatus={props.memoryState.setDecisionDefaultStatus}
        decisionAutoConfirmEnabled={props.memoryState.decisionAutoConfirmEnabled}
        setDecisionAutoConfirmEnabled={props.memoryState.setDecisionAutoConfirmEnabled}
        decisionAutoConfirmMinConfidence={props.memoryState.decisionAutoConfirmMinConfidence}
        setDecisionAutoConfirmMinConfidence={props.memoryState.setDecisionAutoConfirmMinConfidence}
        decisionBatchSize={props.memoryState.decisionBatchSize}
        setDecisionBatchSize={props.memoryState.setDecisionBatchSize}
        decisionBackfillDays={props.memoryState.decisionBackfillDays}
        setDecisionBackfillDays={props.memoryState.setDecisionBackfillDays}
        activeWorkStaleDays={props.memoryState.activeWorkStaleDays}
        setActiveWorkStaleDays={props.memoryState.setActiveWorkStaleDays}
        activeWorkAutoCloseEnabled={props.memoryState.activeWorkAutoCloseEnabled}
        setActiveWorkAutoCloseEnabled={props.memoryState.setActiveWorkAutoCloseEnabled}
        activeWorkAutoCloseDays={props.memoryState.activeWorkAutoCloseDays}
        setActiveWorkAutoCloseDays={props.memoryState.setActiveWorkAutoCloseDays}
        rawAccessMinRole={props.memoryState.rawAccessMinRole}
        setRawAccessMinRole={props.memoryState.setRawAccessMinRole}
        searchDefaultMode={props.workspaceState.searchDefaultMode}
        setSearchDefaultMode={props.workspaceState.setSearchDefaultMode}
        searchHybridAlpha={props.workspaceState.searchHybridAlpha}
        setSearchHybridAlpha={props.workspaceState.setSearchHybridAlpha}
        searchHybridBeta={props.workspaceState.searchHybridBeta}
        setSearchHybridBeta={props.workspaceState.setSearchHybridBeta}
        searchDefaultLimit={props.workspaceState.searchDefaultLimit}
        setSearchDefaultLimit={props.workspaceState.setSearchDefaultLimit}
        searchTypeWeightsJson={props.workspaceState.searchTypeWeightsJson}
        setSearchTypeWeightsJson={props.workspaceState.setSearchTypeWeightsJson}
        searchRecencyHalfLifeDays={props.workspaceState.searchRecencyHalfLifeDays}
        setSearchRecencyHalfLifeDays={props.workspaceState.setSearchRecencyHalfLifeDays}
        searchSubpathBoostWeight={props.workspaceState.searchSubpathBoostWeight}
        setSearchSubpathBoostWeight={props.workspaceState.setSearchSubpathBoostWeight}
        retentionPolicyEnabled={props.workspaceState.retentionPolicyEnabled}
        setRetentionPolicyEnabled={props.workspaceState.setRetentionPolicyEnabled}
        auditRetentionDays={props.workspaceState.auditRetentionDays}
        setAuditRetentionDays={props.workspaceState.setAuditRetentionDays}
        rawRetentionDays={props.workspaceState.rawRetentionDays}
        setRawRetentionDays={props.workspaceState.setRawRetentionDays}
        retentionMode={props.workspaceState.retentionMode}
        setRetentionMode={props.workspaceState.setRetentionMode}
        githubPrefix={props.workspaceState.githubProjectKeyPrefix}
        setGithubPrefix={(value) => {
          props.workspaceState.setGithubPrefix(value);
          props.workspaceState.setGithubProjectKeyPrefix(value);
        }}
        localPrefix={props.workspaceState.localPrefix}
        setLocalPrefix={props.workspaceState.setLocalPrefix}
        enableMonorepoResolution={props.workspaceState.enableMonorepoResolution}
        setEnableMonorepoResolution={props.workspaceState.setEnableMonorepoResolution}
        monorepoDetectionLevel={props.workspaceState.monorepoDetectionLevel}
        setMonorepoDetectionLevel={props.workspaceState.setMonorepoDetectionLevel}
        monorepoMode={props.workspaceState.monorepoMode}
        setMonorepoMode={props.workspaceState.setMonorepoMode}
        monorepoContextMode={props.workspaceState.monorepoContextMode}
        setMonorepoContextMode={props.workspaceState.setMonorepoContextMode}
        monorepoSubpathMetadataEnabled={props.workspaceState.monorepoSubpathMetadataEnabled}
        setMonorepoSubpathMetadataEnabled={props.workspaceState.setMonorepoSubpathMetadataEnabled}
        monorepoSubpathBoostEnabled={props.workspaceState.monorepoSubpathBoostEnabled}
        setMonorepoSubpathBoostEnabled={props.workspaceState.setMonorepoSubpathBoostEnabled}
        monorepoSubpathBoostWeight={props.workspaceState.monorepoSubpathBoostWeight}
        setMonorepoSubpathBoostWeight={props.workspaceState.setMonorepoSubpathBoostWeight}
        projects={props.workspaceState.projects}
        monorepoSubprojectPolicies={props.workspaceState.monorepoSubprojectPolicies}
        newMonorepoPolicyRepoKey={props.workspaceState.newMonorepoPolicyRepoKey}
        setNewMonorepoPolicyRepoKey={props.workspaceState.setNewMonorepoPolicyRepoKey}
        newMonorepoPolicySubpath={props.workspaceState.newMonorepoPolicySubpath}
        setNewMonorepoPolicySubpath={props.workspaceState.setNewMonorepoPolicySubpath}
        newMonorepoPolicyEnabled={props.workspaceState.newMonorepoPolicyEnabled}
        setNewMonorepoPolicyEnabled={props.workspaceState.setNewMonorepoPolicyEnabled}
        monorepoPolicyReason={props.workspaceState.monorepoPolicyReason}
        setMonorepoPolicyReason={props.workspaceState.setMonorepoPolicyReason}
        createMonorepoSubprojectPolicy={props.workspaceActions.createMonorepoSubprojectPolicy}
        patchMonorepoSubprojectPolicy={props.workspaceActions.patchMonorepoSubprojectPolicy}
        removeMonorepoSubprojectPolicy={props.workspaceActions.removeMonorepoSubprojectPolicy}
        monorepoWorkspaceGlobsText={props.workspaceState.monorepoWorkspaceGlobsText}
        setMonorepoWorkspaceGlobsText={props.workspaceState.setMonorepoWorkspaceGlobsText}
        monorepoExcludeGlobsText={props.workspaceState.monorepoExcludeGlobsText}
        setMonorepoExcludeGlobsText={props.workspaceState.setMonorepoExcludeGlobsText}
        monorepoRootMarkersText={props.workspaceState.monorepoRootMarkersText}
        setMonorepoRootMarkersText={props.workspaceState.setMonorepoRootMarkersText}
        monorepoMaxDepth={props.workspaceState.monorepoMaxDepth}
        setMonorepoMaxDepth={props.workspaceState.setMonorepoMaxDepth}
        workspaceSettingsReason={props.workspaceState.workspaceSettingsReason}
        setWorkspaceSettingsReason={props.workspaceState.setWorkspaceSettingsReason}
        saveWorkspaceSettings={props.workspaceActions.saveWorkspaceSettings}
        draggingKind={props.workspaceState.draggingKind}
        setDraggingKind={props.workspaceState.setDraggingKind}
      />

      <DecisionKeywordPoliciesPanel
        policies={props.memoryState.keywordPolicies}
        keywordPolicyName={props.memoryState.keywordPolicyName}
        setKeywordPolicyName={props.memoryState.setKeywordPolicyName}
        keywordPositiveText={props.memoryState.keywordPositiveText}
        setKeywordPositiveText={props.memoryState.setKeywordPositiveText}
        keywordNegativeText={props.memoryState.keywordNegativeText}
        setKeywordNegativeText={props.memoryState.setKeywordNegativeText}
        keywordPathPositiveText={props.memoryState.keywordPathPositiveText}
        setKeywordPathPositiveText={props.memoryState.setKeywordPathPositiveText}
        keywordPathNegativeText={props.memoryState.keywordPathNegativeText}
        setKeywordPathNegativeText={props.memoryState.setKeywordPathNegativeText}
        keywordWeightPositive={props.memoryState.keywordWeightPositive}
        setKeywordWeightPositive={props.memoryState.setKeywordWeightPositive}
        keywordWeightNegative={props.memoryState.keywordWeightNegative}
        setKeywordWeightNegative={props.memoryState.setKeywordWeightNegative}
        keywordPolicyEnabled={props.memoryState.keywordPolicyEnabled}
        setKeywordPolicyEnabled={props.memoryState.setKeywordPolicyEnabled}
        keywordPolicyReason={props.memoryState.keywordPolicyReason}
        setKeywordPolicyReason={props.memoryState.setKeywordPolicyReason}
        createDecisionKeywordPolicy={props.memoryActions.createDecisionKeywordPolicy}
        patchDecisionKeywordPolicy={props.memoryActions.patchDecisionKeywordPolicy}
        deleteDecisionKeywordPolicy={props.memoryActions.deleteDecisionKeywordPolicy}
      />

      <GlobalRulesPanel
        selectedWorkspace={props.selectedWorkspace}
        members={props.authState.workspaceMembers}
        scope={props.globalRulesState.scope}
        setScope={props.globalRulesState.setScope}
        targetUserId={props.globalRulesState.targetUserId}
        setTargetUserId={props.globalRulesState.setTargetUserId}
        rules={props.globalRulesState.rules}
        title={props.globalRulesState.title}
        setTitle={props.globalRulesState.setTitle}
        content={props.globalRulesState.content}
        setContent={props.globalRulesState.setContent}
        tags={props.globalRulesState.tags}
        setTags={props.globalRulesState.setTags}
        category={props.globalRulesState.category}
        setCategory={props.globalRulesState.setCategory}
        priority={props.globalRulesState.priority}
        setPriority={props.globalRulesState.setPriority}
        severity={props.globalRulesState.severity}
        setSeverity={props.globalRulesState.setSeverity}
        pinned={props.globalRulesState.pinned}
        setPinned={props.globalRulesState.setPinned}
        enabled={props.globalRulesState.enabled}
        setEnabled={props.globalRulesState.setEnabled}
        reason={props.globalRulesState.reason}
        setReason={props.globalRulesState.setReason}
        summaryPreview={props.globalRulesState.summaryPreview}
        recommendMax={props.workspaceState.globalRulesRecommendMax}
        warnThreshold={props.workspaceState.globalRulesWarnThreshold}
        summaryEnabled={props.workspaceState.globalRulesSummaryEnabled}
        summaryMinCount={props.workspaceState.globalRulesSummaryMinCount}
        selectionMode={props.workspaceState.globalRulesSelectionMode}
        routingEnabled={props.workspaceState.globalRulesRoutingEnabled}
        routingMode={props.workspaceState.globalRulesRoutingMode}
        routingTopK={props.workspaceState.globalRulesRoutingTopK}
        routingMinScore={props.workspaceState.globalRulesRoutingMinScore}
        bundleTokenBudgetTotal={props.workspaceState.bundleTokenBudgetTotal}
        bundleBudgetGlobalWorkspacePct={props.workspaceState.bundleBudgetGlobalWorkspacePct}
        bundleBudgetGlobalUserPct={props.workspaceState.bundleBudgetGlobalUserPct}
        bundleBudgetProjectPct={props.workspaceState.bundleBudgetProjectPct}
        bundleBudgetRetrievalPct={props.workspaceState.bundleBudgetRetrievalPct}
        setBundleTokenBudgetTotal={props.workspaceState.setBundleTokenBudgetTotal}
        setBundleBudgetGlobalWorkspacePct={props.workspaceState.setBundleBudgetGlobalWorkspacePct}
        setBundleBudgetGlobalUserPct={props.workspaceState.setBundleBudgetGlobalUserPct}
        setBundleBudgetProjectPct={props.workspaceState.setBundleBudgetProjectPct}
        setBundleBudgetRetrievalPct={props.workspaceState.setBundleBudgetRetrievalPct}
        setSummaryEnabled={props.workspaceState.setGlobalRulesSummaryEnabled}
        setSummaryMinCount={props.workspaceState.setGlobalRulesSummaryMinCount}
        setSelectionMode={props.workspaceState.setGlobalRulesSelectionMode}
        setRoutingEnabled={props.workspaceState.setGlobalRulesRoutingEnabled}
        setRoutingMode={props.workspaceState.setGlobalRulesRoutingMode}
        setRoutingTopK={props.workspaceState.setGlobalRulesRoutingTopK}
        setRoutingMinScore={props.workspaceState.setGlobalRulesRoutingMinScore}
        createGlobalRule={props.globalRulesActions.createGlobalRule}
        loadGlobalRules={props.globalRulesActions.loadGlobalRules}
        patchGlobalRule={props.globalRulesActions.patchGlobalRule}
        deleteGlobalRule={props.globalRulesActions.deleteGlobalRule}
        summarizeGlobalRules={props.globalRulesActions.summarizeGlobalRules}
        saveWorkspaceSettings={props.workspaceActions.saveWorkspaceSettings}
      />

      <DecisionsPanel
        selectedWorkspace={props.selectedWorkspace}
        projects={props.workspaceState.projects}
        decisionProjectFilter={props.memoryState.decisionProjectFilter}
        setDecisionProjectFilter={props.memoryState.setDecisionProjectFilter}
        decisionStatusFilter={props.memoryState.decisionStatusFilter}
        setDecisionStatusFilter={props.memoryState.setDecisionStatusFilter}
        decisionConfidenceMinFilter={props.memoryState.decisionConfidenceMinFilter}
        setDecisionConfidenceMinFilter={props.memoryState.setDecisionConfidenceMinFilter}
        decisionConfidenceMaxFilter={props.memoryState.decisionConfidenceMaxFilter}
        setDecisionConfidenceMaxFilter={props.memoryState.setDecisionConfidenceMaxFilter}
        decisionLimit={props.memoryState.decisionLimit}
        setDecisionLimit={props.memoryState.setDecisionLimit}
        decisions={props.memoryState.decisions}
        loadDecisions={props.memoryActions.loadDecisions}
        setDecisionStatus={props.memoryActions.setDecisionStatus}
      />

      <AdminIntegrationsSection props={props} />

      <ProjectMappingsPanel
        mappingReason={props.workspaceState.mappingReason}
        setMappingReason={props.workspaceState.setMappingReason}
        createProjectMapping={props.workspaceActions.createProjectMapping}
        newMappingKind={props.workspaceState.newMappingKind}
        setNewMappingKind={props.workspaceState.setNewMappingKind}
        newMappingProjectKey={props.workspaceState.newMappingProjectKey}
        setNewMappingProjectKey={props.workspaceState.setNewMappingProjectKey}
        newMappingExternalId={props.workspaceState.newMappingExternalId}
        setNewMappingExternalId={props.workspaceState.setNewMappingExternalId}
        newMappingPriority={props.workspaceState.newMappingPriority}
        setNewMappingPriority={props.workspaceState.setNewMappingPriority}
        newMappingEnabled={props.workspaceState.newMappingEnabled}
        setNewMappingEnabled={props.workspaceState.setNewMappingEnabled}
        projects={props.workspaceState.projects}
        mappings={props.workspaceState.mappings}
        patchMapping={props.workspaceActions.patchMapping}
      />

      <ProjectsPanel
        projects={props.filteredProjects}
        selectedProject={props.workspaceState.selectedProject}
        setSelectedProject={props.workspaceState.setSelectedProject}
        projectViewFilter={props.workspaceState.projectViewFilter}
        setProjectViewFilter={props.workspaceState.setProjectViewFilter}
        createProject={props.workspaceActions.createProject}
        bootstrapProjectContext={props.workspaceActions.bootstrapProjectContext}
        recomputeProjectActiveWork={props.workspaceActions.recomputeProjectActiveWork}
        newProjectKey={props.workspaceState.newProjectKey}
        setNewProjectKey={props.workspaceState.setNewProjectKey}
        newProjectName={props.workspaceState.newProjectName}
        setNewProjectName={props.workspaceState.setNewProjectName}
      />

      <WorkspaceMembersPanel
        members={props.authState.workspaceMembers}
        addMember={props.authActions.addWorkspaceMember}
        createInvite={props.authActions.createWorkspaceInvite}
        updateMemberRole={props.authActions.updateWorkspaceMemberRole}
        removeMember={props.authActions.removeWorkspaceMember}
        email={props.authState.workspaceMemberEmail}
        setEmail={props.authState.setWorkspaceMemberEmail}
        role={props.authState.workspaceMemberRole}
        setRole={props.authState.setWorkspaceMemberRole}
        inviteEmail={props.authState.workspaceInviteEmail}
        setInviteEmail={props.authState.setWorkspaceInviteEmail}
        inviteRole={props.authState.workspaceInviteRole}
        setInviteRole={props.authState.setWorkspaceInviteRole}
        inviteProjectRolesJson={props.authState.workspaceInviteProjectRolesJson}
        setInviteProjectRolesJson={props.authState.setWorkspaceInviteProjectRolesJson}
        latestInviteUrl={props.authState.latestInviteUrl}
        latestInviteExpiresAt={props.authState.latestInviteExpiresAt}
        clearLatestInvite={() => {
          props.authState.setLatestInviteUrl('');
          props.authState.setLatestInviteExpiresAt('');
        }}
      />

      <ApiKeysPanel
        members={props.authState.workspaceMembers}
        selfKeys={props.authState.selfApiKeys}
        selectedUserId={props.authState.selectedApiKeyUserId}
        setSelectedUserId={props.authState.setSelectedApiKeyUserId}
        selectedUserKeys={props.authState.selectedUserApiKeys}
        selfLabel={props.authState.selfApiKeyLabel}
        setSelfLabel={props.authState.setSelfApiKeyLabel}
        contextPersona={props.authState.contextPersona}
        setContextPersona={props.authState.setContextPersona}
        recommendedPersona={props.memoryState.personaRecommendation?.recommended}
        recommendedConfidence={props.memoryState.personaRecommendation?.confidence}
        saveContextPersona={props.authActions.saveContextPersona}
        createSelfKey={props.authActions.createSelfApiKey}
        revokeSelfKey={props.authActions.revokeSelfApiKey}
        revokeUserKey={props.authActions.revokeSelectedUserApiKey}
        resetUserKeys={props.authActions.resetSelectedUserApiKeys}
        latestSelfPlainKey={props.authState.generatedSelfApiKey}
        clearSelfPlainKey={() => props.authState.setGeneratedSelfApiKey('')}
        latestOneTimeUrl={props.authState.latestOneTimeUrl}
        latestOneTimeExpiresAt={props.authState.latestOneTimeExpiresAt}
        clearLatestOneTime={() => {
          props.authState.setLatestOneTimeUrl('');
          props.authState.setLatestOneTimeExpiresAt('');
        }}
      />

      <ProjectMembersPanel
        addProjectMember={props.workspaceActions.addProjectMember}
        updateProjectMemberRole={props.workspaceActions.updateProjectMemberRole}
        removeProjectMember={props.workspaceActions.removeProjectMember}
        inviteEmail={props.workspaceState.inviteEmail}
        setInviteEmail={props.workspaceState.setInviteEmail}
        inviteRole={props.workspaceState.inviteRole}
        setInviteRole={props.workspaceState.setInviteRole}
        members={props.workspaceState.members}
      />
    </>
  );
}
