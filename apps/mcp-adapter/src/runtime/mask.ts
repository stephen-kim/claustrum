const MASK = '***';

const REPLACERS: Array<[RegExp, string]> = [
  [/\b(Bearer\s+)[A-Za-z0-9._\-+/=]+/gi, `$1${MASK}`],
  [/\b(api[_-]?key\b\s*[=:]\s*)[^\s,;]+/gi, `$1${MASK}`],
  [/\b(token\b\s*[=:]\s*)[^\s,;]+/gi, `$1${MASK}`],
  [/("authorization"\s*:\s*")[^"]+"/gi, `$1${MASK}"`],
  [/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, `-----BEGIN PRIVATE KEY-----${MASK}-----END PRIVATE KEY-----`],
  [/\b(password\b\s*[=:]\s*)[^\s,;]+/gi, `$1${MASK}`],
  [/(Initial password \(shown once\):\s*)\S+/gi, `$1${MASK}`],
];

export function maskSensitive(value: unknown): string {
  const input = typeof value === 'string' ? value : String(value ?? '');
  return REPLACERS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), input);
}

export function maskObject<T>(obj: T): T {
  return JSON.parse(maskSensitive(JSON.stringify(obj))) as T;
}
