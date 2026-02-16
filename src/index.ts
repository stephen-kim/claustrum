#!/usr/bin/env node

import { ContextSyncServer } from './server.js';
import { logger } from './logger.js';

async function main() {
  const databaseUrlIndex = process.argv.indexOf('--database-url');
  if (databaseUrlIndex !== -1 && process.argv[databaseUrlIndex + 1]) {
    process.env.DATABASE_URL = process.argv[databaseUrlIndex + 1];
  }

  const legacyDbPathIndex = process.argv.indexOf('--db-path');
  if (legacyDbPathIndex !== -1) {
    logger.warn('`--db-path` is deprecated and ignored. Use DATABASE_URL or CONTEXT_SYNC_DB_* variables.');
  }

  const server = new ContextSyncServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down Context Sync...');
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down Context Sync...');
    server.close();
    process.exit(0);
  });

  await server.run();
}

main().catch((error) => {
  logger.error('Failed to start Context Sync:', error);
  process.exit(1);
});
