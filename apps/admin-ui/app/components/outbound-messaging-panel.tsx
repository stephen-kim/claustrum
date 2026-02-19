'use client';

import type {
  OutboundIntegrationType,
  OutboundLocale,
  OutboundStyle,
  OutboundTemplateVariablesResponse,
} from '../lib/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Input, Label, Select, Textarea } from './ui';

const LOCALES: OutboundLocale[] = ['en', 'ko', 'ja', 'es', 'zh'];
const INTEGRATIONS: OutboundIntegrationType[] = [
  'slack',
  'jira',
  'confluence',
  'notion',
  'webhook',
  'email',
];

type Props = {
  workspaceDefaultLocale: OutboundLocale;
  setWorkspaceDefaultLocale: (value: OutboundLocale) => void;
  workspaceSupportedLocales: OutboundLocale[];
  setWorkspaceSupportedLocales: (value: OutboundLocale[]) => void;
  outboundSettingsReason: string;
  setOutboundSettingsReason: (value: string) => void;
  saveWorkspaceOutboundSettings: () => Promise<void>;
  selectedIntegration: OutboundIntegrationType;
  setSelectedIntegration: (value: OutboundIntegrationType) => void;
  policyEnabled: boolean;
  setPolicyEnabled: (value: boolean) => void;
  policyStyle: OutboundStyle;
  setPolicyStyle: (value: OutboundStyle) => void;
  policyLocaleDefault: OutboundLocale;
  setPolicyLocaleDefault: (value: OutboundLocale) => void;
  policySupportedLocales: OutboundLocale[];
  setPolicySupportedLocales: (value: OutboundLocale[]) => void;
  templateOverridesJson: string;
  setTemplateOverridesJson: (value: string) => void;
  templateVariables: OutboundTemplateVariablesResponse | null;
  outboundPolicyReason: string;
  setOutboundPolicyReason: (value: string) => void;
  saveOutboundPolicy: () => Promise<void>;
};

function toggleLocale(list: OutboundLocale[], locale: OutboundLocale, checked: boolean): OutboundLocale[] {
  if (checked) {
    if (list.includes(locale)) {
      return list;
    }
    return [...list, locale];
  }
  const next = list.filter((item) => item !== locale);
  return next.length > 0 ? next : list;
}

