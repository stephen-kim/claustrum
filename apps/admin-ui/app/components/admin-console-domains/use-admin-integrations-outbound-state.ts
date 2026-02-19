'use client';

import { useState } from 'react';
import type {
  AuditDeliveryQueueResponse,
  AuditSinksResponse,
  DetectionsResponse,
  DetectionRulesResponse,
  GithubInstallationStatus,
  GithubTeamMappingsResponse,
  GithubWebhookEventsResponse,
  GithubPermissionStatusResponse,
  GithubPermissionSyncResponse,
  GithubPermissionPreviewResponse,
  GithubPermissionCacheStatusResponse,
  GithubRepoLinksResponse,
  GithubUserLinksResponse,
  IntegrationSettingsResponse,
  OutboundIntegrationType,
  OutboundLocale,
  OutboundStyle,
  OutboundTemplateVariablesResponse,
} from '../../lib/types';

export const DEFAULT_INTEGRATION_STATES: IntegrationSettingsResponse['integrations'] = {
  notion: { enabled: false, configured: false, source: 'none', has_token: false, write_enabled: false },
  jira: { enabled: false, configured: false, source: 'none', has_api_token: false },
  confluence: { enabled: false, configured: false, source: 'none', has_api_token: false },
  linear: { enabled: false, configured: false, source: 'none', has_api_key: false },
  slack: { enabled: false, configured: false, source: 'none', has_webhook: false, format: 'detailed' },
  audit_reasoner: {
    enabled: false,
    configured: false,
    source: 'none',
    has_api_key: false,
    provider_order: ['openai', 'claude', 'gemini'],
    has_openai_api_key: false,
    has_claude_api_key: false,
    has_gemini_api_key: false,
  },
};

