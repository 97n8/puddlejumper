import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FormDefinition, FormField, ConsentConfig, VaultMapping, OutputConfig, AutomationTrigger } from '../types.js';
import type { SealToken } from '../../seal/types.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS formkey_definitions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  purpose TEXT,
  legal_basis TEXT,
  retention_tier TEXT,
  data_types TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'standard',
  consent_config TEXT,
  consent_text_hash TEXT,
  fields TEXT NOT NULL DEFAULT '[]',
  vault_mapping TEXT,
  output_config TEXT,
  automation_trigger TEXT,
  seal_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  deprecated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_fk_def_tenant ON formkey_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fk_def_formid ON formkey_definitions(form_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_fk_def_status ON formkey_definitions(status);
`;

let _db: Database.Database | null = null;

export function initFormKeyDefinitionStore(db: Database.Database): void {
  _db = db;
  db.exec(SCHEMA);
}

function getDb(): Database.Database {
  if (!_db) throw new Error('FormKey definition store not initialized');
  return _db;
}

function rowToDefinition(row: Record<string, unknown>): FormDefinition {
  return {
    id: row.id as string,
    formId: row.form_id as string,
    tenantId: row.tenant_id as string,
    version: row.version as string,
    name: row.name as string,
    description: row.description as string,
    status: row.status as FormDefinition['status'],
    purpose: (row.purpose as string | null) ?? undefined,
    legalBasis: (row.legal_basis as FormDefinition['legalBasis'] | null) ?? undefined,
    retentionTier: (row.retention_tier as string | null) ?? undefined,
    dataTypes: row.data_types ? JSON.parse(row.data_types as string) : undefined,
    sensitivity: row.sensitivity as string,
    consentConfig: row.consent_config ? JSON.parse(row.consent_config as string) : { required: false, consentText: '', consentVersion: '1.0' },
    fields: row.fields ? JSON.parse(row.fields as string) : [],
    vaultMapping: row.vault_mapping ? JSON.parse(row.vault_mapping as string) : { recordType: '', namespace: '', fieldMap: {} },
    outputConfig: row.output_config ? JSON.parse(row.output_config as string) : undefined,
    sealToken: row.seal_token ? JSON.parse(row.seal_token as string) : null,
    automationTrigger: row.automation_trigger ? JSON.parse(row.automation_trigger as string) : undefined,
    createdAt: row.created_at as string,
    publishedAt: (row.published_at as string | null) ?? undefined,
    deprecatedAt: (row.deprecated_at as string | null) ?? undefined,
  };
}

export function createFormDefinition(
  tenantId: string,
  input: Partial<FormDefinition> & { name: string; formId: string }
): FormDefinition {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO formkey_definitions (
      id, form_id, tenant_id, version, name, description, status,
      purpose, legal_basis, retention_tier, data_types, sensitivity,
      consent_config, fields, vault_mapping, output_config, automation_trigger,
      seal_token, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `).run(
    id,
    input.formId,
    tenantId,
    input.version ?? '1.0.0',
    input.name,
    input.description ?? '',
    input.status ?? 'draft',
    input.purpose ?? null,
    input.legalBasis ?? null,
    input.retentionTier ?? null,
    input.dataTypes ? JSON.stringify(input.dataTypes) : null,
    input.sensitivity ?? 'standard',
    input.consentConfig ? JSON.stringify(input.consentConfig) : JSON.stringify({ required: false, consentText: '', consentVersion: '1.0' }),
    input.fields ? JSON.stringify(input.fields) : '[]',
    input.vaultMapping ? JSON.stringify(input.vaultMapping) : JSON.stringify({ recordType: '', namespace: '', fieldMap: {} }),
    input.outputConfig ? JSON.stringify(input.outputConfig) : null,
    input.automationTrigger ? JSON.stringify(input.automationTrigger) : null,
    null,
    now,
    now,
  );

  return getFormDefinition(tenantId, id) as FormDefinition;
}

