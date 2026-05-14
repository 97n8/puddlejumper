import type { FieldMapDef, FederationField, FilterRule, TransformFn, TransformError } from './types.js';

export interface FieldMapResult {
  mapped: Record<string, FederationField>;
  unmapped: Record<string, unknown>;
  errors: TransformError[];
}

export function applyTransform(value: unknown, transform: TransformFn): unknown {
  const str = String(value ?? '');
  switch (transform.type) {
    case 'trim':
      return str.trim();
    case 'lowercase':
      return str.toLowerCase();
    case 'uppercase':
      return str.toUpperCase();
    case 'date-iso': {
      try {
        return new Date(str).toISOString();
      } catch {
        return value;
      }
    }
    case 'map-value':
      return transform.mapping[str] ?? value;
    case 'concat':
      // value here is the full source record; we return joined fields
      return str; // caller handles concat via source record
    case 'extract-domain': {
      try {
        const email = str.includes('@') ? str.split('@')[1] : new URL(str).hostname;
        return email;
      } catch {
        return value;
      }
    }
    default:
      return value;
  }
}

export function applyFieldMap(
  sourceRecord: Record<string, unknown>,
  fieldMap: FieldMapDef[]
): FieldMapResult {
  const mapped: Record<string, FederationField> = {};
  const errors: TransformError[] = [];
  const mappedSourceFields = new Set<string>();

  for (const def of fieldMap) {
    mappedSourceFields.add(def.sourceField);
    let rawValue: unknown = sourceRecord[def.sourceField];

    // Handle concat special case
    if (def.transform?.type === 'concat') {
      const parts = def.transform.fields.map(f => String(sourceRecord[f] ?? ''));
      rawValue = parts.join(def.transform.separator ?? ' ');
    }

    if (rawValue === undefined || rawValue === null) {
      if (def.required) {
        errors.push({ field: def.sourceField, message: `Required field '${def.sourceField}' is missing` });
      }
      continue;
    }

    let transformedValue: unknown = rawValue;
    if (def.transform && def.transform.type !== 'concat') {
      try {
        transformedValue = applyTransform(rawValue, def.transform);
      } catch (err) {
        errors.push({ field: def.sourceField, message: `Transform error: ${(err as Error).message}` });
        transformedValue = rawValue;
      }
    }

    mapped[def.targetField] = {
      value: transformedValue,
      piiClass: def.piiClass,
    };
  }

  // Collect unmapped fields
  const unmapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sourceRecord)) {
    if (!mappedSourceFields.has(k)) {
      unmapped[k] = v;
    }
  }

  return { mapped, unmapped, errors };
}

export function evaluateFilterRules(
  record: Record<string, unknown>,
  rules: FilterRule[]
): boolean {
  if (!rules || rules.length === 0) return true;
  return rules.every(rule => {
    const fieldVal = record[rule.field];
    switch (rule.operator) {
      case 'eq': return fieldVal === rule.value;
      case 'neq': return fieldVal !== rule.value;
      case 'contains': return String(fieldVal ?? '').includes(String(rule.value ?? ''));
      case 'not-contains': return !String(fieldVal ?? '').includes(String(rule.value ?? ''));
      case 'exists': return fieldVal !== undefined && fieldVal !== null;
      case 'not-exists': return fieldVal === undefined || fieldVal === null;
      case 'gt': return Number(fieldVal) > Number(rule.value);
      case 'lt': return Number(fieldVal) < Number(rule.value);
      default: return true;
    }
  });
}
