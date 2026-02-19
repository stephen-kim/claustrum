import { PrismaClient, ProjectRole, WorkspaceRole } from '@prisma/client';
import * as crypto from 'crypto';
import { buildApiKeyPrefix, hashApiKey } from '../src/security/api-key.js';

const prisma = new PrismaClient();

const PERSONAL_WORKSPACE_KEY = 'personal';
const PERSONAL_WORKSPACE_NAME = 'Personal Workspace';
const ADMIN_EMAIL = 'admin@local.dev';
const ADMIN_NAME = 'Local Admin';
const DEFAULT_PROJECT_KEY = 'default';
const DEFAULT_PROJECT_NAME = 'Default Project';
const ADMIN_KEY =
  process.env.MEMORY_CORE_SEED_ADMIN_KEY ||
  process.env.MEMORY_CORE_API_KEY ||
  'dev-admin-key-change-me';
const API_KEY_HASH_SECRET =
  process.env.MEMORY_CORE_API_KEY_HASH_SECRET || 'claustrum-dev-api-key-hash-secret-change-me';
const DEFAULT_LLM_PRICING: Array<{
  provider: string;
  model: string;
  inputTokenPricePer1kCents: number;
  outputTokenPricePer1kCents: number;
}> = [
  {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    inputTokenPricePer1kCents: 0.04,
    outputTokenPricePer1kCents: 0.16,
  },
  {
    provider: 'claude',
    model: 'claude-3-5-haiku-latest',
    inputTokenPricePer1kCents: 0.08,
    outputTokenPricePer1kCents: 0.4,
  },
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    inputTokenPricePer1kCents: 0.01,
    outputTokenPricePer1kCents: 0.03,
  },
];

async function main(): Promise<void> {
  const workspace = await prisma.workspace.upsert({
    where: { key: PERSONAL_WORKSPACE_KEY },
    update: { name: PERSONAL_WORKSPACE_NAME },
    create: {
      key: PERSONAL_WORKSPACE_KEY,
      name: PERSONAL_WORKSPACE_NAME,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      mustChangePassword: false,
      emailVerified: true,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      mustChangePassword: false,
      emailVerified: true,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: adminUser.id,
      },
    },
    update: { role: WorkspaceRole.ADMIN },
    create: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      role: WorkspaceRole.ADMIN,
    },
  });

  const project = await prisma.project.upsert({
    where: {
      workspaceId_key: {
        workspaceId: workspace.id,
        key: DEFAULT_PROJECT_KEY,
      },
    },
    update: { name: DEFAULT_PROJECT_NAME },
    create: {
      workspaceId: workspace.id,
      key: DEFAULT_PROJECT_KEY,
      name: DEFAULT_PROJECT_NAME,
    },
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: adminUser.id,
      },
    },
    update: { role: ProjectRole.OWNER },
    create: {
      projectId: project.id,
      userId: adminUser.id,
      role: ProjectRole.OWNER,
    },
  });

  const adminKeyHash = hashApiKey(ADMIN_KEY, API_KEY_HASH_SECRET);
  await prisma.apiKey.upsert({
    where: { keyHash: adminKeyHash },
    update: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      label: 'seed-admin',
      keyPrefix: buildApiKeyPrefix(ADMIN_KEY),
      deviceLabel: 'seed-admin-device',
      expiresAt: null,
      revokedAt: null,
      keyHash: adminKeyHash,
      key: null,
      createdByUserId: adminUser.id,
    },
    create: {
      key: null,
      workspaceId: workspace.id,
      keyHash: adminKeyHash,
      keyPrefix: buildApiKeyPrefix(ADMIN_KEY),
      deviceLabel: 'seed-admin-device',
      label: 'seed-admin',
      userId: adminUser.id,
      createdByUserId: adminUser.id,
    },
  });

  await prisma.workspaceSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
    },
  });

  for (const price of DEFAULT_LLM_PRICING) {
    await prisma.llmPricing.upsert({
      where: {
        provider_model: {
          provider: price.provider,
          model: price.model,
        },
      },
      update: {
        isActive: true,
        inputTokenPricePer1kCents: price.inputTokenPricePer1kCents,
        outputTokenPricePer1kCents: price.outputTokenPricePer1kCents,
      },
      create: {
        provider: price.provider,
        model: price.model,
        inputTokenPricePer1kCents: price.inputTokenPricePer1kCents,
        outputTokenPricePer1kCents: price.outputTokenPricePer1kCents,
      },
    });
  }

  await upsertDetectionRuleByName({
    workspaceId: workspace.id,
    name: 'Raw search burst',
    severity: 'high',
    condition: {
      type: 'threshold',
      action_key: 'raw.search',
      window_sec: 300,
      count_gte: 20,
      group_by: 'actor_user_id',
    },
    notify: {
      via: 'security_stream',
    },
  });

  await upsertDetectionRuleByName({
    workspaceId: workspace.id,
    name: 'Project permission churn',
    severity: 'medium',
    condition: {
      type: 'threshold',
      action_key: 'access.project_member.role_changed',
      window_sec: 600,
      count_gte: 30,
      group_by: 'actor_user_id',
    },
    notify: {
      via: 'security_stream',
    },
  });

  await upsertDetectionRuleByName({
    workspaceId: workspace.id,
    name: 'API key reset burst',
    severity: 'high',
    condition: {
      type: 'threshold',
      action_key: 'api_key.reset',
      window_sec: 600,
      count_gte: 5,
      group_by: 'actor_user_id',
    },
    notify: {
      via: 'security_stream',
    },
  });

  console.error(
    '[memory-core:seed] seeded workspace, settings, default LLM pricing, admin user, default project, and admin API key'
  );
  console.error(`[memory-core:seed] admin email: ${ADMIN_EMAIL}`);
  console.error(`[memory-core:seed] admin api key: ${maskKey(ADMIN_KEY)}`);
}

async function upsertDetectionRuleByName(args: {
  workspaceId: string;
  name: string;
  severity: 'low' | 'medium' | 'high';
  condition: Record<string, unknown>;
  notify?: Record<string, unknown>;
}): Promise<void> {
  const existing = await prisma.detectionRule.findFirst({
    where: {
      workspaceId: args.workspaceId,
      name: args.name,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.detectionRule.update({
      where: {
        id: existing.id,
      },
      data: {
        enabled: true,
        severity: args.severity,
        condition: args.condition as any,
        notify: (args.notify || { via: 'security_stream' }) as any,
      },
    });
    return;
  }

  await prisma.detectionRule.create({
    data: {
      workspaceId: args.workspaceId,
      name: args.name,
      enabled: true,
      severity: args.severity,
      condition: args.condition as any,
      notify: (args.notify || { via: 'security_stream' }) as any,
    },
  });
}

function maskKey(value: string): string {
  if (value.length <= 8) {
    return value;
  }
  const digest = crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
  return `${value.slice(0, 4)}...${value.slice(-4)} (sha256:${digest})`;
}

main()
  .catch((error) => {
    console.error('[memory-core:seed] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