export function getFormDefinition(tenantId: string, id: string): FormDefinition | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM formkey_definitions WHERE id = ? AND tenant_id = ?'
  ).get(id, tenantId) as Record<string, unknown> | undefined;
  return row ? rowToDefinition(row) : null;
}

export function getFormDefinitionByFormId(tenantId: string, formId: string): FormDefinition | null {
  const db = getDb();
  // Prefer published, then draft
  const row = db.prepare(`
    SELECT * FROM formkey_definitions
    WHERE form_id = ? AND tenant_id = ?
    ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, created_at DESC
    LIMIT 1
  `).get(formId, tenantId) as Record<string, unknown> | undefined;
  return row ? rowToDefinition(row) : null;
}

export function updateFormDefinition(
  tenantId: string,
  id: string,
  updates: Partial<FormDefinition>
): FormDefinition {
  const db = getDb();
  const now = new Date().toISOString();

  const setParts: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.name !== undefined) { setParts.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { setParts.push('description = ?'); values.push(updates.description); }
  if (updates.version !== undefined) { setParts.push('version = ?'); values.push(updates.version); }
  if (updates.purpose !== undefined) { setParts.push('purpose = ?'); values.push(updates.purpose); }
  if (updates.legalBasis !== undefined) { setParts.push('legal_basis = ?'); values.push(updates.legalBasis); }
  if (updates.retentionTier !== undefined) { setParts.push('retention_tier = ?'); values.push(updates.retentionTier); }
  if (updates.dataTypes !== undefined) { setParts.push('data_types = ?'); values.push(JSON.stringify(updates.dataTypes)); }
  if (updates.sensitivity !== undefined) { setParts.push('sensitivity = ?'); values.push(updates.sensitivity); }
  if (updates.consentConfig !== undefined) { setParts.push('consent_config = ?'); values.push(JSON.stringify(updates.consentConfig)); }
  if (updates.fields !== undefined) { setParts.push('fields = ?'); values.push(JSON.stringify(updates.fields)); }
  if (updates.vaultMapping !== undefined) { setParts.push('vault_mapping = ?'); values.push(JSON.stringify(updates.vaultMapping)); }
  if (updates.outputConfig !== undefined) { setParts.push('output_config = ?'); values.push(JSON.stringify(updates.outputConfig)); }
  if (updates.automationTrigger !== undefined) { setParts.push('automation_trigger = ?'); values.push(JSON.stringify(updates.automationTrigger)); }

  values.push(id, tenantId);

  db.prepare(`UPDATE formkey_definitions SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...values);

  const updated = getFormDefinition(tenantId, id);
  if (!updated) throw new Error(`Form definition not found after update: ${id}`);
  return updated;
}

export function listFormDefinitions(tenantId: string, status?: string): FormDefinition[] {
  const db = getDb();
  let query = 'SELECT * FROM formkey_definitions WHERE tenant_id = ?';
  const params: unknown[] = [tenantId];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map(rowToDefinition);
}

export function publishFormDefinition(
  tenantId: string,
  id: string,
  sealToken: SealToken,
  consentTextHash: string
): FormDefinition {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE formkey_definitions
    SET status = 'published', seal_token = ?, consent_text_hash = ?, published_at = ?, updated_at = ?
    WHERE id = ? AND tenant_id = ?
  `).run(JSON.stringify(sealToken), consentTextHash, now, now, id, tenantId);

  const updated = getFormDefinition(tenantId, id);
  if (!updated) throw new Error(`Form definition not found after publish: ${id}`);
  return updated;
}

export function deprecateFormDefinition(
  tenantId: string,
  id: string,
  _reason: string,
  _supersededBy?: string
): FormDefinition {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE formkey_definitions
    SET status = 'deprecated', deprecated_at = ?, updated_at = ?
    WHERE id = ? AND tenant_id = ?
  `).run(now, now, id, tenantId);

  const updated = getFormDefinition(tenantId, id);
  if (!updated) throw new Error(`Form definition not found after deprecate: ${id}`);
  return updated;
}
