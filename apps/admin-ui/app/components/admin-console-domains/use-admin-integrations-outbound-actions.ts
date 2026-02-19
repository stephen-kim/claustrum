'use client';
import type {
  AuditDeliveryQueueResponse,
  AuditSinksResponse,
  DetectionsResponse,
  DetectionRulesResponse,
  IntegrationProvider,
  IntegrationSettingsResponse,
  OutboundIntegrationType,
  OutboundPolicy,
  OutboundTemplateVariablesResponse,
  WorkspaceOutboundSettings,
} from '../../lib/types';
import { createAdminIntegrationsOutboundGithubActions } from './use-admin-integrations-outbound-github-actions';
import { createAdminIntegrationsOutboundProviderSaveActions } from './use-admin-integrations-outbound-provider-save-actions';
import type { AdminCallApi } from './types';
import type { AdminIntegrationsOutboundState } from './use-admin-integrations-outbound-state';

type IntegrationsOutboundDeps = {
  callApi: AdminCallApi;
  selectedWorkspace: string;
  state: AdminIntegrationsOutboundState;
  setError: (message: string | null) => void;
};

export function useAdminIntegrationsOutboundActions(deps: IntegrationsOutboundDeps) {
  const { callApi, selectedWorkspace, state, setError } = deps;
  const githubActions = createAdminIntegrationsOutboundGithubActions({
    callApi,
    state,
  });

  async function loadWorkspaceOutboundSettings(workspaceKey: string) {
    const settings = await callApi<WorkspaceOutboundSettings>(
      `/v1/workspaces/${encodeURIComponent(workspaceKey)}/outbound-settings`
    );
    state.setWorkspaceOutboundDefaultLocale(settings.default_outbound_locale);
    state.setWorkspaceOutboundSupportedLocales(settings.supported_outbound_locales);
  }

  async function saveWorkspaceOutboundSettings() {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/workspaces/${encodeURIComponent(selectedWorkspace)}/outbound-settings`, {
      method: 'PUT',
      body: JSON.stringify({
        default_outbound_locale: state.workspaceOutboundDefaultLocale,
        supported_outbound_locales: state.workspaceOutboundSupportedLocales,
        reason: state.outboundSettingsReason.trim() || undefined,
      }),
    });
    await loadWorkspaceOutboundSettings(selectedWorkspace);
  }

  async function loadOutboundPolicy(workspaceKey: string, integrationType: OutboundIntegrationType) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<OutboundPolicy>(
      `/v1/outbound-policies/${integrationType}?${query.toString()}`
    );
    state.setOutboundPolicyEnabled(data.enabled);
    state.setOutboundPolicyStyle(data.style);
    state.setOutboundPolicyLocaleDefault(data.locale_default);
    state.setOutboundPolicySupportedLocales(data.supported_locales);
    state.setOutboundTemplateOverridesJson(JSON.stringify(data.template_overrides || {}, null, 2));
  }

  async function loadOutboundTemplateVariables(
    workspaceKey: string,
    integrationType: OutboundIntegrationType
  ) {
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      integration_type: integrationType,
    });
    const data = await callApi<OutboundTemplateVariablesResponse>(
      `/v1/outbound/template-variables?${query.toString()}`
    );
    state.setOutboundTemplateVariables(data);
  }

  async function saveOutboundPolicy() {
    if (!selectedWorkspace) {
      return;
    }

    let templateOverrides: Record<string, unknown> = {};
    try {
      templateOverrides = state.outboundTemplateOverridesJson.trim()
        ? (JSON.parse(state.outboundTemplateOverridesJson) as Record<string, unknown>)
        : {};
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? `template overrides JSON parse error: ${parseError.message}`
          : 'template overrides JSON parse error'
      );
      return;
    }

    await callApi(`/v1/outbound-policies/${state.selectedOutboundIntegration}`, {
      method: 'PUT',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        enabled: state.outboundPolicyEnabled,
        locale_default: state.outboundPolicyLocaleDefault,
        supported_locales: state.outboundPolicySupportedLocales,
        style: state.outboundPolicyStyle,
        template_overrides: templateOverrides,
        reason: state.outboundPolicyReason.trim() || undefined,
      }),
    });

    await loadOutboundPolicy(selectedWorkspace, state.selectedOutboundIntegration);
    await loadOutboundTemplateVariables(selectedWorkspace, state.selectedOutboundIntegration);
  }

  async function loadIntegrations(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<IntegrationSettingsResponse>(`/v1/integrations?${query.toString()}`);
    const normalizedIntegrations: IntegrationSettingsResponse['integrations'] = {
      ...data.integrations,
      audit_reasoner: data.integrations.audit_reasoner || {
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

    state.setIntegrationStates(normalizedIntegrations);

    const notion = normalizedIntegrations.notion;
    state.setNotionEnabled(notion.enabled);
    state.setNotionParentPageId(notion.default_parent_page_id || '');
    state.setNotionWriteEnabled(Boolean(notion.write_enabled));
    state.setNotionWriteOnCommit(Boolean(notion.write_on_commit));
    state.setNotionWriteOnMerge(Boolean(notion.write_on_merge));
    state.setNotionToken('');

    const jira = normalizedIntegrations.jira;
    state.setJiraEnabled(jira.enabled);
    state.setJiraBaseUrl(jira.base_url || '');
    state.setJiraEmail(jira.email || '');
    state.setJiraWriteOnCommit(Boolean(jira.write_on_commit));
    state.setJiraWriteOnMerge(Boolean(jira.write_on_merge));
    state.setJiraToken('');

    const confluence = normalizedIntegrations.confluence;
    state.setConfluenceEnabled(confluence.enabled);
    state.setConfluenceBaseUrl(confluence.base_url || '');
    state.setConfluenceEmail(confluence.email || '');
    state.setConfluenceWriteOnCommit(Boolean(confluence.write_on_commit));
    state.setConfluenceWriteOnMerge(Boolean(confluence.write_on_merge));
    state.setConfluenceToken('');

    const linear = normalizedIntegrations.linear;
    state.setLinearEnabled(linear.enabled);
    state.setLinearApiUrl(linear.api_url || '');
    state.setLinearWriteOnCommit(Boolean(linear.write_on_commit));
    state.setLinearWriteOnMerge(Boolean(linear.write_on_merge));
    state.setLinearApiKey('');

    const slack = normalizedIntegrations.slack;
    state.setSlackEnabled(slack.enabled);
    state.setSlackDefaultChannel(slack.default_channel || '');
    state.setSlackActionPrefixes(
      (slack.action_prefixes || []).join(',') ||
        'workspace_settings.,project_mapping.,integration.,git.,ci.'
    );
    state.setSlackFormat(slack.format === 'compact' ? 'compact' : 'detailed');
    state.setSlackIncludeTargetJson(slack.include_target_json !== false);
    state.setSlackMaskSecrets(slack.mask_secrets !== false);
    state.setSlackRoutesJson(JSON.stringify(slack.routes || [], null, 2));
    state.setSlackSeverityRulesJson(JSON.stringify(slack.severity_rules || [], null, 2));
    state.setSlackWebhookUrl('');

    const reasoner = normalizedIntegrations.audit_reasoner || {
      enabled: false,
      configured: false,
      source: 'none' as const,
      has_api_key: false,
      provider_order: ['openai', 'claude', 'gemini'] as Array<'openai' | 'claude' | 'gemini'>,
      has_openai_api_key: false,
      has_claude_api_key: false,
      has_gemini_api_key: false,
    };
    const providerOrder =
      reasoner.provider_order && reasoner.provider_order.length > 0
        ? reasoner.provider_order
        : (['openai', 'claude', 'gemini'] as Array<'openai' | 'claude' | 'gemini'>);

    state.setAuditReasonerEnabled(reasoner.enabled);
    state.setAuditReasonerOrderCsv(providerOrder.join(','));
    state.setAuditReasonerOpenAiModel(reasoner.openai_model || '');
    state.setAuditReasonerOpenAiBaseUrl(reasoner.openai_base_url || '');
    state.setAuditReasonerOpenAiApiKey('');
    state.setAuditReasonerClaudeModel(reasoner.claude_model || '');
    state.setAuditReasonerClaudeBaseUrl(reasoner.claude_base_url || '');
    state.setAuditReasonerClaudeApiKey('');
    state.setAuditReasonerGeminiModel(reasoner.gemini_model || '');
    state.setAuditReasonerGeminiBaseUrl(reasoner.gemini_base_url || '');
    state.setAuditReasonerGeminiApiKey('');
  }

  async function loadAuditSinks(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<AuditSinksResponse>(`/v1/audit-sinks?${query.toString()}`);
    state.setAuditSinks(data.sinks || []);
    if (!state.newAuditSinkName.trim()) {
      state.setNewAuditSinkName('Primary SIEM Sink');
    }
  }

  async function loadAuditDeliveries(workspaceKey: string) {
    const query = new URLSearchParams({
      workspace_key: workspaceKey,
      limit: '200',
    });
    if (state.auditDeliveryStatusFilter) {
      query.set('status', state.auditDeliveryStatusFilter);
    }
    const data = await callApi<AuditDeliveryQueueResponse>(`/v1/audit-deliveries?${query.toString()}`);
    state.setAuditDeliveries(data.deliveries || []);
  }

  async function createAuditSink() {
    if (!selectedWorkspace) {
      return;
    }
    let eventFilter: Record<string, unknown> = {};
    let retryPolicy: Record<string, unknown> = {};
    try {
      eventFilter = state.newAuditSinkEventFilterJson.trim()
        ? (JSON.parse(state.newAuditSinkEventFilterJson) as Record<string, unknown>)
        : {};
      retryPolicy = state.newAuditSinkRetryPolicyJson.trim()
        ? (JSON.parse(state.newAuditSinkRetryPolicyJson) as Record<string, unknown>)
        : {};
    } catch (error) {
      setError(error instanceof Error ? `SIEM JSON parse error: ${error.message}` : 'SIEM JSON parse error');
      return;
    }

    await callApi('/v1/audit-sinks', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        type: state.newAuditSinkType,
        name: state.newAuditSinkName.trim(),
        enabled: state.newAuditSinkEnabled,
        endpoint_url: state.newAuditSinkEndpointUrl.trim(),
        secret: state.newAuditSinkSecret.trim(),
        event_filter: eventFilter,
        retry_policy: retryPolicy,
        reason: state.auditSinkReason.trim() || undefined,
      }),
    });
    state.setNewAuditSinkSecret('');
    await Promise.all([loadAuditSinks(selectedWorkspace), loadAuditDeliveries(selectedWorkspace)]);
  }

  async function patchAuditSink(args: {
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
  }) {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/audit-sinks/${encodeURIComponent(args.sinkId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        ...args.input,
      }),
    });
    await Promise.all([loadAuditSinks(selectedWorkspace), loadAuditDeliveries(selectedWorkspace)]);
  }

  async function deleteAuditSink(sinkId: string) {
    if (!selectedWorkspace) {
      return;
    }
    const query = new URLSearchParams({ workspace_key: selectedWorkspace });
    const reason = state.auditSinkReason.trim();
    if (reason) {
      query.set('reason', reason);
    }
    await callApi(`/v1/audit-sinks/${encodeURIComponent(sinkId)}?${query.toString()}`, {
      method: 'DELETE',
    });
    await Promise.all([loadAuditSinks(selectedWorkspace), loadAuditDeliveries(selectedWorkspace)]);
  }

  async function testAuditSink(sinkId: string) {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/audit-sinks/${encodeURIComponent(sinkId)}/test-delivery`, {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
      }),
    });
    await loadAuditDeliveries(selectedWorkspace);
  }

  async function loadDetectionRules(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey });
    const data = await callApi<DetectionRulesResponse>(`/v1/detection-rules?${query.toString()}`);
    state.setDetectionRules(data.rules || []);
  }

  async function createDetectionRule() {
    if (!selectedWorkspace) {
      return;
    }
    let condition: Record<string, unknown> = {};
    let notify: Record<string, unknown> = {};
    try {
      condition = state.newDetectionRuleConditionJson.trim()
        ? (JSON.parse(state.newDetectionRuleConditionJson) as Record<string, unknown>)
        : {};
      notify = state.newDetectionRuleNotifyJson.trim()
        ? (JSON.parse(state.newDetectionRuleNotifyJson) as Record<string, unknown>)
        : {};
    } catch (error) {
      setError(
        error instanceof Error
          ? `Detection rule JSON parse error: ${error.message}`
          : 'Detection rule JSON parse error'
      );
      return;
    }
    await callApi('/v1/detection-rules', {
      method: 'POST',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        name: state.newDetectionRuleName.trim(),
        enabled: state.newDetectionRuleEnabled,
        severity: state.newDetectionRuleSeverity,
        condition,
        notify,
        reason: state.detectionRuleReason.trim() || undefined,
      }),
    });
    await Promise.all([loadDetectionRules(selectedWorkspace), loadDetections(selectedWorkspace)]);
  }

  async function patchDetectionRule(args: {
    ruleId: string;
    input: {
      name?: string;
      enabled?: boolean;
      severity?: 'low' | 'medium' | 'high';
      condition?: Record<string, unknown>;
      notify?: Record<string, unknown>;
      reason?: string;
    };
  }) {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/detection-rules/${encodeURIComponent(args.ruleId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        ...args.input,
      }),
    });
    await Promise.all([loadDetectionRules(selectedWorkspace), loadDetections(selectedWorkspace)]);
  }

  async function deleteDetectionRule(ruleId: string) {
    if (!selectedWorkspace) {
      return;
    }
    const query = new URLSearchParams({
      workspace_key: selectedWorkspace,
    });
    const reason = state.detectionRuleReason.trim();
    if (reason) {
      query.set('reason', reason);
    }
    await callApi(`/v1/detection-rules/${encodeURIComponent(ruleId)}?${query.toString()}`, {
      method: 'DELETE',
    });
    await Promise.all([loadDetectionRules(selectedWorkspace), loadDetections(selectedWorkspace)]);
  }

  async function loadDetections(workspaceKey: string) {
    const query = new URLSearchParams({ workspace_key: workspaceKey, limit: '200' });
    if (state.detectionStatusFilter) {
      query.set('status', state.detectionStatusFilter);
    }
    const data = await callApi<DetectionsResponse>(`/v1/detections?${query.toString()}`);
    state.setDetections(data.detections || []);
  }

  async function updateDetectionStatus(detectionId: string, status: 'open' | 'ack' | 'closed') {
    if (!selectedWorkspace) {
      return;
    }
    await callApi(`/v1/detections/${encodeURIComponent(detectionId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        status,
        reason: state.detectionRuleReason.trim() || undefined,
      }),
    });
    await loadDetections(selectedWorkspace);
  }

  async function saveIntegration(
    provider: IntegrationProvider,
    payload: {
      enabled: boolean;
      config: Record<string, unknown>;
      reason?: string;
    }
  ) {
    if (!selectedWorkspace) {
      return;
    }
    if (state.integrationStates[provider].locked) {
      setError(
        `${provider} integration is locked by server policy (MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS).`
      );
      return;
    }
    await callApi('/v1/integrations', {
      method: 'PUT',
      body: JSON.stringify({
        workspace_key: selectedWorkspace,
        provider,
        enabled: payload.enabled,
        config: payload.config,
        reason: payload.reason?.trim() || undefined,
      }),
    });
    await loadIntegrations(selectedWorkspace);
  }
  const providerSaveActions = createAdminIntegrationsOutboundProviderSaveActions({
    state,
    setError,
    saveIntegration,
  });

  return {
    loadWorkspaceOutboundSettings,
    saveWorkspaceOutboundSettings,
    loadOutboundPolicy,
    loadOutboundTemplateVariables,
    saveOutboundPolicy,
    loadIntegrations,
    ...githubActions,
    loadAuditSinks,
    loadAuditDeliveries,
    createAuditSink,
    patchAuditSink,
    deleteAuditSink,
    testAuditSink,
    loadDetectionRules,
    createDetectionRule,
    patchDetectionRule,
    deleteDetectionRule,
    loadDetections,
    updateDetectionStatus,
    ...providerSaveActions,
  };
}

export type AdminIntegrationsOutboundActions = ReturnType<typeof useAdminIntegrationsOutboundActions>;
