import * as fs from 'fs';
import * as path from 'path';

const HOOK_MARKER = '# Context Sync Auto-Hook';
const MANAGED_HOOKS = ['post-commit', 'post-merge', 'post-checkout'] as const;

export class GitHookManager {
  private readonly projectPath: string;
  private readonly projectKey: string;
  private readonly hooksDir: string;
  private readonly nodeBin: string;
  private readonly hookWorkerPath: string;
  private readonly memoryCoreUrl?: string;
  private readonly memoryCoreApiKey?: string;
  private readonly memoryCoreWorkspaceKey?: string;

  constructor(args: {
    projectPath: string;
    projectKey: string;
    hookWorkerPath: string;
    nodeBin?: string;
    memoryCoreUrl?: string;
    memoryCoreApiKey?: string;
    memoryCoreWorkspaceKey?: string;
  }) {
    this.projectPath = args.projectPath;
    this.projectKey = args.projectKey;
    this.hooksDir = path.join(this.projectPath, '.git', 'hooks');
    this.nodeBin = args.nodeBin || process.execPath;
    this.hookWorkerPath = args.hookWorkerPath;
    this.memoryCoreUrl = args.memoryCoreUrl?.trim() || undefined;
    this.memoryCoreApiKey = args.memoryCoreApiKey?.trim() || undefined;
    this.memoryCoreWorkspaceKey = args.memoryCoreWorkspaceKey?.trim() || undefined;
  }

  isGitRepo(): boolean {
    try {
      return fs.existsSync(path.join(this.projectPath, '.git'));
    } catch {
      return false;
    }
  }

  installHooks(): { success: boolean; installed: string[]; errors: string[] } {
    if (!this.isGitRepo()) {
      return {
        success: false,
        installed: [],
        errors: ['Not a git repository'],
      };
    }

    const installed: string[] = [];
    const errors: string[] = [];

    fs.mkdirSync(this.hooksDir, { recursive: true });
    this.removeManagedPrePushHook();

    const hookBodies: Record<(typeof MANAGED_HOOKS)[number], string> = {
      'post-commit': this.generateHook('post-commit'),
      'post-merge': this.generateHook('post-merge'),
      'post-checkout': this.generateHook('post-checkout'),
    };

    for (const hookName of MANAGED_HOOKS) {
      const hookPath = path.join(this.hooksDir, hookName);
      try {
        this.backupIfExists(hookPath);
        fs.writeFileSync(hookPath, hookBodies[hookName], { mode: 0o755 });
        installed.push(hookName);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to install ${hookName}: ${message}`);
      }
    }

    return {
      success: errors.length === 0,
      installed,
      errors,
    };
  }

  uninstallHooks(): { success: boolean; removed: string[] } {
    const removed: string[] = [];
    for (const hookName of MANAGED_HOOKS) {
      const hookPath = path.join(this.hooksDir, hookName);
      if (!fs.existsSync(hookPath)) {
        continue;
      }
      const content = fs.readFileSync(hookPath, 'utf8');
      if (!content.includes(HOOK_MARKER)) {
        continue;
      }
      fs.unlinkSync(hookPath);
      removed.push(hookName);
      this.restoreBackupIfExists(hookName, hookPath);
    }
    return { success: true, removed };
  }

  getInstalledHooks(): string[] {
    const installed: string[] = [];
    for (const hookName of MANAGED_HOOKS) {
      const hookPath = path.join(this.hooksDir, hookName);
      if (!fs.existsSync(hookPath)) {
        continue;
      }
      const content = fs.readFileSync(hookPath, 'utf8');
      if (content.includes(HOOK_MARKER)) {
        installed.push(hookName);
      }
    }
    return installed;
  }

  private generateHook(event: 'post-commit' | 'post-merge' | 'post-checkout'): string {
    const escapedNode = shellEscape(this.nodeBin);
    const escapedWorker = shellEscape(this.hookWorkerPath);
    const escapedKey = shellEscape(this.projectKey);
    const escapedEvent = shellEscape(event);
    const maybeCoreUrl = this.memoryCoreUrl ? `  MEMORY_CORE_URL=${shellEscape(this.memoryCoreUrl)} \\\n` : '';
    const maybeCoreApiKey = this.memoryCoreApiKey
      ? `  MEMORY_CORE_API_KEY=${shellEscape(this.memoryCoreApiKey)} \\\n`
      : '';
    const maybeWorkspaceKey = this.memoryCoreWorkspaceKey
      ? `  MEMORY_CORE_WORKSPACE_KEY=${shellEscape(this.memoryCoreWorkspaceKey)} \\\n`
      : '';
    const envPrefix = `${maybeCoreUrl}${maybeCoreApiKey}${maybeWorkspaceKey}`;

    return `#!/bin/sh
${HOOK_MARKER}: ${event}
# Non-blocking, fire-and-forget hook. Never blocks git workflow.

(
${envPrefix}  CONTEXT_SYNC_PROJECT_KEY=${escapedKey} \
  CONTEXT_SYNC_HOOK_EVENT=${escapedEvent} \
  ${escapedNode} ${escapedWorker} >/dev/null 2>&1 || true
) &
exit 0
`;
  }

  private backupIfExists(hookPath: string): void {
    if (!fs.existsSync(hookPath)) {
      return;
    }
    const backupPath = `${hookPath}.backup-${Date.now()}`;
    fs.copyFileSync(hookPath, backupPath);
  }

  private restoreBackupIfExists(hookName: string, hookPath: string): void {
    const backups = fs
      .readdirSync(this.hooksDir)
      .filter((entry) => entry.startsWith(`${hookName}.backup-`))
      .sort()
      .reverse();
    if (backups.length === 0) {
      return;
    }
    fs.copyFileSync(path.join(this.hooksDir, backups[0]), hookPath);
  }

  private removeManagedPrePushHook(): void {
    const prePushPath = path.join(this.hooksDir, 'pre-push');
    if (!fs.existsSync(prePushPath)) {
      return;
    }
    const content = fs.readFileSync(prePushPath, 'utf8');
    if (!content.includes(HOOK_MARKER)) {
      return;
    }
    fs.unlinkSync(prePushPath);
  }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}
