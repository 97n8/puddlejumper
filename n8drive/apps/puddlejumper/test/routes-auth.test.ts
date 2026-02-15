import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { signJwt, cookieParserMiddleware, csrfProtection, validateJwt } from '@publiclogic/core';
import { createAuthRoutes } from '../src/api/routes/auth.js';

// ── Test helpers ────────────────────────────────────────────────────────────

const TEST_PASSWORD = 'test-p@ssw0rd';
const HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

const TEST_USER = {
  id: 'u1',
  username: 'admin',
  passwordHash: HASH,
  name: 'Test Admin',
  role: 'admin',
  permissions: ['deploy', 'evaluate.execute'],
  tenants: ['tenant-1'],
  tenantId: 'tenant-1',
};

function buildApp(overrides: Record<string, any> = {}) {
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());

  // Decode JWT from Bearer header or cookie (simulates the server's auth gating)
  app.use(async (req: any, _res: any, next: any) => {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }
    if (token) {
      try {
        const { verifyJwt } = await import('@publiclogic/core');
        req.auth = await verifyJwt(token);
      } catch { /* unauthenticated */ }
    }
    next();
  });

  app.use(csrfProtection());

  const router = createAuthRoutes({
    builtInLoginEnabled: true,
    loginUsers: [TEST_USER],
    loginRateLimit: (_req: any, _res: any, next: any) => next(), // no-op rate limiter
    nodeEnv: 'test',
    trustedParentOrigins: ['http://localhost:3000'],
    ...overrides,
  });
  app.use('/api', router);
  return app;
}

async function getAuthToken() {
  return signJwt(
    { sub: TEST_USER.id, name: TEST_USER.name, role: TEST_USER.role, permissions: TEST_USER.permissions, tenants: TEST_USER.tenants, tenantId: TEST_USER.tenantId },
    { expiresIn: '1h' },
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Auth routes', () => {
  describe('POST /api/login', () => {
    it('returns 200 + JWT cookie for valid credentials', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/login')
        .set('X-PuddleJumper-Request', 'true')
        .send({ username: 'admin', password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user).toEqual({ id: 'u1', name: 'Test Admin', role: 'admin' });
      // Should set a jwt cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const jwtCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) => c.startsWith('jwt='));
      expect(jwtCookie).toBeDefined();
    });

    it('returns 401 for invalid password', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/login')
        .set('X-PuddleJumper-Request', 'true')
        .send({ username: 'admin', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns 401 for non-existent user', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/login')
        .set('X-PuddleJumper-Request', 'true')
        .send({ username: 'nobody', password: TEST_PASSWORD });
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing fields', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/login')
        .set('X-PuddleJumper-Request', 'true')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request payload');
    });

    it('returns 404 when login is disabled', async () => {
      const app = buildApp({ builtInLoginEnabled: false });
      const res = await request(app)
        .post('/api/login')
        .set('X-PuddleJumper-Request', 'true')
        .send({ username: 'admin', password: TEST_PASSWORD });
      expect(res.status).toBe(404);
    });

    it('returns 503 when no users configured', async () => {
      const app = buildApp({ loginUsers: [] });
      const res = await request(app)
        .post('/api/login')
        .set('X-PuddleJumper-Request', 'true')
        .send({ username: 'admin', password: TEST_PASSWORD });
      expect(res.status).toBe(503);
    });

    it('returns 403 without CSRF header', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'admin', password: TEST_PASSWORD });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/logout', () => {
    it('clears JWT cookie for authenticated user', async () => {
      const app = buildApp();
      const token = await getAuthToken();
      const res = await request(app)
        .post('/api/logout')
        .set('X-PuddleJumper-Request', 'true')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/logout')
        .set('X-PuddleJumper-Request', 'true');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/identity', () => {
    it('returns user identity for authenticated user', async () => {
      const app = buildApp();
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/identity')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Admin');
      expect(res.body.role).toBe('admin');
      expect(res.body.initials).toBe('TA');
      expect(res.body.trustedParentOrigins).toEqual(['http://localhost:3000']);
    });

    it('returns 401 without auth', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/identity');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/status', () => {
    it('returns authenticated=true with user info when valid JWT cookie', async () => {
      const app = buildApp();
      const token = await signJwt(
        { sub: 'u1', email: 'admin@test.com', name: 'Test Admin', provider: 'github' },
        { expiresIn: '1h' },
      );
      const res = await request(app)
        .get('/api/auth/status')
        .set('Cookie', `jwt=${token}`);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.sub).toBe('u1');
      expect(res.body.user.email).toBe('admin@test.com');
      expect(res.body.user.name).toBe('Test Admin');
      expect(res.body.user.provider).toBe('github');
    });

    it('returns authenticated=true when using Bearer header', async () => {
      const app = buildApp();
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.sub).toBe('u1');
    });

    it('returns 200 with authenticated=false when no auth', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });
  });
});
