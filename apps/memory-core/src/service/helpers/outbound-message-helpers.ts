import type { Prisma, PrismaClient } from '@prisma/client';
import {
  defaultOutboundLocales,
  outboundIntegrationTypeSchema,
  outboundStyleSchema,
  type OutboundIntegrationType,
  type OutboundMode,
  type OutboundStyle,
} from '@claustrum/shared';
import type { AuthContext } from '../../auth.js';
import { assertWorkspaceAccess, assertWorkspaceAdmin } from '../access-control.js';
import { diffFields, normalizeReason } from '../audit-utils.js';
import { ValidationError } from '../errors.js';
import {
  buildOutboundTemplateVariablesCatalog,
  renderOutboundMessage,
  resolveOutboundLocale,
} from '../outbound-renderer.js';
import { getEffectiveWorkspaceSettings } from '../workspace-resolution.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

type Workspace = { id: string; key: string };

type OutboundPolicyRecord = {
  id: string;
  workspaceId: string;
  integrationType: string;
  enabled: boolean;
  localeDefault: string;
  supportedLocales: Prisma.JsonValue;
  mode: string;
  style: string;
  templateOverrides: Prisma.JsonValue;
  llmPromptSystem: string | null;
  llmPromptUser: string | null;
};

type OutboundDeps = {
  prisma: PrismaClient;
  getWorkspaceByKey: (workspaceKey: string) => Promise<Workspace>;
  recordAudit: (args: {
    workspaceId: string;
    projectId?: string;
    workspaceKey?: string;
    actorUserId: string;
    actorUserEmail?: string;
    action: string;
    target: Record<string, unknown>;
  }) => Promise<void>;
};

type OutboundPolicyResponse = {
  integration_type: OutboundIntegrationType;
  enabled: boolean;
  locale_default: string;
  supported_locales: string[];
  mode: OutboundMode;
  style: OutboundStyle;
  template_overrides: Record<string, unknown>;
  llm_prompt_system: string | null;
  llm_prompt_user: string | null;
};

const OUTBOUND_ENGINE_MODE: OutboundMode = 'template';

function normalizeLocale(input: unknown, fallback: string): string {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) {
    return fallback;
  }
  return defaultOutboundLocales.includes(value as (typeof defaultOutboundLocales)[number])
    ? value
    : fallback;
}

function normalizeLocaleList(input: unknown, fallback: string[]): string[] {
  const source = Array.isArray(input) ? input : fallback;
  const values = source
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => defaultOutboundLocales.includes(item as (typeof defaultOutboundLocales)[number]));
  const unique = Array.from(new Set(values));
  return unique.length > 0 ? unique : fallback;
}

function normalizeIntegrationType(input: string): OutboundIntegrationType {
  const parsed = outboundIntegrationTypeSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('integration_type must be one of slack|jira|confluence|notion|webhook|email');
  }
  return parsed.data;
}

function toPolicyResponse(args: {
  integrationType: OutboundIntegrationType;
  workspaceDefaultLocale: string;
  workspaceSupportedLocales: string[];
  row?: OutboundPolicyRecord | null;
}): OutboundPolicyResponse {
  const localeDefault = normalizeLocale(
    args.row?.localeDefault || args.workspaceDefaultLocale,
    args.workspaceDefaultLocale
  );
  const supportedLocales = normalizeLocaleList(
    args.row?.supportedLocales,
    args.workspaceSupportedLocales
  );
  const mode: OutboundMode = OUTBOUND_ENGINE_MODE;
  const styleParsed = outboundStyleSchema.safeParse(args.row?.style || 'short');
  const style: OutboundStyle = styleParsed.success ? styleParsed.data : 'short';
  const templateOverrides =
    args.row?.templateOverrides && typeof args.row.templateOverrides === 'object'
      ? (args.row.templateOverrides as Record<string, unknown>)
      : {};
  return {
    integration_type: args.integrationType,
    enabled: args.row?.enabled ?? true,
    locale_default: localeDefault,
    supported_locales: supportedLocales,
    mode,
    style,
    template_overrides: templateOverrides,
    llm_prompt_system: args.row?.llmPromptSystem ?? null,
    llm_prompt_user: args.row?.llmPromptUser ?? null,
  };
}

