import type { FormEvent } from 'react';
import type {
  AuditDeliveryQueueResponse,
  AuditSinksResponse,
  DetectionsResponse,
  DetectionRulesResponse,
  GithubInstallationStatus,
  GithubTeamMappingsResponse,
  GithubWebhookEventsResponse,
  GithubPermissionStatusResponse,
  GithubPermissionSyncMode,
  GithubPermissionSyncResponse,
  GithubPermissionPreviewResponse,
  GithubPermissionCacheStatusResponse,
  GithubRepoLinksResponse,
  GithubUserLinksResponse,
  IntegrationSettingsResponse,
  WorkspaceMember,
} from '../../lib/types';

export type IntegrationsPanelProps = {
  selectedWorkspace: string;
  monorepoContextMode: 'shared_repo' | 'split_on_demand' | 'split_auto';
  githubAutoCreateProjects: boolean;
  setGithubAutoCreateProjects: (value: boolean) => void;
  githubAutoCreateSubprojects: boolean;
  setGithubAutoCreateSubprojects: (value: boolean) => void;
  githubPermissionSyncEnabled: boolean;
  setGithubPermissionSyncEnabled: (value: boolean) => void;
  githubPermissionSyncMode: GithubPermissionSyncMode;
  setGithubPermissionSyncMode: (value: GithubPermissionSyncMode) => void;
  githubCacheTtlSeconds: number;
  setGithubCacheTtlSeconds: (value: number) => void;
  githubWebhookEnabled: boolean;
  setGithubWebhookEnabled: (value: boolean) => void;
  githubWebhookSyncMode: GithubPermissionSyncMode;
  setGithubWebhookSyncMode: (value: GithubPermissionSyncMode) => void;
  githubTeamMappingEnabled: boolean;
  setGithubTeamMappingEnabled: (value: boolean) => void;
  githubRoleMappingJson: string;
  setGithubRoleMappingJson: (value: string) => void;
  githubProjectKeyPrefix: string;
  setGithubProjectKeyPrefix: (value: string) => void;
  setGithubPrefix: (value: string) => void;
  saveGithubProjectSettings: () => void | Promise<void>;
  securityStreamEnabled: boolean;
  setSecurityStreamEnabled: (value: boolean) => void;
  securityStreamSinkId: string;
  setSecurityStreamSinkId: (value: string) => void;
  securityStreamMinSeverity: 'low' | 'medium' | 'high';
  setSecurityStreamMinSeverity: (value: 'low' | 'medium' | 'high') => void;
  workspaceMembers: WorkspaceMember[];
  integrationStates: IntegrationSettingsResponse['integrations'];
  integrationReason: string;
  setIntegrationReason: (value: string) => void;
  githubInstallation: GithubInstallationStatus['installation'];
  githubRepos: GithubRepoLinksResponse['repos'];
  githubLastSyncSummary: {
    count: number;
    projects_auto_created: number;
    projects_auto_linked: number;
  } | null;
  githubInstallUrl: string;
  githubUserLinks: GithubUserLinksResponse['links'];
  githubPermissionStatus: GithubPermissionStatusResponse | null;
  githubLastPermissionSyncResult: GithubPermissionSyncResponse | null;
  githubPermissionPreview: GithubPermissionPreviewResponse | null;
  githubPermissionCacheStatus: GithubPermissionCacheStatusResponse | null;
  githubWebhookDeliveries: GithubWebhookEventsResponse['deliveries'];
  githubTeamMappings: GithubTeamMappingsResponse['mappings'];
  auditSinks: AuditSinksResponse['sinks'];
  auditDeliveries: AuditDeliveryQueueResponse['deliveries'];
  auditDeliveryStatusFilter: 'queued' | 'sending' | 'delivered' | 'failed' | '';
  setAuditDeliveryStatusFilter: (value: 'queued' | 'sending' | 'delivered' | 'failed' | '') => void;
  newAuditSinkType: 'webhook' | 'http';
  setNewAuditSinkType: (value: 'webhook' | 'http') => void;
  newAuditSinkName: string;
  setNewAuditSinkName: (value: string) => void;
  newAuditSinkEnabled: boolean;
  setNewAuditSinkEnabled: (value: boolean) => void;
  newAuditSinkEndpointUrl: string;
  setNewAuditSinkEndpointUrl: (value: string) => void;
  newAuditSinkSecret: string;
  setNewAuditSinkSecret: (value: string) => void;
  newAuditSinkEventFilterJson: string;
  setNewAuditSinkEventFilterJson: (value: string) => void;
  newAuditSinkRetryPolicyJson: string;
  setNewAuditSinkRetryPolicyJson: (value: string) => void;
  auditSinkReason: string;
  setAuditSinkReason: (value: string) => void;
  detectionRules: DetectionRulesResponse['rules'];
  detections: DetectionsResponse['detections'];
  detectionStatusFilter: 'open' | 'ack' | 'closed' | '';
  setDetectionStatusFilter: (value: 'open' | 'ack' | 'closed' | '') => void;
  newDetectionRuleName: string;
  setNewDetectionRuleName: (value: string) => void;
  newDetectionRuleEnabled: boolean;
  setNewDetectionRuleEnabled: (value: boolean) => void;
  newDetectionRuleSeverity: 'low' | 'medium' | 'high';
  setNewDetectionRuleSeverity: (value: 'low' | 'medium' | 'high') => void;
  newDetectionRuleConditionJson: string;
  setNewDetectionRuleConditionJson: (value: string) => void;
  newDetectionRuleNotifyJson: string;
  setNewDetectionRuleNotifyJson: (value: string) => void;
  detectionRuleReason: string;
  setDetectionRuleReason: (value: string) => void;
  githubLinkUserId: string;
  setGithubLinkUserId: (value: string) => void;
  githubLinkLogin: string;
  setGithubLinkLogin: (value: string) => void;
  githubTeamMappingProviderInstallationId: string;
  setGithubTeamMappingProviderInstallationId: (value: string) => void;
  githubTeamMappingTeamId: string;
  setGithubTeamMappingTeamId: (value: string) => void;
  githubTeamMappingTeamSlug: string;
  setGithubTeamMappingTeamSlug: (value: string) => void;
  githubTeamMappingOrgLogin: string;
  setGithubTeamMappingOrgLogin: (value: string) => void;
  githubTeamMappingTargetType: 'workspace' | 'project';
  setGithubTeamMappingTargetType: (value: 'workspace' | 'project') => void;
  githubTeamMappingTargetKey: string;
  setGithubTeamMappingTargetKey: (value: string) => void;
  githubTeamMappingRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER';
  setGithubTeamMappingRole: (
    value: 'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER'
  ) => void;
  githubTeamMappingPriority: string;
  setGithubTeamMappingPriority: (value: string) => void;
  githubTeamMappingEnabledState: boolean;
  setGithubTeamMappingEnabledState: (value: boolean) => void;
  generateGithubInstallUrl: (workspaceKey: string) => Promise<string>;
  syncGithubRepos: (workspaceKey: string) => Promise<{
    count: number;
    projects_auto_created: number;
    projects_auto_linked: number;
  }>;
  syncGithubPermissions: (args: {
    workspaceKey: string;
    dryRun?: boolean;
    projectKeyPrefix?: string;
    repos?: string[];
  }) => Promise<GithubPermissionSyncResponse>;
  previewGithubPermissions: (
    workspaceKey: string,
    repo: string
  ) => Promise<GithubPermissionPreviewResponse>;
  loadGithubCacheStatus: (workspaceKey: string) => Promise<GithubPermissionCacheStatusResponse>;
  loadAuditDeliveries: (workspaceKey: string) => Promise<void>;
  createAuditSink: () => Promise<void>;
  patchAuditSink: (args: {
    sinkId: string;
    input: {
      name?: string;
      enabled?: boolean;
      endpoint_url?: string;
      secret?: string;
      event_filter?: Record<string, unknown>;
      retry_policy?: Record<string, unknown>;
      reason?: string;
    };
  }) => Promise<void>;
  deleteAuditSink: (sinkId: string) => Promise<void>;
  testAuditSink: (sinkId: string) => Promise<void>;
  createDetectionRule: () => Promise<void>;
  patchDetectionRule: (args: {
    ruleId: string;
    input: {
      name?: string;
      enabled?: boolean;
      severity?: 'low' | 'medium' | 'high';
      condition?: Record<string, unknown>;
      notify?: Record<string, unknown>;
      reason?: string;
    };
  }) => Promise<void>;
  deleteDetectionRule: (ruleId: string) => Promise<void>;
  loadDetections: (workspaceKey: string) => Promise<void>;
  updateDetectionStatus: (detectionId: string, status: 'open' | 'ack' | 'closed') => Promise<void>;
  createGithubUserLink: (workspaceKey: string, userId: string, githubLogin: string) => Promise<void>;
  deleteGithubUserLink: (workspaceKey: string, userId: string) => Promise<void>;
  createGithubTeamMapping: (args: {
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
  }) => Promise<void>;
  patchGithubTeamMapping: (args: {
    workspaceKey: string;
    mappingId: string;
    input: {
      enabled?: boolean;
      priority?: number;
    };
  }) => Promise<void>;
  deleteGithubTeamMapping: (workspaceKey: string, mappingId: string) => Promise<void>;

  notionLocked: boolean;
  notionEnabled: boolean;
  setNotionEnabled: (value: boolean) => void;
  notionWriteEnabled: boolean;
  setNotionWriteEnabled: (value: boolean) => void;
  notionWriteOnCommit: boolean;
  setNotionWriteOnCommit: (value: boolean) => void;
  notionWriteOnMerge: boolean;
  setNotionWriteOnMerge: (value: boolean) => void;
  notionParentPageId: string;
  setNotionParentPageId: (value: string) => void;
  notionToken: string;
  setNotionToken: (value: string) => void;
  saveNotionIntegration: (event: FormEvent) => void | Promise<void>;

  jiraLocked: boolean;
  jiraEnabled: boolean;
  setJiraEnabled: (value: boolean) => void;
  jiraWriteOnCommit: boolean;
  setJiraWriteOnCommit: (value: boolean) => void;
  jiraWriteOnMerge: boolean;
  setJiraWriteOnMerge: (value: boolean) => void;
  jiraBaseUrl: string;
  setJiraBaseUrl: (value: string) => void;
  jiraEmail: string;
  setJiraEmail: (value: string) => void;
  jiraToken: string;
  setJiraToken: (value: string) => void;
  saveJiraIntegration: (event: FormEvent) => void | Promise<void>;

  confluenceLocked: boolean;
  confluenceEnabled: boolean;
  setConfluenceEnabled: (value: boolean) => void;
  confluenceWriteOnCommit: boolean;
  setConfluenceWriteOnCommit: (value: boolean) => void;
  confluenceWriteOnMerge: boolean;
  setConfluenceWriteOnMerge: (value: boolean) => void;
  confluenceBaseUrl: string;
  setConfluenceBaseUrl: (value: string) => void;
  confluenceEmail: string;
  setConfluenceEmail: (value: string) => void;
  confluenceToken: string;
  setConfluenceToken: (value: string) => void;
  saveConfluenceIntegration: (event: FormEvent) => void | Promise<void>;

  linearLocked: boolean;
  linearEnabled: boolean;
  setLinearEnabled: (value: boolean) => void;
  linearWriteOnCommit: boolean;
  setLinearWriteOnCommit: (value: boolean) => void;
  linearWriteOnMerge: boolean;
  setLinearWriteOnMerge: (value: boolean) => void;
  linearApiUrl: string;
  setLinearApiUrl: (value: string) => void;
  linearApiKey: string;
  setLinearApiKey: (value: string) => void;
  saveLinearIntegration: (event: FormEvent) => void | Promise<void>;

  slackLocked: boolean;
  slackEnabled: boolean;
  setSlackEnabled: (value: boolean) => void;
  slackWebhookUrl: string;
  setSlackWebhookUrl: (value: string) => void;
  slackDefaultChannel: string;
  setSlackDefaultChannel: (value: string) => void;
  slackActionPrefixes: string;
  setSlackActionPrefixes: (value: string) => void;
  slackFormat: 'compact' | 'detailed';
  setSlackFormat: (value: 'compact' | 'detailed') => void;
  slackIncludeTargetJson: boolean;
  setSlackIncludeTargetJson: (value: boolean) => void;
  slackMaskSecrets: boolean;
  setSlackMaskSecrets: (value: boolean) => void;
  slackRoutesJson: string;
  setSlackRoutesJson: (value: string) => void;
  slackSeverityRulesJson: string;
  setSlackSeverityRulesJson: (value: string) => void;
  saveSlackIntegration: (event: FormEvent) => void | Promise<void>;

  auditReasonerLocked: boolean;
  auditReasonerEnabled: boolean;
  setAuditReasonerEnabled: (value: boolean) => void;
  auditReasonerOrderCsv: string;
  setAuditReasonerOrderCsv: (value: string) => void;
  auditReasonerOpenAiModel: string;
  setAuditReasonerOpenAiModel: (value: string) => void;
  auditReasonerOpenAiBaseUrl: string;
  setAuditReasonerOpenAiBaseUrl: (value: string) => void;
  auditReasonerOpenAiApiKey: string;
  setAuditReasonerOpenAiApiKey: (value: string) => void;
  auditReasonerClaudeModel: string;
  setAuditReasonerClaudeModel: (value: string) => void;
  auditReasonerClaudeBaseUrl: string;
  setAuditReasonerClaudeBaseUrl: (value: string) => void;
  auditReasonerClaudeApiKey: string;
  setAuditReasonerClaudeApiKey: (value: string) => void;
  auditReasonerGeminiModel: string;
  setAuditReasonerGeminiModel: (value: string) => void;
  auditReasonerGeminiBaseUrl: string;
  setAuditReasonerGeminiBaseUrl: (value: string) => void;
  auditReasonerGeminiApiKey: string;
  setAuditReasonerGeminiApiKey: (value: string) => void;
  saveAuditReasonerIntegration: (event: FormEvent) => void | Promise<void>;
};
