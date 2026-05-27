// Shared binding registry — admin-only CRUD over shared_bindings.
//
//   POST /api/overlays/bindings                publish a new shared binding
//   PUT  /api/overlays/bindings/:id/deprecate  mark a binding deprecated
//   GET  /api/overlays/bindings                list (includes deprecated)
//
// Source: Master Spec Part 14 RESOLVED-2 + Phase 4 prompt.
//
// Bindings are immutable once published (DB trigger
// `shared_bindings_no_content_update` enforces this). Deprecation is the
// only mutation allowed on an existing row.

import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { getAuthContext, requireAuthenticated } from '@publiclogic/core';
import { appendAuditEvent, type DatabaseHandle } from '@pj/db';
import { SPLIT_POINTS } from '@pj/split-row';
import type { SplitPointId } from '@publiclogic/core';

const CANON_VERSION = '1.0.0';
function deploymentId(): string {
  return process.env.PJ_DEPLOYMENT_ID ?? 'default';
}

const createBindingSchema = z.object({
  binding_id: z.string().min(1),
  name: z.string().min(1),
  split_point: z.enum(SPLIT_POINTS as readonly [SplitPointId, ...SplitPointId[]]),
  version: z.string().min(1),
  content_yaml: z.string().min(1),
  published_by: z.string().min(1),
});

type SharedBindingRow = {
  binding_id: string;
  name: string;
  split_point: string;
  version: string;
  content_yaml: string;
  content_hash: string;
  published_by: string;
  published_at: string;
  deprecated_at: string | null;
};

function tenantOrForbidden(req: express.Request, res: express.Response):
  | { tenantId: string; actorRef: string; role: string | null }
  | null {
  const auth = getAuthContext(req);
  if (!auth) {
    res.status(401).json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return null;
  }
  if (!auth.tenantId) {
    res.status(403).json({ ok: false, error: { code: 'NO_TENANT', message: 'Tenant binding missing' } });
    return null;
  }
  return {
    tenantId: String(auth.tenantId),
    actorRef: String(auth.sub ?? auth.userId ?? 'unknown'),
    role: typeof auth.role === 'string' ? auth.role : null,
  };
}

/**
 * Shared-binding mutations require the administrator role on the JWT.
 * (Phase 8 will replace this with a process-scoped `can()` gate; for now
 * the registry is workspace-global and admin-only.)
 */
function requireAdmin(
  res: express.Response,
  role: string | null,
): boolean {
  if (role !== 'admin' && role !== 'administrator') {
    res.status(403).json({
      ok: false,
      error: {
        code: 'auth.refused',
        message: 'shared binding registry requires administrator role',
      },
    });
    return false;
  }
  return true;
}

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export interface CanonOverlayRoutesOptions {
  db: DatabaseHandle;
}

export function createCanonOverlayRouter(opts: CanonOverlayRoutesOptions): express.Router {
  const { db } = opts;
  const router = express.Router();

  router.post('/overlays/bindings', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(req, res);
    if (!auth) return;
    if (!requireAdmin(res, auth.role)) return;

    const parsed = createBindingSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid request body', details: parsed.error.flatten() },
      });
      return;
    }

    const existing = db
      .prepare(`SELECT binding_id FROM shared_bindings WHERE binding_id = ?`)
      .get(parsed.data.binding_id) as { binding_id: string } | undefined;
    if (existing) {
      res.status(409).json({
        ok: false,
        error: { code: 'BINDING_EXISTS', message: `binding '${parsed.data.binding_id}' already published` },
      });
      return;
    }

    const content_hash = sha256Hex(parsed.data.content_yaml);
    const published_at = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO shared_bindings (
           binding_id, name, split_point, version, content_yaml, content_hash,
           published_by, published_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        parsed.data.binding_id,
        parsed.data.name,
        parsed.data.split_point,
        parsed.data.version,
        parsed.data.content_yaml,
        content_hash,
        parsed.data.published_by,
        published_at,
      );

      appendAuditEvent(db, {
        event_family: 'divergence',
        event_subtype: 'divergence.binding_published',
        canon_version: CANON_VERSION,
        deployment_id: deploymentId(),
        tenant_id: auth.tenantId,
        process_id: null,
        actor_ref: auth.actorRef,
        occurred_at: published_at,
        payload: {
          binding_id: parsed.data.binding_id,
          name: parsed.data.name,
          split_point: parsed.data.split_point,
          version: parsed.data.version,
          content_hash,
          published_by: parsed.data.published_by,
        },
      });
    });
    tx();

    const row = db
      .prepare(`SELECT * FROM shared_bindings WHERE binding_id = ?`)
      .get(parsed.data.binding_id) as SharedBindingRow;
    res.status(201).json({ ok: true, data: row });
  });

  router.put('/overlays/bindings/:id/deprecate', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(req, res);
    if (!auth) return;
    if (!requireAdmin(res, auth.role)) return;
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'binding_id required' } });
      return;
    }
    const row = db
      .prepare(`SELECT * FROM shared_bindings WHERE binding_id = ?`)
      .get(id) as SharedBindingRow | undefined;
    if (!row) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `binding '${id}' not found` } });
      return;
    }
    if (row.deprecated_at) {
      res.status(409).json({ ok: false, error: { code: 'ALREADY_DEPRECATED', message: `binding '${id}' was deprecated at ${row.deprecated_at}` } });
      return;
    }
    const deprecated_at = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare(`UPDATE shared_bindings SET deprecated_at = ? WHERE binding_id = ?`)
        .run(deprecated_at, id);
      appendAuditEvent(db, {
        event_family: 'divergence',
        event_subtype: 'divergence.binding_deprecated',
        canon_version: CANON_VERSION,
        deployment_id: deploymentId(),
        tenant_id: auth.tenantId,
        process_id: null,
        actor_ref: auth.actorRef,
        occurred_at: deprecated_at,
        payload: {
          binding_id: id,
          name: row.name,
          split_point: row.split_point,
          version: row.version,
        },
      });
    });
    tx();
    res.json({ ok: true, data: { binding_id: id, deprecated_at } });
  });

  router.get('/overlays/bindings', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(req, res);
    if (!auth) return;
    const includeDeprecated = req.query.include_deprecated !== 'false';
    const rows = db
      .prepare(
        includeDeprecated
          ? `SELECT * FROM shared_bindings ORDER BY published_at DESC`
          : `SELECT * FROM shared_bindings WHERE deprecated_at IS NULL ORDER BY published_at DESC`,
      )
      .all() as SharedBindingRow[];
    res.json({ ok: true, data: rows });
  });

  return router;
}
