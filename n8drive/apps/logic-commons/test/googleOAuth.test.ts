import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Isolate stores to a temp dir
const tmpDir = path.join(os.tmpdir(), `google-oauth-test-${Date.now()}`);
process.env.LOGIC_COMMONS_DATA_DIR = tmpDir;

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-google-oauth';
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || 'test-issuer';
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || 'test-audience';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3002/api/auth/google/callback';
  process.env.FRONTEND_URL = 'http://localhost:3000';
});

const { resetDb } = await import('../src/lib/refreshTokenStore.js');
const { cookieParserMiddleware, createOptionalJwtAuthenticationMiddleware } = await import('@publiclogic/core');

async function createTestApp() {
  const loginRouter = (await import('../src/routes/login.js')).default;
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());
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

describe('Google OAuth redirect flow', () => {
  it('GET /api/auth/google/login redirects to Google with correct params', async () => {
    const app = await createTestApp();
    const res = await request(app).get('/api/auth/google/login');

    expect(res.status).toBe(302);
    const location = res.headers.location;
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain('client_id=test-google-client-id');
    expect(location).toContain('scope=openid+email+profile');
    expect(location).toContain('response_type=code');
    expect(location).toContain('state=');

    // Should set google_oauth_state cookie
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const stateCookie = cookies.find((c: string) => c.startsWith('google_oauth_state='));
    expect(stateCookie).toBeDefined();
    expect(stateCookie).toContain('HttpOnly');
  });

  it('returns 500 if GOOGLE_CLIENT_ID is not set', async () => {
    const original = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    try {
      const app = await createTestApp();
      const res = await request(app).get('/api/auth/google/login');
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('not configured');
    } finally {
      process.env.GOOGLE_CLIENT_ID = original;
    }
  });

  it('rejects callback with mismatched state', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .get('/api/auth/google/callback?code=test-code&state=wrong-state');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('state');
  });

  it('rejects callback without code', async () => {
    const app = await createTestApp();

    // First get a valid state
    const loginRes = await request(app).get('/api/auth/google/login');
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith('google_oauth_state='));
    const stateValue = stateCookie!.split('=')[1].split(';')[0];

    const res = await request(app)
      .get(`/api/auth/google/callback?state=${stateValue}`)
      .set('Cookie', `google_oauth_state=${stateValue}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('code');
  });

  it('completes full OAuth flow with mocked Google API', async () => {
    const app = await createTestApp();

    // Step 1: Get redirect URL and state
    const loginRes = await request(app).get('/api/auth/google/login');
    expect(loginRes.status).toBe(302);
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith('google_oauth_state='));
    const stateValue = stateCookie!.split('=')[1].split(';')[0];

    // Step 2: Mock Google token exchange + userinfo API
    let fetchCallCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      fetchCallCount++;
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'ya29_mock_access_token' }),
        };
      }
      if (String(url).includes('googleapis.com/oauth2/v2/userinfo')) {
        return {
          ok: true,
          json: async () => ({
            id: '1234567890',
            email: 'user@gmail.com',
            name: 'Test User',
            verified_email: true,
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    // Step 3: Hit callback with valid state + code
    const callbackRes = await request(app)
      .get(`/api/auth/google/callback?code=test-auth-code&state=${stateValue}`)
      .set('Cookie', `google_oauth_state=${stateValue}`);

    // Should redirect to frontend with access token in hash
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toContain('http://localhost:3000/#access_token=');

    // Should set pj_refresh cookie
    const responseCookies = callbackRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = responseCookies.find((c: string) => c.startsWith('pj_refresh='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');

    // Should have called both Google endpoints
    expect(fetchCallCount).toBe(2);
  });

  it('redirects to frontend with error on token exchange failure', async () => {
    const app = await createTestApp();

    // Get state
    const loginRes = await request(app).get('/api/auth/google/login');
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith('google_oauth_state='));
    const stateValue = stateCookie!.split('=')[1].split(';')[0];

    // Mock failed token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'invalid_grant', error_description: 'Code expired' }),
    });

    const callbackRes = await request(app)
      .get(`/api/auth/google/callback?code=expired-code&state=${stateValue}`)
      .set('Cookie', `google_oauth_state=${stateValue}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('http://localhost:3000/#error=authentication_failed');
  });

  it('state is single-use (replay rejected)', async () => {
    const app = await createTestApp();

    // Get state
    const loginRes = await request(app).get('/api/auth/google/login');
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith('google_oauth_state='));
    const stateValue = stateCookie!.split('=')[1].split(';')[0];

    // Mock successful exchange
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return { ok: true, json: async () => ({ access_token: 'ya29_valid' }) };
      }
      return {
        ok: true,
        json: async () => ({ id: '99', email: 'u@gmail.com', name: 'User' }),
      };
    });

    // First call succeeds
    const first = await request(app)
      .get(`/api/auth/google/callback?code=code1&state=${stateValue}`)
      .set('Cookie', `google_oauth_state=${stateValue}`);
    expect(first.status).toBe(302);
    expect(first.headers.location).toContain('#access_token=');

    // Replay with same state — rejected
    const replay = await request(app)
      .get(`/api/auth/google/callback?code=code2&state=${stateValue}`)
      .set('Cookie', `google_oauth_state=${stateValue}`);
    expect(replay.status).toBe(400);
  });
});
