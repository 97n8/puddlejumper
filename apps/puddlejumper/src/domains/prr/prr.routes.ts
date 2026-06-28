// PRR canon HTTP surface.
// Replaces apps/puddlejumper/src/api/routes/prr.ts (legacy). Mounted at /api.
//
//   POST   /api/prr              createPRR
//   GET    /api/prr              listPRR
//   GET    /api/prr/:id          getPRR
//   PATCH  /api/prr/:id/state    transitionPRR  body: { trigger }
//   POST   /api/prr/:id/close    closePRR
//
// Pattern: getAuthContext → Zod validate → store call → JSON.

import express from 'express';
import { z } from 'zod';
import {
  getAuthContext,
  requireAuthenticated,
} from '@publiclogic/core';
import type { DatabaseHandle } from '@pj/db';
import { can } from '@pj/org-manager';
import { resolveActor } from '@publiclogic/logic-commons-runtime';
import {
  closePRR,
  createPRR,
  getPRR,
  listPRR,
  transitionPRR,
  updateFields,
} from './prr.store.js';
import { PatchFieldsSchema } from './prr.schemas.js';
import {
  PJFieldsClosed,
  PJInvalidTransition,
  type PrrState,
  type PrrTrigger,
} from './prr.machine.js';

const PRR_TRIGGERS: readonly PrrTrigger[] = [
  'intake_complete',
  'route',
  'search_begin',
  'search_complete',
  'respond',
  'reassign',
  'close',
] as const;

const PRR_STATES: readonly PrrState[] = [
  'received',
  'logged',
  'assigned',
  'searching',
  'reviewing',
  'responded',
  'closed',
] as const;

const createBodySchema = z.object({
  fields: z.record(z.string(), z.unknown()).default({}),
  links: z
    .array(
      z.object({
        type: z.string(),
        ref: z.string(),
        label: z.string().optional(),
      }),
    )
    .optional(),
});

const transitionBodySchema = z.object({
  trigger: z.enum(PRR_TRIGGERS as readonly [PrrTrigger, ...PrrTrigger[]]),
});

const listQuerySchema = z.object({
  state: z.enum(PRR_STATES as readonly [PrrState, ...PrrState[]]).optional(),
  assignee_ref: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().optional(),
});

function tenantOrForbidden(
  db: DatabaseHandle,
  req: express.Request,
  res: express.Response,
):
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
  const tenantId = String(auth.tenantId)
  const resolved = resolveActor(db, tenantId, {
    canonIdentityId: (auth as { canonIdentityId?: string | null }).canonIdentityId,
    userId: String(auth.userId ?? ''),
    sub: String(auth.sub ?? ''),
    email: auth.email ?? null,
    name: auth.name ?? null,
  })
  if (!resolved.ok) {
    res.status(403).json({
      ok: false,
      error: { code: 'authority_failure', message: 'Authenticated actor could not be resolved to a canonical identity' },
    })
    return null
  }
  return {
    tenantId,
    actorRef: resolved.identityId,
  };
}

function badRequest(res: express.Response, message: string, details?: unknown): void {
  res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message, details } });
}

export interface CanonPrrRoutesOptions {
  db: DatabaseHandle;
}

export function createCanonPrrRouter(opts: CanonPrrRoutesOptions): express.Router {
  const { db } = opts;
  const router = express.Router();

  router.post('/prr', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(db, req, res);
    if (!auth) return;
    const parsed = createBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      badRequest(res, 'Invalid request body', parsed.error.flatten());
      return;
    }
    const created = createPRR(db, auth.tenantId, auth.actorRef, parsed.data);
    res.status(201).json({ ok: true, data: created });
  });

  router.get('/prr', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(db, req, res);
    if (!auth) return;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      badRequest(res, 'Invalid query parameters', parsed.error.flatten());
      return;
    }
    const page = listPRR(db, auth.tenantId, parsed.data);
    res.json(page);
  });

  router.get('/prr/:id', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(db, req, res);
    if (!auth) return;
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      badRequest(res, 'Process id required');
      return;
    }
    const found = getPRR(db, auth.tenantId, id);
    if (!found) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'PRR not found' } });
      return;
    }
    res.json({ ok: true, data: found });
  });

  router.patch('/prr/:id/state', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(db, req, res);
    if (!auth) return;
    const id = String(req.params.id ?? '').trim();
    const parsed = transitionBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      badRequest(res, 'Invalid trigger', parsed.error.flatten());
      return;
    }
    // Authority gate (Phase 3). can() emits auth.granted/auth.refused for us —
    // do not append another audit event in this route.
    const permitted = can(db, auth.actorRef, 'process.transition', id, auth.tenantId);
    if (!permitted) {
      res.status(403).json({
        ok: false,
        error: {
          code: 'auth.refused',
          message: "actor lacks 'process.transition' on this process",
          details: { action: 'process.transition', process_id: id },
        },
      });
      return;
    }
    try {
      const updated = transitionPRR(db, auth.tenantId, id, parsed.data.trigger, auth.actorRef);
      res.json({ ok: true, data: updated });
    } catch (err) {
      if (err instanceof PJInvalidTransition) {
        res.status(400).json({
          ok: false,
          error: {
            code: 'PJInvalidTransition',
            message: err.message,
            details: { from: err.from, trigger: err.trigger },
          },
        });
        return;
      }
      throw err;
    }
  });

  router.patch('/prr/:id/fields', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(db, req, res);
    if (!auth) return;
    const id = String(req.params.id ?? '').trim();
    if (!id) { badRequest(res, 'Process id required'); return; }

    const parsed = PatchFieldsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      badRequest(res, 'Invalid fields patch', parsed.error.flatten());
      return;
    }

    // Authority gate. can() emits auth.granted/refused — do not double-emit.
    const permitted = can(db, auth.actorRef, 'process.update_fields', id, auth.tenantId);
    if (!permitted) {
      res.status(403).json({
        ok: false,
        error: {
          code: 'auth.refused',
          message: "actor lacks 'process.update_fields' on this process",
          details: { action: 'process.update_fields', process_id: id },
        },
      });
      return;
    }

    try {
      const { process, changed } = updateFields(db, {
        tenantId: auth.tenantId,
        prrId: id,
        actorRef: auth.actorRef,
        patch: parsed.data,
      });
      res.json({ ok: true, data: { process, changed } });
    } catch (err) {
      if (err instanceof PJFieldsClosed) {
        res.status(409).json({
          ok: false,
          error: { code: 'fields.closed', message: err.message, details: { process_id: id } },
        });
        return;
      }
      if (err instanceof PJInvalidTransition) {
        // updateFields signals "not found in tenant" via PJInvalidTransition
        // for consistency with the rest of the store; translate to 404 here.
        res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'PRR not found' } });
        return;
      }
      throw err;
    }
  });

  router.post('/prr/:id/close', requireAuthenticated(), (req, res) => {
    const auth = tenantOrForbidden(db, req, res);
    if (!auth) return;
    const id = String(req.params.id ?? '').trim();
    try {
      const closed = closePRR(db, auth.tenantId, id, auth.actorRef);
      res.json({ ok: true, data: closed });
    } catch (err) {
      if (err instanceof PJInvalidTransition) {
        res.status(400).json({
          ok: false,
          error: {
            code: 'PJInvalidTransition',
            message: err.message,
            details: { from: err.from, trigger: err.trigger },
          },
        });
        return;
      }
      throw err;
    }
  });

  return router;
}
