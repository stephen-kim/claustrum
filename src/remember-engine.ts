import type { Knex } from 'knex';
import { randomUUID } from 'crypto';
import simpleGit from 'simple-git';
import { ReadFileEngine } from './read-file-engine.js';
import { normalizeProjectKey } from './project-key.js';

interface RememberInput {
  type: 'active_work' | 'constraint' | 'problem' | 'goal' | 'decision' | 'note' | 'caveat';
  content: string;
  metadata?: Record<string, any>;
}

interface RememberResult {
  action: 'created' | 'updated' | 'skipped';
  id: string;
  type: string;
  reason?: string;
  gitContext?: {
    branch: string;
    uncommittedFiles: string[];
    stagedFiles: string[];
    lastCommit: string;
  };
  fileContext?: {
    files: Array<{
      path: string;
      complexity: string;
      linesOfCode: number;
      imports: string[];
    }>;
  };
}

type MemoryRow = {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any> | null;
  status: string | null;
};

export class RememberEngine {
  private readonly db: Knex;
  private readonly projectKey: string;
  private readonly projectPath?: string;
  private readonly readFileEngine?: ReadFileEngine;

  constructor(db: Knex, projectKey: string, projectPath?: string) {
    this.db = db;
    this.projectKey = normalizeProjectKey(projectKey);
    this.projectPath = projectPath;
    this.readFileEngine = projectPath ? new ReadFileEngine(projectPath) : undefined;
  }

  async remember(input: RememberInput): Promise<RememberResult> {
    const validation = this.validateContent(input);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const gitContext = await this.fetchGitContext();
    input.metadata = await this.enhanceMetadata(input, gitContext);

    let fileContext: RememberResult['fileContext'];
    if (Array.isArray(input.metadata.files) && input.metadata.files.length > 0) {
      fileContext = await this.enrichWithFileContext(input.metadata.files);
      if (fileContext && fileContext.files.length > 0) {
        input.metadata.fileContext = fileContext.files;
      }
    }

    const result = await this.db.transaction(async (trx) => {
      const existing = await this.findSimilar(trx, input);
      if (existing) {
        await this.updateExisting(trx, existing, input, gitContext, fileContext);
        return { action: 'updated' as const, id: existing.id };
      }

      const id = await this.storeNew(trx, input, gitContext);
      return { action: 'created' as const, id };
    });

    return {
      action: result.action,
      id: result.id,
      type: input.type,
      reason:
        result.action === 'updated'
          ? 'Found similar existing context and updated it'
          : 'Stored new context',
      gitContext: gitContext || undefined,
      fileContext,
    };
  }

  private async fetchGitContext(): Promise<RememberResult['gitContext'] | null> {
    if (!this.projectPath) {
      return null;
    }
    try {
      const git = simpleGit(this.projectPath);
      const status = await git.status();
      const log = await git.log({ maxCount: 1 });
      return {
        branch: status.current || 'unknown',
        uncommittedFiles: [
          ...status.modified,
          ...status.created,
          ...status.deleted,
          ...status.renamed.map((entry: { to: string }) => entry.to),
        ],
        stagedFiles: status.staged,
        lastCommit: log.latest?.message || 'No commits',
      };
    } catch {
      return null;
    }
  }

  private validateContent(input: RememberInput): { valid: boolean; reason?: string } {
    const content = input.content.trim();
    if (content.length < 3) {
      return { valid: false, reason: 'Content too short - minimum 3 characters.' };
    }
    return { valid: true };
  }

  private async enhanceMetadata(
    input: RememberInput,
    gitContext: RememberResult['gitContext'] | null
  ): Promise<Record<string, any>> {
    const metadata = input.metadata || {};
    const content = input.content;

    if (!metadata.files) {
      const fileMatches = content.match(/\b[\w./-]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h|md|json|yaml|yml|toml)\b/g);
      if (fileMatches) {
        metadata.files = Array.from(new Set(fileMatches));
      }
    }

    if (!metadata.branch && gitContext) {
      metadata.branch = gitContext.branch;
    }

    if (gitContext && (input.type === 'active_work' || input.type === 'problem')) {
      const existingFiles = Array.isArray(metadata.files) ? metadata.files : [];
      metadata.files = Array.from(
        new Set([...existingFiles, ...gitContext.uncommittedFiles, ...gitContext.stagedFiles])
      );
    }

