import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FormDefinition } from '../types.js';
import { getFormDefinition, publishFormDefinition } from './definition-store.js';
import { sealSign } from '../../seal/index.js';
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

export async function runPublishPipeline(
  tenantId: string,
  formId: string,
  publishedBy: string,
  db: Database.Database
): Promise<FormDefinition> {
  // Step 1: Load draft, check status === 'draft'
  const form = getFormDefinition(tenantId, formId);
  if (!form) throw new Error(`Form definition not found: ${formId}`);
  if (form.status !== 'draft') throw new Error(`Form must be in draft status to publish (current: ${form.status})`);

  // Step 2: Pre-flight checks
  if (!form.purpose) throw new Error('Form must have a purpose before publishing');
  if (!form.legalBasis) throw new Error('Form must have a legalBasis before publishing');
  if (!form.retentionTier) throw new Error('Form must have a retentionTier before publishing');
  if (!form.fields || form.fields.length === 0) throw new Error('Form must have at least one field');
  if (form.legalBasis === 'consent' && !form.consentConfig?.required) {
    throw new Error('Forms with legalBasis=consent must have consentConfig.required=true');
  }

  // Step 3: SHA-256 of consentConfig.consentText
  const consentText = form.consentConfig?.consentText ?? '';
  const consentTextHash = crypto.createHash('sha256').update(consentText, 'utf8').digest('hex');

  // Step 4: JCS-serialize full FormDefinition + call sealSign()
  const serializable = { ...form, sealToken: null };
  const canonical = JSON.stringify(jcsSortKeys(serializable));
  const buf = Buffer.from(canonical, 'utf8');

  const sealToken = await sealSign(buf, {
    tenantId,
    callerModule: 'formkey',
    callerContext: `${form.formId}/publish`,
  });

  // Step 5: publishFormDefinition() + archieveLog
  const published = publishFormDefinition(tenantId, form.id, sealToken, consentTextHash);

  try {
    archieveLog({
      requestId: crypto.randomUUID(),
      tenantId,
      module: 'formkey',
      eventType: 'FORMKEY_FORM_PUBLISHED',
      actor: { userId: publishedBy, role: 'admin', sessionId: 'formkey-publish' },
      severity: 'info',
      data: { formId: form.formId, definitionId: form.id, version: form.version },
    });
  } catch (err) {
    console.warn('[formkey] Failed to log FORMKEY_FORM_PUBLISHED:', (err as Error).message);
  }

  return published;
}
