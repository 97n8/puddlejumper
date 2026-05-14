import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ConsentStamp } from '../types.js';
import type { SealToken } from '../../seal/types.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS formkey_consent_stamps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  form_version TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  consent_record_id TEXT NOT NULL,
  intake_seal_token TEXT NOT NULL,
  stamped_at TEXT NOT NULL
);
`;

let _db: Database.Database | null = null;

export function initConsentStampStore(db: Database.Database): void {
  _db = db;
  db.exec(SCHEMA);
}

function getDb(): Database.Database {
  if (!_db) throw new Error('FormKey consent stamp store not initialized');
  return _db;
}

export function createConsentStamp(
  tenantId: string,
  formId: string,
  formVersion: string,
  submissionId: string,
  consentRecordId: string,
  intakeSealToken: SealToken
): ConsentStamp {
  const db = getDb();
  const id = crypto.randomUUID();
  const stampedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO formkey_consent_stamps
      (id, tenant_id, form_id, form_version, submission_id, consent_record_id, intake_seal_token, stamped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tenantId, formId, formVersion, submissionId, consentRecordId, JSON.stringify(intakeSealToken), stampedAt);

  return {
    id,
    tenantId,
    formId,
    formVersion,
    submissionId,
    consentRecordId,
    intakeSealToken,
    stampedAt,
  };
}
