import type { DlpFinding } from './types.js';

// V1 pattern-based DLP engine

const DLP_PATTERNS: Array<{ entityType: string; pattern: RegExp; confidence: 'low' | 'medium' | 'high' }> = [
  {
    entityType: 'EMAIL_ADDRESS',
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    confidence: 'high',
  },
  {
    entityType: 'PHONE_NUMBER',
    pattern: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    confidence: 'medium',
  },
  {
    entityType: 'SSN',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    confidence: 'high',
  },
  {
    entityType: 'FINANCIAL_DATA',
    pattern: /\b(?:\d[ -]*?){13,16}\b/g, // credit card-like
    confidence: 'medium',
  },
  {
    entityType: 'NAME',
    pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    confidence: 'low',
  },
  {
    entityType: 'ADDRESS',
    pattern: /\b\d+\s+[A-Za-z]+\s+(?:St|Ave|Blvd|Rd|Dr|Ln|Ct|Way|Pl)\b/gi,
    confidence: 'medium',
  },
];

export function scan(
  fields: Record<string, unknown>,
  _policy?: unknown
): DlpFinding[] {
  const findings: DlpFinding[] = [];

  for (const [field, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    const str = typeof value === 'string' ? value : JSON.stringify(value);

    for (const def of DLP_PATTERNS) {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(str)) {
        findings.push({ field, entityType: def.entityType, confidence: def.confidence });
      }
    }
  }

  return findings;
}

export function maskValue(value: string, entityType: string): string {
  switch (entityType) {
    case 'EMAIL_ADDRESS': return '[MASKED-EMAIL]';
    case 'PHONE_NUMBER': return '[MASKED-PHONE]';
    case 'SSN': return '[MASKED-SSN]';
    case 'FINANCIAL_DATA': return '[MASKED-FINANCIAL]';
    case 'NAME': return '[MASKED-NAME]';
    case 'ADDRESS': return '[MASKED-ADDRESS]';
    default: return '[MASKED]';
  }
}

export function applyDlp(
  fields: Record<string, unknown>,
  findings: DlpFinding[],
  action: 'mask' | 'redact' | 'block'
): { result: Record<string, unknown>; blocked: boolean } {
  if (findings.length === 0) {
    return { result: fields, blocked: false };
  }

  if (action === 'block') {
    return { result: fields, blocked: true };
  }

  const result = { ...fields };
  const affectedFields = new Set(findings.map(f => f.field));

  for (const field of affectedFields) {
    const finding = findings.find(f => f.field === field);
    if (!finding) continue;
    if (action === 'redact') {
      delete result[field];
    } else if (action === 'mask') {
      const val = result[field];
      result[field] = typeof val === 'string' ? maskValue(val, finding.entityType) : '[MASKED]';
    }
  }

  return { result, blocked: false };
}
