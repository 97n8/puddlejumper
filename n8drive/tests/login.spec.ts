import { test, expect } from '@playwright/test';

// ── API-level tests (no browser needed) ────────────────────────

test.describe('CSRF enforcement', () => {
  test('POST /api/login without CSRF header returns 403', async ({ request }) => {
    const res = await request.post('/api/login', {
      data: { provider: 'github', providerToken: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/CSRF/i);
  });

  test('POST /api/login with CSRF header passes CSRF check', async ({ request }) => {
    const res = await request.post('/api/login', {
      data: { provider: 'github', providerToken: 'fake' },
      headers: {
        'Content-Type': 'application/json',
        'X-PuddleJumper-Request': 'true',
      },
    });
    // Should get past CSRF — will fail on auth (401) not CSRF (403)
    expect(res.status()).not.toBe(403);
  });

  test('GET requests are not blocked by CSRF', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBe(true);
  });
});

test.describe('POST /api/login', () => {
  test('returns 400 when provider is missing', async ({ request }) => {
    const res = await request.post('/api/login', {
      data: {},
      headers: {
        'Content-Type': 'application/json',
        'X-PuddleJumper-Request': 'true',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/provider/i);
  });

  test('returns 400 for unsupported provider', async ({ request }) => {
    const res = await request.post('/api/login', {
      data: { provider: 'facebook', providerToken: 'tok' },
      headers: {
        'Content-Type': 'application/json',
        'X-PuddleJumper-Request': 'true',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported/i);
  });

  test('returns 401 for github with invalid token', async ({ request }) => {
    const res = await request.post('/api/login', {
      data: { provider: 'github', providerToken: 'ghp_invalid_token' },
      headers: {
        'Content-Type': 'application/json',
        'X-PuddleJumper-Request': 'true',
      },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('POST /api/refresh', () => {
  test('returns 401 when no refresh cookie is present', async ({ request }) => {
    const res = await request.post('/api/refresh', {
      headers: { 'X-PuddleJumper-Request': 'true' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/no refresh token/i);
  });
});
