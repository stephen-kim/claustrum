#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const routesRoot = path.join(repoRoot, 'apps', 'memory-core', 'src', 'http', 'routes');
const httpServerFile = path.join(repoRoot, 'apps', 'memory-core', 'src', 'http-server.ts');
const sharedSchemaFile = path.join(repoRoot, 'packages', 'shared', 'src', 'index.ts');
const memoryCorePackagePath = path.join(repoRoot, 'apps', 'memory-core', 'package.json');
const outputPath = path.join(repoRoot, 'apps', 'docs-site', 'public', 'openapi.json');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const methodOrder = new Map(HTTP_METHODS.map((method, index) => [method, index]));

const publicEndpointKeys = new Set([
  'get /healthz',
  'post /v1/auth/login',
  'get /v1/auth/oidc/:workspace_key/start',
  'get /v1/auth/oidc/:workspace_key/callback',
  'get /v1/auth/github/callback',
  'get /v1/invite/:token',
  'post /v1/invite/:token/accept',
  'get /v1/api-keys/one-time/:token',
  'post /v1/webhooks/github',
]);

function collectTsFiles(directory) {
  const files = [];
  if (!fs.existsSync(directory)) {
    return files;
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractEnumValues(arrayText) {
  const values = [];
  const regex = /['"]([^'"]+)['"]/g;
  for (const match of arrayText.matchAll(regex)) {
    values.push(match[1]);
  }
  return values;
}

function extractEnumRegistryFromSource(source) {
  const registry = new Map();
  const enumRegex = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*z\.enum\(\s*(\[[\s\S]*?\])\s*\)/g;

  for (const match of source.matchAll(enumRegex)) {
    const name = match[1];
    const values = extractEnumValues(match[2]);
    if (name && values.length > 0) {
      registry.set(name, { type: 'string', enum: values });
    }
  }

  return registry;
}

function mergeEnumRegistries(...registries) {
  const merged = new Map();
  for (const registry of registries) {
    for (const [key, value] of registry.entries()) {
      merged.set(key, value);
    }
  }
  return merged;
}

function normalizeRoutePath(routePath) {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function operationId(method, routePath) {
  const cleanPath = routePath
    .replace(/^\//, '')
    .replace(/[{}:]/g, '')
    .replace(/\//g, '_')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_');
  return `${method}_${cleanPath}`;
}

function tagForPath(routePath) {
  if (routePath === '/healthz') return 'Health';
  if (routePath.startsWith('/v1/auth/')) return 'Auth';
  if (routePath.startsWith('/v1/workspaces') || routePath.startsWith('/v1/workspace-settings')) return 'Workspace';
  if (routePath.startsWith('/v1/projects') || routePath === '/v1/resolve-project' || routePath === '/v1/session/select') return 'Project';
  if (routePath.startsWith('/v1/memories') || routePath.startsWith('/v1/decisions')) return 'Memory';
  if (routePath.startsWith('/v1/context/')) return 'Context';
  if (routePath.startsWith('/v1/imports')) return 'Import';
  if (routePath.startsWith('/v1/raw') || routePath.startsWith('/v1/raw-events')) return 'Raw';
  if (routePath.startsWith('/v1/api-keys') || routePath.startsWith('/v1/invite') || routePath.includes('/members') || routePath.startsWith('/v1/users') || routePath.startsWith('/v1/project-members')) return 'Access';
  if (routePath.includes('/github') || routePath === '/v1/webhooks/github') return 'GitHub';
  if (routePath.startsWith('/v1/audit') || routePath.startsWith('/v1/detection') || routePath.startsWith('/v1/detections')) return 'Audit';
  if (routePath.startsWith('/v1/notion') || routePath.startsWith('/v1/jira') || routePath.startsWith('/v1/confluence') || routePath.startsWith('/v1/linear') || routePath === '/v1/integrations') return 'Integrations';
  if (routePath.startsWith('/v1/decision-keyword-policies') || routePath.startsWith('/v1/global-rules') || routePath.startsWith('/v1/extraction-settings') || routePath.startsWith('/v1/outbound') || routePath.startsWith('/v1/oidc') || routePath.startsWith('/v1/project-mappings') || routePath.startsWith('/v1/monorepo-subproject-policies')) return 'Settings';
  if (routePath.startsWith('/v1/git-events') || routePath.startsWith('/v1/ci-events') || routePath.startsWith('/v1/onboarding')) return 'Events';
  return 'Core';
}

function splitTopLevel(input) {
  const tokens = [];
  let current = '';
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth -= 1;
    if (char === '{') braceDepth += 1;
    if (char === '}') braceDepth -= 1;
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth -= 1;

    if (char === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

function findMatching(source, startIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = startIndex; i < source.length; i += 1) {
    const char = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function extractObjectShapeFromZodObject(expression) {
  const objectMatch = expression.match(/z\s*\.\s*object\s*\(/);
  if (!objectMatch || objectMatch.index == null) {
    return null;
  }

  const objectStart = objectMatch.index;
  const braceStart = expression.indexOf('{', objectStart);
  if (braceStart < 0) {
    return null;
  }

  const braceEnd = findMatching(expression, braceStart, '{', '}');
  if (braceEnd < 0) {
    return null;
  }

  return expression.slice(braceStart + 1, braceEnd);
}

function schemaForIdentifier(identifier, enumRegistry) {
  if (!identifier) {
    return null;
  }
  const known = enumRegistry.get(identifier);
  if (known) {
    return JSON.parse(JSON.stringify(known));
  }
  if (/id$/i.test(identifier)) {
    return { type: 'string' };
  }
  if (/count|limit|ttl|seconds|days|size|weight|alpha|beta|min|max|confidence/i.test(identifier)) {
    return { type: 'number' };
  }
  return { type: 'string' };
}

function inferPrimitiveSchema(rawExpression, enumRegistry) {
  const expression = rawExpression.trim();
  const optional = /\.optional\(\)/.test(expression);
  const nullable = /\.nullable\(\)/.test(expression);

  let schema = null;

  if (/z\s*\.\s*string\s*\(/.test(expression)) {
    schema = { type: 'string' };
    if (/\.uuid\(\)/.test(expression)) {
      schema.format = 'uuid';
    }
    if (/\.datetime\(\)/.test(expression)) {
      schema.format = 'date-time';
    }
  } else if (/z\s*\.\s*(?:coerce\s*\.\s*)?number\s*\(/.test(expression)) {
    schema = { type: /\.int\(\)/.test(expression) ? 'integer' : 'number' };
  } else if (/z\s*\.\s*(?:coerce\s*\.\s*)?boolean\s*\(/.test(expression)) {
    schema = { type: 'boolean' };
  } else if (/z\s*\.\s*record\s*\(/.test(expression)) {
    schema = { type: 'object', additionalProperties: true };
  } else if (/z\s*\.\s*(?:unknown|any)\s*\(/.test(expression)) {
    schema = {};
  } else if (/z\s*\.\s*literal\s*\(/.test(expression)) {
    const literalMatch = expression.match(/z\s*\.\s*literal\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (literalMatch?.[1]) {
      schema = { type: 'string', enum: [literalMatch[1]] };
    }
  } else if (/z\s*\.\s*enum\s*\(/.test(expression)) {
    const enumMatch = expression.match(/z\s*\.\s*enum\s*\(\s*(\[[\s\S]*?\])\s*\)/);
    if (enumMatch?.[1]) {
      const values = extractEnumValues(enumMatch[1]);
      if (values.length > 0) {
        schema = { type: 'string', enum: values };
      }
    }
  } else if (/z\s*\.\s*array\s*\(/.test(expression)) {
    const arrayMatch = expression.match(/z\s*\.\s*array\s*\(/);
    const arrayCallStart = arrayMatch?.index ?? -1;
    const argStart = arrayCallStart >= 0 ? expression.indexOf('(', arrayCallStart) : -1;
    const argEnd = findMatching(expression, argStart, '(', ')');
    let items = { type: 'string' };
    if (argStart >= 0 && argEnd > argStart) {
      const inner = expression.slice(argStart + 1, argEnd);
      items = inferPrimitiveSchema(inner, enumRegistry).schema ?? { type: 'string' };
    }
    schema = { type: 'array', items };
  } else {
    const identifierMatch = expression.match(/^([A-Za-z_$][\w$]*)/);
    if (identifierMatch?.[1]) {
      schema = schemaForIdentifier(identifierMatch[1], enumRegistry);
    }
  }

  if (!schema) {
    schema = { type: 'string' };
  }

  if (nullable) {
    schema.nullable = true;
  }

  return { schema, optional };
}

function parseObjectSchema(shapeText, enumRegistry) {
  const properties = {};
  const required = [];

  const entries = splitTopLevel(shapeText);
  for (const entry of entries) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim().replace(/,$/, '');
    const expression = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    const parsed = inferPrimitiveSchema(expression, enumRegistry);
    properties[key] = parsed.schema;
    if (!parsed.optional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function schemaFromExpression(expression, enumRegistry) {
  const trimmed = String(expression || '').trim();
  if (!trimmed) {
    return null;
  }

  const objectShape = extractObjectShapeFromZodObject(trimmed);
  if (objectShape != null) {
    return parseObjectSchema(objectShape, enumRegistry);
  }

  return inferPrimitiveSchema(trimmed, enumRegistry).schema;
}

function parseValidationSchemas(routeBlock, enumRegistry) {
  const result = {};
  const parseRegex = /(?:const|let|var)\s+\w+\s*=\s*([\s\S]*?)\.parse\(req\.(body|query|params)\s*\)/g;

  for (const match of routeBlock.matchAll(parseRegex)) {
    const expression = match[1];
    const target = match[2];
    const schema = schemaFromExpression(expression, enumRegistry);
    if (!schema) {
      continue;
    }
    result[target] = schema;
  }

  return result;
}

function extractRouteDefinitionsFromFile(filePath, sharedEnumRegistry) {
  const source = fs.readFileSync(filePath, 'utf8');
  const localEnumRegistry = extractEnumRegistryFromSource(source);
  const enumRegistry = mergeEnumRegistries(sharedEnumRegistry, localEnumRegistry);

  const routeRegex = /app\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]/g;
  const matches = [];

  for (const match of source.matchAll(routeRegex)) {
    matches.push({
      method: String(match[1] || '').toLowerCase(),
      routePath: String(match[2] || '').trim(),
      index: match.index ?? 0,
      filePath: path.relative(repoRoot, filePath),
    });
  }

  const routes = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    if (!HTTP_METHODS.includes(current.method)) {
      continue;
    }
    if (current.routePath !== '/healthz' && !current.routePath.startsWith('/v1/')) {
      continue;
    }

    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const routeBlock = source.slice(current.index, nextIndex);
    const validations = parseValidationSchemas(routeBlock, enumRegistry);
    const usesReqBody = /req\.body/.test(routeBlock);

    const statusMatch = routeBlock.match(/res\.status\((\d{3})\)/);
    const successStatus = statusMatch?.[1] ?? '200';

    routes.push({
      method: current.method,
      routePath: current.routePath,
      filePath: current.filePath,
      validations,
      usesReqBody,
      successStatus,
    });
  }

  return routes;
}

function buildPathParameters(routePath, paramsSchema) {
  const params = [];
  const seen = new Set();

  for (const match of routePath.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const name = match[1];
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);

    const schemaFromValidation = paramsSchema?.properties?.[name];
    params.push({
      name,
      in: 'path',
      required: true,
      schema: schemaFromValidation ? JSON.parse(JSON.stringify(schemaFromValidation)) : { type: 'string' },
    });
  }

  return params;
}

function buildQueryParameters(querySchema) {
  if (!querySchema || querySchema.type !== 'object' || !querySchema.properties) {
    return [];
  }

  const requiredSet = new Set(querySchema.required || []);
  return Object.entries(querySchema.properties).map(([name, schema]) => ({
    name,
    in: 'query',
    required: requiredSet.has(name),
    schema: JSON.parse(JSON.stringify(schema)),
  }));
}

function buildOpenApi(routes) {
  const memoryCoreVersion = JSON.parse(fs.readFileSync(memoryCorePackagePath, 'utf8')).version || '0.1.0';

  const sortedRoutes = [...routes].sort((a, b) => {
    if (a.routePath !== b.routePath) {
      return a.routePath.localeCompare(b.routePath);
    }
    return (methodOrder.get(a.method) ?? 99) - (methodOrder.get(b.method) ?? 99);
  });

  const paths = {};
  const tagSet = new Set();
  let bodySchemaCount = 0;
  let querySchemaCount = 0;

  for (const route of sortedRoutes) {
    const openApiPath = normalizeRoutePath(route.routePath);
    const routeTag = tagForPath(route.routePath);
    tagSet.add(routeTag);

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    const pathParams = buildPathParameters(route.routePath, route.validations.params);
    const queryParams = buildQueryParameters(route.validations.query);
    const parameters = [...pathParams, ...queryParams];

    const key = `${route.method} ${route.routePath}`.toLowerCase();
    const isPublic = publicEndpointKeys.has(key);

    const operation = {
      tags: [routeTag],
      summary: `${route.method.toUpperCase()} ${route.routePath}`,
      operationId: operationId(route.method, openApiPath),
      responses: {
        [route.successStatus]: { description: 'Success' },
        400: { description: 'Bad request' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        500: {
          description: 'Server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(isPublic ? { security: [] } : {}),
      'x-source-file': route.filePath,
    };

    if (route.validations.body) {
      bodySchemaCount += 1;
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: route.validations.body,
          },
        },
      };
    } else if (route.usesReqBody && ['post', 'put', 'patch'].includes(route.method)) {
      operation.requestBody = {
        required: false,
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true },
          },
        },
      };
    }

    if (queryParams.length > 0) {
      querySchemaCount += 1;
    }

    paths[openApiPath][route.method] = operation;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Claustrum Memory Core API',
      version: memoryCoreVersion,
      description: 'Auto-generated from memory-core route declarations and inline Zod validations.',
    },
    servers: [{ url: 'http://localhost:8080', description: 'Local development' }],
    security: [{ bearerAuth: [] }],
    tags: [...tagSet].sort().map((name) => ({ name })),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: {},
              },
              required: ['code', 'message'],
            },
          },
          required: ['error'],
        },
      },
    },
    paths,
    'x-generated-at': new Date().toISOString(),
    'x-generated-from': ['apps/memory-core/src/http/routes/**/*.ts', 'apps/memory-core/src/http-server.ts'],
    'x-generated-stats': {
      endpointCount: sortedRoutes.length,
      bodySchemaCount,
      querySchemaCount,
    },
  };
}

function main() {
  const routeFiles = collectTsFiles(routesRoot);
  const sharedSource = fs.existsSync(sharedSchemaFile) ? fs.readFileSync(sharedSchemaFile, 'utf8') : '';
  const sharedEnumRegistry = extractEnumRegistryFromSource(sharedSource);

  const inputs = [...routeFiles, httpServerFile].filter((filePath) => fs.existsSync(filePath));
  const routeMap = new Map();

  for (const filePath of inputs) {
    const extracted = extractRouteDefinitionsFromFile(filePath, sharedEnumRegistry);
    for (const route of extracted) {
      routeMap.set(`${route.method} ${route.routePath}`, route);
    }
  }

  if (routeMap.size === 0) {
    throw new Error('No API routes found while generating OpenAPI spec.');
  }

  const debugRouteKey = String(process.env.OPENAPI_DEBUG_ROUTE || '').trim().toLowerCase();
  if (debugRouteKey) {
    const debugRoute = routeMap.get(debugRouteKey);
    process.stderr.write(
      `[openapi][debug] ${debugRouteKey} -> ${JSON.stringify(
        debugRoute
          ? {
              filePath: debugRoute.filePath,
              usesReqBody: debugRoute.usesReqBody,
              validations: debugRoute.validations,
            }
          : null,
        null,
        2,
      )}\n`,
    );
  }

  const output = buildOpenApi([...routeMap.values()]);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  process.stderr.write(
    `[openapi] Generated ${routeMap.size} endpoints (body schemas: ${output['x-generated-stats'].bodySchemaCount}, query schemas: ${output['x-generated-stats'].querySchemaCount}) -> ${path.relative(repoRoot, outputPath)}\n`,
  );
}

main();
