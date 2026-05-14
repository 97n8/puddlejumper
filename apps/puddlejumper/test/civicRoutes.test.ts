/**
 * civicRoutes.test.ts — Integration tests for /api/v1/civic/* routes
 *
 * Uses supertest + in-memory SQLite (tmpdir) + real JWT signing.
 * Covers: auth, RBAC, actor provisioning, objects, exceptions, org-manager.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import request from 'supertest';
import { signJwt, cookieParserMiddleware } from '@publiclogic/core';
import { createCivicRouter } from '../src/civic/civicRoutes.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN = { userId: 'admin-1', email: 'admin@test.gov', name: 'Alice Admin', role: 'admin', tenantId: 't1', tenants: ['t1'] };
const STAFF = { userId: 'staff-1', email: 'staff@test.gov', name: 'Bob Staff', role: 'staff', tenantId: 't1', tenants: ['t1'] };

async function tokenFor(user: Record<string, unknown>) {
  return signJwt(user, { expiresIn: '1h' });
}

let tmpDir: string;

function buildApp() {
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());
  app.use('/api/v1/civic', createCivicRouter(tmpDir));
  return app;
}

// Auth header helper
async function adminAuth() {
  return { Authorization: `Bearer ${await tokenFor(ADMIN)}`, 'Content-Type': 'application/json' };
}
async function staffAuth() {
  return { Authorization: `Bearer ${await tokenFor(STAFF)}`, 'Content-Type': 'application/json' };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'civic-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Auth & Actor Provisioning ─────────────────────────────────────────────────

describe('GET /api/v1/civic/me', () => {
  it('returns 401 without auth', async () => {
    const res = await request(buildApp()).get('/api/v1/civic/me');
    expect(res.status).toBe(401);
  });

  it('auto-provisions actor for new admin and returns actor info', async () => {
    const res = await request(buildApp())
      .get('/api/v1/civic/me')
      .set(await adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.actor.email).toBe('admin@test.gov');
    expect(res.body.actor.role).toBe('town_administrator');
    expect(res.body.actor.display_name).toBe('Alice Admin');
  });

  it('auto-provisions actor for new staff user with staff role', async () => {
    const res = await request(buildApp())
      .get('/api/v1/civic/me')
      .set(await staffAuth());
    expect(res.status).toBe(200);
    expect(res.body.actor.role).toBe('staff');
  });

  it('returns same actor on repeat calls (idempotent provisioning)', async () => {
    const app = buildApp();
    const h = await adminAuth();
    const r1 = await request(app).get('/api/v1/civic/me').set(h);
    const r2 = await request(app).get('/api/v1/civic/me').set(h);
    expect(r1.body.actor.id).toBe(r2.body.actor.id);
    expect(r1.body.actor.object_id).toBe(r2.body.actor.object_id);
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/civic/dashboard', () => {
  it('returns dashboard with vault score', async () => {
    const res = await request(buildApp())
      .get('/api/v1/civic/dashboard')
      .set(await adminAuth());
    expect(res.status).toBe(200);
    const { vault_score, due_this_week, exceptions, open_records_requests } = res.body;
    expect(vault_score).toBeDefined();
    expect(typeof vault_score.overall).toBe('number');
    expect(typeof vault_score.operational_mode).toBe('string');
    expect(Array.isArray(due_this_week)).toBe(true);
    expect(Array.isArray(exceptions)).toBe(true);
    expect(Array.isArray(open_records_requests)).toBe(true);
  });
});

// ── Objects ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/civic/objects', () => {
  it('creates an object', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/objects')
      .set(await adminAuth())
      .send({ type: 'record', subtype: 'general_record', vault_class: 'public' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.subtype).toBe('general_record');
  });

  it('returns 422 when type or subtype missing', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/objects')
      .set(await adminAuth())
      .send({ type: 'record' });
    expect(res.status).toBe(422);
  });

  it('auto-creates statutory deadline for records_request', async () => {
    const app = buildApp();
    const h = await adminAuth();
    const create = await request(app)
      .post('/api/v1/civic/objects')
      .set(h)
      .send({ type: 'record', subtype: 'records_request' });
    expect(create.status).toBe(201);

    const deadlines = await request(app).get('/api/v1/civic/deadlines').set(h);
    expect(deadlines.status).toBe(200);
    const rr = deadlines.body.deadlines.find((d: { label: string }) => d.label.includes('MGL c.66'));
    expect(rr).toBeDefined();
    expect(rr.statute_ref).toBe('MGL c.66 §10');
  });

  it('auto-creates statutory deadline for procurement', async () => {
    const app = buildApp();
    const h = await adminAuth();
    await request(app)
      .post('/api/v1/civic/objects')
      .set(h)
      .send({ type: 'case', subtype: 'procurement' });

    const deadlines = await request(app).get('/api/v1/civic/deadlines').set(h);
    const proc = deadlines.body.deadlines.find((d: { statute_ref: string }) => d.statute_ref === 'MGL c.30B §5');
    expect(proc).toBeDefined();
  });
});

describe('GET /api/v1/civic/objects', () => {
  it('lists objects', async () => {
    const app = buildApp();
    const h = await adminAuth();
    await request(app).post('/api/v1/civic/objects').set(h).send({ type: 'record', subtype: 'memo' });
    const res = await request(app).get('/api/v1/civic/objects').set(h);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.objects)).toBe(true);
    expect(res.body.objects.length).toBeGreaterThan(0);
  });

  it('filters by subtype', async () => {
    const app = buildApp();
    const h = await adminAuth();
    await request(app).post('/api/v1/civic/objects').set(h).send({ type: 'record', subtype: 'memo' });
    await request(app).post('/api/v1/civic/objects').set(h).send({ type: 'record', subtype: 'policy' });
    const res = await request(app).get('/api/v1/civic/objects?subtype=memo').set(h);
    expect(res.body.objects.every((o: { subtype: string }) => o.subtype === 'memo')).toBe(true);
  });
});

// ── Exceptions ────────────────────────────────────────────────────────────────

describe('POST /api/v1/civic/exceptions/:id/acknowledge', () => {
  it('returns 422 when reason is too short', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/exceptions/fake-id/acknowledge')
      .set(await adminAuth())
      .send({ reason: 'too short' });
    expect(res.status).toBe(422);
    expect(res.body.min_length).toBe(20);
  });

  it('returns 404 for unknown exception id', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/exceptions/does-not-exist/acknowledge')
      .set(await adminAuth())
      .send({ reason: 'This is a reason that is long enough to pass validation.' });
    expect(res.status).toBe(404);
  });
});

// ── RBAC — Org-Manager Routes ─────────────────────────────────────────────────

describe('RBAC: org-manager routes require town_administrator', () => {
  it('POST /org-manager/town returns 403 for staff role', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/org-manager/town')
      .set(await staffAuth())
      .send({ town_name: 'Springfield' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE');
  });

  it('POST /org-manager/staff returns 403 for staff role', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/org-manager/staff')
      .set(await staffAuth())
      .send({ staff: [] });
    expect(res.status).toBe(403);
  });

  it('POST /org-manager/bodies returns 403 for staff role', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/org-manager/bodies')
      .set(await staffAuth())
      .send({ bodies: [] });
    expect(res.status).toBe(403);
  });

  it('POST /org-manager/configure returns 403 for staff role', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/org-manager/configure')
      .set(await staffAuth())
      .send({ modules: [{ moduleId: 'records' }] });
    expect(res.status).toBe(403);
  });

  it('POST /org-manager/complete returns 403 for staff role', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/org-manager/complete')
      .set(await staffAuth())
      .send({});
    expect(res.status).toBe(403);
  });

  it('POST /org-manager/town succeeds for admin', async () => {
    const res = await request(buildApp())
      .post('/api/v1/civic/org-manager/town')
      .set(await adminAuth())
      .send({ town_name: 'Springfield', governance_form: 'town_manager' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /org-manager/status is accessible to all authenticated users', async () => {
    const res = await request(buildApp())
      .get('/api/v1/civic/org-manager/status')
      .set(await staffAuth());
    expect(res.status).toBe(200);
  });
});

// ── Org-Manager Full Setup Flow ───────────────────────────────────────────────

describe('org-manager: full setup flow', () => {
  it('saves town, staff, bodies, and completes setup', async () => {
    const app = buildApp();
    const h = await adminAuth();

    // 1. Save town
    const town = await request(app)
      .post('/api/v1/civic/org-manager/town')
      .set(h)
      .send({ town_name: 'Testville', governance_form: 'town_meeting', county: 'Middlesex' });
    expect(town.status).toBe(200);

    // 2. Save staff
    const staff = await request(app)
      .post('/api/v1/civic/org-manager/staff')
      .set(h)
      .send({ staff: [{ name: 'Jane Clerk', email: 'clerk@testville.gov', title: 'Town Clerk', role: 'staff' }] });
    expect(staff.status).toBe(200);

    // 3. Save bodies
    const bodies = await request(app)
      .post('/api/v1/civic/org-manager/bodies')
      .set(h)
      .send({ bodies: [{ name: 'Board of Selectmen', type: 'select_board', members: '3' }] });
    expect(bodies.status).toBe(200);

    // 4. Complete setup
    const complete = await request(app)
      .post('/api/v1/civic/org-manager/complete')
      .set(h)
      .send({});
    expect(complete.status).toBe(200);
    expect(complete.body.completed_at).toBeDefined();

    // 5. Verify status shows complete
    const status = await request(app)
      .get('/api/v1/civic/org-manager/status')
      .set(h);
    expect(status.status).toBe(200);
    expect(status.body.complete).toBe(true);
  });

  it('complete succeeds on pre-seeded DB (Phillipston seed has town profile)', async () => {
    // The DB is seeded with a default town, so complete should succeed even without prior POST /org-manager/town
    const res = await request(buildApp())
      .post('/api/v1/civic/org-manager/complete')
      .set(await adminAuth())
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── Deadlines & Audit ─────────────────────────────────────────────────────────

describe('GET /api/v1/civic/deadlines', () => {
  it('returns empty list on fresh DB', async () => {
    const res = await request(buildApp())
      .get('/api/v1/civic/deadlines')
      .set(await adminAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.deadlines)).toBe(true);
  });
});

describe('GET /api/v1/civic/audit', () => {
  it('returns audit entries after object creation', async () => {
    const app = buildApp();
    const h = await adminAuth();
    await request(app).post('/api/v1/civic/objects').set(h).send({ type: 'record', subtype: 'memo' });
    const res = await request(app).get('/api/v1/civic/audit').set(h);
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThan(0);
  });
});