export async function renderOutboundForWorkspace(args: {
  prisma: DbClient;
  workspaceId: string;
  integrationType: string;
  actionKey: string;
  params?: Record<string, unknown>;
  localeOverride?: string;
}) {
  const integrationType = normalizeIntegrationType(args.integrationType);
  const settings = await getEffectiveWorkspaceSettings(args.prisma, args.workspaceId);
  const row = await args.prisma.outboundMessagePolicy.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId: args.workspaceId,
        integrationType,
      },
    },
  });
  const policy = toPolicyResponse({
    integrationType,
    workspaceDefaultLocale: settings.defaultOutboundLocale,
    workspaceSupportedLocales: settings.supportedOutboundLocales,
    row,
  });
  const effectivePolicy: OutboundPolicyResponse =
    policy.enabled
      ? policy
      : {
          ...policy,
          locale_default: settings.defaultOutboundLocale,
          supported_locales: settings.supportedOutboundLocales,
          mode: OUTBOUND_ENGINE_MODE,
          style: 'short',
          template_overrides: {},
        };
  const localeUsed = resolveOutboundLocale(
    {
      defaultOutboundLocale: settings.defaultOutboundLocale,
      supportedOutboundLocales: settings.supportedOutboundLocales,
    },
    {
      localeDefault: effectivePolicy.locale_default,
      supportedLocales: effectivePolicy.supported_locales,
      mode: effectivePolicy.mode,
      style: effectivePolicy.style,
      templateOverrides: effectivePolicy.template_overrides,
      llmPromptSystem: effectivePolicy.llm_prompt_system,
      llmPromptUser: effectivePolicy.llm_prompt_user,
    },
    args.localeOverride
  );
  const text = renderOutboundMessage({
    integrationType,
    actionKey: args.actionKey,
    params: args.params || {},
    locale: localeUsed,
    mode: effectivePolicy.mode,
    style: effectivePolicy.style,
    templateOverrides: effectivePolicy.template_overrides,
  });

  return {
    locale_used: localeUsed,
    text,
    mode: effectivePolicy.mode,
    style: effectivePolicy.style,
  };
}

export async function getWorkspaceOutboundSettingsHandler(
  deps: OutboundDeps,
  args: { auth: AuthContext; workspaceKey: string }
) {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);
  const settings = await getEffectiveWorkspaceSettings(deps.prisma, workspace.id);
  return {
    workspace_key: workspace.key,
    default_outbound_locale: settings.defaultOutboundLocale,
    supported_outbound_locales: settings.supportedOutboundLocales,
  };
}

export async function updateWorkspaceOutboundSettingsHandler(
  deps: OutboundDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    defaultOutboundLocale?: string;
    supportedOutboundLocales?: string[];
    reason?: string;
  }
) {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);
  const effective = await getEffectiveWorkspaceSettings(deps.prisma, workspace.id);
  const currentDefault = effective.defaultOutboundLocale;
  const currentSupported = effective.supportedOutboundLocales;

  const supportedLocales = normalizeLocaleList(
    args.supportedOutboundLocales,
    currentSupported
  );
  let defaultLocale = normalizeLocale(args.defaultOutboundLocale, currentDefault);
  if (!supportedLocales.includes(defaultLocale)) {
    defaultLocale = supportedLocales[0] || 'en';
  }

  await deps.prisma.workspaceSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {
      defaultOutboundLocale: defaultLocale,
      supportedOutboundLocales: supportedLocales,
    },
    create: {
      workspaceId: workspace.id,
      defaultOutboundLocale: defaultLocale,
      supportedOutboundLocales: supportedLocales,
    },
  });

  const before = {
    default_outbound_locale: currentDefault,
    supported_outbound_locales: currentSupported,
  };
  const after = {
    default_outbound_locale: defaultLocale,
    supported_outbound_locales: supportedLocales,
  };
  const changedFields = diffFields(before, after);
  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'outbound.settings.update',
    target: {
      workspace_key: workspace.key,
      reason: normalizeReason(args.reason),
      changed_fields: changedFields,
      before,
      after,
    },
  });

  return {
    workspace_key: workspace.key,
    default_outbound_locale: defaultLocale,
    supported_outbound_locales: supportedLocales,
  };
}

export async function getOutboundPolicyHandler(
  deps: OutboundDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    integrationType: string;
  }
) {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);
  const settings = await getEffectiveWorkspaceSettings(deps.prisma, workspace.id);
  const integrationType = normalizeIntegrationType(args.integrationType);
  const row = await deps.prisma.outboundMessagePolicy.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId: workspace.id,
        integrationType,
      },
    },
  });
  return {
    workspace_key: workspace.key,
    ...toPolicyResponse({
      integrationType,
      workspaceDefaultLocale: settings.defaultOutboundLocale,
      workspaceSupportedLocales: settings.supportedOutboundLocales,
      row,
    }),
  };
}

