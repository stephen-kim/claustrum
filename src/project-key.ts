/**
 * Normalizes a logical project key.
 * Keys are logical identifiers, not filesystem paths.
 */
export function normalizeProjectKey(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new Error('Project key cannot be empty');
  }

  return value.toLowerCase();
}
