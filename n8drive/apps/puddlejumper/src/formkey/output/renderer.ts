import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { IntakeRecord } from '../types.js';
import { OutputNotConfigured, RecordNotFound, IntakeSealInvalid } from '../types.js';
import { getFormRegistry } from '../index.js';
import { getIntakeDb } from '../intake/pipeline.js';
import { resolveFieldPath } from './binding-resolver.js';
import { sealVerify } from '../../seal/index.js';
import { archieveLog } from '../../archieve/index.js';

function jcsSortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(jcsSortKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map(k => [k, jcsSortKeys((obj as Record<string, unknown>)[k])])
    );
  }
  return obj;
}

function loadIntakeRecord(db: Database.Database, tenantId: string, recordId: string): IntakeRecord | null {
  const row = db.prepare(
    'SELECT * FROM formkey_intake_records WHERE id = ? AND tenant_id = ?'
  ).get(recordId, tenantId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    formId: row.form_id as string,
    formVersion: row.form_version as string,
    recordType: row.record_type as string,
    namespace: row.namespace as string,
    governance: JSON.parse(row.governance as string),
    fields: JSON.parse(row.fields as string),
    createdAt: row.created_at as string,
  };
}

export async function renderForm(
  tenantId: string,
  formId: string,
  recordId: string,
  db: Database.Database,
  opts?: { format?: 'json' | 'html'; requestedBy?: string }
): Promise<{ format: string; content: string; mimeType: string }> {
  const format = opts?.format ?? 'json';

  // Step 1: Load form from registry
  const registry = getFormRegistry();
  const form = registry.get(tenantId)?.get(formId);
  if (!form) throw new RecordNotFound(formId);

  if (!form.outputConfig) throw new OutputNotConfigured(formId);

  // Step 2: Load intake record from SQLite
  const intakeDb = getIntakeDb();
  const record = loadIntakeRecord(intakeDb, tenantId, recordId);
  if (!record) throw new RecordNotFound(recordId);

  // Step 3: Verify record._governance.formId === formId
  if (record.governance.formId !== formId) {
    throw new IntakeSealInvalid('Record does not belong to this form');
  }

  // Step 4: Reconstruct canonical sealed payload → call sealVerify()
  const coveredFields = form.fields
    .filter(f => f.consentCovered)
    .sort((a, b) => a.order - b.order);

  const sealPayload: Record<string, unknown> = {};
  for (const f of coveredFields) {
    if (record.fields[f.id] !== undefined) {
      sealPayload[f.id] = record.fields[f.id];
    }
  }

  const canonical = JSON.stringify(jcsSortKeys(sealPayload));
  const buf = Buffer.from(canonical, 'utf8');
  const sealResult = await sealVerify(buf, record.governance.intakeSealToken);

  if (!sealResult.valid) {
    throw new IntakeSealInvalid(sealResult.reason);
  }

  // Step 5: Build field bindings from outputConfig.fieldBindings
  const bindings: Record<string, string> = {};
  for (const [placeholder, path] of Object.entries(form.outputConfig.fieldBindings)) {
    bindings[placeholder] = resolveFieldPath(record, path) ?? '';
  }

  // Step 6: Add governance bindings if configured
  if (form.outputConfig.includeConsentStamp && record.governance.consentStampId) {
    bindings['CONSENT_STAMP_ID'] = record.governance.consentStampId;
  }
  if (form.outputConfig.includeSealToken) {
    bindings['SEAL_TOKEN'] = record.governance.intakeSealToken.artifactHash;
  }
  if (form.outputConfig.includeRetentionTier) {
    bindings['RETENTION_TIER'] = record.governance.retentionTier;
  }

  // Step 7: Render
  let content: string;
  let mimeType: string;

  if (format === 'html') {
    // Simple {{PLACEHOLDER}} replacement in a basic template
    let html = `<!DOCTYPE html><html><body><div class="form-output">`;
    for (const [placeholder, value] of Object.entries(bindings)) {
      html += `<div><strong>${placeholder}:</strong> ${value}</div>`;
    }
    html += `</div></body></html>`;
    // Also do string-replace if templateId provided (not yet built)
    content = html;
    mimeType = 'text/html';
  } else {
    // JSON format (default — Template Library not built yet)
    content = JSON.stringify({
      recordId,
      formId,
      renderedAt: new Date().toISOString(),
      note: 'Template Library not built yet — returning JSON bindings',
      bindings,
    }, null, 2);
    mimeType = 'application/json';
  }

  // Step 8: archieveLog FORMKEY_OUTPUT_RENDERED
  try {
    archieveLog({
      requestId: crypto.randomUUID(),
      tenantId,
      module: 'formkey',
      eventType: 'FORMKEY_OUTPUT_RENDERED',
      actor: { userId: opts?.requestedBy ?? 'system', role: 'system', sessionId: 'formkey-output' },
      severity: 'info',
      data: { formId, recordId, format },
    });
  } catch (err) {
    console.warn('[formkey] Failed to log FORMKEY_OUTPUT_RENDERED:', (err as Error).message);
  }

  return { format, content, mimeType };
}
