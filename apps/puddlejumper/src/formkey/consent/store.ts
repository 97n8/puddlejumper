import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ConsentRecord } from '../types.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS formkey_consent_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  submitter_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_text_hash TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  expires_at TEXT,
  withdrawn INTEGER NOT NULL DEFAULT 0,
  withdrawn_at TEXT,
  ip_address TEXT,
  user_agent TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fk_consent_unique ON formkey_consent_records(tenant_id, submitter_id, form_id, consent_version);
`;

let _db: Database.Database | null = null;

export function initConsentStore(db: Database.Database): void {
  _db = db;
  db.exec(SCHEMA);
}

function getDb(): Database.Database {
  if (!_db) throw new Error('FormKey consent store not initialized');
  return _db;
}

function rowToConsent(row: Record<string, unknown>): ConsentRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    submitterId: row.submitter_id as string,
    formId: row.form_id as string,
    consentVersion: row.consent_version as string,
    consentTextHash: row.consent_text_hash as string,
    grantedAt: row.granted_at as string,
    expiresAt: (row.expires_at as string | null) ?? undefined,
    withdrawn: (row.withdrawn as number) === 1,
    withdrawnAt: (row.withdrawn_at as string | null) ?? undefined,
    ipAddress: (row.ip_address as string | null) ?? undefined,
    userAgent: (row.user_agent as string | null) ?? undefined,
  };
}

export function grantConsent(
  tenantId: string,
  formId: string,
  submitterId: string,
  consentVersion: string,
  consentTextHash: string,
  opts?: { expiryDays?: number; ipAddress?: string; userAgent?: string }
): ConsentRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let expiresAt: string | null = null;
  if (opts?.expiryDays) {
    const exp = new Date();
    exp.setDate(exp.getDate() + opts.expiryDays);
    expiresAt = exp.toISOString();
  }

  db.prepare(`
    INSERT INTO formkey_consent_records
      (id, tenant_id, submitter_id, form_id, consent_version, consent_text_hash, granted_at, expires_at, withdrawn, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(tenant_id, submitter_id, form_id, consent_version)
    DO UPDATE SET withdrawn = 0, withdrawn_at = NULL, granted_at = excluded.granted_at, expires_at = excluded.expires_at
  `).run(id, tenantId, submitterId, formId, consentVersion, consentTextHash, now, expiresAt, opts?.ipAddress ?? null, opts?.userAgent ?? null);

  return getConsentRecord(tenantId, submitterId, formId, consentVersion) as ConsentRecord;
}

export function getConsentRecord(
  tenantId: string,
  submitterId: string,
  formId: string,
  consentVersion: string
): ConsentRecord | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM formkey_consent_records
    WHERE tenant_id = ? AND submitter_id = ? AND form_id = ? AND consent_version = ?
  `).get(tenantId, submitterId, formId, consentVersion) as Record<string, unknown> | undefined;
  return row ? rowToConsent(row) : null;
}

export function withdrawConsent(tenantId: string, submitterId: string, formId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE formkey_consent_records
    SET withdrawn = 1, withdrawn_at = ?
    WHERE tenant_id = ? AND submitter_id = ? AND form_id = ?
  `).run(now, tenantId, submitterId, formId);
}
