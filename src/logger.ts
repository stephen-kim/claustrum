type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_SCORE: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function normalizeLevel(input?: string): LogLevel {
  const value = (input || '').toLowerCase();
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error' || value === 'silent') {
    return value;
  }
  return 'error';
}

const configuredLevel = normalizeLevel(
  process.env.CONTEXT_SYNC_LOG_LEVEL || process.env.LOG_LEVEL
);

function shouldLog(level: LogLevel): boolean {
  return LEVEL_SCORE[level] >= LEVEL_SCORE[configuredLevel];
}

function write(level: LogLevel, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) {
    return;
  }
  const line = `[context-sync:${level}] ${message}`;
  if (args.length > 0) {
    console.error(line, ...args);
    return;
  }
  console.error(line);
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    write('debug', message, ...args);
  },
  info(message: string, ...args: unknown[]): void {
    write('info', message, ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    write('warn', message, ...args);
  },
  error(message: string, ...args: unknown[]): void {
    write('error', message, ...args);
  },
  level: configuredLevel,
};

export type { LogLevel };
