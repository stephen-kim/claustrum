'use client';

import type { FormEvent } from 'react';
import type { IntegrationProvider } from '../../lib/types';
import type { AdminIntegrationsOutboundState } from './use-admin-integrations-outbound-state';

type SaveIntegrationPayload = {
  enabled: boolean;
  config: Record<string, unknown>;
  reason?: string;
};

type SaveIntegrationFn = (
  provider: IntegrationProvider,
  payload: SaveIntegrationPayload
) => Promise<void>;

type ProviderSaveDeps = {
  state: AdminIntegrationsOutboundState;
  setError: (message: string | null) => void;
  saveIntegration: SaveIntegrationFn;
};

export function createAdminIntegrationsOutboundProviderSaveActions(deps: ProviderSaveDeps) {
  const { state, setError, saveIntegration } = deps;

  async function saveNotionIntegration(event: FormEvent) {
    event.preventDefault();
    const config: Record<string, unknown> = {
      default_parent_page_id: state.notionParentPageId.trim(),
      write_enabled: state.notionWriteEnabled,
      write_on_commit: state.notionWriteOnCommit,
      write_on_merge: state.notionWriteOnMerge,
    };
    if (state.notionToken.trim()) {
      config.token = state.notionToken.trim();
    }
    await saveIntegration('notion', {
      enabled: state.notionEnabled,
      config,
      reason: state.integrationReason,
    });
  }

  async function saveJiraIntegration(event: FormEvent) {
    event.preventDefault();
    const config: Record<string, unknown> = {
      base_url: state.jiraBaseUrl.trim(),
      email: state.jiraEmail.trim(),
      write_on_commit: state.jiraWriteOnCommit,
      write_on_merge: state.jiraWriteOnMerge,
    };
    if (state.jiraToken.trim()) {
      config.api_token = state.jiraToken.trim();
    }
    await saveIntegration('jira', {
      enabled: state.jiraEnabled,
      config,
      reason: state.integrationReason,
    });
  }

  async function saveConfluenceIntegration(event: FormEvent) {
    event.preventDefault();
    const config: Record<string, unknown> = {
      base_url: state.confluenceBaseUrl.trim(),
      email: state.confluenceEmail.trim(),
      write_on_commit: state.confluenceWriteOnCommit,
      write_on_merge: state.confluenceWriteOnMerge,
    };
    if (state.confluenceToken.trim()) {
      config.api_token = state.confluenceToken.trim();
    }
    await saveIntegration('confluence', {
      enabled: state.confluenceEnabled,
      config,
      reason: state.integrationReason,
    });
  }

  async function saveLinearIntegration(event: FormEvent) {
    event.preventDefault();
    const config: Record<string, unknown> = {
      api_url: state.linearApiUrl.trim(),
      write_on_commit: state.linearWriteOnCommit,
      write_on_merge: state.linearWriteOnMerge,
    };
    if (state.linearApiKey.trim()) {
      config.api_key = state.linearApiKey.trim();
    }
    await saveIntegration('linear', {
      enabled: state.linearEnabled,
      config,
      reason: state.integrationReason,
    });
  }

  async function saveSlackIntegration(event: FormEvent) {
    event.preventDefault();
    let routes: unknown = [];
    let severityRules: unknown = [];
    try {
      routes = state.slackRoutesJson.trim() ? JSON.parse(state.slackRoutesJson) : [];
      severityRules = state.slackSeverityRulesJson.trim() ? JSON.parse(state.slackSeverityRulesJson) : [];
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? `slack JSON parse error: ${parseError.message}`
          : 'slack JSON parse error'
      );
      return;
    }

    const config: Record<string, unknown> = {
      default_channel: state.slackDefaultChannel.trim(),
      action_prefixes: state.slackActionPrefixes
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      format: state.slackFormat,
      include_target_json: state.slackIncludeTargetJson,
      mask_secrets: state.slackMaskSecrets,
      routes,
      severity_rules: severityRules,
    };
    if (state.slackWebhookUrl.trim()) {
      config.webhook_url = state.slackWebhookUrl.trim();
    }

    await saveIntegration('slack', {
      enabled: state.slackEnabled,
      config,
      reason: state.integrationReason,
    });
  }

  async function saveAuditReasonerIntegration(event: FormEvent) {
    event.preventDefault();
    const providerOrder = state.auditReasonerOrderCsv
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item): item is 'openai' | 'claude' | 'gemini' => {
        return item === 'openai' || item === 'claude' || item === 'gemini';
      })
      .filter((item, index, array) => array.indexOf(item) === index);

    if (providerOrder.length === 0) {
      setError('audit_reasoner provider order is required (openai/claude/gemini).');
      return;
    }

    const config: Record<string, unknown> = {
      provider_order: providerOrder,
      openai_model: state.auditReasonerOpenAiModel.trim() || null,
      openai_base_url: state.auditReasonerOpenAiBaseUrl.trim() || null,
      claude_model: state.auditReasonerClaudeModel.trim() || null,
      claude_base_url: state.auditReasonerClaudeBaseUrl.trim() || null,
      gemini_model: state.auditReasonerGeminiModel.trim() || null,
      gemini_base_url: state.auditReasonerGeminiBaseUrl.trim() || null,
    };
    if (state.auditReasonerOpenAiApiKey.trim()) {
      config.openai_api_key = state.auditReasonerOpenAiApiKey.trim();
    }
    if (state.auditReasonerClaudeApiKey.trim()) {
      config.claude_api_key = state.auditReasonerClaudeApiKey.trim();
    }
    if (state.auditReasonerGeminiApiKey.trim()) {
      config.gemini_api_key = state.auditReasonerGeminiApiKey.trim();
    }

    await saveIntegration('audit_reasoner', {
      enabled: state.auditReasonerEnabled,
      config,
      reason: state.integrationReason,
    });
  }

  return {
    saveNotionIntegration,
    saveJiraIntegration,
    saveConfluenceIntegration,
    saveLinearIntegration,
    saveSlackIntegration,
    saveAuditReasonerIntegration,
  };
}
