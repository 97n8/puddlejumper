import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { cookieParserMiddleware, signJwt } from '@publiclogic/core';
import { createConfigRoutes } from '../src/api/routes/config.js';

// ── Test fixtures ───────────────────────────────────────────────────────────

const RUNTIME_CONTEXT = {
  workspace: { id: 'ws-1', name: 'Test Workspace' },
  municipality: { id: 'muni-1', name: 'Test City' },
  actionDefaults: { timeout: 30 },
};

const TILES = [
  { id: 'prr', label: 'PRR Intake', icon: '📋', mode: 'form', intent: 'create', target: '/prr', tone: 'neutral', description: 'Submit a PRR' },
  { id: 'dash', label: 'Dashboard', icon: '📊', mode: 'view', intent: 'read', target: '/dashboard', tone: 'info', description: 'Overview dashboard' },
];

const CAPABILITIES = {
  automations: [{ id: 'auto-1', label: 'Auto review', description: 'Automated document review' }],
  quickActions: [{ id: 'qa-1', label: 'Fast track', description: 'Fast track a PRR' }],
};

async function getAuthToken(overrides: Record<string, any> = {}) {
  return signJwt(
    { sub: 'u1', name: 'Test User', role: 'admin', permissions: ['deploy'], tenants: ['t1'], tenantId: 't1', delegations: [], ...overrides },
    { expiresIn: '1h' },
  );
}

function buildApp(opts: Record<string, any> = {}) {
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());

  // Simulate auth middleware: set req.auth from Bearer token
  app.use(async (req: any, _res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { verifyJwt } = await import('@publiclogic/core');
        req.auth = await verifyJwt(authHeader.slice(7));
      } catch { /* unauthenticated */ }
    }
    next();
  });

  const router = createConfigRoutes({
    runtimeContext: RUNTIME_CONTEXT,
    runtimeTiles: TILES,
    runtimeCapabilities: CAPABILITIES,
    ...opts,
  });
  app.use('/api', router);
  return app;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Config routes', () => {
  describe('GET /api/runtime/context', () => {
    it('returns runtime context for authed user', async () => {
      const app = buildApp();
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/runtime/context')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.workspace.id).toBe('ws-1');
      expect(res.body.municipality.id).toBe('muni-1');
      expect(res.body.operator.name).toBe('Test User');
      expect(res.body.timestamp).toBeDefined();
    });

    it('returns 401 without auth', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/runtime/context');
      expect(res.status).toBe(401);
    });

    it('returns 503 when context is null', async () => {
      const app = buildApp({ runtimeContext: null });
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/runtime/context')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/config/tiles', () => {
    it('returns tiles', async () => {
      const app = buildApp();
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/config/tiles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('prr');
    });

    it('returns 503 when tiles are empty', async () => {
      const app = buildApp({ runtimeTiles: [] });
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/config/tiles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/config/capabilities', () => {
    it('returns capabilities', async () => {
      const app = buildApp();
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/config/capabilities')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.automations).toHaveLength(1);
      expect(res.body.quickActions).toHaveLength(1);
    });

    it('returns 503 when capabilities are null', async () => {
      const app = buildApp({ runtimeCapabilities: null });
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/config/capabilities')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/capabilities/manifest', () => {
    it('returns capability manifest for admin with deploy permission', async () => {
      const app = buildApp();
      const token = await getAuthToken({ role: 'admin', permissions: ['deploy'] });
      const res = await request(app)
        .get('/api/capabilities/manifest')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.capabilities['corePrompt.edit']).toBe(true);
      expect(res.body.capabilities['evaluate.execute']).toBe(true);
      expect(res.body.capabilities['missionControl.tiles.read']).toBe(true);
    });

    it('returns restricted manifest for non-admin user', async () => {
      const app = buildApp();
      const token = await getAuthToken({ role: 'viewer', permissions: [] });
      const res = await request(app)
        .get('/api/capabilities/manifest')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.capabilities['corePrompt.edit']).toBe(false);
      expect(res.body.capabilities['evaluate.execute']).toBe(false);
    });
  });

  describe('GET /api/pj/actions', () => {
    it('returns actions for user with deploy permission', async () => {
      const app = buildApp();
      const token = await getAuthToken({ permissions: ['deploy'] });
      const res = await request(app)
        .get('/api/pj/actions')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/sample', () => {
    it('always returns 404', async () => {
      const app = buildApp();
      const token = await getAuthToken();
      const res = await request(app)
        .get('/api/sample')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
