import type { Logger } from '../logger.js';

type AuditEvent = {
  workspaceId: string;
  workspaceKey?: string;
  actorUserId: string;
  actorUserEmail?: string;
  action: string;
  target: Record<string, unknown>;
  createdAt: Date;
};

type SlackSeverity = 'low' | 'medium' | 'high' | 'critical';
type SlackFormat = 'compact' | 'detailed';

type SlackSeverityRule = {
  action_prefix: string;
  severity: SlackSeverity;
};

type SlackRouteRule = {
  action_prefix: string;
  channel?: string;
  min_severity?: SlackSeverity;
};

type SlackDeliveryConfig = {
  enabled?: boolean;
  webhookUrl?: string;
  actionPrefixes?: string[];
  defaultChannel?: string;
  format?: SlackFormat;
  includeTargetJson?: boolean;
  maskSecrets?: boolean;
  severityRules?: SlackSeverityRule[];
  routes?: SlackRouteRule[];
};

type SlackAuditNotifierOptions = {
  webhookUrl?: string;
  actionPrefixes?: string[];
  defaultChannel?: string;
  format?: SlackFormat;
  includeTargetJson?: boolean;
  maskSecrets?: boolean;
  logger: Logger;
  timeoutMs?: number;
};

export class SlackAuditNotifier {
  private readonly defaultConfig: SlackDeliveryConfig;
  private readonly logger: Logger;
  private readonly timeoutMs: number;

  constructor(options: SlackAuditNotifierOptions) {
    this.defaultConfig = {
      webhookUrl: options.webhookUrl?.trim() || undefined,
      actionPrefixes: (options.actionPrefixes || []).map((value) => value.trim()).filter(Boolean),
      defaultChannel: options.defaultChannel?.trim() || undefined,
      format: options.format || 'detailed',
      includeTargetJson: options.includeTargetJson ?? true,
      maskSecrets: options.maskSecrets ?? true,
    };
    this.logger = options.logger;
    this.timeoutMs = Math.max(options.timeoutMs || 4000, 1000);
  }

  isEnabled(config?: SlackDeliveryConfig): boolean {
    return Boolean(this.resolveConfig(config).webhookUrl);
  }

  shouldNotify(action: string, config?: SlackDeliveryConfig): boolean {
    const resolved = this.resolveConfig(config);
    if (!resolved.webhookUrl || resolved.enabled === false) {
      return false;
    }
    const prefixes = resolved.actionPrefixes || [];
    if (prefixes.length === 0) {
      return true;
    }
    return prefixes.some((prefix) => action.startsWith(prefix));
  }

