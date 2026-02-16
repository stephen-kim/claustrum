import type { LogLevel } from './config.js';

const SCORE: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export class Logger {
  constructor(private readonly level: LogLevel) {}

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write('info', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }

  private write(level: LogLevel, message: string, args: unknown[]): void {
    if (SCORE[level] < SCORE[this.level]) {
      return;
    }
    const line = `[memory-core:${level}] ${message}`;
    if (args.length > 0) {
      console.error(line, ...args);
      return;
    }
    console.error(line);
  }
}
