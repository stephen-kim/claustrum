/**
 * Knex was chosen for this project because it keeps migrations simple and SQL-first,
 * while still giving us portable transaction handling and connection pooling.
 */

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('projects', (table) => {
    table.text('key').primary();
    table.text('name').notNullable();
    table.text('path').nullable();
    table.text('architecture').nullable();
    table.jsonb('tech_stack').notNullable().defaultTo('[]');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('project_metrics', (table) => {
    table.text('project_key').primary().references('projects.key').onDelete('CASCADE');
    table.integer('lines_of_code').notNullable().defaultTo(0);
    table.integer('file_count').notNullable().defaultTo(0);
    table.text('last_commit').nullable();
    table.integer('contributors').notNullable().defaultTo(0);
    table.jsonb('hotspots').notNullable().defaultTo('[]');
    // NULL allowed to avoid legacy NOT NULL migration failures.
    table.text('complexity').nullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('memory_entries', (table) => {
    table.text('id').primary();
    table.text('project_key').notNullable().references('projects.key').onDelete('CASCADE');
    table
      .enu('type', ['active_work', 'constraint', 'problem', 'goal', 'decision', 'note', 'caveat'], {
        useNative: true,
        enumName: 'memory_type',
      })
      .notNullable();
    table.text('content').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.text('status').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_memory_entries_scope_type_created ON memory_entries(project_key, type, created_at DESC)'
  );
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_memory_entries_scope_created ON memory_entries(project_key, created_at DESC)'
  );
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_memory_entries_type_created ON memory_entries(type, created_at DESC)'
  );
  // Baseline index for case-insensitive search patterns.
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_memory_entries_content_lower ON memory_entries (lower(content))'
  );

  // Optional trigram index for broader ILIKE patterns when extension is permitted.
  await knex.schema.raw(`
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END $$;
`);

  await knex.schema.raw(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_memory_entries_content_trgm ON memory_entries USING gin (content gin_trgm_ops)';
  END IF;
END $$;
`);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_memory_entries_content_trgm');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_memory_entries_content_lower');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_memory_entries_type_created');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_memory_entries_scope_created');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_memory_entries_scope_type_created');
  await knex.schema.dropTableIfExists('memory_entries');
  await knex.schema.raw('DROP TYPE IF EXISTS memory_type');
  await knex.schema.dropTableIfExists('project_metrics');
  await knex.schema.dropTableIfExists('projects');
};
