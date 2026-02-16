'use client';

import type { FormEvent } from 'react';
import type { IntegrationSettingsResponse } from '../lib/types';

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
};

export function IntegrationsPanel(props: Props) {
  return (
    <article className="panel">
      <div className="panel-body">
        <div className="panel-title">Integrations (Notion / Jira / Confluence / Linear)</div>
        <div className="muted">
          Env가 없어도 이 화면에서 키를 저장해 워크스페이스 단위로 연동할 수 있습니다.
        </div>
        <div className="muted">
          commit/merge hook auto-write 트리거를 켜면 git 이벤트 시 audit 로그가 남고, Notion은 자동 문서 write를 시도합니다.
        </div>
        <div className="muted">
          Jira/Confluence/Linear는 현재 auto-write audit 트리거까지만 지원하고, 실제 write 구현은 이후 확장 예정입니다.
        </div>
        <label>
          <div className="muted">Reason (for audit + Slack)</div>
          <input
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
              <input
                type="checkbox"
                checked={props.notionEnabled}
                onChange={(event) => props.setNotionEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.notionWriteEnabled}
                onChange={(event) => props.setNotionWriteEnabled(event.target.checked)}
              />{' '}
              write enabled
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.notionWriteOnCommit}
                onChange={(event) => props.setNotionWriteOnCommit(event.target.checked)}
              />{' '}
              auto write on commit hook
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.notionWriteOnMerge}
                onChange={(event) => props.setNotionWriteOnMerge(event.target.checked)}
              />{' '}
              auto write on merge hook
            </label>
            <div className="row">
              <input
                value={props.notionParentPageId}
                onChange={(event) => props.setNotionParentPageId(event.target.value)}
                placeholder="default parent page id (optional)"
              />
              <input
                value={props.notionToken}
                onChange={(event) => props.setNotionToken(event.target.value)}
                placeholder="notion token (blank = keep existing)"
              />
            </div>
            <div className="toolbar">
              <button className="primary" type="submit">
                Save Notion
              </button>
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
              <input
                type="checkbox"
                checked={props.jiraEnabled}
                onChange={(event) => props.setJiraEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.jiraWriteOnCommit}
                onChange={(event) => props.setJiraWriteOnCommit(event.target.checked)}
              />{' '}
              auto write on commit hook
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.jiraWriteOnMerge}
                onChange={(event) => props.setJiraWriteOnMerge(event.target.checked)}
              />{' '}
              auto write on merge hook
            </label>
            <div className="row">
              <input
                value={props.jiraBaseUrl}
                onChange={(event) => props.setJiraBaseUrl(event.target.value)}
                placeholder="https://your-org.atlassian.net"
              />
              <input
                value={props.jiraEmail}
                onChange={(event) => props.setJiraEmail(event.target.value)}
                placeholder="jira-email"
              />
            </div>
            <input
              value={props.jiraToken}
              onChange={(event) => props.setJiraToken(event.target.value)}
              placeholder="jira api token (blank = keep existing)"
            />
            <div className="toolbar">
              <button className="primary" type="submit">
                Save Jira
              </button>
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
              <input
                type="checkbox"
                checked={props.confluenceEnabled}
                onChange={(event) => props.setConfluenceEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.confluenceWriteOnCommit}
                onChange={(event) => props.setConfluenceWriteOnCommit(event.target.checked)}
              />{' '}
              auto write on commit hook
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.confluenceWriteOnMerge}
                onChange={(event) => props.setConfluenceWriteOnMerge(event.target.checked)}
              />{' '}
              auto write on merge hook
            </label>
            <div className="row">
              <input
                value={props.confluenceBaseUrl}
                onChange={(event) => props.setConfluenceBaseUrl(event.target.value)}
                placeholder="https://your-org.atlassian.net/wiki"
              />
              <input
                value={props.confluenceEmail}
                onChange={(event) => props.setConfluenceEmail(event.target.value)}
                placeholder="confluence-email"
              />
            </div>
            <input
              value={props.confluenceToken}
              onChange={(event) => props.setConfluenceToken(event.target.value)}
              placeholder="confluence api token (blank = keep existing)"
            />
            <div className="toolbar">
              <button className="primary" type="submit">
                Save Confluence
              </button>
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
              <input
                type="checkbox"
                checked={props.linearEnabled}
                onChange={(event) => props.setLinearEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.linearWriteOnCommit}
                onChange={(event) => props.setLinearWriteOnCommit(event.target.checked)}
              />{' '}
              auto write on commit hook
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.linearWriteOnMerge}
                onChange={(event) => props.setLinearWriteOnMerge(event.target.checked)}
              />{' '}
              auto write on merge hook
            </label>
            <div className="row">
              <input
                value={props.linearApiUrl}
                onChange={(event) => props.setLinearApiUrl(event.target.value)}
                placeholder="https://api.linear.app/graphql"
              />
              <input
                value={props.linearApiKey}
                onChange={(event) => props.setLinearApiKey(event.target.value)}
                placeholder="linear api key (blank = keep existing)"
              />
            </div>
            <div className="toolbar">
              <button className="primary" type="submit">
                Save Linear
              </button>
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
            Route example: git.* to #audit-devflow, integration.* high+ to #audit-security
          </div>
          <fieldset disabled={props.slackLocked} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className="muted">
              <input
                type="checkbox"
                checked={props.slackEnabled}
                onChange={(event) => props.setSlackEnabled(event.target.checked)}
              />{' '}
              enabled
            </label>
            <div className="row">
              <input
                value={props.slackWebhookUrl}
                onChange={(event) => props.setSlackWebhookUrl(event.target.value)}
                placeholder="slack webhook url (blank = keep existing)"
              />
              <input
                value={props.slackDefaultChannel}
                onChange={(event) => props.setSlackDefaultChannel(event.target.value)}
                placeholder="#channel (optional)"
              />
            </div>
            <input
              value={props.slackActionPrefixes}
              onChange={(event) => props.setSlackActionPrefixes(event.target.value)}
              placeholder="action prefixes CSV (e.g. git.,integration.,raw.)"
            />
            <div className="row">
              <select
                value={props.slackFormat}
                onChange={(event) => props.setSlackFormat(event.target.value as 'compact' | 'detailed')}
              >
                <option value="detailed">detailed</option>
                <option value="compact">compact</option>
              </select>
              <label className="muted">
                <input
                  type="checkbox"
                  checked={props.slackIncludeTargetJson}
                  onChange={(event) => props.setSlackIncludeTargetJson(event.target.checked)}
                />{' '}
                include target json
              </label>
              <label className="muted">
                <input
                  type="checkbox"
                  checked={props.slackMaskSecrets}
                  onChange={(event) => props.setSlackMaskSecrets(event.target.checked)}
                />{' '}
                mask secrets
              </label>
            </div>
            <label>
              <div className="muted">Routes JSON (action_prefix/channel/min_severity)</div>
              <textarea
                value={props.slackRoutesJson}
                onChange={(event) => props.setSlackRoutesJson(event.target.value)}
                placeholder='[{"action_prefix":"git.","channel":"#audit-devflow","min_severity":"medium"}]'
              />
            </label>
            <label>
              <div className="muted">Severity Rules JSON (action_prefix/severity)</div>
              <textarea
                value={props.slackSeverityRulesJson}
                onChange={(event) => props.setSlackSeverityRulesJson(event.target.value)}
                placeholder='[{"action_prefix":"integration.","severity":"high"}]'
              />
            </label>
            <div className="toolbar">
              <button className="primary" type="submit">
                Save Slack Audit
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </article>
  );
}
