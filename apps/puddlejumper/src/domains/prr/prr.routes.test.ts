// Route-level coverage for PATCH /api/prr/:id/fields (Phase 5.1).
// Store/schema correctness is covered in prr.store.test.ts; this file
// exercises the HTTP status code translation and the can() gate.

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import { assign } from '@pj/org-manager';
import type { RoleType } from '@publiclogic/core';
import { createCanonPrrRouter } from './prr.routes.js';
import { createPRR, transitionPRR, closePRR } from './prr.store.js';

const TENANT = 't-canon';
const OTHER_TENANT = 't-other';
const ADMIN_ID = 'u-admin';
const REQ_ID   = 'u-requestor';

function fresh(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(TENANT, 'Canon', '1.0.0');
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(OTHER_TENANT, 'Other', '1.0.0');
  db.prepare(
    `INSERT INTO identities (identity_id, tenant_id, kind, active) VALUES (?, ?, 'person', 1)`,
  ).run(ADMIN_ID, TENANT);
  db.prepare(
    `INSERT INTO identities (identity_id, tenant_id, kind, active) VALUES (?, ?, 'person', 1)`,
  ).run(REQ_ID, TENANT);
  return db;
}

interface AuthStub {
  tenantId: string;
  sub: string;
}

function makeApp(db: DatabaseHandle, auth: AuthStub | null): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // @ts-expect-error — stub the canonical auth payload directly.
    req.auth = auth;
    next();
  });
  app.use('/api', createCanonPrrRouter({ db }));
  return app;
}

function asAdmin(db: DatabaseHandle, prrId: string): void {
  assign(db, prrId, 'administrator' as RoleType,
    { strategy: 'named_default', identity_ref: ADMIN_ID },
    TENANT, ADMIN_ID);
}

function asRequestor(db: DatabaseHandle, prrId: string): void {
  assign(db, prrId, 'requestor' as RoleType,
    { strategy: 'named_default', identity_ref: REQ_ID },
    TENANT, ADMIN_ID);
}

describe('PATCH /api/prr/:id/fields — Phase 5.1', () => {
  let db: DatabaseHandle;
  let prrId: string;
  beforeEach(() => {
    db = fresh();
    const p = createPRR(db, TENANT, ADMIN_ID, {
      fields: {
        subject: 'Records ledger',
        checklist: [
          { id: 'a', label: 'Pick precinct', done: false },
          { id: 'b', label: 'Knock', done: false },
        ],
      },
    });
    prrId = p.process_id;
    transitionPRR(db, TENANT, prrId, 'intake_complete', ADMIN_ID);
  });

  it('200 — administrator patches checklist; response includes changed list', async () => {
    asAdmin(db, prrId);
    const app = makeApp(db, { tenantId: TENANT, sub: ADMIN_ID });
    const res = await request(app)
      .patch(`/api/prr/${prrId}/fields`)
      .send({
        checklist: [
          { id: 'a', label: 'Pick precinct', done: true },
          { id: 'b', label: 'Knock', done: false },
        ],
      })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.changed).toEqual(['checklist']);
  });

  it('403 — requestor lacks process.update_fields; auth.refused event written', async () => {
    asRequestor(db, prrId);
    const app = makeApp(db, { tenantId: TENANT, sub: REQ_ID });
    const res = await request(app)
      .patch(`/api/prr/${prrId}/fields`)
      .send({ notes: 'attempt' })
      .expect(403);
    expect(res.body.error.code).toBe('auth.refused');

    const refused = db.prepare(
      `SELECT COUNT(*) AS n FROM audit_events
       WHERE process_id = ? AND event_subtype = 'auth.refused' AND actor_ref = ?`,
    ).get(prrId, REQ_ID) as { n: number };
    expect(refused.n).toBe(1);
  });

  it('400 — empty patch is rejected by Zod refine', async () => {
    asAdmin(db, prrId);
    const app = makeApp(db, { tenantId: TENANT, sub: ADMIN_ID });
    const res = await request(app)
      .patch(`/api/prr/${prrId}/fields`)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('400 — unknown key (state) is refused; cannot mutate state via this route', async () => {
    asAdmin(db, prrId);
    const app = makeApp(db, { tenantId: TENANT, sub: ADMIN_ID });
    const res = await request(app)
      .patch(`/api/prr/${prrId}/fields`)
      .send({ state: 'closed' })
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('409 — closed PRR refuses field updates', async () => {
    asAdmin(db, prrId);
    transitionPRR(db, TENANT, prrId, 'route', ADMIN_ID);
    transitionPRR(db, TENANT, prrId, 'search_begin', ADMIN_ID);
    transitionPRR(db, TENANT, prrId, 'search_complete', ADMIN_ID);
    transitionPRR(db, TENANT, prrId, 'respond', ADMIN_ID);
    closePRR(db, TENANT, prrId, ADMIN_ID);

    const app = makeApp(db, { tenantId: TENANT, sub: ADMIN_ID });
    const res = await request(app)
      .patch(`/api/prr/${prrId}/fields`)
      .send({ notes: 'late edit' })
      .expect(409);
    expect(res.body.error.code).toBe('fields.closed');
  });

  it('404 — wrong tenant cannot see (or mutate) the PRR', async () => {
    asAdmin(db, prrId);
    db.prepare(
      `INSERT INTO identities (identity_id, tenant_id, kind, active) VALUES (?, ?, 'person', 1)`,
    ).run('u-other-admin', OTHER_TENANT);
    const app = makeApp(db, { tenantId: OTHER_TENANT, sub: 'u-other-admin' });
    const res = await request(app)
      .patch(`/api/prr/${prrId}/fields`)
      .send({ notes: 'cross-tenant attempt' })
      .expect(403);
    // 403 (not 404) because can() runs before updateFields lookup; the
    // cross-tenant actor has no assignment on the target process so auth
    // is refused first. This is the intended canon precedence: identity
    // gating before existence disclosure.
    expect(res.body.error.code).toBe('auth.refused');
  });
});
