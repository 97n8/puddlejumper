import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FormSubmissionPayload, SubmissionResult, IntakeRecord } from '../types.js';
import { FormNotFound, FormNotAccepting, FieldValidationFailed, ConsentRequired } from '../types.js';
import { getFormRegistry } from '../index.js';
import { validateFields } from './field-validator.js';
import { verifyConsent } from '../consent/verifier.js';
import { grantConsent, getConsentRecord } from '../consent/store.js';
import { createConsentStamp } from '../consent/stamp.js';
import { sealIntakePayload } from './sealer.js';
import { buildIntakeRecord } from './record-builder.js';
import { fireSynchron8Trigger } from './trigger.js';
import { archieveLog } from '../../archieve/index.js';

const INTAKE_SCHEMA = `
CREATE TABLE IF NOT EXISTS formkey_intake_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  form_version TEXT NOT NULL,
  record_type TEXT NOT NULL,
  namespace TEXT NOT NULL,
  governance TEXT NOT NULL,
  fields TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fk_intake_tenant ON formkey_intake_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fk_intake_form ON formkey_intake_records(tenant_id, form_id);
`;

let _intakeDbInitialized = false;
let _intakeDb: Database.Database | null = null;

export function initIntakeRecordStore(db: Database.Database): void {
  _intakeDb = db;
  if (!_intakeDbInitialized) {
    db.exec(INTAKE_SCHEMA);
    _intakeDbInitialized = true;
  }
}

export function getIntakeDb(): Database.Database {
  if (!_intakeDb) throw new Error('Intake record store not initialized');
  return _intakeDb;
}

export async function processSubmission(
  tenantId: string,
  formId: string,
  payload: FormSubmissionPayload,
  db: Database.Database
): Promise<SubmissionResult> {
  // Step 1: Form lookup from in-memory registry
  const registry = getFormRegistry();
  const tenantForms = registry.get(tenantId);
  const form = tenantForms?.get(formId);

  if (!form) throw new FormNotFound(formId);
  if (form.status !== 'published') throw new FormNotAccepting(formId, form.status);

  // Step 2: Field validation
  const validation = validateFields(payload.fields, form.fields, payload.submittedAt);
  if (!validation.valid) throw new FieldValidationFailed(validation.errors);

  // Step 3: Consent check
  let consentRecordId: string | null = null;
  if (form.consentConfig?.required) {
    const consentVersion = form.consentConfig.consentVersion;
    const check = verifyConsent(tenantId, payload.submitterId, formId, consentVersion);
    if (!check.valid) {
      // Try to auto-grant if consentToken provided in payload
      if (payload.consentToken) {
        const consentRecord = grantConsent(
          tenantId, formId, payload.submitterId, consentVersion,
          payload.consentToken,
          { expiryDays: form.consentConfig.expiryDays }
        );
        consentRecordId = consentRecord.id;
      } else {
        throw new ConsentRequired(formId);
      }
    } else {
      const record = getConsentRecord(tenantId, payload.submitterId, formId, consentVersion);
      consentRecordId = record?.id ?? null;
    }
  }

  // Step 4: Seal the submission
  const submissionId = crypto.randomUUID();
  const sealToken = await sealIntakePayload(form, payload.fields, submissionId);

  // Step 5: Create consent stamp if applicable
  let consentStampId: string | null = null;
  if (consentRecordId) {
    const stamp = createConsentStamp(
      tenantId, formId, form.version, submissionId, consentRecordId, sealToken
    );
    consentStampId = stamp.id;
  }

  // Step 5b: Build VAULT record
  const record = buildIntakeRecord(form, payload.fields, sealToken, submissionId, consentStampId);

  // Step 6: Atomic write — insert intake record + archieveLog in transaction
  const insertStmt = db.prepare(`
    INSERT INTO formkey_intake_records
      (id, tenant_id, form_id, form_version, record_type, namespace, governance, fields, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertStmt.run(
      record.id,
      record.tenantId,
      record.formId,
      record.formVersion,
      record.recordType,
      record.namespace,
      JSON.stringify(record.governance),
      JSON.stringify(record.fields),
      record.createdAt,
    );

    try {
      archieveLog({
        requestId: crypto.randomUUID(),
        tenantId,
        module: 'formkey',
        eventType: 'FORMKEY_INTAKE_SUBMITTED',
        actor: { userId: payload.submitterId, role: payload.submitterType, sessionId: 'formkey-intake' },
        severity: 'info',
        data: { formId, submissionId: record.id },
      });
    } catch (err) {
      console.warn('[formkey] archieveLog error in transaction:', (err as Error).message);
    }
  })();

  // Step 7: Fire SYNCHRON8 trigger (async, don't await, log errors)
  fireSynchron8Trigger(form, record, db).catch(err => {
    console.warn('[formkey] trigger error:', (err as Error).message);
  });

  // Step 8: Return SubmissionResult
  return {
    recordId: record.id,
    intakeSealToken: sealToken,
    submittedAt: record.createdAt,
    retentionTier: form.retentionTier ?? '',
    consentVersion: form.consentConfig?.consentVersion ?? '',
  };
}
