import knex, { Knex } from 'knex';
import type { ProjectContext } from './types.js';
import { normalizeProjectKey } from './project-key.js';
import { resolveDatabaseConnection } from './db-connection.js';

type ProjectRow = {
  key: string;
  name: string;
  path: string | null;
  architecture: string | null;
  tech_stack: unknown;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
};

type ProjectInput = {
  key: string;
  label: string;
  path?: string;
  metadata?: Record<string, unknown>;
  architecture?: string;
  techStack?: string[];
};

type ProjectMetricsInput = {
  projectKey: string;
  linesOfCode?: number;
  fileCount?: number;
  lastCommit?: string | null;
  contributors?: number;
  hotspots?: unknown[];
  complexity?: string | null;
};

export class Storage {
  private readonly db: Knex;

  constructor() {
    this.db = knex({
      client: 'pg',
      connection: resolveDatabaseConnection(),
      pool: {
        min: 0,
        max: 10,
      },
    });
  }

  async ensureSchemaIsReady(): Promise<void> {
    const rows = await this.db('information_schema.tables')
      .select('table_name')
      .where('table_schema', 'public')
      .whereIn('table_name', ['projects', 'project_metrics', 'memory_entries']);

    const existing = new Set(rows.map((row) => row.table_name as string));
    const required = ['projects', 'project_metrics', 'memory_entries'];
    const missing = required.filter((table) => !existing.has(table));
    if (missing.length > 0) {
      throw new Error(
        `Database schema is not initialized. Missing tables: ${missing.join(', ')}. Run \"npm run db:migrate\".`
      );
    }
  }

  getDb(): Knex {
    return this.db;
  }

  async upsertProject(input: ProjectInput): Promise<ProjectContext> {
    const key = normalizeProjectKey(input.key);
    const now = new Date();

    await this.db('projects')
      .insert({
        key,
        name: input.label,
        path: input.path || null,
        architecture: input.architecture || null,
        tech_stack: input.techStack || [],
        metadata: input.metadata || {},
        created_at: now,
        updated_at: now,
      })
      .onConflict('key')
      .merge({
        name: input.label,
        path: input.path || null,
        architecture: input.architecture || null,
        tech_stack: input.techStack || [],
        metadata: input.metadata || {},
        updated_at: now,
      });

    const row = (await this.db<ProjectRow>('projects').where({ key }).first()) as ProjectRow | undefined;
    if (!row) {
      throw new Error(`Failed to load project after upsert: ${key}`);
    }
    return rowToProject(row);
  }

  async createProject(name: string, projectPath?: string): Promise<ProjectContext> {
    const key = normalizeProjectKey(projectPath || name);
    return this.upsertProject({
      key,
      label: name,
      path: projectPath,
    });
  }

  async getProject(projectKey: string): Promise<ProjectContext | null> {
    const key = normalizeProjectKey(projectKey);
    const row = (await this.db<ProjectRow>('projects').where({ key }).first()) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  }

  async getAllProjects(): Promise<ProjectContext[]> {
    const rows = (await this.db<ProjectRow>('projects')
      .select('*')
      .orderBy('updated_at', 'desc')) as ProjectRow[];
    return rows.map(rowToProject);
  }

  async findProjectByPath(projectPath: string): Promise<ProjectContext | null> {
    const key = normalizeProjectKey(projectPath);
    return this.getProject(key);
  }

  async updateProject(projectKey: string, updates: Partial<ProjectContext>): Promise<void> {
    const key = normalizeProjectKey(projectKey);
    const patch: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (typeof updates.name === 'string') {
      patch.name = updates.name;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'path')) {
      patch.path = updates.path || null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'architecture')) {
      patch.architecture = updates.architecture || null;
    }
    if (Array.isArray(updates.techStack)) {
      patch.tech_stack = updates.techStack;
    }

    await this.db('projects').where({ key }).update(patch);
  }

  async upsertProjectMetrics(input: ProjectMetricsInput): Promise<void> {
    const projectKey = normalizeProjectKey(input.projectKey);
    const now = new Date();
    await this.db('project_metrics')
      .insert({
        project_key: projectKey,
        lines_of_code: input.linesOfCode ?? 0,
        file_count: input.fileCount ?? 0,
        last_commit: input.lastCommit ?? null,
        contributors: input.contributors ?? 0,
        hotspots: input.hotspots ?? [],
        complexity: input.complexity ?? null,
        updated_at: now,
      })
      .onConflict('project_key')
      .merge({
        lines_of_code: input.linesOfCode ?? 0,
        file_count: input.fileCount ?? 0,
        last_commit: input.lastCommit ?? null,
        contributors: input.contributors ?? 0,
        hotspots: input.hotspots ?? [],
        complexity: input.complexity ?? null,
        updated_at: now,
      });
  }

  async getProjectMetrics(projectKey: string): Promise<{
    linesOfCode: number;
    fileCount: number;
    lastCommit: string | null;
    contributors: number;
    hotspots: unknown[];
    complexity: string | null;
    updatedAt: Date;
  } | null> {
    const key = normalizeProjectKey(projectKey);
    const row = await this.db('project_metrics').where({ project_key: key }).first();
    if (!row) {
      return null;
    }
    return {
      linesOfCode: Number(row.lines_of_code || 0),
      fileCount: Number(row.file_count || 0),
      lastCommit: row.last_commit ?? null,
      contributors: Number(row.contributors || 0),
      hotspots: Array.isArray(row.hotspots) ? row.hotspots : [],
      complexity: row.complexity ?? null,
      updatedAt: new Date(row.updated_at),
    };
  }

  async close(): Promise<void> {
    await this.db.destroy();
  }
}

function rowToProject(row: ProjectRow): ProjectContext {
  let techStack: string[] = [];
  if (Array.isArray(row.tech_stack)) {
    techStack = row.tech_stack as string[];
  } else if (typeof row.tech_stack === 'string') {
    try {
      const parsed = JSON.parse(row.tech_stack);
      if (Array.isArray(parsed)) {
        techStack = parsed as string[];
      }
    } catch {
      techStack = [];
    }
  }

  return {
    id: row.key,
    name: row.name,
    path: row.path || undefined,
    architecture: row.architecture || undefined,
    techStack,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
