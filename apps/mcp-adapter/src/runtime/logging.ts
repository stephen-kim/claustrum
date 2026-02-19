import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { appendFile } from 'node:fs/promises';
import {
  MAX_ERROR_LOG_BYTES,
  MAX_INFO_LOG_BYTES,
  MAX_TOTAL_LOG_BYTES,
  type RuntimeLogLevel,
} from './constants.js';
import { maskSensitive } from './mask.js';

const LEVEL_SCORE: Record<RuntimeLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type FileLoggerOptions = {
  logsDir: string;
  level: RuntimeLogLevel;
  maxInfoBytes?: number;
  maxErrorBytes?: number;
  maxTotalBytes?: number;
  writeToStderr?: boolean;
};

export class RuntimeFileLogger {
  private queue: Promise<void> = Promise.resolve();
  private readonly maxInfoBytes: number;
  private readonly maxErrorBytes: number;
  private readonly maxTotalBytes: number;

  constructor(private readonly options: FileLoggerOptions) {
    this.maxInfoBytes = options.maxInfoBytes ?? MAX_INFO_LOG_BYTES;
    this.maxErrorBytes = options.maxErrorBytes ?? MAX_ERROR_LOG_BYTES;
    this.maxTotalBytes = options.maxTotalBytes ?? MAX_TOTAL_LOG_BYTES;
  }

  debug(message: string, ...args: unknown[]): void {
    this.enqueue('debug', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.enqueue('info', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.enqueue('warn', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.enqueue('error', message, args);
  }

  async drain(): Promise<void> {
    await this.queue;
  }

  private enqueue(level: RuntimeLogLevel, message: string, args: unknown[]): void {
    if (LEVEL_SCORE[level] < LEVEL_SCORE[this.options.level]) {
      return;
    }
    this.queue = this.queue
      .then(async () => {
        await mkdir(this.options.logsDir, { recursive: true });
        const now = new Date().toISOString();
        const argText = args.length > 0 ? ` ${args.map((item) => maskSensitive(item)).join(' ')}` : '';
        const line = `[claustrum-mcp:${level}] ${now} ${maskSensitive(message)}${argText}`;
        const fileName = level === 'error' ? 'error.log' : 'adapter.log';
        const filePath = path.join(this.options.logsDir, fileName);
        const maxBytes = level === 'error' ? this.maxErrorBytes : this.maxInfoBytes;

        await this.rotateIfNeeded(filePath, maxBytes);
        await appendFile(filePath, `${line}\n`, 'utf8');
        await this.enforceTotalSizeLimit();

        if (this.options.writeToStderr !== false) {
          process.stderr.write(`${line}\n`);
        }
      })
      .catch((error) => {
        process.stderr.write(`[claustrum-mcp:error] logger failure ${maskSensitive(error)}\n`);
      });
  }

  private async rotateIfNeeded(filePath: string, maxBytes: number): Promise<void> {
    let currentSize = 0;
    try {
      const info = await stat(filePath);
      currentSize = info.size;
    } catch {
      currentSize = 0;
    }
    if (currentSize < maxBytes) {
      return;
    }

    const secondary = `${filePath}.2`;
    const primary = `${filePath}.1`;
    await rm(secondary, { force: true });
    try {
      await rename(primary, secondary);
    } catch {
      // noop
    }
    try {
      await rename(filePath, primary);
    } catch {
      // noop
    }
  }

  private async enforceTotalSizeLimit(): Promise<void> {
    const entries = await readdir(this.options.logsDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const fullPath = path.join(this.options.logsDir, entry.name);
          const info = await stat(fullPath);
          return {
            fullPath,
            size: info.size,
            mtimeMs: info.mtimeMs,
            name: entry.name,
          };
        })
    );

    let total = files.reduce((sum, file) => sum + file.size, 0);
    if (total <= this.maxTotalBytes) {
      return;
    }

    files.sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const file of files) {
      if (total <= this.maxTotalBytes) {
        break;
      }
      await rm(file.fullPath, { force: true });
      total -= file.size;
    }
  }
}
