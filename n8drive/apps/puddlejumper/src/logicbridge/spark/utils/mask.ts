// spark.utils.mask

const MASK_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  { name: 'SSN',      regex: /\b\d{3}-\d{2}-\d{4}\b/g,             replacement: '[SSN-MASKED]' },
  { name: 'EMAIL',    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL-MASKED]' },
  { name: 'PHONE',    regex: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, replacement: '[PHONE-MASKED]' },
  { name: 'CARD',     regex: /\b(?:\d[ -]*?){13,16}\b/g,           replacement: '[CARD-MASKED]' },
];

export function createSparkMask() {
  return {
    text(value: string, types?: string[]): string {
      let result = value;
      for (const p of MASK_PATTERNS) {
        if (!types || types.includes(p.name)) {
          p.regex.lastIndex = 0;
          result = result.replace(p.regex, p.replacement);
        }
      }
      return result;
    },
    object<T extends Record<string, unknown>>(obj: T, fields: string[]): T {
      const copy: Record<string, unknown> = { ...obj };
      for (const field of fields) {
        if (field in copy && typeof copy[field] === 'string') {
          copy[field] = '[MASKED]';
        }
      }
      return copy as T;
    },
  };
}
