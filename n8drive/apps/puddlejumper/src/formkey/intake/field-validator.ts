import type { FormField } from '../types.js';

export interface ValidationError {
  code: string;
  fieldId: string;
  [key: string]: unknown;
}

export function validateFields(
  submitted: Record<string, unknown>,
  fieldDefs: FormField[],
  submittedAt?: string
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const fieldIds = new Set(fieldDefs.map(f => f.id));

  // Check timestamp skew
  if (submittedAt) {
    const submittedMs = Date.parse(submittedAt);
    if (!isNaN(submittedMs)) {
      const nowMs = Date.now();
      const diffMs = Math.abs(nowMs - submittedMs);
      if (diffMs > 30000) {
        errors.push({
          code: 'SUBMISSION_TIMESTAMP_SKEW',
          fieldId: '_meta',
          serverTs: new Date().toISOString(),
          diffMs,
        });
      }
    }
  }

  // Check for unknown fields
  for (const key of Object.keys(submitted)) {
    if (!fieldIds.has(key)) {
      errors.push({ code: 'FIELD_UNKNOWN', fieldId: key });
    }
  }

  for (const field of fieldDefs) {
    const value = submitted[field.id];
    const missing = value === undefined || value === null || value === '';

    // Required check
    if (field.required && missing) {
      errors.push({ code: 'FIELD_REQUIRED', fieldId: field.id });
      continue;
    }

    if (missing) continue;

    // Type validation
    switch (field.type) {
      case 'number': {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push({ code: 'FIELD_TYPE_INVALID', fieldId: field.id, expected: 'number' });
          break;
        }
        if (field.validation?.min !== undefined && num < field.validation.min) {
          errors.push({ code: 'FIELD_MIN_VIOLATED', fieldId: field.id, min: field.validation.min, actual: num });
        }
        if (field.validation?.max !== undefined && num > field.validation.max) {
          errors.push({ code: 'FIELD_MAX_VIOLATED', fieldId: field.id, max: field.validation.max, actual: num });
        }
        break;
      }
      case 'date': {
        if (isNaN(Date.parse(String(value)))) {
          errors.push({ code: 'FIELD_TYPE_INVALID', fieldId: field.id, expected: 'date' });
        }
        break;
      }
      case 'checkbox': {
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push({ code: 'FIELD_TYPE_INVALID', fieldId: field.id, expected: 'boolean' });
        }
        break;
      }
      case 'select': {
        if (field.validation?.allowedValues && !field.validation.allowedValues.includes(String(value))) {
          errors.push({ code: 'FIELD_VALUE_NOT_ALLOWED', fieldId: field.id, allowedValues: field.validation.allowedValues });
        }
        break;
      }
      case 'multiselect': {
        const arr = Array.isArray(value) ? value : [value];
        if (field.validation?.allowedValues) {
          const invalid = arr.filter(v => !field.validation!.allowedValues!.includes(String(v)));
          if (invalid.length > 0) {
            errors.push({ code: 'FIELD_VALUE_NOT_ALLOWED', fieldId: field.id, invalidValues: invalid, allowedValues: field.validation.allowedValues });
          }
        }
        break;
      }
      case 'file': {
        if (typeof value === 'object' && value !== null) {
          const file = value as { name?: string; type?: string; sizeMb?: number };
          if (field.validation?.fileTypes && file.type && !field.validation.fileTypes.includes(file.type)) {
            errors.push({ code: 'FIELD_FILE_TYPE_INVALID', fieldId: field.id, allowedTypes: field.validation.fileTypes, actual: file.type });
          }
          if (field.validation?.maxFileSizeMb !== undefined && file.sizeMb !== undefined && file.sizeMb > field.validation.maxFileSizeMb) {
            errors.push({ code: 'FIELD_FILE_TOO_LARGE', fieldId: field.id, maxMb: field.validation.maxFileSizeMb, actualMb: file.sizeMb });
          }
        }
        break;
      }
      default: {
        // text, email, textarea
        const str = String(value);
        if (field.validation?.minLength !== undefined && str.length < field.validation.minLength) {
          errors.push({ code: 'FIELD_MIN_LENGTH_VIOLATED', fieldId: field.id, minLength: field.validation.minLength, actual: str.length });
        }
        if (field.validation?.maxLength !== undefined && str.length > field.validation.maxLength) {
          errors.push({ code: 'FIELD_MAX_LENGTH_VIOLATED', fieldId: field.id, maxLength: field.validation.maxLength, actual: str.length });
        }
        if (field.validation?.pattern) {
          const re = new RegExp(field.validation.pattern);
          if (!re.test(str)) {
            errors.push({ code: 'FIELD_PATTERN_MISMATCH', fieldId: field.id, pattern: field.validation.pattern });
          }
        }
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
