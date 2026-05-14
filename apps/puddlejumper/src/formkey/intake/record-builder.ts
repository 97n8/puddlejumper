import crypto from 'node:crypto';
import type { FormDefinition, IntakeRecord, GovernanceEnvelope } from '../types.js';
import type { SealToken } from '../../seal/types.js';

function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

export function buildIntakeRecord(
  form: FormDefinition,
  fields: Record<string, unknown>,
  sealToken: SealToken,
  submissionId: string,
  consentStampId: string | null
): IntakeRecord {
  const now = new Date().toISOString();

  // Map fields through vaultMapping.fieldMap
  const mappedFields: Record<string, unknown> = {};
  for (const [fieldId, path] of Object.entries(form.vaultMapping.fieldMap)) {
    if (fields[fieldId] !== undefined) {
      setNested(mappedFields, path, fields[fieldId]);
    }
  }

  // Include unmapped fields at top level
  for (const [fieldId, value] of Object.entries(fields)) {
    if (!form.vaultMapping.fieldMap[fieldId]) {
      mappedFields[fieldId] = value;
    }
  }

  const governance: GovernanceEnvelope = {
    purpose: form.purpose ?? '',
    legalBasis: form.legalBasis ?? '',
    retentionTier: form.retentionTier ?? '',
    sensitivity: form.sensitivity,
    dataTypes: form.dataTypes ?? [],
    formId: form.formId,
    formVersion: form.version,
    consentVersion: form.consentConfig?.consentVersion ?? '',
    submittedAt: now,
    intakeSealToken: sealToken,
    consentStampId,
  };

  return {
    id: submissionId,
    tenantId: form.tenantId,
    formId: form.formId,
    formVersion: form.version,
    recordType: form.vaultMapping.recordType,
    namespace: form.vaultMapping.namespace,
    governance,
    fields: mappedFields,
    createdAt: now,
    status: 'received' as const,
  };
}
