import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type Database from 'better-sqlite3';
import {
  FormNotFound,
  FormNotAccepting,
  FieldValidationFailed,
  ConsentRequired,
  OutputNotConfigured,
  RecordNotFound,
  IntakeSealInvalid,
} from './types.js';
import {
  createFormDefinition,
  getFormDefinition,
  getFormDefinitionByFormId,
  updateFormDefinition,
  listFormDefinitions,
  deprecateFormDefinition,
} from './registry/definition-store.js';
import { runPublishPipeline } from './registry/publisher.js';
import { processSubmission, getIntakeDb } from './intake/pipeline.js';
import { normalizeToForm } from './intake/normalizer.js';
import { grantConsent, getConsentRecord, withdrawConsent } from './consent/store.js';
import { verifyConsent } from './consent/verifier.js';
import { renderForm } from './output/renderer.js';
import { getFormRegistry } from './index.js';
import { archieveLog } from '../archieve/index.js';
import { hasGovernanceRole } from '../org-manager/store.js';

function getTenantId(req: Request): string {
  return (req.headers['x-tenant-id'] as string) ?? 'default';
}

function getUserId(req: Request): string {
  return (req as unknown as { user?: { id?: string } }).user?.id ?? 'system';
}

// Simple in-memory rate limiter
// Configurable via FORMKEY_RATE_LIMIT_MAX (max submissions) and FORMKEY_RATE_LIMIT_WINDOW_MS (window)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string, formId: string): boolean {
  const limit = parseInt(process.env.FORMKEY_RATE_LIMIT_MAX ?? process.env.FORMKEY_SUBMISSION_RATE_LIMIT ?? '10', 10);
  const windowMs = parseInt(process.env.FORMKEY_RATE_LIMIT_WINDOW_MS ?? '60000', 10);
  const key = `${ip}:${formId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function createFormKeyApiRouter(db: Database.Database): Router {
  const router = Router();

  // POST /api/formkey/forms/normalize — plain-text → best matching form + prefill
  router.post('/normalize', async (req: Request, res: Response) => {
    try {
      const { text } = req.body ?? {};
      if (!text || typeof text !== 'string' || text.trim().length < 3) {
        res.status(400).json({ error: 'text is required (min 3 chars)' });
        return;
      }
      const tenantId = getTenantId(req);
      const registry = getFormRegistry();
      const tenantForms = registry.get(tenantId);
      const forms = tenantForms ? Array.from(tenantForms.values()) : [];

      const openAiKey = process.env.OPENAI_API_KEY;
      const result = await normalizeToForm(text.trim(), forms, openAiKey);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /v1/forms — list
  router.get('/', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const status = req.query.status as string | undefined;
      const forms = listFormDefinitions(tenantId, status);
      res.json({ forms, total: forms.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /v1/forms — create draft
  router.post('/', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { name, formId, ...rest } = req.body;
      if (!name || !formId) return res.status(400).json({ error: 'name and formId are required' }) as unknown as void;
      const form = createFormDefinition(tenantId, { name, formId, ...rest });
      res.status(201).json(form);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /v1/forms/:id — get by id
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const form = getFormDefinition(tenantId, req.params.id)
        ?? getFormDefinitionByFormId(tenantId, req.params.id);
      if (!form) return res.status(404).json({ error: 'Form not found' }) as unknown as void;
      res.json(form);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PUT /v1/forms/:id — update draft (409 if published)
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const form = getFormDefinition(tenantId, req.params.id);
      if (!form) return res.status(404).json({ error: 'Form not found' }) as unknown as void;
      if (form.status === 'published') return res.status(409).json({ error: 'Cannot update a published form' }) as unknown as void;
      const updated = updateFormDefinition(tenantId, req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /v1/forms/:id/publish — run publish pipeline
  router.post('/:id/publish', async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const publishedBy = getUserId(req);
      const form = await runPublishPipeline(tenantId, req.params.id, publishedBy, db);

      // Update in-memory registry
      const registry = getFormRegistry();
      if (!registry.has(tenantId)) registry.set(tenantId, new Map());
      registry.get(tenantId)!.set(form.formId, form);

      res.json(form);
    } catch (err) {
      const status = (err as Error).message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  // POST /v1/forms/:id/deprecate — deprecate
  router.post('/:id/deprecate', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { reason, supersededBy } = req.body;
      const form = deprecateFormDefinition(tenantId, req.params.id, reason ?? '', supersededBy);

      // Remove from registry
      const registry = getFormRegistry();
      registry.get(tenantId)?.delete(form.formId);

      res.json(form);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /v1/forms/:id/submit — intake submission (rate limited)
  router.post('/:id/submit', async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const formId = req.params.id;

    // Rate limit check
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    if (!checkRateLimit(ip, formId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' }) as unknown as void;
    }

    try {
      const result = await processSubmission(tenantId, formId, req.body, db);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof FormNotFound) return res.status(404).json({ error: err.message }) as unknown as void;
      if (err instanceof FormNotAccepting) return res.status(422).json({ error: err.message }) as unknown as void;
      if (err instanceof FieldValidationFailed) return res.status(400).json({ error: err.message, errors: err.errors }) as unknown as void;
      if (err instanceof ConsentRequired) return res.status(403).json({ error: err.message, code: 'CONSENT_REQUIRED' }) as unknown as void;
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /v1/forms/:id/consent — grant consent
  router.post('/:id/consent', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const formId = req.params.id;
      const { submitterId, consentVersion, consentTextHash, expiryDays, ipAddress, userAgent } = req.body;

      if (!submitterId || !consentVersion || !consentTextHash) {
        return res.status(400).json({ error: 'submitterId, consentVersion, and consentTextHash are required' }) as unknown as void;
      }

      const record = grantConsent(tenantId, formId, submitterId, consentVersion, consentTextHash, { expiryDays, ipAddress, userAgent });

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'formkey',
          eventType: 'FORMKEY_CONSENT_STAMPED',
          actor: { userId: submitterId, role: 'submitter', sessionId: 'formkey-consent' },
          severity: 'info',
          data: { formId, submissionId: record.id },
        });
      } catch { /* ignore */ }

      res.status(201).json(record);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE /v1/forms/:id/consent/:submitterId — withdraw consent
  router.delete('/:id/consent/:submitterId', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      withdrawConsent(tenantId, req.params.submitterId, req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /v1/forms/:id/consent/:submitterId — get consent status
  router.get('/:id/consent/:submitterId', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const formId = req.params.id;
      const submitterId = req.params.submitterId;

      // Get form to find consentVersion
      const form = getFormDefinition(tenantId, formId)
        ?? getFormDefinitionByFormId(tenantId, formId);
      if (!form) return res.status(404).json({ error: 'Form not found' }) as unknown as void;

      const consentVersion = form.consentConfig?.consentVersion ?? '1.0';
      const record = getConsentRecord(tenantId, submitterId, formId, consentVersion);
      const verification = verifyConsent(tenantId, submitterId, formId, consentVersion);

      res.json({ record, verification });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /v1/forms/:id/render/:recordId — render output
  router.get('/:id/render/:recordId', async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const format = (req.query.format as 'json' | 'html') ?? 'json';
      const result = await renderForm(tenantId, req.params.id, req.params.recordId, db, {
        format,
        requestedBy: getUserId(req),
      });
      res.setHeader('Content-Type', result.mimeType).send(result.content);
    } catch (err) {
      if (err instanceof RecordNotFound) return res.status(404).json({ error: err.message }) as unknown as void;
      if (err instanceof OutputNotConfigured) return res.status(422).json({ error: err.message }) as unknown as void;
      if (err instanceof IntakeSealInvalid) return res.status(403).json({ error: err.message }) as unknown as void;
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /v1/forms/:id/submissions — list submissions (with status + SLA)
  router.get('/:id/submissions', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const formId = req.params.id;
      const statusFilter = req.query.status as string | undefined;
      const intakeDb = getIntakeDb();

      const sql = statusFilter
        ? 'SELECT id, form_id, form_version, record_type, namespace, created_at, status, sla_due_at, review_id FROM formkey_intake_records WHERE tenant_id = ? AND form_id = ? AND status = ? ORDER BY created_at DESC LIMIT 100'
        : 'SELECT id, form_id, form_version, record_type, namespace, created_at, status, sla_due_at, review_id FROM formkey_intake_records WHERE tenant_id = ? AND form_id = ? ORDER BY created_at DESC LIMIT 100';

      const params = statusFilter ? [tenantId, formId, statusFilter] : [tenantId, formId];
      const rows = intakeDb.prepare(sql).all(...params) as Record<string, unknown>[];
      res.json({ submissions: rows, total: rows.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /v1/forms/:id/submissions/:recordId — get submission
  router.get('/:id/submissions/:recordId', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const intakeDb = getIntakeDb();
      const row = intakeDb.prepare(
        'SELECT * FROM formkey_intake_records WHERE id = ? AND tenant_id = ? AND form_id = ?'
      ).get(req.params.recordId, tenantId, req.params.id) as Record<string, unknown> | undefined;

      if (!row) return res.status(404).json({ error: 'Submission not found' }) as unknown as void;

      const record = {
        id: row.id,
        tenantId: row.tenant_id,
        formId: row.form_id,
        formVersion: row.form_version,
        recordType: row.record_type,
        namespace: row.namespace,
        governance: JSON.parse(row.governance as string),
        fields: JSON.parse(row.fields as string),
        createdAt: row.created_at,
        status: row.status ?? 'received',
        slaDueAt: row.sla_due_at ?? null,
        reviewId: row.review_id ?? null,
      };
      res.json(record);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PATCH /v1/forms/:id/submissions/:recordId/status — update intake status
  router.patch('/:id/submissions/:recordId/status', async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { recordId, id: formId } = req.params;
      const { status, note, updatedBy } = req.body ?? {};

      const VALID = ['received', 'under_review', 'responded', 'closed'];
      if (!VALID.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` });
        return;
      }

      const intakeDb = getIntakeDb();
      const existing = intakeDb.prepare(
        'SELECT * FROM formkey_intake_records WHERE id = ? AND tenant_id = ? AND form_id = ?'
      ).get(recordId, tenantId, formId) as Record<string, unknown> | undefined;

      if (!existing) { res.status(404).json({ error: 'Submission not found' }); return; }

      const now = new Date().toISOString();
      const extra: Record<string, string | null> = {};
      if (status === 'responded') extra.responded_at = now;
      if (status === 'closed')    extra.closed_at = now;

      const setClauses = [
        'status = ?', 'status_updated_at = ?', 'status_updated_by = ?',
        ...Object.keys(extra).map(k => `${k} = ?`),
      ].join(', ');
      const values = [status, now, updatedBy ?? null, ...Object.values(extra), recordId, tenantId];

      intakeDb.prepare(`UPDATE formkey_intake_records SET ${setClauses} WHERE id = ? AND tenant_id = ?`).run(...values);

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'formkey',
          eventType: 'FORMKEY_STATUS_UPDATED',
          actor: { userId: updatedBy ?? 'unknown', role: 'operator', sessionId: 'formkey-status' },
          severity: 'info',
          data: { formId, recordId, fromStatus: existing.status, toStatus: status, note: note ?? null },
        });
      } catch { /* best-effort */ }

      // If closed + form has recurrence → schedule next intake task
      if (status === 'closed') {
        try {
          const formDef = getFormDefinitionByFormId(tenantId, formId);
          if (formDef?.vaultMapping.recurrence && formDef.vaultMapping.recurrence !== 'once') {
            const daysMap = { annual: 365, quarterly: 91, monthly: 30 };
            const days = daysMap[formDef.vaultMapping.recurrence] ?? 365;
            const nextDue = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            // Insert renewal task into tasks queue via archieve event
            archieveLog({
              requestId: crypto.randomUUID(),
              tenantId,
              module: 'formkey',
              eventType: 'FORMKEY_RENEWAL_SCHEDULED',
              actor: { userId: 'system', role: 'system', sessionId: 'formkey-renewal' },
              severity: 'info',
              data: { formId, recordId, recurrence: formDef.vaultMapping.recurrence, nextDueDate: nextDue },
            });
          }
        } catch { /* best-effort */ }
      }

      const updated = intakeDb.prepare('SELECT * FROM formkey_intake_records WHERE id = ?').get(recordId) as Record<string, unknown>;
      res.json({ id: updated.id, status: updated.status, slaDueAt: updated.sla_due_at ?? null });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /v1/forms/reviews — list all pending reviews for this tenant
  router.get('/reviews', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const statusFilter = (req.query.status as string) ?? 'pending';
      const intakeDb = getIntakeDb();

      const tableExists = intakeDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='formkey_reviews'"
      ).get();
      if (!tableExists) { res.json({ reviews: [], total: 0 }); return; }

      const rows = intakeDb.prepare(`
        SELECT r.*, i.status as intake_status, i.sla_due_at
        FROM formkey_reviews r
        LEFT JOIN formkey_intake_records i ON r.record_id = i.id
        WHERE r.tenant_id = ? AND r.status = ?
        ORDER BY r.created_at ASC
        LIMIT 50
      `).all(tenantId, statusFilter) as Record<string, unknown>[];
      res.json({ reviews: rows, total: rows.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /v1/forms/reviews/:reviewId/decide — approve or reject a review gate
  router.post('/reviews/:reviewId/decide', async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { reviewId } = req.params;
      const { decision, reviewedBy, note } = req.body ?? {};

      if (!['approved', 'rejected'].includes(decision)) {
        res.status(400).json({ error: 'decision must be approved or rejected' });
        return;
      }

      const intakeDb = getIntakeDb();
      const review = intakeDb.prepare(
        'SELECT * FROM formkey_reviews WHERE id = ? AND tenant_id = ?'
      ).get(reviewId, tenantId) as Record<string, unknown> | undefined;

      if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
      if (review.status !== 'pending') { res.status(409).json({ error: `Review already ${review.status}` }); return; }

      // ── VAULT RBAC: verify reviewer holds the required governance role ──
      if (review.required_role && reviewedBy && reviewedBy !== 'system') {
        const authorized = hasGovernanceRole(intakeDb, tenantId, reviewedBy as string, review.required_role as string);
        if (!authorized) {
          res.status(403).json({
            error: `Role '${review.required_role}' required to decide this review`,
            requiredRole: review.required_role,
          });
          return;
        }
      }

      const now = new Date().toISOString();
      intakeDb.prepare(`
        UPDATE formkey_reviews SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?
      `).run(decision, reviewedBy ?? null, now, note ?? null, reviewId);

      // Update intake record status based on decision
      const newIntakeStatus = decision === 'approved' ? 'under_review' : 'closed';
      intakeDb.prepare(`
        UPDATE formkey_intake_records SET status = ?, status_updated_at = ?, status_updated_by = ? WHERE id = ?
      `).run(newIntakeStatus, now, reviewedBy ?? null, review.record_id);

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'formkey',
          eventType: 'FORMKEY_REVIEW_DECIDED',
          actor: { userId: reviewedBy ?? 'unknown', role: 'reviewer', sessionId: 'formkey-review' },
          severity: decision === 'rejected' ? 'warn' : 'info',
          data: { reviewId, recordId: review.record_id, decision, note: note ?? null },
        });
      } catch { /* best-effort */ }

      res.json({ reviewId, decision, intakeStatus: newIntakeStatus });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
