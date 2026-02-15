import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Isolate refresh-token store to a temp dir
const tmpDir = path.join(os.tmpdir(), `login-test-store-${Date.now()}`);
process.env.LOGIC_COMMONS_DATA_DIR = tmpDir;

// Set env before importing modules that read it at load time
beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-logic-commons';
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || 'test-issuer';
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || 'test-audience';
});

// Import after env is set
const { resetDb } = await import('../src/lib/refreshTokenStore.js');
const { cookieParserMiddleware, createOptionalJwtAuthenticationMiddleware, signJwt } = await import('@publiclogic/core');

// Build a lightweight test app that mirrors server.ts wiring
async function createTestApp() {
  const loginRouter = (await import('../src/routes/login.js')).default;
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());
  // Optional JWT for /api/auth/revoke
  app.use('/api/auth', createOptionalJwtAuthenticationMiddleware());
  app.use('/api', loginRouter);
  return app;
}

beforeEach(() => {
  resetDb();
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(async () => {
  resetDb();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── Helper: mock GitHub fetch and perform login ─────────────────────────
function mockGitHubOk() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 42, login: 'testuser', name: 'Test', email: 'test@example.com' }),
  } as any);
}

async function loginAndGetCookie(app: express.Express): Promise<string> {
  mockGitHubOk();
  const res = await request(app)
    .post('/api/login')
    .send({ provider: 'github', providerToken: 'ghp_valid' });
  expect(res.status).toBe(200);
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const rc = cookies.find((c: string) => c.startsWith('pj_refresh='));
  expect(rc).toBeDefined();
  return rc!.split(';')[0]; // "pj_refresh=<token>"
}

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/login', () => {
  it('returns 400 when provider is missing', async () => {
    const app = await createTestApp();
    const res = await request(app).post('/api/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/provider/i);
  });

  it('returns 400 for unsupported provider', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/login')
      .send({ provider: 'facebook', providerToken: 'tok' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported/i);
  });

  it('returns 401 for github with invalid token', async () => {
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
  });

  it('returns jwt and sets pj_refresh cookie for valid github login', async () => {
    mockGitHubOk();
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jwt');
    expect(typeof res.body.jwt).toBe('string');

    // Should set pj_refresh cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('pj_refresh='))
      : (cookies as string);
    expect(refreshCookie).toContain('pj_refresh=');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/api');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/refresh', () => {
  it('returns 401 when no refresh cookie is present', async () => {
    const app = await createTestApp();
    const res = await request(app).post('/api/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no refresh token/i);
  });

  it('returns a new access jwt when given a valid refresh cookie', async () => {
    const app = await createTestApp();
    const cookie = await loginAndGetCookie(app);

    const refreshRes = await request(app)
      .post('/api/refresh')
      .set('Cookie', cookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('jwt');
    expect(typeof refreshRes.body.jwt).toBe('string');
    expect(refreshRes.body.jwt.split('.').length).toBe(3);
  });

  it('rotates refresh token and returns new cookie', async () => {
    const app = await createTestApp();
    const cookie1 = await loginAndGetCookie(app);

    const refreshRes = await request(app)
      .post('/api/refresh')
      .set('Cookie', cookie1);
    expect(refreshRes.status).toBe(200);

    const newCookies = refreshRes.headers['set-cookie'] as unknown as string[];
    const cookie2 = newCookies.find((c: string) => c.startsWith('pj_refresh='))!.split(';')[0];
    expect(cookie2).toBeDefined();
    expect(cookie2).not.toBe(cookie1);
  });

  it('invalidates old refresh token after rotation', async () => {
    const app = await createTestApp();
    const oldCookie = await loginAndGetCookie(app);

    // First refresh succeeds
    await request(app).post('/api/refresh').set('Cookie', oldCookie);

    // Second use of old cookie — replay detected
    const retryRes = await request(app).post('/api/refresh').set('Cookie', oldCookie);
    expect(retryRes.status).toBe(401);
    expect(retryRes.body.error).toBe('token_reuse_detected');
  });

  it('replay detection revokes entire family chain', async () => {
    const app = await createTestApp();
    const cookie1 = await loginAndGetCookie(app);

    // Rotate: cookie1 → cookie2
    const r1 = await request(app).post('/api/refresh').set('Cookie', cookie1);
    expect(r1.status).toBe(200);
    const cookie2 = (r1.headers['set-cookie'] as unknown as string[])
      .find((c: string) => c.startsWith('pj_refresh='))!.split(';')[0];

    // Replay cookie1 — triggers family revocation
    const replay = await request(app).post('/api/refresh').set('Cookie', cookie1);
    expect(replay.status).toBe(401);

    // cookie2 should also be revoked (same family)
    const r2 = await request(app).post('/api/refresh').set('Cookie', cookie2);
    expect(r2.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('revokes token and clears cookie', async () => {
    const app = await createTestApp();
    const cookie = await loginAndGetCookie(app);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Cookie should be cleared
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const cleared = setCookies?.find((c: string) => c.startsWith('pj_refresh='));
    expect(cleared).toContain('pj_refresh=');

    // Refresh with same cookie should fail
    const refreshRes = await request(app)
      .post('/api/refresh')
      .set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });

  it('returns 200 even when no cookie is present', async () => {
    const app = await createTestApp();
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/revoke', () => {
  it('returns 401 without a Bearer token', async () => {
    const app = await createTestApp();
    const res = await request(app).post('/api/auth/revoke');
    expect(res.status).toBe(401);
  });

  it('revokes all tokens for the calling user', async () => {
    const app = await createTestApp();
    const cookie = await loginAndGetCookie(app);

    // Create an access token for user 42
    const accessToken = await signJwt(
      { sub: '42', name: 'Test', role: 'user' } as any,
      { expiresIn: '1h' } as any,
    );

    const res = await request(app)
      .post('/api/auth/revoke')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('revoked');
    expect(res.body.revoked).toBeGreaterThanOrEqual(1);

    // Refresh with same cookie should fail
    const refreshRes = await request(app)
      .post('/api/refresh')
      .set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });

  it('non-admin cannot revoke another user', async () => {
    const app = await createTestApp();
    const accessToken = await signJwt(
      { sub: '42', name: 'Test', role: 'user' } as any,
      { expiresIn: '1h' } as any,
    );

    const res = await request(app)
      .post('/api/auth/revoke')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ user_id: 'other-user' });
    expect(res.status).toBe(403);
  });

  it('admin can revoke another user', async () => {
    const app = await createTestApp();

    // Login as "other-user" to create tokens for them
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 999, login: 'otheruser', name: 'Other', email: 'other@example.com' }),
    } as any);
    const otherLoginRes = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_other' });
    expect(otherLoginRes.status).toBe(200);

    // Admin access token
    const adminToken = await signJwt(
      { sub: '1', name: 'Admin', role: 'admin' } as any,
      { expiresIn: '1h' } as any,
    );

    const res = await request(app)
      .post('/api/auth/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: '999' });
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBeGreaterThanOrEqual(1);
  });
});
