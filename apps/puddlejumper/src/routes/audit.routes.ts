// Canon audit HTTP surface.
// Replaces the audit endpoints that previously lived in api/routes/admin.ts.
//
//   GET /api/audit                  list (tenant-scoped, paginated)
//   GET /api/audit/divergence       divergence.* family only
//   GET /api/audit/:process_id      events for a single process (oldest first)
//
// /audit/divergence is matched before /audit/:process_id so the literal
// segment wins over the wildcard.

import express from 'express';
import { z } from 'zod';
import { getAuthContext, requireAuthenticated } from '@publiclogic/core';
import type { DatabaseHandle } from '@pj/db';
import type { AuditEventFamily } from '@publiclogic/core';
import { listAuditEvents, listAuditEventsForProcess } from './audit.store.js';

const AUDIT_FAMILIES: readonly AuditEventFamily[] = [
  'process',
  'transition',
  'role',
  'auth',
  'divergence',
  'system',
] as const;

const listQuerySchema = z.object({
  family: z.enum(AUDIT_FAMILIES as readonly [AuditEventFamily, ...AuditEventFamily[]]).optional(),
  subtype: z.string().optional(),
  actor_ref: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

function tenantOrForbidden(req: express.Request, res: express.Response): string | null {
  const auth = getAuthContext(req);
  if (!auth) {
    res.status(401).json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return null;
  }
  if (!auth.tenantId) {
    res.status(403).json({ ok: false, error: { code: 'NO_TENANT', message: 'Tenant binding missing' } });
    return null;
  }
  return String(auth.tenantId);
}

export interface CanonAuditRoutesOptions {
  db: DatabaseHandle;
}

export function createCanonAuditRouter(opts: CanonAuditRoutesOptions): express.Router {
  const { db } = opts;
  const router = express.Router();

  router.get('/audit', requireAuthenticated(), (req, res) => {
    const tenantId = tenantOrForbidden(req, res);
    if (!tenantId) return;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid query parameters', details: parsed.error.flatten() },
      });
      return;
    }
    res.json(listAuditEvents(db, tenantId, parsed.data));
  });

  // Literal segment must precede the wildcard `:process_id` route below.
  router.get('/audit/divergence', requireAuthenticated(), (req, res) => {
    const tenantId = tenantOrForbidden(req, res);
    if (!tenantId) return;
    const parsed = listQuerySchema
      .omit({ family: true })
      .safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid query parameters', details: parsed.error.flatten() },
      });
      return;
    }
    res.json(listAuditEvents(db, tenantId, { ...parsed.data, family: 'divergence' }));
  });

  router.get('/audit/:process_id', requireAuthenticated(), (req, res) => {
    const tenantId = tenantOrForbidden(req, res);
    if (!tenantId) return;
    const processId = String(req.params.process_id ?? '').trim();
    if (!processId) {
      res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'process_id required' } });
      return;
    }
    const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 500;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 5000) : 500;
    const events = listAuditEventsForProcess(db, tenantId, processId, { limit });
    res.json({ ok: true, data: events });
  });

  return router;
}