  async notify(event: AuditEvent, overrideConfig?: SlackDeliveryConfig): Promise<void> {
    const resolved = this.resolveConfig(overrideConfig);
    if (!resolved.webhookUrl || resolved.enabled === false) {
      return;
    }
    if (!this.shouldNotify(event.action, resolved)) {
      return;
    }

    const severity = this.resolveSeverity(event, resolved);
    const route = this.resolveRoute(event.action, severity, resolved.routes || []);
    const channel = route?.channel || resolved.defaultChannel;
    const target = resolved.maskSecrets === false ? event.target : this.maskObject(event.target);
    const reason = typeof target.reason === 'string' ? target.reason : undefined;
    const what = this.summarizeWhatChanged(target);
    const actor = event.actorUserEmail || event.actorUserId;
    const workspace = event.workspaceKey || event.workspaceId;
    const createdAt = event.createdAt.toISOString();
    const linesDetailed = [
      `*Action*: \`${event.action}\``,
      `*Severity*: \`${severity}\``,
      `*Workspace*: \`${workspace}\``,
      `*Actor*: \`${actor}\``,
      `*What*: ${what}`,
      `*Why*: ${reason && reason.trim() ? reason.trim() : 'not provided'}`,
      `*At*: ${createdAt}`,
    ];
    if (resolved.includeTargetJson !== false) {
      linesDetailed.push(`*Target*: \`\`\`${this.limitJson(target, 1200)}\`\`\``);
    }

    const compactText = [
      `\`${event.action}\``,
      `sev=${severity}`,
      `ws=${workspace}`,
      `by=${actor}`,
      `why=${reason && reason.trim() ? this.oneLine(reason) : 'auto'}`,
    ].join(' | ');

    const detailedText = linesDetailed.join('\n');
    const messageText =
      resolved.format === 'compact'
        ? compactText
        : `audit ${event.action} by ${actor} in ${workspace}`;
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: resolved.format === 'compact' ? compactText : detailedText,
        },
      },
    ];
    const payload: Record<string, unknown> = {
      text: messageText,
      mrkdwn: true,
      blocks,
      attachments: [
        {
          color: this.severityColor(severity),
        },
      ],
    };
    if (channel) {
      payload.channel = channel;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(resolved.webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(`Slack audit webhook returned ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.logger.warn('Slack audit webhook failed', error);
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveConfig(overrideConfig?: SlackDeliveryConfig): SlackDeliveryConfig {
    if (!overrideConfig) {
      return this.defaultConfig;
    }
    return {
      ...this.defaultConfig,
      ...overrideConfig,
      actionPrefixes: overrideConfig.actionPrefixes ?? this.defaultConfig.actionPrefixes,
      severityRules: overrideConfig.severityRules ?? this.defaultConfig.severityRules,
      routes: overrideConfig.routes ?? this.defaultConfig.routes,
    };
  }

  private resolveSeverity(event: AuditEvent, config: SlackDeliveryConfig): SlackSeverity {
    const rules = config.severityRules || [];
    for (const rule of rules) {
      if (event.action.startsWith(rule.action_prefix)) {
        return rule.severity;
      }
    }
    const status = typeof event.target.status === 'string' ? event.target.status : '';
    if (status === 'failed') {
      return 'high';
    }
    if (event.action.startsWith('workspace_settings.') || event.action.startsWith('integration.')) {
      return 'medium';
    }
    if (event.action.startsWith('git.')) {
      return 'medium';
    }
    if (event.action.startsWith('ci.')) {
      return 'medium';
    }
    if (event.action.endsWith('.write')) {
      return 'medium';
    }
    return 'low';
  }

  private resolveRoute(
    action: string,
    severity: SlackSeverity,
    routes: SlackRouteRule[]
  ): SlackRouteRule | undefined {
    for (const route of routes) {
      if (!action.startsWith(route.action_prefix)) {
        continue;
      }
      if (route.min_severity && this.severityRank(severity) < this.severityRank(route.min_severity)) {
        continue;
      }
      return route;
    }
    return undefined;
  }

  private severityRank(severity: SlackSeverity): number {
    if (severity === 'critical') {
      return 4;
    }
    if (severity === 'high') {
      return 3;
    }
    if (severity === 'medium') {
      return 2;
    }
    return 1;
  }

  private severityColor(severity: SlackSeverity): string {
    if (severity === 'critical') {
      return '#C62828';
    }
    if (severity === 'high') {
      return '#E53935';
    }
    if (severity === 'medium') {
      return '#FB8C00';
    }
    return '#546E7A';
  }

  private oneLine(input: string): string {
    return input.replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  private limitJson(target: Record<string, unknown>, maxChars: number): string {
    const raw = JSON.stringify(target, null, 2);
    return raw.length > maxChars ? `${raw.slice(0, maxChars)}...` : raw;
  }

  private maskObject(target: Record<string, unknown>): Record<string, unknown> {
    const text = JSON.stringify(target);
    const masked = text
      .replace(/(xox[baprs]-[A-Za-z0-9-]+)/g, '[redacted-slack-token]')
      .replace(/(\"?(token|api[_-]?key|secret|password)\"?\s*:\s*\")([^\"]+)(\")/gi, '$1[redacted]$4');
    try {
      return JSON.parse(masked) as Record<string, unknown>;
    } catch {
      return target;
    }
  }

  private summarizeWhatChanged(target: Record<string, unknown>): string {
    const changedFields = Array.isArray(target.changed_fields) ? target.changed_fields : [];
    const fields = changedFields.filter((item): item is string => typeof item === 'string');
    if (fields.length > 0) {
      return `changed fields: ${fields.join(', ')}`;
    }
    if (typeof target.provider === 'string') {
      return `provider=${target.provider}`;
    }
    if (typeof target.mapping_id === 'string') {
      return `mapping_id=${target.mapping_id}`;
    }
    return 'see audit target details';
  }
}

export type {
  AuditEvent,
  SlackDeliveryConfig,
  SlackSeverity,
  SlackFormat,
  SlackSeverityRule,
  SlackRouteRule,
};