export async function updateOutboundPolicyHandler(
  deps: OutboundDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    integrationType: string;
    enabled?: boolean;
    localeDefault?: string;
    supportedLocales?: string[];
    mode?: string;
    style?: string;
    templateOverrides?: Record<string, unknown>;
    llmPromptSystem?: string | null;
    llmPromptUser?: string | null;
    reason?: string;
  }
) {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);
  const settings = await getEffectiveWorkspaceSettings(deps.prisma, workspace.id);
  const integrationType = normalizeIntegrationType(args.integrationType);
  const existing = await deps.prisma.outboundMessagePolicy.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId: workspace.id,
        integrationType,
      },
    },
  });

  const supportedLocales = normalizeLocaleList(
    args.supportedLocales,
    normalizeLocaleList(existing?.supportedLocales, settings.supportedOutboundLocales)
  );
  let localeDefault = normalizeLocale(
    args.localeDefault,
    normalizeLocale(existing?.localeDefault, settings.defaultOutboundLocale)
  );
  if (!supportedLocales.includes(localeDefault)) {
    localeDefault = supportedLocales[0] || 'en';
  }

  const mode: OutboundMode = OUTBOUND_ENGINE_MODE;
  const styleParsed = outboundStyleSchema.safeParse(args.style ?? existing?.style ?? 'short');
  const style: OutboundStyle = styleParsed.success ? styleParsed.data : 'short';
  const templateOverrides =
    args.templateOverrides && typeof args.templateOverrides === 'object'
      ? args.templateOverrides
      : (existing?.templateOverrides as Record<string, unknown> | undefined) || {};
  const llmPromptSystem =
    args.llmPromptSystem !== undefined ? args.llmPromptSystem : existing?.llmPromptSystem ?? null;
  const llmPromptUser =
    args.llmPromptUser !== undefined ? args.llmPromptUser : existing?.llmPromptUser ?? null;

  const saved = await deps.prisma.outboundMessagePolicy.upsert({
    where: {
      workspaceId_integrationType: {
        workspaceId: workspace.id,
        integrationType,
      },
    },
    update: {
      enabled: args.enabled ?? existing?.enabled ?? true,
      localeDefault,
      supportedLocales,
      mode,
      style,
      templateOverrides: templateOverrides as Prisma.InputJsonValue,
      llmPromptSystem,
      llmPromptUser,
    },
    create: {
      workspaceId: workspace.id,
      integrationType,
      enabled: args.enabled ?? true,
      localeDefault,
      supportedLocales,
      mode,
      style,
      templateOverrides: templateOverrides as Prisma.InputJsonValue,
      llmPromptSystem,
      llmPromptUser,
    },
  });

  const before = existing
    ? {
        enabled: existing.enabled,
        locale_default: existing.localeDefault,
        supported_locales: existing.supportedLocales,
        mode: existing.mode,
        style: existing.style,
      }
    : null;
  const after = {
    enabled: saved.enabled,
    locale_default: saved.localeDefault,
    supported_locales: saved.supportedLocales,
    mode: saved.mode,
    style: saved.style,
  };
  const changedFields = diffFields(before || {}, after);
  await deps.recordAudit({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    actorUserId: args.auth.user.id,
    actorUserEmail: args.auth.user.email,
    action: 'outbound.policy.update',
    target: {
      workspace_key: workspace.key,
      integration_type: integrationType,
      reason: normalizeReason(args.reason),
      changed_fields: changedFields,
      before,
      after,
    },
  });

  return {
    workspace_key: workspace.key,
    ...toPolicyResponse({
      integrationType,
      workspaceDefaultLocale: settings.defaultOutboundLocale,
      workspaceSupportedLocales: settings.supportedOutboundLocales,
      row: saved,
    }),
  };
}

export async function listOutboundTemplateVariablesHandler(
  deps: OutboundDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    integrationType: string;
  }
) {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAdmin(deps.prisma, args.auth, workspace.id);
  const integrationType = normalizeIntegrationType(args.integrationType);
  const row = await deps.prisma.outboundMessagePolicy.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId: workspace.id,
        integrationType,
      },
    },
  });
  const templateOverrides =
    row?.templateOverrides && typeof row.templateOverrides === 'object'
      ? (row.templateOverrides as Record<string, unknown>)
      : {};

  return {
    workspace_key: workspace.key,
    ...buildOutboundTemplateVariablesCatalog({
      integrationType,
      templateOverrides,
    }),
  };
}

export async function renderOutboundHandler(
  deps: OutboundDeps,
  args: {
    auth: AuthContext;
    workspaceKey: string;
    integrationType: string;
    actionKey: string;
    params?: Record<string, unknown>;
    locale?: string;
  }
) {
  const workspace = await deps.getWorkspaceByKey(args.workspaceKey);
  await assertWorkspaceAccess(deps.prisma, args.auth, workspace.id);
  const rendered = await renderOutboundForWorkspace({
    prisma: deps.prisma,
    workspaceId: workspace.id,
    integrationType: args.integrationType,
    actionKey: args.actionKey,
    params: args.params || {},
    localeOverride: args.locale,
  });
  return {
    locale_used: rendered.locale_used,
    text: rendered.text,
  };
}
