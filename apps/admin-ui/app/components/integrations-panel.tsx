'use client';

import type { FormEvent } from 'react';
import type { IntegrationSettingsResponse } from '../lib/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from './ui';

type Props = {
  integrationStates: IntegrationSettingsResponse['integrations'];
  integrationReason: string;
  setIntegrationReason: (value: string) => void;

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

export function IntegrationsPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Integrations (Notion / Jira / Confluence / Linear / Slack / Audit Reasoner)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="muted">
          Env가 없어도 이 화면에서 키를 저장해 워크스페이스 단위로 연동할 수 있습니다.
        </div>
        <div className="muted">
          commit/merge hook auto-write 트리거를 켜면 git 이벤트 시 audit 로그가 남고, Notion은 자동 문서 write를 시도합니다.
        </div>
        <div className="muted">
          Jira/Confluence/Linear는 현재 auto-write audit 트리거까지만 지원하고, 실제 write 구현은 이후 확장 예정입니다.
        </div>
        <label className="stack gap-1">
          <Label className="muted">Reason (for audit + Slack)</Label>
          <Input
            value={props.integrationReason}
            onChange={(event) => props.setIntegrationReason(event.target.value)}
            placeholder="why this integration config changed"
          />
        </label>

        <form className="stack" onSubmit={props.saveNotionIntegration}>
          <strong>Notion</strong>
          <div className="muted">
            source: {props.integrationStates.notion.source} · configured:{' '}
            {props.integrationStates.notion.configured ? 'yes' : 'no'} · token:{' '}
            {props.integrationStates.notion.has_token ? 'saved' : 'missing'} · write:{' '}
            {props.integrationStates.notion.write_enabled ? 'enabled' : 'disabled'} · hook(commit/merge):{' '}
            {props.integrationStates.notion.write_on_commit ? 'on' : 'off'}/
            {props.integrationStates.notion.write_on_merge ? 'on' : 'off'}
          </div>
          {props.notionLocked ? (
            <div className="muted">locked by env policy (MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS)</div>
          ) : null}
          <fieldset disabled={props.notionLocked} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.notionEnabled}
                onChange={(event) => props.setNotionEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.notionWriteEnabled}
                onChange={(event) => props.setNotionWriteEnabled(event.target.checked)}
              />{' '}
              write enabled
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.notionWriteOnCommit}
                onChange={(event) => props.setNotionWriteOnCommit(event.target.checked)}
              />{' '}
              auto write on commit hook
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.notionWriteOnMerge}
                onChange={(event) => props.setNotionWriteOnMerge(event.target.checked)}
              />{' '}
              auto write on merge hook
            </label>
            <div className="row">
              <Input
                value={props.notionParentPageId}
                onChange={(event) => props.setNotionParentPageId(event.target.value)}
                placeholder="default parent page id (optional)"
              />
              <Input
                value={props.notionToken}
                onChange={(event) => props.setNotionToken(event.target.value)}
                placeholder="notion token (blank = keep existing)"
              />
            </div>
            <div className="toolbar">
              <Button className="primary" type="submit">
                Save Notion
              </Button>
            </div>
          </fieldset>
        </form>

        <form className="stack" onSubmit={props.saveJiraIntegration}>
          <strong>Jira</strong>
          <div className="muted">
            source: {props.integrationStates.jira.source} · configured:{' '}
            {props.integrationStates.jira.configured ? 'yes' : 'no'} · token:{' '}
            {props.integrationStates.jira.has_api_token ? 'saved' : 'missing'} · hook(commit/merge):{' '}
            {props.integrationStates.jira.write_on_commit ? 'on' : 'off'}/
            {props.integrationStates.jira.write_on_merge ? 'on' : 'off'}
          </div>
          {props.jiraLocked ? (
            <div className="muted">locked by env policy (MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS)</div>
          ) : null}
          <fieldset disabled={props.jiraLocked} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.jiraEnabled}
                onChange={(event) => props.setJiraEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.jiraWriteOnCommit}
                onChange={(event) => props.setJiraWriteOnCommit(event.target.checked)}
              />{' '}
              auto write on commit hook
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.jiraWriteOnMerge}
                onChange={(event) => props.setJiraWriteOnMerge(event.target.checked)}
              />{' '}
              auto write on merge hook
            </label>
            <div className="row">
              <Input
                value={props.jiraBaseUrl}
                onChange={(event) => props.setJiraBaseUrl(event.target.value)}
                placeholder="https://your-org.atlassian.net"
              />
              <Input
                value={props.jiraEmail}
                onChange={(event) => props.setJiraEmail(event.target.value)}
                placeholder="jira-email"
              />
            </div>
            <Input
              value={props.jiraToken}
              onChange={(event) => props.setJiraToken(event.target.value)}
              placeholder="jira api token (blank = keep existing)"
            />
            <div className="toolbar">
              <Button className="primary" type="submit">
                Save Jira
              </Button>
            </div>
          </fieldset>
        </form>

        <form className="stack" onSubmit={props.saveConfluenceIntegration}>
          <strong>Confluence</strong>
          <div className="muted">
            source: {props.integrationStates.confluence.source} · configured:{' '}
            {props.integrationStates.confluence.configured ? 'yes' : 'no'} · token:{' '}
            {props.integrationStates.confluence.has_api_token ? 'saved' : 'missing'} · hook(commit/merge):{' '}
            {props.integrationStates.confluence.write_on_commit ? 'on' : 'off'}/
            {props.integrationStates.confluence.write_on_merge ? 'on' : 'off'}
          </div>
          {props.confluenceLocked ? (
            <div className="muted">locked by env policy (MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS)</div>
          ) : null}
          <fieldset disabled={props.confluenceLocked} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.confluenceEnabled}
                onChange={(event) => props.setConfluenceEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.confluenceWriteOnCommit}
                onChange={(event) => props.setConfluenceWriteOnCommit(event.target.checked)}
              />{' '}
              auto write on commit hook
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.confluenceWriteOnMerge}
                onChange={(event) => props.setConfluenceWriteOnMerge(event.target.checked)}
              />{' '}
              auto write on merge hook
            </label>
            <div className="row">
              <Input
                value={props.confluenceBaseUrl}
                onChange={(event) => props.setConfluenceBaseUrl(event.target.value)}
                placeholder="https://your-org.atlassian.net/wiki"
              />
              <Input
                value={props.confluenceEmail}
                onChange={(event) => props.setConfluenceEmail(event.target.value)}
                placeholder="confluence-email"
              />
            </div>
            <Input
              value={props.confluenceToken}
              onChange={(event) => props.setConfluenceToken(event.target.value)}
              placeholder="confluence api token (blank = keep existing)"
            />
            <div className="toolbar">
              <Button className="primary" type="submit">
                Save Confluence
              </Button>
            </div>
          </fieldset>
        </form>

        <form className="stack" onSubmit={props.saveLinearIntegration}>
          <strong>Linear</strong>
          <div className="muted">
            source: {props.integrationStates.linear.source} · configured:{' '}
            {props.integrationStates.linear.configured ? 'yes' : 'no'} · key:{' '}
            {props.integrationStates.linear.has_api_key ? 'saved' : 'missing'} · hook(commit/merge):{' '}
            {props.integrationStates.linear.write_on_commit ? 'on' : 'off'}/
            {props.integrationStates.linear.write_on_merge ? 'on' : 'off'}
          </div>
          {props.linearLocked ? (
            <div className="muted">locked by env policy (MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS)</div>
          ) : null}
          <fieldset disabled={props.linearLocked} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.linearEnabled}
                onChange={(event) => props.setLinearEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.linearWriteOnCommit}
                onChange={(event) => props.setLinearWriteOnCommit(event.target.checked)}
              />{' '}
              auto write on commit hook
            </label>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.linearWriteOnMerge}
                onChange={(event) => props.setLinearWriteOnMerge(event.target.checked)}
              />{' '}
              auto write on merge hook
            </label>
            <div className="row">
              <Input
                value={props.linearApiUrl}
                onChange={(event) => props.setLinearApiUrl(event.target.value)}
                placeholder="https://api.linear.app/graphql"
              />
              <Input
                value={props.linearApiKey}
                onChange={(event) => props.setLinearApiKey(event.target.value)}
                placeholder="linear api key (blank = keep existing)"
              />
            </div>
            <div className="toolbar">
              <Button className="primary" type="submit">
                Save Linear
              </Button>
            </div>
          </fieldset>
        </form>

        <form className="stack" onSubmit={props.saveSlackIntegration}>
          <strong>Slack Audit</strong>
          <div className="muted">
            source: {props.integrationStates.slack.source} · configured:{' '}
            {props.integrationStates.slack.configured ? 'yes' : 'no'} · webhook:{' '}
            {props.integrationStates.slack.has_webhook ? 'saved' : 'missing'} · format:{' '}
            {props.integrationStates.slack.format || 'detailed'}
          </div>
          {props.slackLocked ? (
            <div className="muted">locked by env policy (MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS)</div>
          ) : null}
          <div className="muted">
            Route example: git./ci. to #audit-devflow, integration.* high+ to #audit-security
          </div>
          <fieldset disabled={props.slackLocked} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.slackEnabled}
                onChange={(event) => props.setSlackEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <div className="row">
              <Input
                value={props.slackWebhookUrl}
                onChange={(event) => props.setSlackWebhookUrl(event.target.value)}
                placeholder="slack webhook url (blank = keep existing)"
              />
              <Input
                value={props.slackDefaultChannel}
                onChange={(event) => props.setSlackDefaultChannel(event.target.value)}
                placeholder="#channel (optional)"
              />
            </div>
            <Input
              value={props.slackActionPrefixes}
              onChange={(event) => props.setSlackActionPrefixes(event.target.value)}
              placeholder="action prefixes CSV (e.g. git.,ci.,integration.,raw.)"
            />
            <div className="row">
              <Select
                value={props.slackFormat}
                onChange={(event) => props.setSlackFormat(event.target.value as 'compact' | 'detailed')}
              >
                <option value="detailed">detailed</option>
                <option value="compact">compact</option>
              </Select>
              <label className="muted">
                <Input
                  type="checkbox"
                  checked={props.slackIncludeTargetJson}
                  onChange={(event) => props.setSlackIncludeTargetJson(event.target.checked)}
                />{' '}
                include target json
              </label>
              <label className="muted">
                <Input
                  type="checkbox"
                  checked={props.slackMaskSecrets}
                  onChange={(event) => props.setSlackMaskSecrets(event.target.checked)}
                />{' '}
                mask secrets
              </label>
            </div>
            <label>
              <div className="muted">Routes JSON (action_prefix/channel/min_severity)</div>
              <Textarea
                value={props.slackRoutesJson}
                onChange={(event) => props.setSlackRoutesJson(event.target.value)}
                placeholder='[{"action_prefix":"ci.","channel":"#audit-devflow","min_severity":"medium"}]'
              />
            </label>
            <label>
              <div className="muted">Severity Rules JSON (action_prefix/severity)</div>
              <Textarea
                value={props.slackSeverityRulesJson}
                onChange={(event) => props.setSlackSeverityRulesJson(event.target.value)}
                placeholder='[{"action_prefix":"integration.","severity":"high"}]'
              />
            </label>
            <div className="toolbar">
              <Button className="primary" type="submit">
                Save Slack Audit
              </Button>
            </div>
          </fieldset>
        </form>

        <form className="stack" onSubmit={props.saveAuditReasonerIntegration}>
          <strong>Audit Reasoner (AI)</strong>
          <div className="muted">
            source: {props.integrationStates.audit_reasoner.source} · configured:{' '}
            {props.integrationStates.audit_reasoner.configured ? 'yes' : 'no'} · order:{' '}
            {(props.integrationStates.audit_reasoner.provider_order || []).join(',') || '-'}
          </div>
          <div className="muted">
            keys(openai/claude/gemini):{' '}
            {props.integrationStates.audit_reasoner.has_openai_api_key ? 'o' : 'x'}/
            {props.integrationStates.audit_reasoner.has_claude_api_key ? 'o' : 'x'}/
            {props.integrationStates.audit_reasoner.has_gemini_api_key ? 'o' : 'x'}
          </div>
          <div className="muted">
            ENV 우선순위: env가 설정되면 provider order/fallback도 env 값이 우선 적용됩니다.
          </div>
          {props.auditReasonerLocked ? (
            <div className="muted">locked by env policy (MEMORY_CORE_INTEGRATION_LOCKED_PROVIDERS)</div>
          ) : null}
          <fieldset disabled={props.auditReasonerLocked} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className="muted">
              <Input
                type="checkbox"
                checked={props.auditReasonerEnabled}
                onChange={(event) => props.setAuditReasonerEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <Input
              value={props.auditReasonerOrderCsv}
              onChange={(event) => props.setAuditReasonerOrderCsv(event.target.value)}
              placeholder="provider order csv (e.g. openai,claude,gemini)"
            />
            <div className="muted">If first provider fails, next provider is used automatically.</div>

            <strong>OpenAI</strong>
            <div className="row">
              <Input
                value={props.auditReasonerOpenAiModel}
                onChange={(event) => props.setAuditReasonerOpenAiModel(event.target.value)}
                placeholder="openai model"
              />
              <Input
                value={props.auditReasonerOpenAiBaseUrl}
                onChange={(event) => props.setAuditReasonerOpenAiBaseUrl(event.target.value)}
                placeholder="openai base url (optional)"
              />
            </div>
            <Input
              value={props.auditReasonerOpenAiApiKey}
              onChange={(event) => props.setAuditReasonerOpenAiApiKey(event.target.value)}
              placeholder="openai api key (blank = keep existing)"
            />

            <strong>Claude</strong>
            <div className="row">
              <Input
                value={props.auditReasonerClaudeModel}
                onChange={(event) => props.setAuditReasonerClaudeModel(event.target.value)}
                placeholder="claude model"
              />
              <Input
                value={props.auditReasonerClaudeBaseUrl}
                onChange={(event) => props.setAuditReasonerClaudeBaseUrl(event.target.value)}
                placeholder="claude base url (optional)"
              />
            </div>
            <Input
              value={props.auditReasonerClaudeApiKey}
              onChange={(event) => props.setAuditReasonerClaudeApiKey(event.target.value)}
              placeholder="claude api key (blank = keep existing)"
            />

            <strong>Gemini</strong>
            <div className="row">
              <Input
                value={props.auditReasonerGeminiModel}
                onChange={(event) => props.setAuditReasonerGeminiModel(event.target.value)}
                placeholder="gemini model"
              />
              <Input
                value={props.auditReasonerGeminiBaseUrl}
                onChange={(event) => props.setAuditReasonerGeminiBaseUrl(event.target.value)}
                placeholder="gemini base url (optional)"
              />
            </div>
            <Input
              value={props.auditReasonerGeminiApiKey}
              onChange={(event) => props.setAuditReasonerGeminiApiKey(event.target.value)}
              placeholder="gemini api key (blank = keep existing)"
            />
            <div className="toolbar">
              <Button className="primary" type="submit">
                Save Audit Reasoner
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
