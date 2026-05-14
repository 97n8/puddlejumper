import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { signJwt } from '../src/jwt';
import {
  createJwtAuthenticationMiddleware,
  createOptionalJwtAuthenticationMiddleware,
} from '../src/auth';
import { validateJwt } from '../src/middleware';

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-please-change';
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || 'test-issuer';
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || 'test-audience';
});

function createApp(middleware: express.RequestHandler) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.get('/protected', middleware, (req: any, res) => {
    res.json({ sub: req.auth?.sub ?? null });
  });
  return app;
}

describe('Bearer header support', () => {
  describe('createJwtAuthenticationMiddleware', () => {
    const mw = createJwtAuthenticationMiddleware();

    it('authenticates via Authorization: Bearer header', async () => {
      const token = await signJwt({ sub: 'bearer-user' } as any, { expiresIn: '1h' } as any);
      const app = createApp(mw);
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.sub).toBe('bearer-user');
    });

    it('authenticates via cookie', async () => {
      const token = await signJwt({ sub: 'cookie-user' } as any, { expiresIn: '1h' } as any);
      const app = createApp(mw);
      const res = await request(app)
        .get('/protected')
        .set('Cookie', `jwt=${token}`);
      expect(res.status).toBe(200);
      expect(res.body.sub).toBe('cookie-user');
    });

    it('returns 401 when no token is provided', async () => {
      const app = createApp(mw);
      const res = await request(app).get('/protected');
      expect(res.status).toBe(401);
    });

    it('returns 401 for invalid Bearer token', async () => {
      const app = createApp(mw);
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    it('prefers cookie over Bearer header when both present', async () => {
      const cookieToken = await signJwt({ sub: 'from-cookie' } as any, { expiresIn: '1h' } as any);
      const bearerToken = await signJwt({ sub: 'from-bearer' } as any, { expiresIn: '1h' } as any);
      const app = createApp(mw);
      const res = await request(app)
        .get('/protected')
        .set('Cookie', `jwt=${cookieToken}`)
        .set('Authorization', `Bearer ${bearerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.sub).toBe('from-cookie');
    });
  });

  describe('createOptionalJwtAuthenticationMiddleware', () => {
    const mw = createOptionalJwtAuthenticationMiddleware();

    it('passes through without token (no 401)', async () => {
      const app = createApp(mw);
      const res = await request(app).get('/protected');
      expect(res.status).toBe(200);
      expect(res.body.sub).toBeNull();
    });

    it('authenticates via Bearer header when present', async () => {
      const token = await signJwt({ sub: 'opt-bearer' } as any, { expiresIn: '1h' } as any);
      const app = createApp(mw);
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.sub).toBe('opt-bearer');
    });
  });

  describe('validateJwt', () => {
    const mw = validateJwt();

    it('authenticates via Bearer header', async () => {
      const token = await signJwt({ sub: 'validate-bearer' } as any, { expiresIn: '1h' } as any);
      const app = createApp(mw);
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.sub).toBe('validate-bearer');
    });

    it('returns 401 without token', async () => {
      const app = createApp(mw);
      const res = await request(app).get('/protected');
      expect(res.status).toBe(401);
    });
  });
});
