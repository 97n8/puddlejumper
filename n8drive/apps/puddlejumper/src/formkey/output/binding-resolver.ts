import type { IntakeRecord } from '../types.js';

export function resolveFieldPath(record: IntakeRecord, path: string): string | null {
  const parts = path.split('.');
  let current: unknown = record.fields;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (current === null || current === undefined) return null;
  return String(current);
}
