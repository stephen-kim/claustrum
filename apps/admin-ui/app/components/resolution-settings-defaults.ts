import type { Props } from './resolution-settings-types';

export function applyResolutionDefaults(props: Props): void {
  props.setResolutionOrder(['github_remote', 'repo_root_slug', 'manual']);
  props.setAutoCreateProject(true);
  props.setAutoSwitchRepo(true);
  props.setAutoSwitchSubproject(false);
  props.setAllowManualPin(true);
  props.setEnableGitEvents(true);
  props.setEnableCommitEvents(true);
  props.setEnableMergeEvents(true);
  props.setEnableCheckoutEvents(false);
  props.setCheckoutDebounceSeconds(30);
  props.setCheckoutDailyLimit(200);
  props.setEnableActivityAutoLog(true);
  props.setEnableDecisionExtraction(true);
  props.setDecisionExtractionMode('llm_only');
  props.setDecisionDefaultStatus('draft');
  props.setDecisionAutoConfirmEnabled(false);
  props.setDecisionAutoConfirmMinConfidence(0.9);
  props.setDecisionBatchSize(25);
  props.setDecisionBackfillDays(30);
  props.setActiveWorkStaleDays(14);
  props.setActiveWorkAutoCloseEnabled(false);
  props.setActiveWorkAutoCloseDays(45);
  props.setRawAccessMinRole('WRITER');
  props.setSearchDefaultMode('hybrid');
  props.setSearchHybridAlpha(0.6);
  props.setSearchHybridBeta(0.4);
  props.setSearchDefaultLimit(20);
  props.setSearchTypeWeightsJson(
    '{\n  "decision": 1.5,\n  "constraint": 1.35,\n  "goal": 1.2,\n  "activity": 1.05,\n  "active_work": 1.1,\n  "summary": 1.2,\n  "note": 1.0,\n  "problem": 1.0,\n  "caveat": 0.95\n}'
  );
  props.setSearchRecencyHalfLifeDays(14);
  props.setSearchSubpathBoostWeight(1.5);
  props.setRetentionPolicyEnabled(false);
  props.setAuditRetentionDays(365);
  props.setRawRetentionDays(90);
  props.setRetentionMode('archive');
  props.setGithubPrefix('github:');
  props.setLocalPrefix('local:');
  props.setAutoCreateProjectSubprojects(true);
  props.setEnableMonorepoResolution(false);
  props.setMonorepoDetectionLevel(2);
  props.setMonorepoMode('repo_hash_subpath');
  props.setMonorepoContextMode('shared_repo');
  props.setMonorepoSubpathMetadataEnabled(true);
  props.setMonorepoSubpathBoostEnabled(true);
  props.setMonorepoSubpathBoostWeight(1.5);
  props.setMonorepoRootMarkersText('pnpm-workspace.yaml\nturbo.json\nnx.json\nlerna.json');
  props.setMonorepoWorkspaceGlobsText('apps/*\npackages/*');
  props.setMonorepoExcludeGlobsText(
    '**/node_modules/**\n**/.git/**\n**/dist/**\n**/build/**\n.next/**'
  );
  props.setMonorepoMaxDepth(3);
}
