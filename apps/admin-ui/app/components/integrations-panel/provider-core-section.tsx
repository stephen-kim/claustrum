
'use client';

import type { IntegrationsPanelProps } from './types';
import { Button, Input, Label, Textarea } from '../ui';

type SectionProps = {
  props: IntegrationsPanelProps;
};

export function ProviderCoreSection({ props }: SectionProps) {
  return (
    <>
<div className="muted">
          You can save integration keys in workspace settings even when environment variables are not set.
        </div>
        <div className="muted">
          When commit/merge auto-write triggers are enabled, git events generate audit logs and Notion write attempts.
        </div>
        <div className="muted">
          Jira/Confluence/Linear currently support audit-triggered auto-write hooks; full write coverage can be extended later.
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

        
    </>
  );
}