export function OutboundMessagingPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Outbound Messaging</CardTitle>
        <p className="text-xs text-muted-foreground">
          All policy changes are persisted to audit logs and visible in the Access Timeline/Audit panels.
        </p>
      </CardHeader>
      <CardContent>
        <div className="row">
          <div className="stack gap-1">
            <Label className="muted">Workspace Default Locale</Label>
            <Select
              value={props.workspaceDefaultLocale}
              onChange={(event) => props.setWorkspaceDefaultLocale(event.target.value as OutboundLocale)}
            >
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </Select>
          </div>
          <div className="stack gap-1">
            <Label className="muted">Reason (audit)</Label>
            <Input
              value={props.outboundSettingsReason}
              onChange={(event) => props.setOutboundSettingsReason(event.target.value)}
              placeholder="why outbound locale defaults changed"
            />
          </div>
        </div>

        <div className="stack gap-2">
          <Label className="muted">Workspace Supported Locales (outbound only)</Label>
          <div className="row">
            {LOCALES.map((locale) => (
              <label key={locale} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
                <Checkbox
                  checked={props.workspaceSupportedLocales.includes(locale)}
                  onCheckedChange={(value) =>
                    props.setWorkspaceSupportedLocales(
                      toggleLocale(props.workspaceSupportedLocales, locale, value === true)
                    )
                  }
                />
                <span>{locale}</span>
              </label>
            ))}
          </div>
          <div>
            <Button type="button" onClick={() => void props.saveWorkspaceOutboundSettings()}>
              Save Workspace Outbound Settings
            </Button>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <div className="row items-center">
            <Label className="muted">Integration Policy</Label>
            <div className="flex flex-wrap gap-2">
              {INTEGRATIONS.map((integration) => (
                <button
                  key={integration}
                  type="button"
                  className={`rounded-md border px-2 py-1 text-xs ${
                    props.selectedIntegration === integration
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                  onClick={() => props.setSelectedIntegration(integration)}
                >
                  {integration}
                </button>
              ))}
            </div>
          </div>

          <div className="row mt-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="outbound-policy-enabled"
                checked={props.policyEnabled}
                onCheckedChange={(value) => props.setPolicyEnabled(value === true)}
              />
              <Label htmlFor="outbound-policy-enabled" className="text-sm text-muted-foreground">
                enabled
              </Label>
            </div>
            <Badge>{props.selectedIntegration}</Badge>
          </div>

          <div className="row mt-3">
            <div className="stack gap-1">
              <Label className="muted">Template Engine</Label>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">Liquid</span>
                <span className="ml-2 text-muted-foreground">(fixed)</span>
              </div>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Style</Label>
              <Select
                value={props.policyStyle}
                onChange={(event) => props.setPolicyStyle(event.target.value as OutboundStyle)}
              >
                <option value="short">short</option>
                <option value="normal">normal</option>
                <option value="verbose">verbose</option>
              </Select>
            </div>
            <div className="stack gap-1">
              <Label className="muted">Locale Default</Label>
              <Select
                value={props.policyLocaleDefault}
                onChange={(event) => props.setPolicyLocaleDefault(event.target.value as OutboundLocale)}
              >
                {LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {locale}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="stack gap-2 mt-3">
            <Label className="muted">Supported Locales (policy)</Label>
            <div className="row">
              {LOCALES.map((locale) => (
                <label key={locale} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
                  <Checkbox
                    checked={props.policySupportedLocales.includes(locale)}
                    onCheckedChange={(value) =>
                      props.setPolicySupportedLocales(
                        toggleLocale(props.policySupportedLocales, locale, value === true)
                      )
                    }
                  />
                  <span>{locale}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="stack gap-1 mt-3">
            <Label className="muted">Template Overrides JSON (action_key -&gt; locale map)</Label>
            <Textarea
              rows={6}
              value={props.templateOverridesJson}
              onChange={(event) => props.setTemplateOverridesJson(event.target.value)}
              placeholder='{"raw.search":{"en":"Searched for {{ q }} ({{ count }})","ko":"{{ q }} 검색 완료 ({{ count }})"}}'
            />
          </div>

          <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
            <Label className="muted">Available Template Variables</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Use Liquid syntax like <code>{'{{ q }}'}</code>. Variables come from audit/event params.
            </p>
            {props.templateVariables ? (
              <>
                <div className="mt-3">
                  <div className="text-xs font-medium text-muted-foreground">Common</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {props.templateVariables.common_variables.map((item) => (
                      <Badge key={item.name} variant="secondary" className="font-mono text-xs">
                        {item.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-3 max-h-56 overflow-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-2 py-1">Action</th>
                        <th className="px-2 py-1">Variables</th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.templateVariables.action_variables.map((row) => (
                        <tr key={row.action_key} className="border-t border-border">
                          <td className="px-2 py-1 font-mono">{row.action_key}</td>
                          <td className="px-2 py-1">
                            {row.variables.length > 0
                              ? row.variables.map((item) => item.name).join(', ')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Variable catalog will load after selecting a workspace and integration.
              </p>
            )}
          </div>

          <div className="stack gap-1 mt-3">
            <Label className="muted">Reason (audit)</Label>
            <Input
              value={props.outboundPolicyReason}
              onChange={(event) => props.setOutboundPolicyReason(event.target.value)}
              placeholder="why this policy changed"
            />
          </div>

          <div className="mt-3">
            <Button type="button" onClick={() => void props.saveOutboundPolicy()}>
              Save Outbound Policy
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
