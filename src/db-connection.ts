export function resolveDatabaseConnection(): string {
  const explicit = process.env.DATABASE_URL || process.env.CONTEXT_SYNC_DATABASE_URL;
  if (explicit) {
    return explicit;
  }

  const host = process.env.CONTEXT_SYNC_DB_HOST;
  const port = process.env.CONTEXT_SYNC_DB_PORT || '5432';
  const database = process.env.CONTEXT_SYNC_DB_NAME || 'context_sync';
  const user = process.env.CONTEXT_SYNC_DB_USER;
  const password = process.env.CONTEXT_SYNC_DB_PASSWORD;

  if (!host || !user) {
    throw new Error(
      'DATABASE_URL is required (or set CONTEXT_SYNC_DB_HOST, CONTEXT_SYNC_DB_USER, CONTEXT_SYNC_DB_PASSWORD, CONTEXT_SYNC_DB_NAME).'
    );
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password || '');
  return `postgres://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
}
