import { PrismaClient, ProjectRole, WorkspaceRole } from '@prisma/client';
import * as crypto from 'crypto';

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
    update: { name: ADMIN_NAME },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
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
    update: { role: ProjectRole.ADMIN },
    create: {
      projectId: project.id,
      userId: adminUser.id,
      role: ProjectRole.ADMIN,
    },
  });

  await prisma.apiKey.upsert({
    where: { key: ADMIN_KEY },
    update: {
      userId: adminUser.id,
      label: 'seed-admin',
      revokedAt: null,
    },
    create: {
      key: ADMIN_KEY,
      label: 'seed-admin',
      userId: adminUser.id,
    },
  });

  await prisma.workspaceSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
    },
  });

  console.error('[memory-core:seed] seeded workspace, settings, admin user, default project, and admin API key');
  console.error(`[memory-core:seed] admin email: ${ADMIN_EMAIL}`);
  console.error(`[memory-core:seed] admin api key: ${maskKey(ADMIN_KEY)}`);
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
