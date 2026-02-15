import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Set env before importing modules that read it at load time
beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-logic-commons';
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || 'test-issuer';
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || 'test-audience';
});

async function createTestApp() {
  const { csrfProtection } = await import('@publiclogic/core');
  const loginRouter = (await import('../src/routes/login.js')).default;
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', csrfProtection());
  app.use('/api', loginRouter);

  // Simple test route for non-mutating requests
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));

  return app;
}

describe('CSRF protection', () => {
  it('rejects POST without X-PuddleJumper-Request header with 403', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/login')
      .send({ provider: 'github', providerToken: 'tok' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CSRF/i);
  });

  it('allows POST when X-PuddleJumper-Request header is set', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/login')
      .set('X-PuddleJumper-Request', 'true')
      .send({ provider: 'github', providerToken: 'tok' });
    // Should pass CSRF check — whatever status comes back is NOT 403
    expect(res.status).not.toBe(403);
  });

  it('allows GET requests without CSRF header', async () => {
    const app = await createTestApp();
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('rejects PUT without header', async () => {
    const app = await createTestApp();
    const res = await request(app).put('/api/login').send({});
    expect(res.status).toBe(403);
  });

  it('rejects DELETE without header', async () => {
    const app = await createTestApp();
    const res = await request(app).delete('/api/login');
    expect(res.status).toBe(403);
  });

  it('rejects PATCH without header', async () => {
    const app = await createTestApp();
    const res = await request(app).patch('/api/login').send({});
    expect(res.status).toBe(403);
  });
});
