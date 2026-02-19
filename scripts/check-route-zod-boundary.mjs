#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROUTES_DIR = path.resolve(process.cwd(), 'apps/memory-core/src/http/routes');
const IGNORE_MARKER = 'zod-boundary-ignore-line';

const forbiddenPatterns = [
  {
    re: /\binput\s*:\s*req\.(body|query|params)\b/,
    message: 'Do not pass req.* directly to service input. Parse with Zod first.',
  },
];

function collectFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function toRelative(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, '/');
}

function main() {
  if (!fs.existsSync(ROUTES_DIR)) {
    console.error(`[zod-boundary] routes directory not found: ${ROUTES_DIR}`);
    process.exit(1);
  }

  const routeFiles = collectFiles(ROUTES_DIR);
  const violations = [];

  for (const filePath of routeFiles) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (line.includes(IGNORE_MARKER)) {
        return;
      }
      for (const pattern of forbiddenPatterns) {
        if (pattern.re.test(line)) {
          violations.push({
            file: toRelative(filePath),
            line: index + 1,
            message: pattern.message,
            source: line.trim(),
          });
        }
      }
    });
  }

  if (violations.length === 0) {
    console.log('[zod-boundary] OK: all memory-core routes validate ingress before service input.');
    return;
  }

  console.error('[zod-boundary] Found route validation boundary violations:');
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} ${violation.message}\n  ${violation.source}`
    );
  }
  process.exit(1);
}

main();