export function useAdminIntegrationsOutboundState() {
  const [workspaceOutboundDefaultLocale, setWorkspaceOutboundDefaultLocale] =
    useState<OutboundLocale>('en');
  const [workspaceOutboundSupportedLocales, setWorkspaceOutboundSupportedLocales] = useState<
    OutboundLocale[]
  >(['en', 'ko', 'ja', 'es', 'zh']);
  const [outboundSettingsReason, setOutboundSettingsReason] = useState('');
  const [selectedOutboundIntegration, setSelectedOutboundIntegration] =
    useState<OutboundIntegrationType>('slack');
  const [outboundPolicyEnabled, setOutboundPolicyEnabled] = useState(true);
  const [outboundPolicyStyle, setOutboundPolicyStyle] = useState<OutboundStyle>('short');
  const [outboundPolicyLocaleDefault, setOutboundPolicyLocaleDefault] = useState<OutboundLocale>('en');
  const [outboundPolicySupportedLocales, setOutboundPolicySupportedLocales] = useState<
    OutboundLocale[]
  >(['en', 'ko', 'ja', 'es', 'zh']);
  const [outboundTemplateOverridesJson, setOutboundTemplateOverridesJson] = useState('{}');
  const [outboundTemplateVariables, setOutboundTemplateVariables] =
    useState<OutboundTemplateVariablesResponse | null>(null);
  const [outboundPolicyReason, setOutboundPolicyReason] = useState('');

  const [integrationStates, setIntegrationStates] = useState<IntegrationSettingsResponse['integrations']>(
    DEFAULT_INTEGRATION_STATES
  );
  const [notionEnabled, setNotionEnabled] = useState(false);
  const [notionToken, setNotionToken] = useState('');
  const [notionParentPageId, setNotionParentPageId] = useState('');
  const [notionWriteEnabled, setNotionWriteEnabled] = useState(false);
  const [notionWriteOnCommit, setNotionWriteOnCommit] = useState(false);
  const [notionWriteOnMerge, setNotionWriteOnMerge] = useState(false);

  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraWriteOnCommit, setJiraWriteOnCommit] = useState(false);
  const [jiraWriteOnMerge, setJiraWriteOnMerge] = useState(false);

  const [confluenceEnabled, setConfluenceEnabled] = useState(false);
  const [confluenceBaseUrl, setConfluenceBaseUrl] = useState('');
  const [confluenceEmail, setConfluenceEmail] = useState('');
  const [confluenceToken, setConfluenceToken] = useState('');
  const [confluenceWriteOnCommit, setConfluenceWriteOnCommit] = useState(false);
  const [confluenceWriteOnMerge, setConfluenceWriteOnMerge] = useState(false);

  const [linearEnabled, setLinearEnabled] = useState(false);
  const [linearApiUrl, setLinearApiUrl] = useState('');
  const [linearApiKey, setLinearApiKey] = useState('');
  const [linearWriteOnCommit, setLinearWriteOnCommit] = useState(false);
  const [linearWriteOnMerge, setLinearWriteOnMerge] = useState(false);

  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackDefaultChannel, setSlackDefaultChannel] = useState('');
  const [slackActionPrefixes, setSlackActionPrefixes] = useState(
    'workspace_settings.,project_mapping.,integration.,git.,ci.'
  );
  const [slackFormat, setSlackFormat] = useState<'compact' | 'detailed'>('detailed');
  const [slackIncludeTargetJson, setSlackIncludeTargetJson] = useState(true);
  const [slackMaskSecrets, setSlackMaskSecrets] = useState(true);
  const [slackRoutesJson, setSlackRoutesJson] = useState('[]');
  const [slackSeverityRulesJson, setSlackSeverityRulesJson] = useState('[]');

  const [auditReasonerEnabled, setAuditReasonerEnabled] = useState(false);
  const [auditReasonerOrderCsv, setAuditReasonerOrderCsv] = useState('openai,claude,gemini');
  const [auditReasonerOpenAiModel, setAuditReasonerOpenAiModel] = useState('');
  const [auditReasonerOpenAiBaseUrl, setAuditReasonerOpenAiBaseUrl] = useState('');
  const [auditReasonerOpenAiApiKey, setAuditReasonerOpenAiApiKey] = useState('');
  const [auditReasonerClaudeModel, setAuditReasonerClaudeModel] = useState('');
  const [auditReasonerClaudeBaseUrl, setAuditReasonerClaudeBaseUrl] = useState('');
  const [auditReasonerClaudeApiKey, setAuditReasonerClaudeApiKey] = useState('');
  const [auditReasonerGeminiModel, setAuditReasonerGeminiModel] = useState('');
  const [auditReasonerGeminiBaseUrl, setAuditReasonerGeminiBaseUrl] = useState('');
  const [auditReasonerGeminiApiKey, setAuditReasonerGeminiApiKey] = useState('');

  const [integrationReason, setIntegrationReason] = useState('');
  const [githubInstallation, setGithubInstallation] =
    useState<GithubInstallationStatus['installation']>(null);
  const [githubRepos, setGithubRepos] = useState<GithubRepoLinksResponse['repos']>([]);
  const [githubInstallUrl, setGithubInstallUrl] = useState('');
  const [githubLastSyncSummary, setGithubLastSyncSummary] = useState<{
    count: number;
    projects_auto_created: number;
    projects_auto_linked: number;
  } | null>(null);
  const [githubUserLinks, setGithubUserLinks] = useState<GithubUserLinksResponse['links']>([]);
  const [githubPermissionStatus, setGithubPermissionStatus] =
    useState<GithubPermissionStatusResponse | null>(null);
  const [githubLastPermissionSyncResult, setGithubLastPermissionSyncResult] =
    useState<GithubPermissionSyncResponse | null>(null);
  const [githubPermissionPreview, setGithubPermissionPreview] =
    useState<GithubPermissionPreviewResponse | null>(null);
  const [githubPermissionCacheStatus, setGithubPermissionCacheStatus] =
    useState<GithubPermissionCacheStatusResponse | null>(null);
  const [githubLinkUserId, setGithubLinkUserId] = useState('');
  const [githubLinkLogin, setGithubLinkLogin] = useState('');
  const [githubWebhookDeliveries, setGithubWebhookDeliveries] =
    useState<GithubWebhookEventsResponse['deliveries']>([]);
  const [githubTeamMappings, setGithubTeamMappings] =
    useState<GithubTeamMappingsResponse['mappings']>([]);
  const [githubTeamMappingProviderInstallationId, setGithubTeamMappingProviderInstallationId] =
    useState('');
  const [githubTeamMappingTeamId, setGithubTeamMappingTeamId] = useState('');
  const [githubTeamMappingTeamSlug, setGithubTeamMappingTeamSlug] = useState('');
  const [githubTeamMappingOrgLogin, setGithubTeamMappingOrgLogin] = useState('');
  const [githubTeamMappingTargetType, setGithubTeamMappingTargetType] =
    useState<'workspace' | 'project'>('workspace');
  const [githubTeamMappingTargetKey, setGithubTeamMappingTargetKey] = useState('');
  const [githubTeamMappingRole, setGithubTeamMappingRole] = useState<
    'OWNER' | 'ADMIN' | 'MEMBER' | 'MAINTAINER' | 'WRITER' | 'READER'
  >('MEMBER');
  const [githubTeamMappingPriority, setGithubTeamMappingPriority] = useState('100');
  const [githubTeamMappingEnabled, setGithubTeamMappingEnabled] = useState(true);

  const [auditSinks, setAuditSinks] = useState<AuditSinksResponse['sinks']>([]);
  const [auditDeliveries, setAuditDeliveries] = useState<AuditDeliveryQueueResponse['deliveries']>([]);
  const [auditDeliveryStatusFilter, setAuditDeliveryStatusFilter] = useState<
    'queued' | 'sending' | 'delivered' | 'failed' | ''
  >('');
  const [newAuditSinkType, setNewAuditSinkType] = useState<'webhook' | 'http'>('webhook');
  const [newAuditSinkName, setNewAuditSinkName] = useState('');
  const [newAuditSinkEnabled, setNewAuditSinkEnabled] = useState(true);
  const [newAuditSinkEndpointUrl, setNewAuditSinkEndpointUrl] = useState('');
  const [newAuditSinkSecret, setNewAuditSinkSecret] = useState('');
  const [newAuditSinkEventFilterJson, setNewAuditSinkEventFilterJson] = useState(
    '{\n  "include_prefixes": ["access.", "auth.", "raw.", "api_key."],\n  "exclude_actions": []\n}'
  );
  const [newAuditSinkRetryPolicyJson, setNewAuditSinkRetryPolicyJson] = useState(
    '{\n  "max_attempts": 5,\n  "backoff_sec": [1, 5, 30, 120, 600]\n}'
  );
  const [auditSinkReason, setAuditSinkReason] = useState('');

  const [detectionRules, setDetectionRules] = useState<DetectionRulesResponse['rules']>([]);
  const [newDetectionRuleName, setNewDetectionRuleName] = useState('Raw search burst');
  const [newDetectionRuleEnabled, setNewDetectionRuleEnabled] = useState(true);
  const [newDetectionRuleSeverity, setNewDetectionRuleSeverity] =
    useState<'low' | 'medium' | 'high'>('high');
  const [newDetectionRuleConditionJson, setNewDetectionRuleConditionJson] = useState(
    '{\n  "type": "threshold",\n  "action_key": "raw.search",\n  "window_sec": 300,\n  "count_gte": 20,\n  "group_by": "actor_user_id"\n}'
  );
  const [newDetectionRuleNotifyJson, setNewDetectionRuleNotifyJson] = useState(
    '{\n  "via": "security_stream"\n}'
  );
  const [detectionRuleReason, setDetectionRuleReason] = useState('');
  const [detections, setDetections] = useState<DetectionsResponse['detections']>([]);
  const [detectionStatusFilter, setDetectionStatusFilter] = useState<'open' | 'ack' | 'closed' | ''>(
    'open'
  );

  function resetWorkspaceScopedState() {
    setIntegrationStates(DEFAULT_INTEGRATION_STATES);

    setNotionEnabled(false);
    setNotionToken('');
    setNotionParentPageId('');
    setNotionWriteEnabled(false);
    setNotionWriteOnCommit(false);
    setNotionWriteOnMerge(false);

    setJiraEnabled(false);
    setJiraBaseUrl('');
    setJiraEmail('');
    setJiraToken('');
    setJiraWriteOnCommit(false);
    setJiraWriteOnMerge(false);

    setConfluenceEnabled(false);
    setConfluenceBaseUrl('');
    setConfluenceEmail('');
    setConfluenceToken('');
    setConfluenceWriteOnCommit(false);
    setConfluenceWriteOnMerge(false);

    setLinearEnabled(false);
    setLinearApiUrl('');
    setLinearApiKey('');
    setLinearWriteOnCommit(false);
    setLinearWriteOnMerge(false);

    setSlackEnabled(false);
    setSlackWebhookUrl('');
    setSlackDefaultChannel('');
    setSlackActionPrefixes('workspace_settings.,project_mapping.,integration.,git.,ci.');
    setSlackFormat('detailed');
    setSlackIncludeTargetJson(true);
    setSlackMaskSecrets(true);
    setSlackRoutesJson('[]');
    setSlackSeverityRulesJson('[]');

    setAuditReasonerEnabled(false);
    setAuditReasonerOrderCsv('openai,claude,gemini');
    setAuditReasonerOpenAiModel('');
    setAuditReasonerOpenAiBaseUrl('');
    setAuditReasonerOpenAiApiKey('');
    setAuditReasonerClaudeModel('');
    setAuditReasonerClaudeBaseUrl('');
    setAuditReasonerClaudeApiKey('');
    setAuditReasonerGeminiModel('');
    setAuditReasonerGeminiBaseUrl('');
    setAuditReasonerGeminiApiKey('');

    setWorkspaceOutboundDefaultLocale('en');
    setWorkspaceOutboundSupportedLocales(['en', 'ko', 'ja', 'es', 'zh']);
    setOutboundSettingsReason('');
    setSelectedOutboundIntegration('slack');
    setOutboundPolicyEnabled(true);
    setOutboundPolicyStyle('short');
    setOutboundPolicyLocaleDefault('en');
    setOutboundPolicySupportedLocales(['en', 'ko', 'ja', 'es', 'zh']);
    setOutboundTemplateOverridesJson('{}');
    setOutboundTemplateVariables(null);
    setOutboundPolicyReason('');
    setGithubInstallation(null);
    setGithubRepos([]);
    setGithubInstallUrl('');
    setGithubLastSyncSummary(null);
    setGithubUserLinks([]);
    setGithubPermissionStatus(null);
    setGithubLastPermissionSyncResult(null);
    setGithubPermissionPreview(null);
    setGithubPermissionCacheStatus(null);
    setGithubLinkUserId('');
    setGithubLinkLogin('');
    setGithubWebhookDeliveries([]);
    setGithubTeamMappings([]);
    setGithubTeamMappingProviderInstallationId('');
    setGithubTeamMappingTeamId('');
    setGithubTeamMappingTeamSlug('');
    setGithubTeamMappingOrgLogin('');
    setGithubTeamMappingTargetType('workspace');
    setGithubTeamMappingTargetKey('');
    setGithubTeamMappingRole('MEMBER');
    setGithubTeamMappingPriority('100');
    setGithubTeamMappingEnabled(true);
    setAuditSinks([]);
    setAuditDeliveries([]);
    setAuditDeliveryStatusFilter('');
    setNewAuditSinkType('webhook');
    setNewAuditSinkName('');
    setNewAuditSinkEnabled(true);
    setNewAuditSinkEndpointUrl('');
    setNewAuditSinkSecret('');
    setNewAuditSinkEventFilterJson(
      '{\n  "include_prefixes": ["access.", "auth.", "raw.", "api_key."],\n  "exclude_actions": []\n}'
    );
    setNewAuditSinkRetryPolicyJson(
      '{\n  "max_attempts": 5,\n  "backoff_sec": [1, 5, 30, 120, 600]\n}'
    );
    setAuditSinkReason('');
    setDetectionRules([]);
    setNewDetectionRuleName('Raw search burst');
    setNewDetectionRuleEnabled(true);
    setNewDetectionRuleSeverity('high');
    setNewDetectionRuleConditionJson(
      '{\n  "type": "threshold",\n  "action_key": "raw.search",\n  "window_sec": 300,\n  "count_gte": 20,\n  "group_by": "actor_user_id"\n}'
    );
    setNewDetectionRuleNotifyJson('{\n  "via": "security_stream"\n}');
    setDetectionRuleReason('');
    setDetections([]);
    setDetectionStatusFilter('open');
  }

  return {
    workspaceOutboundDefaultLocale,
    setWorkspaceOutboundDefaultLocale,
    workspaceOutboundSupportedLocales,
    setWorkspaceOutboundSupportedLocales,
    outboundSettingsReason,
    setOutboundSettingsReason,
    selectedOutboundIntegration,
    setSelectedOutboundIntegration,
    outboundPolicyEnabled,
    setOutboundPolicyEnabled,
    outboundPolicyStyle,
    setOutboundPolicyStyle,
    outboundPolicyLocaleDefault,
    setOutboundPolicyLocaleDefault,
    outboundPolicySupportedLocales,
    setOutboundPolicySupportedLocales,
    outboundTemplateOverridesJson,
    setOutboundTemplateOverridesJson,
    outboundTemplateVariables,
    setOutboundTemplateVariables,
    outboundPolicyReason,
    setOutboundPolicyReason,
    integrationStates,
    setIntegrationStates,
    notionEnabled,
    setNotionEnabled,
    notionToken,
    setNotionToken,
    notionParentPageId,
    setNotionParentPageId,
    notionWriteEnabled,
    setNotionWriteEnabled,
    notionWriteOnCommit,
    setNotionWriteOnCommit,
    notionWriteOnMerge,
    setNotionWriteOnMerge,
    jiraEnabled,
    setJiraEnabled,
    jiraBaseUrl,
    setJiraBaseUrl,
    jiraEmail,
    setJiraEmail,
    jiraToken,
    setJiraToken,
    jiraWriteOnCommit,
    setJiraWriteOnCommit,
    jiraWriteOnMerge,
    setJiraWriteOnMerge,
    confluenceEnabled,
    setConfluenceEnabled,
    confluenceBaseUrl,
    setConfluenceBaseUrl,
    confluenceEmail,
    setConfluenceEmail,
    confluenceToken,
    setConfluenceToken,
    confluenceWriteOnCommit,
    setConfluenceWriteOnCommit,
    confluenceWriteOnMerge,
    setConfluenceWriteOnMerge,
    linearEnabled,
    setLinearEnabled,
    linearApiUrl,
    setLinearApiUrl,
    linearApiKey,
    setLinearApiKey,
    linearWriteOnCommit,
    setLinearWriteOnCommit,
    linearWriteOnMerge,
    setLinearWriteOnMerge,
    slackEnabled,
    setSlackEnabled,
    slackWebhookUrl,
    setSlackWebhookUrl,
    slackDefaultChannel,
    setSlackDefaultChannel,
    slackActionPrefixes,
    setSlackActionPrefixes,
    slackFormat,
    setSlackFormat,
    slackIncludeTargetJson,
    setSlackIncludeTargetJson,
    slackMaskSecrets,
    setSlackMaskSecrets,
    slackRoutesJson,
    setSlackRoutesJson,
    slackSeverityRulesJson,
    setSlackSeverityRulesJson,
    auditReasonerEnabled,
    setAuditReasonerEnabled,
    auditReasonerOrderCsv,
    setAuditReasonerOrderCsv,
    auditReasonerOpenAiModel,
    setAuditReasonerOpenAiModel,
    auditReasonerOpenAiBaseUrl,
    setAuditReasonerOpenAiBaseUrl,
    auditReasonerOpenAiApiKey,
    setAuditReasonerOpenAiApiKey,
    auditReasonerClaudeModel,
    setAuditReasonerClaudeModel,
    auditReasonerClaudeBaseUrl,
    setAuditReasonerClaudeBaseUrl,
    auditReasonerClaudeApiKey,
    setAuditReasonerClaudeApiKey,
    auditReasonerGeminiModel,
    setAuditReasonerGeminiModel,
    auditReasonerGeminiBaseUrl,
    setAuditReasonerGeminiBaseUrl,
    auditReasonerGeminiApiKey,
    setAuditReasonerGeminiApiKey,
    integrationReason,
    setIntegrationReason,
    githubInstallation,
    setGithubInstallation,
    githubRepos,
    setGithubRepos,
    githubInstallUrl,
    setGithubInstallUrl,
    githubLastSyncSummary,
    setGithubLastSyncSummary,
    githubUserLinks,
    setGithubUserLinks,
    githubPermissionStatus,
    setGithubPermissionStatus,
    githubLastPermissionSyncResult,
    setGithubLastPermissionSyncResult,
    githubPermissionPreview,
    setGithubPermissionPreview,
    githubPermissionCacheStatus,
    setGithubPermissionCacheStatus,
    githubLinkUserId,
    setGithubLinkUserId,
    githubLinkLogin,
    setGithubLinkLogin,
    githubWebhookDeliveries,
    setGithubWebhookDeliveries,
    githubTeamMappings,
    setGithubTeamMappings,
    githubTeamMappingProviderInstallationId,
    setGithubTeamMappingProviderInstallationId,
    githubTeamMappingTeamId,
    setGithubTeamMappingTeamId,
    githubTeamMappingTeamSlug,
    setGithubTeamMappingTeamSlug,
    githubTeamMappingOrgLogin,
    setGithubTeamMappingOrgLogin,
    githubTeamMappingTargetType,
    setGithubTeamMappingTargetType,
    githubTeamMappingTargetKey,
    setGithubTeamMappingTargetKey,
    githubTeamMappingRole,
    setGithubTeamMappingRole,
    githubTeamMappingPriority,
    setGithubTeamMappingPriority,
    githubTeamMappingEnabled,
    setGithubTeamMappingEnabled,
    auditSinks,
    setAuditSinks,
    auditDeliveries,
    setAuditDeliveries,
    auditDeliveryStatusFilter,
    setAuditDeliveryStatusFilter,
    newAuditSinkType,
    setNewAuditSinkType,
    newAuditSinkName,
    setNewAuditSinkName,
    newAuditSinkEnabled,
    setNewAuditSinkEnabled,
    newAuditSinkEndpointUrl,
    setNewAuditSinkEndpointUrl,
    newAuditSinkSecret,
    setNewAuditSinkSecret,
    newAuditSinkEventFilterJson,
    setNewAuditSinkEventFilterJson,
    newAuditSinkRetryPolicyJson,
    setNewAuditSinkRetryPolicyJson,
    auditSinkReason,
    setAuditSinkReason,
    detectionRules,
    setDetectionRules,
    newDetectionRuleName,
    setNewDetectionRuleName,
    newDetectionRuleEnabled,
    setNewDetectionRuleEnabled,
    newDetectionRuleSeverity,
    setNewDetectionRuleSeverity,
    newDetectionRuleConditionJson,
    setNewDetectionRuleConditionJson,
    newDetectionRuleNotifyJson,
    setNewDetectionRuleNotifyJson,
    detectionRuleReason,
    setDetectionRuleReason,
    detections,
    setDetections,
    detectionStatusFilter,
    setDetectionStatusFilter,
    resetWorkspaceScopedState,
  };
}

export type AdminIntegrationsOutboundState = ReturnType<typeof useAdminIntegrationsOutboundState>;
