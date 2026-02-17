import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { detectSubproject, type MonorepoDetectionSettings } from './monorepo-detection.js';

const baseSettings: MonorepoDetectionSettings = {
  monorepoDetectionLevel: 2,
  monorepoWorkspaceGlobs: ['apps/*', 'packages/*'],
  monorepoExcludeGlobs: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '.next/**'],
  monorepoRootMarkers: ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'],
  monorepoMaxDepth: 3,
};

async function withRepo(
  setup: (repoRoot: string) => Promise<void>,
  run: (repoRoot: string) => Promise<void>
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'claustrum-monorepo-'));
  try {
    await setup(root);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('detects apps/memory-core subproject path', async () => {
  await withRepo(
    async (repoRoot) => {
      await mkdir(path.join(repoRoot, 'apps', 'memory-core', 'src'), { recursive: true });
      await writeFile(path.join(repoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n", 'utf8');
    },
    async (repoRoot) => {
      const cwd = path.join(repoRoot, 'apps', 'memory-core', 'src');
      const result = await detectSubproject(repoRoot, cwd, baseSettings);
      assert.equal(result, 'apps/memory-core');
    }
  );
});

test('detects packages/shared subproject path', async () => {
  await withRepo(
    async (repoRoot) => {
      await mkdir(path.join(repoRoot, 'packages', 'shared', 'src'), { recursive: true });
      await writeFile(path.join(repoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n", 'utf8');
    },
    async (repoRoot) => {
      const cwd = path.join(repoRoot, 'packages', 'shared', 'src');
      const result = await detectSubproject(repoRoot, cwd, baseSettings);
      assert.equal(result, 'packages/shared');
    }
  );
});

test('returns null for excluded paths', async () => {
  await withRepo(
    async (repoRoot) => {
      await mkdir(path.join(repoRoot, 'apps', 'memory-core', 'node_modules', 'dep'), {
        recursive: true,
      });
      await mkdir(path.join(repoRoot, 'apps', 'memory-core', '.git', 'objects'), {
        recursive: true,
      });
      await mkdir(path.join(repoRoot, 'apps', 'memory-core', 'dist', 'chunks'), {
        recursive: true,
      });
    },
    async (repoRoot) => {
      const excludedPaths = [
        path.join(repoRoot, 'apps', 'memory-core', 'node_modules', 'dep'),
        path.join(repoRoot, 'apps', 'memory-core', '.git', 'objects'),
        path.join(repoRoot, 'apps', 'memory-core', 'dist', 'chunks'),
      ];
      for (const cwd of excludedPaths) {
        const result = await detectSubproject(repoRoot, cwd, baseSettings);
        assert.equal(result, null);
      }
    }
  );
});

test('uses pnpm-workspace globs before defaults at level 2', async () => {
  await withRepo(
    async (repoRoot) => {
      await mkdir(path.join(repoRoot, 'services', 'gateway', 'src'), { recursive: true });
      await writeFile(path.join(repoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'services/*'\n", 'utf8');
    },
    async (repoRoot) => {
      const cwd = path.join(repoRoot, 'services', 'gateway', 'src');
      const result = await detectSubproject(repoRoot, cwd, {
        ...baseSettings,
        monorepoDetectionLevel: 2,
      });
      assert.equal(result, 'services/gateway');
    }
  );
});

test('falls back to nearest package.json at level 3', async () => {
  await withRepo(
    async (repoRoot) => {
      await mkdir(path.join(repoRoot, 'tools', 'devkit', 'src'), { recursive: true });
      await writeFile(
        path.join(repoRoot, 'tools', 'devkit', 'package.json'),
        JSON.stringify({ name: 'devkit' }),
        'utf8'
      );
    },
    async (repoRoot) => {
      const cwd = path.join(repoRoot, 'tools', 'devkit', 'src');
      const result = await detectSubproject(repoRoot, cwd, {
        ...baseSettings,
        monorepoDetectionLevel: 3,
      });
      assert.equal(result, 'tools/devkit');
    }
  );
});

test('returns null when max depth is exceeded', async () => {
  await withRepo(
    async (repoRoot) => {
      await mkdir(path.join(repoRoot, 'apps', 'memory-core', 'src', 'nested', 'dir'), {
        recursive: true,
      });
      await writeFile(path.join(repoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n", 'utf8');
    },
    async (repoRoot) => {
      const cwd = path.join(repoRoot, 'apps', 'memory-core', 'src', 'nested', 'dir');
      const result = await detectSubproject(repoRoot, cwd, {
        ...baseSettings,
        monorepoMaxDepth: 3,
      });
      assert.equal(result, null);
    }
  );
});
