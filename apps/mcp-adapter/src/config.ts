import { z } from 'zod';
import { type LogLevel } from './logger.js';

export type McpAdapterConfig = {
  memoryCoreUrl: string;
  memoryCoreApiKey: string;
  defaultWorkspaceKey: string;
  logLevel: LogLevel;
};

const configSchema = z
  .object({
    MEMORY_CORE_URL: z.string().trim().url('MEMORY_CORE_URL must be a valid URL'),
    MEMORY_CORE_API_KEY: z.string().trim().min(1, 'MEMORY_CORE_API_KEY is required'),
    MEMORY_CORE_WORKSPACE_KEY: z.string().trim().min(1).optional(),
    MCP_ADAPTER_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),
  })
  .passthrough();

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpAdapterConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid MCP adapter configuration: ${details}`);
  }

  const values = parsed.data;
  return {
    memoryCoreUrl: values.MEMORY_CORE_URL.replace(/\/+$/, ''),
    memoryCoreApiKey: values.MEMORY_CORE_API_KEY,
    defaultWorkspaceKey: values.MEMORY_CORE_WORKSPACE_KEY || 'personal',
    logLevel: values.MCP_ADAPTER_LOG_LEVEL || 'error',
  };
}
