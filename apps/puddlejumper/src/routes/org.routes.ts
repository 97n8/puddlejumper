// Canon Org Manager HTTP surface (Phase 3).
//
//   GET    /api/org/identities                     list (tenant-scoped, paginated)
//   POST   /api/org/identities                     create identity
//   GET    /api/org/identities/:id                 get identity
//   PATCH  /api/org/identities/:id/deactivate      deactivate + close open assignments
//   POST   /api/org/can                            authority check (emits audit event)
//
// Auth: every route reads getAuthContext(req) and scopes by tenantId.

import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { getAuthContext, requireAuthenticated } from '@publiclogic/core';
import type {
  CanonicalAction,
  Identity,
  PJPaginated,
} from '@publiclogic/core';
import { appendAuditEvent, type DatabaseHandle } from '@pj/db';
import {
  CANONICAL_ACTIONS,
  PJIdentityNotFound,
  can,
  deactivateIdentity,
  whois,
} from '@pj/org-manager';

const CANON_VERSION = '1.0.0';
function deploymentId(): string {
  return process.env.PJ_DEPLOYMENT_ID ?? 'default';
}

// ── Schemas ─────────────────────────────────────────────────────────────────

const createIdentitySchema = z.object({
  kind: z.enum(['person', 'service', 'delegation']),
  // Canon Identity (Spec Part 3) has no display_name/email columns. We
  // accept them here for overlay use and persist them only in the
  // role.identity_created audit event payload.
  display_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

const listQuerySchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const canBodySchema = z.object({
  identity_id: z.string().min(1),
  action: z.enum(CANONICAL_ACTIONS as readonly [CanonicalAction, ...CanonicalAction[]]),
  process_id: z.string().min(1),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

type IdentityRow = {
  identity_id: string;
  tenant_id: string;
  kind: 'person' | 'service' | 'delegation';
  active: 0 | 1;
  created_at: string;
  deactivated_at: string | null;
};

function rowToIdentity(row: IdentityRow): Identity {
  return {
    identity_id: row.identity_id,
    tenant_id: row.tenant_id,
    kind: row.kind,
    active: row.active === 1,
    created_at: row.created_at,
    deactivated_at: row.deactivated_at,
  };
}

function tenantOrForbidden(req: express.Request, res: express.Response):
  | { tenantId: string; actorRef: string }
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
  };
}

function badRequest(res: express.Response, message: string, details?: unknown): void {
  res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message, details } });
}

function listIdentities(
  db: DatabaseHandle,
  tenantId: string,
  filters: { active?: boolean; cursor?: string; limit?: number },
): PJPaginated<Identity> {
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  const conds = ['tenant_id = ?'];
  const params: unknown[] = [tenantId];
  if (typeof filters.active === 'boolean') {
    conds.push('active = ?');
    params.push(filters.active ? 1 : 0);
  }
  if (filters.cursor) {
    conds.push('created_at < ?');
    params.push(filters.cursor);
  }
  const rows = db
    .prepare(
      `SELECT * FROM identities
       WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(...params, limit + 1) as IdentityRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(rowToIdentity);
  const next_cursor = hasMore ? page[page.length - 1]!.created_at : null;
  return {
    ok: true,
    data: page,
    page: { limit, cursor: filters.cursor ?? null, next_cursor },
  };
}

// ── Router ──────────────────────────────────────────────────────────────────

export interface CanonOrgRoutesOptions {
  db: DatabaseHandle;
}

export function createCanonOrgRouter(opts: CanonOrgRoutesOptions): express.Router {
  const { db } = opts;
  const router = express.Router();

  router.get('/org/identities', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(req, res);
    if (!auth) return;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      badRequest(res, 'Invalid query parameters', parsed.error.flatten());
      return;
    }
    res.json(
      listIdentities(db, auth.tenantId, {
        active:
          parsed.data.active === 'true'
            ? true
            : parsed.data.active === 'false'
              ? false
              : undefined,
        cursor: parsed.data.cursor,
        limit: parsed.data.limit,
      }),
    );
  });

  router.post('/org/identities', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(req, res);
    if (!auth) return;
    const parsed = createIdentitySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      badRequest(res, 'Invalid request body', parsed.error.flatten());
      return;
    }
    const identity_id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO identities (identity_id, tenant_id, kind, active, created_at)
         VALUES (?, ?, ?, 1, ?)`,
      ).run(identity_id, auth.tenantId, parsed.data.kind, created_at);

      appendAuditEvent(db, {
        event_family: 'role',
        event_subtype: 'role.identity_created',
        canon_version: CANON_VERSION,
        deployment_id: deploymentId(),
        tenant_id: auth.tenantId,
        process_id: null,
        actor_ref: auth.actorRef,
        occurred_at: created_at,
        payload: {
          identity_id,
          kind: parsed.data.kind,
          display_name: parsed.data.display_name ?? null,
          email: parsed.data.email ?? null,
        },
      });
    });
    tx();

    const created = db
      .prepare('SELECT * FROM identities WHERE identity_id = ?')
      .get(identity_id) as IdentityRow;
    res.status(201).json({ ok: true, data: rowToIdentity(created) });
  });

  router.get('/org/identities/:id', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(req, res);
    if (!auth) return;
    const id = String(req.params.id ?? '').trim();
    if (!id) { badRequest(res, 'identity_id required'); return; }
    try {
      const found = whois(db, id, auth.tenantId);
      res.json({ ok: true, data: found });
    } catch (err) {
      if (err instanceof PJIdentityNotFound) {
        res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      throw err;
    }
  });

  router.patch('/org/identities/:id/deactivate', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(req, res);
    if (!auth) return;
    const id = String(req.params.id ?? '').trim();
    if (!id) { badRequest(res, 'identity_id required'); return; }
    try {
      deactivateIdentity(db, id, auth.tenantId);
      res.json({ ok: true, data: { identity_id: id, active: false } });
    } catch (err) {
      if (err instanceof PJIdentityNotFound) {
        res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      throw err;
    }
  });

  router.post('/org/can', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(req, res);
    if (!auth) return;
    const parsed = canBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      badRequest(res, 'Invalid request body', parsed.error.flatten());
      return;
    }
    // can() emits the audit event; the route does not.
    const permitted = can(
      db,
      parsed.data.identity_id,
      parsed.data.action,
      parsed.data.process_id,
      auth.tenantId,
    );
    res.json({ ok: true, data: { permitted } });
  });

  return router;
}