    return metadata;
  }

  private async enrichWithFileContext(files: string[]): Promise<RememberResult['fileContext']> {
    if (!this.readFileEngine) {
      return undefined;
    }

    const fileContexts: RememberResult['fileContext'] = { files: [] };
    for (const file of files.slice(0, 3)) {
      try {
        const fileCtx = await this.readFileEngine.read(file);
        fileContexts.files.push({
          path: file,
          complexity: fileCtx.complexity.level,
          linesOfCode: fileCtx.metadata.linesOfCode,
          imports: fileCtx.relationships.imports.slice(0, 5),
        });
      } catch {
        continue;
      }
    }

    return fileContexts.files.length > 0 ? fileContexts : undefined;
  }

  private async findSimilar(trx: Knex.Transaction, input: RememberInput): Promise<MemoryRow | null> {
    if (input.type === 'active_work') {
      const existing = (await trx<MemoryRow>('memory_entries')
        .select('id', 'type', 'content', 'metadata', 'status')
        .where('project_key', this.projectKey)
        .andWhere('type', 'active_work')
        .andWhere('status', 'active')
        .orderBy('created_at', 'desc')
        .limit(5)
        .forUpdate()) as MemoryRow[];

      for (const row of existing) {
        if (this.calculateSimilarity(input.content, row.content) > 0.8) {
          return row;
        }
      }
    }

    if (input.type === 'constraint') {
      const keyValue = this.parseKeyValue(input.content);
      const existing = (await trx<MemoryRow>('memory_entries')
        .select('id', 'type', 'content', 'metadata', 'status')
        .where('project_key', this.projectKey)
        .andWhere('type', 'constraint')
        .andWhereRaw("metadata->>'key' = ?", [keyValue.key])
        .orderBy('created_at', 'desc')
        .first()
        .forUpdate()) as MemoryRow | undefined;

      return existing || null;
    }

    return null;
  }

  private async updateExisting(
    trx: Knex.Transaction,
    existing: MemoryRow,
    input: RememberInput,
    gitContext: RememberResult['gitContext'] | null,
    fileContext?: RememberResult['fileContext']
  ): Promise<void> {
    const now = new Date();
    const metadata = this.buildMetadata(input, gitContext, fileContext);
    await trx('memory_entries')
      .where({ id: existing.id })
      .update({
        content: input.content,
        metadata,
        status: this.resolveStatus(input.type, metadata),
        created_at: now,
        updated_at: now,
      });
  }

  private async storeNew(
    trx: Knex.Transaction,
    input: RememberInput,
    gitContext: RememberResult['gitContext'] | null
  ): Promise<string> {
    const id = randomUUID();
    const metadata = this.buildMetadata(input, gitContext);
    const now = new Date();
    await trx('memory_entries').insert({
      id,
      project_key: this.projectKey,
      type: input.type,
      content: input.content,
      metadata,
      status: this.resolveStatus(input.type, metadata),
      created_at: now,
      updated_at: now,
    });
    return id;
  }

  private buildMetadata(
    input: RememberInput,
    gitContext: RememberResult['gitContext'] | null,
    fileContext?: RememberResult['fileContext']
  ): Record<string, unknown> {
    const metadata = { ...(input.metadata || {}) };
    if (fileContext && fileContext.files.length > 0) {
      metadata.fileContext = fileContext.files;
    }
    if (gitContext && !metadata.branch) {
      metadata.branch = gitContext.branch;
    }

    if (input.type === 'constraint') {
      const keyValue = this.parseKeyValue(input.content);
      metadata.key = keyValue.key;
      metadata.value = keyValue.value;
      metadata.reasoning = metadata.reasoning || '';
    }

    if (input.type === 'caveat') {
      metadata.category = metadata.category || 'workaround';
      metadata.severity = metadata.severity || 'medium';
      metadata.verified = metadata.verified === true;
      metadata.affects_production = metadata.affects_production === true;
      metadata.resolved = metadata.resolved === true;
    }

    if (input.type === 'goal') {
      metadata.status = metadata.status || 'planned';
      metadata.target_date = metadata.target_date || null;
    }

    if (input.type === 'problem') {
      metadata.status = metadata.status || 'open';
    }

    if (input.type === 'active_work') {
      metadata.status = metadata.status || 'active';
      metadata.files = Array.isArray(metadata.files) ? metadata.files : [];
    }

    return metadata;
  }

  private resolveStatus(type: RememberInput['type'], metadata: Record<string, unknown>): string | null {
    if (type === 'active_work') {
      return String(metadata.status || 'active');
    }
    if (type === 'problem') {
      return String(metadata.status || 'open');
    }
    if (type === 'goal') {
      return String(metadata.status || 'planned');
    }
    if (type === 'caveat') {
      return metadata.resolved === true ? 'resolved' : 'open';
    }
    return null;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(Boolean));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(Boolean));
    if (words1.size === 0 && words2.size === 0) {
      return 1;
    }
    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private parseKeyValue(content: string): { key: string; value: string } {
    const match = content.match(/^(.+?)[:=](.+)$/);
    if (match) {
      return {
        key: match[1].trim(),
        value: match[2].trim(),
      };
    }
    return {
      key: content.trim(),
      value: '',
    };
  }
}
