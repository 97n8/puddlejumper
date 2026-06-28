// Canon CaseSpace HTTP surface (Issue #101, C101-B — Visibility Layer).
// Backend projects the thread; web renders the thread.
//
//   GET /api/casespaces/:id   read-only CaseSpaceView for one CaseSpace
//
// This is the ONLY way the web app reaches the projection: the canon DB lives
// here (Fly + SQLite/WAL), so the route calls projectCaseSpaceView() and hands
// back the CaseSpaceView JSON. Tenant-scoped via the auth context; read-only.
// No writes, no new runtime — pure projection over proof-backed tables.

import express from 'express';
import { getAuthContext, requireAuthenticated } from '@publiclogic/core';
import type { DatabaseHandle } from '@pj/db';
import { projectCaseSpaceView } from '@pj/casespace-view';

function tenantOrForbidden(
  req: express.Request,
  res: express.Response,
): string | null {
  const auth = getAuthContext(req);
  if (!auth) {
    res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return null;
  }
  if (!auth.tenantId) {
    res.status(403).json({
      ok: false,
      error: { code: 'NO_TENANT', message: 'Tenant binding missing' },
    });
    return null;
  }
  return String(auth.tenantId);
}

export interface CanonCaseSpaceRoutesOptions {
  db: DatabaseHandle;
}

export function createCanonCaseSpaceRouter(
  opts: CanonCaseSpaceRoutesOptions,
): express.Router {
  const { db } = opts;
  const router = express.Router();

  router.get('/casespaces/:id', requireAuthenticated(), (req, res) => {
    const tenantId = tenantOrForbidden(req, res);
    if (!tenantId) return;

    const caseSpaceId = String(req.params.id ?? '').trim();
    if (!caseSpaceId) {
      res.status(400).json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'case space id required' },
      });
      return;
    }

    // Projection is tenant-scoped — never reads another tenant's thread.
    const view = projectCaseSpaceView(db, {
      tenant_id: tenantId,
      case_space_id: caseSpaceId,
    });
    res.json({ ok: true, data: view });
  });

  return router;
}
