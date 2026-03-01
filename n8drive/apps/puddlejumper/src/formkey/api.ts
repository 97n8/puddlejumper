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
import { grantConsent, getConsentRecord, withdrawConsent } from './consent/store.js';
import { verifyConsent } from './consent/verifier.js';
import { renderForm } from './output/renderer.js';
import { getFormRegistry } from './index.js';
import { archieveLog } from '../archieve/index.js';

function getTenantId(req: Request): string {
  return (req.headers['x-tenant-id'] as string) ?? 'default';
}

function getUserId(req: Request): string {
  return (req as unknown as { user?: { id?: string } }).user?.id ?? 'system';
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string, formId: string): boolean {
  const limit = parseInt(process.env.FORMKEY_SUBMISSION_RATE_LIMIT ?? '10', 10);
  const key = `${ip}:${formId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > 60000) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function createFormKeyApiRouter(db: Database.Database): Router {
  const router = Router();

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

  // GET /v1/forms/:id/submissions — list submissions
  router.get('/:id/submissions', (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const formId = req.params.id;
      const intakeDb = getIntakeDb();
      const rows = intakeDb.prepare(
        'SELECT id, form_id, form_version, record_type, namespace, created_at FROM formkey_intake_records WHERE tenant_id = ? AND form_id = ? ORDER BY created_at DESC LIMIT 100'
      ).all(tenantId, formId) as Record<string, unknown>[];
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
      };
      res.json(record);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
