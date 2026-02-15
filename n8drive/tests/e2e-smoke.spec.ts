import { test, expect } from '@playwright/test';

test.describe('Health endpoint', () => {
  test('GET /health returns 200 with ok status', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('puddle-jumper-deploy-remote');
    expect(body.checks).toBeDefined();
    expect(body.secrets).toBeDefined();
  });

  test('health response includes database checks', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body.checks.prr).toBeDefined();
    expect(body.checks.connectors).toBeDefined();
  });
});

test.describe('Auth status', () => {
  test('GET /api/auth/status returns unauthenticated without cookies', async ({ request }) => {
    const res = await request.get('/api/auth/status');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });
});

test.describe('OAuth login redirects', () => {
  test('GET /api/auth/github/login redirects to GitHub', async ({ request }) => {
    const res = await request.get('/api/auth/github/login', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('github.com/login/oauth/authorize');
  });

  test('GET /api/auth/google/login redirects to Google', async ({ request }) => {
    const res = await request.get('/api/auth/google/login', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('accounts.google.com/o/oauth2');
  });

  test('GET /api/auth/microsoft/login redirects to Microsoft', async ({ request }) => {
    const res = await request.get('/api/auth/microsoft/login', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('login.microsoftonline.com');
  });
});

test.describe('OAuth rate limiting', () => {
  test('returns rate limit headers on OAuth login', async ({ request }) => {
    const res = await request.get('/api/auth/github/login', {
      maxRedirects: 0,
    });
    expect(res.headers()['x-ratelimit-limit']).toBe('10');
    expect(res.headers()['x-ratelimit-remaining']).toBeDefined();
  });
});

test.describe('Protected endpoints require auth', () => {
  test('GET /api/identity returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/identity');
    expect(res.status()).toBe(401);
  });

  test('GET /api/config/context returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/config/context');
    expect(res.status()).toBe(401);
  });

  test('GET /api/admin/audit returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/admin/audit');
    expect(res.status()).toBe(401);
  });
});
