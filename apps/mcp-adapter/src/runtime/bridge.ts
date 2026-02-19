import { RuntimeFileLogger } from './logging.js';
import { postJsonWithRetry, type FetchLike } from './http.js';
import { maskSensitive } from './mask.js';

type BridgeConfig = {
  baseUrl: string;
  apiKey: string;
  bearerToken: string;
  workspaceKey?: string;
  deviceLabel?: string;
  timeoutMs: number;
  retryCount: number;
};

type JsonRpcEnvelope = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

function buildAuthHeader(config: BridgeConfig): Record<string, string> {
  const out: Record<string, string> = {};
  if (config.apiKey) {
    out.authorization = `Bearer ${config.apiKey}`;
  } else if (config.bearerToken) {
    out.authorization = `Bearer ${config.bearerToken}`;
  }
  if (config.workspaceKey) {
    out['x-claustrum-workspace-key'] = config.workspaceKey;
  }
  if (config.deviceLabel) {
    out['x-claustrum-device-label'] = config.deviceLabel;
  }
  return out;
}

function makeJsonRpcError(request: JsonRpcEnvelope, code: number, message: string, data?: unknown): JsonRpcEnvelope {
  return {
    jsonrpc: '2.0',
    id: request.id ?? null,
    error: {
      code,
      message,
      data,
    },
  };
}

export async function proxyJsonRpcRequest(args: {
  request: JsonRpcEnvelope;
  config: BridgeConfig;
  logger: RuntimeFileLogger;
  fetchImpl?: FetchLike;
}): Promise<JsonRpcEnvelope | null> {
  const { request, config, logger } = args;
  const fetchImpl = args.fetchImpl || fetch;

  try {
    const response = await postJsonWithRetry<JsonRpcEnvelope>({
      fetchImpl,
      url: `${config.baseUrl}/v1/mcp`,
      body: request,
      headers: {
        ...buildAuthHeader(config),
      },
      timeoutMs: config.timeoutMs,
      retryCount: config.retryCount,
    });

    if (!response.ok) {
      logger.warn('Upstream returned non-2xx for MCP request', response.status, response.bodyText);
      if (response.status === 401 || response.status === 403) {
        return makeJsonRpcError(
          request,
          -32004,
          'Claustrum API key is invalid, expired, or revoked. Run: claustrum-mcp login --api-key <key>',
          { status: response.status }
        );
      }
      return makeJsonRpcError(request, -32001, 'Upstream returned non-success status.', {
        status: response.status,
      });
    }

    return response.payload;
  } catch (error) {
    logger.error('Upstream request failed', error);
    if (request.id === undefined) {
      return null;
    }
    return makeJsonRpcError(request, -32098, 'Unable to reach Claustrum MCP gateway.', {
      reason: maskSensitive(error),
    });
  }
}

function writeFramedPayload(payload: JsonRpcEnvelope): void {
  const text = JSON.stringify(payload);
  const bytes = Buffer.byteLength(text, 'utf8');
  process.stdout.write(`Content-Length: ${bytes}\r\n\r\n${text}`);
}

function parseContentLength(header: string): number | null {
  const line = header
    .split(/\r?\n/)
    .find((entry) => entry.toLowerCase().startsWith('content-length:'));
  if (!line) {
    return null;
  }
  const length = Number.parseInt(line.split(':')[1]?.trim() || '', 10);
  if (!Number.isFinite(length) || length < 0) {
    return null;
  }
  return length;
}

export async function runStdioBridge(args: {
  config: BridgeConfig;
  logger: RuntimeFileLogger;
  fetchImpl?: FetchLike;
}): Promise<void> {
  const queue: JsonRpcEnvelope[] = [];
  let processing = false;
  let buffer = Buffer.alloc(0);

  async function drainQueue() {
    if (processing) {
      return;
    }
    processing = true;
    while (queue.length > 0) {
      const request = queue.shift() as JsonRpcEnvelope;
      const response = await proxyJsonRpcRequest({
        request,
        config: args.config,
        logger: args.logger,
        fetchImpl: args.fetchImpl,
      });
      if (response) {
        writeFramedPayload(response);
      }
    }
    processing = false;
  }

  process.stdin.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length > 0) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) {
        break;
      }
      const headerText = buffer.slice(0, headerEnd).toString('utf8');
      const contentLength = parseContentLength(headerText);
      if (contentLength === null) {
        args.logger.error('Invalid MCP frame: missing or invalid Content-Length header.');
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      const frameEnd = headerEnd + 4 + contentLength;
      if (buffer.length < frameEnd) {
        break;
      }

      const payloadText = buffer.slice(headerEnd + 4, frameEnd).toString('utf8');
      buffer = buffer.slice(frameEnd);

      try {
        const parsed = JSON.parse(payloadText) as JsonRpcEnvelope;
        queue.push(parsed);
      } catch (error) {
        args.logger.error('Invalid JSON payload on stdin frame', error);
      }
    }

    void drainQueue();
  });

  process.stdin.on('error', (error) => {
    args.logger.error('stdin stream failure', error);
  });

  process.stdin.resume();

  await new Promise<void>((resolve) => {
    process.stdin.on('end', () => resolve());
  });
}
