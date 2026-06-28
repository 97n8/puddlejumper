// Route-level coverage for GET /api/casespaces/:id (Visibility Layer #101).
// The projection itself is covered in @pj/casespace-view; this file exercises
// the HTTP surface: auth/tenant gating + that the endpoint returns the same
// CaseSpaceView the projection produces (web renders what backend projects).

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  runPipeline,
  seedTimedeskMuni,
  seedOutputTemplate,
  TIMEDESK_MUNI,
  TIMESHEET_REVIEW_SUMMARY,
} from '@pj/pipeline';
import { projectCaseSpaceView } from '@pj/casespace-view';
import { createCanonCaseSpaceRouter } from '../src/routes/casespace.routes.js';

const TENANT = 't-canon';

interface AuthStub {
  tenantId: string;
  sub: string;
}

function fresh(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    TENANT,
    'Canon',
    '1.0.0',
  );
  seedTimedeskMuni(db, TENANT);
  seedOutputTemplate(db, {
    tenant_id: TENANT,
    module: TIMEDESK_MUNI.module,
    environment: TIMEDESK_MUNI.environment,
    name: 'timesheet_review_summary',
    body: TIMESHEET_REVIEW_SUMMARY,
  });
  return db;
}

function makeApp(db: DatabaseHandle, auth: AuthStub | null): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // @ts-expect-error — stub the canonical auth payload directly.
    req.auth = auth;
    next();
  });
  app.use('/api', createCanonCaseSpaceRouter({ db }));
  return app;
}

function runMuni(db: DatabaseHandle, caseSpaceId: string): void {
  runPipeline(db, {
    pack: 'timedesk.muni',
    tenant_id: TENANT,
    deployment_id: 'dpl-test',
    module: TIMEDESK_MUNI.module,
    environment: TIMEDESK_MUNI.environment,
    case_space_id: caseSpaceId,
    item: { employee_id: 'emp-7' },
  });
}

describe('GET /api/casespaces/:id', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = fresh();
  });

  it('401 when unauthenticated', async () => {
    const app = makeApp(db, null);
    const res = await request(app).get('/api/casespaces/cs-1');
    // The canon requireAuthenticated() middleware short-circuits with a 401
    // before the handler runs.
    expect(res.status).toBe(401);
  });

  it('returns the CaseSpaceView for an authenticated tenant', async () => {
    runMuni(db, 'cs-muni');
    const app = makeApp(db, { tenantId: TENANT, sub: 'u-1' });
    const res = await request(app).get('/api/casespaces/cs-muni');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Endpoint returns exactly what the projection produces.
    const expected = projectCaseSpaceView(db, {
      tenant_id: TENANT,
      case_space_id: 'cs-muni',
    });
    expect(res.body.data).toEqual(expected);
    // Sanity: muni created two pending payroll holds.
    expect(res.body.data.waitingOn).toHaveLength(2);
    expect(res.body.data.currentState.waitingApproval).toBe(2);
  });

  it('Show Proof returns the same audit ids Recent Changes summarized', async () => {
    runMuni(db, 'cs-muni');
    const app = makeApp(db, { tenantId: TENANT, sub: 'u-1' });
    const res = await request(app).get('/api/casespaces/cs-muni');

    const { recentChanges, proof } = res.body.data;
    expect(proof.map((p: { auditEventId: string }) => p.auditEventId)).toEqual(
      recentChanges.map((c: { auditEventId: string }) => c.auditEventId),
    );
  });

  it('empty CaseSpace returns a clean zero-state', async () => {
    const app = makeApp(db, { tenantId: TENANT, sub: 'u-1' });
    const res = await request(app).get('/api/casespaces/cs-empty');
    expect(res.status).toBe(200);
    expect(res.body.data.currentState).toEqual({
      active: 0,
      waitingApproval: 0,
      blocked: 0,
    });
    expect(res.body.data.waitingOn).toEqual([]);
    expect(res.body.data.proof).toEqual([]);
  });

  it('does not leak another tenant CaseSpace (tenant-scoped)', async () => {
    runMuni(db, 'cs-muni');
    // A different tenant asking for the same case_space_id sees nothing.
    const app = makeApp(db, { tenantId: 't-other', sub: 'u-x' });
    const res = await request(app).get('/api/casespaces/cs-muni');
    expect(res.status).toBe(200);
    expect(res.body.data.waitingOn).toEqual([]);
    expect(res.body.data.currentState.waitingApproval).toBe(0);
    expect(res.body.data.proof).toEqual([]);
  });
});
