import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
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

// Build a lightweight test app that mirrors server.ts wiring
async function createTestApp() {
  const loginRouter = (await import('../src/routes/login.js')).default;
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', loginRouter);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

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
    // Mock fetch to simulate GitHub rejecting the token
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
    // Mock fetch to simulate a valid GitHub user
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, login: 'testuser', name: 'Test', email: 'test@example.com' }),
    } as any);

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
    expect(refreshCookie).toContain('Path=/api/refresh');
  });
});

describe('POST /api/refresh', () => {
  it('returns 401 when no refresh cookie is present', async () => {
    const app = await createTestApp();
    const res = await request(app).post('/api/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no refresh token/i);
  });

  it('returns a new access jwt when given a valid refresh cookie', async () => {
    // First, do a login to get a refresh cookie
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, login: 'testuser', name: 'Test', email: 'test@example.com' }),
    } as any);

    const app = await createTestApp();
    const loginRes = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });

    // Extract pj_refresh cookie value
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c: string) => c.startsWith('pj_refresh='));
    expect(refreshCookie).toBeDefined();

    // Parse just the cookie value
    const cookieValue = refreshCookie!.split(';')[0]; // "pj_refresh=<token>"

    const refreshRes = await request(app)
      .post('/api/refresh')
      .set('Cookie', cookieValue);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('jwt');
    expect(typeof refreshRes.body.jwt).toBe('string');
    // Verify the refreshed token is a valid JWT (header.payload.signature)
    expect(refreshRes.body.jwt.split('.').length).toBe(3);
  });

  it('rotates refresh token and returns new cookie', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, login: 'testuser', name: 'Test', email: 'test@example.com' }),
    } as any);

    const app = await createTestApp();

    // Login to get initial refresh cookie
    const loginRes = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const cookie1 = cookies.find((c: string) => c.startsWith('pj_refresh='))!.split(';')[0];

    // Refresh — should rotate and return new cookie
    const refreshRes = await request(app)
      .post('/api/refresh')
      .set('Cookie', cookie1);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('jwt');

    const newCookies = refreshRes.headers['set-cookie'] as unknown as string[];
    const cookie2 = newCookies.find((c: string) => c.startsWith('pj_refresh='))!.split(';')[0];
    expect(cookie2).toBeDefined();
    expect(cookie2).not.toBe(cookie1); // must be a different token
  });

  it('invalidates old refresh token after rotation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, login: 'testuser', name: 'Test', email: 'test@example.com' }),
    } as any);

    const app = await createTestApp();

    const loginRes = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const oldCookie = cookies.find((c: string) => c.startsWith('pj_refresh='))!.split(';')[0];

    // First refresh succeeds
    await request(app).post('/api/refresh').set('Cookie', oldCookie);

    // Second use of old cookie should fail (revoked)
    const retryRes = await request(app).post('/api/refresh').set('Cookie', oldCookie);
    expect(retryRes.status).toBe(401);
  });
});

describe('POST /api/revoke', () => {
  it('returns 204 and prevents subsequent refresh', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, login: 'testuser', name: 'Test', email: 'test@example.com' }),
    } as any);

    const app = await createTestApp();

    const loginRes = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'ghp_valid' });
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.find((c: string) => c.startsWith('pj_refresh='))!.split(';')[0];

    // Revoke
    const revokeRes = await request(app)
      .post('/api/revoke')
      .set('Cookie', cookie);
    expect(revokeRes.status).toBe(204);

    // Refresh with same cookie should fail
    const afterRes = await request(app)
      .post('/api/refresh')
      .set('Cookie', cookie);
    expect(afterRes.status).toBe(401);
  });

  it('returns 204 even when no cookie is present (idempotent)', async () => {
    const app = await createTestApp();
    const res = await request(app).post('/api/revoke');
    expect(res.status).toBe(204);
  });
});
