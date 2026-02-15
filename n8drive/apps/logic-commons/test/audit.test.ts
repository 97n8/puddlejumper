import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Isolate stores to a temp dir
const tmpDir = path.join(os.tmpdir(), `audit-test-store-${Date.now()}`);
process.env.LOGIC_COMMONS_DATA_DIR = tmpDir;

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-logic-commons';
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || 'test-issuer';
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || 'test-audience';
});

const { resetDb } = await import('../src/lib/refreshTokenStore.js');
const { resetAuditDb, queryAuditEvents } = await import('../src/lib/auditStore.js');
const { cookieParserMiddleware, createOptionalJwtAuthenticationMiddleware, createJwtAuthenticationMiddleware, signJwt } = await import('@publiclogic/core');

async function createTestApp() {
  const loginRouter = (await import('../src/routes/login.js')).default;
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());
  app.use('/api/auth', createOptionalJwtAuthenticationMiddleware());
  app.use('/api/admin', createJwtAuthenticationMiddleware());
  app.use('/api', loginRouter);
  return app;
}

function mockGitHubOk(id = 42, login = 'testuser') {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id, login, name: 'Test', email: 'test@example.com' }),
  } as any);
}

beforeEach(() => {
  resetDb();
  resetAuditDb();
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(async () => {
  resetDb();
  resetAuditDb();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Audit event persistence', () => {
  it('login emits auth.login event', async () => {
    const app = await createTestApp();
    mockGitHubOk();
    const res = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });
    expect(res.status).toBe(200);

    const events = queryAuditEvents({ event_type: 'auth.login' });
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe('auth.login');
    expect(events[0].actor_id).toBe('42');
  });

  it('failed login emits auth.login_failed event', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Bad credentials',
    } as any);

    const app = await createTestApp();
    const res = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'bad' });
    expect(res.status).toBe(401);

    const events = queryAuditEvents({ event_type: 'auth.login_failed' });
    expect(events.length).toBe(1);
  });

  it('refresh emits auth.refresh event', async () => {
    const app = await createTestApp();
    mockGitHubOk();
    const loginRes = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });
    const cookie = (loginRes.headers['set-cookie'] as unknown as string[])
      .find((c: string) => c.startsWith('pj_refresh='))!.split(';')[0];

    const refreshRes = await request(app)
      .post('/api/refresh')
      .set('Cookie', cookie);
    expect(refreshRes.status).toBe(200);

    const events = queryAuditEvents({ event_type: 'auth.refresh' });
    expect(events.length).toBe(1);
  });

  it('replay emits auth.token_reuse_detected event', async () => {
    const app = await createTestApp();
    mockGitHubOk();
    const loginRes = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });
    const cookie = (loginRes.headers['set-cookie'] as unknown as string[])
      .find((c: string) => c.startsWith('pj_refresh='))!.split(';')[0];

    // First refresh rotates
    await request(app).post('/api/refresh').set('Cookie', cookie);
    // Replay old token
    const replay = await request(app).post('/api/refresh').set('Cookie', cookie);
    expect(replay.status).toBe(401);

    const events = queryAuditEvents({ event_type: 'auth.token_reuse_detected' });
    expect(events.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/audit', () => {
  it('returns 401 without auth', async () => {
    const app = await createTestApp();
    const res = await request(app).get('/api/admin/audit');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const app = await createTestApp();
    const userToken = await signJwt(
      { sub: '42', name: 'Test', role: 'user' } as any,
      { expiresIn: '1h' } as any,
    );
    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('returns audit events for admin', async () => {
    const app = await createTestApp();
    mockGitHubOk();

    // Generate some events
    await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });

    const adminToken = await signJwt(
      { sub: '1', name: 'Admin', role: 'admin' } as any,
      { expiresIn: '1h' } as any,
    );
    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.events).toBeInstanceOf(Array);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
    expect(res.body.events[0]).toHaveProperty('event_type');
    expect(res.body.events[0]).toHaveProperty('timestamp');
  });

  it('filters by event_type', async () => {
    const app = await createTestApp();
    mockGitHubOk();

    // Login to create an event
    await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });

    const adminToken = await signJwt(
      { sub: '1', name: 'Admin', role: 'admin' } as any,
      { expiresIn: '1h' } as any,
    );

    // Query for non-existent type
    const res = await request(app)
      .get('/api/admin/audit?event_type=auth.nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBe(0);

    // Query for existing type
    const res2 = await request(app)
      .get('/api/admin/audit?event_type=auth.login')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.events.length).toBe(1);
  });
});
