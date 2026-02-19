
'use client';

import type { IntegrationsPanelProps } from './types';
import { Button, Input, Select, Textarea } from '../ui';

type SectionProps = {
  props: IntegrationsPanelProps;
};

export function ProviderExtendedSection({ props }: SectionProps) {
  return (
    <>
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
            Environment precedence: when env values are set, provider order and fallback use env first.
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
    </>
  );
}
