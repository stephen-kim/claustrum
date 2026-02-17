import knex from 'knex';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { resolveDatabaseConnection } from './db/db-connection.js';

async function runMigrations(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.resolve(__dirname, '..', 'migrations');

  const db = knex({
    client: 'pg',
    connection: resolveDatabaseConnection(),
    migrations: {
      directory: migrationsDir,
      tableName: 'context_sync_migrations',
    },
  });

  try {
    const [batchNo, log] = await db.migrate.latest();
    console.error(`[claustrum:migrate] batch ${batchNo} applied (${log.length} migration(s)).`);
    if (log.length > 0) {
      for (const migration of log) {
        console.error(`[claustrum:migrate] - ${migration}`);
      }
    }
  } finally {
    await db.destroy();
  }
}

runMigrations().catch((error) => {
  console.error('[claustrum:migrate] failed:', error);
  process.exit(1);
});
