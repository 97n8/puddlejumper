// ── Tests: Syncron8 API response envelope and new endpoints ─────────────────
//
// Validates that:
//   1. The response envelope { success, correlationId, data } is present.
//   2. The /health endpoint returns the expected shape without auth.
//   3. The /polimorphic/webhook/health endpoint returns the expected shape.
//   4. Error responses include { success: false, error: { message, code? } }.
//
// Note: Requires better-sqlite3 native bindings to be compiled.
// Run `bash scripts/bootstrap.sh` to build them if tests are skipped.
//
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { signJwt } from '@publiclogic/core';

// Detect whether native SQLite bindings are available before importing anything
// that would throw at module load time.
let sqliteAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const testDb = new Database(':memory:');
  testDb.close();
  sqliteAvailable = true;
} catch {
  sqliteAvailable = false;
}

const TENANT_ID = 'tenant-test-001';

async function adminToken() {
  return signJwt(
    { sub: 'admin-user', userId: 'admin-user', role: 'admin', tenantId: TENANT_ID, sessionId: 'sess-1' },
    { expiresIn: '1h' }
  );
}

let tmpDir: string;
let app: express.Express;

beforeEach(async () => {
  if (!sqliteAvailable) return;
  const Database = (await import('better-sqlite3')).default;
  const { initSyncronate } = await import('../src/syncronate/index.js');
  const { createSyncronateRouter } = await import('../src/syncronate/api.js');

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncron8-test-'));
  const db = new Database(path.join(tmpDir, 'test.db'));
  initSyncronate(db);

  app = express();
  app.use(express.json());
  app.use('/api/syncronate', createSyncronateRouter(db));
});

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('Syncron8 API — response envelope', () => {
  describe.skipIf(!sqliteAvailable)('GET /api/syncronate/health (no auth required)', () => {
    it('returns { success: true, correlationId, data } with status shape', async () => {
      const res = await request(app).get('/api/syncronate/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.correlationId).toBe('string');
      expect(res.body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.data).toMatchObject({
        status: expect.stringMatching(/^(ok|degraded)$/),
        message: expect.any(String),
        activeFeeds: expect.any(Number),
        jobsRunning: expect.any(Number),
        timestamp: expect.any(String),
      });
    });

    it('reports status ok when no feeds exist', async () => {
      const res = await request(app).get('/api/syncronate/health');
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.activeFeeds).toBe(0);
      expect(res.body.data.jobsRunning).toBe(0);
    });
  });

  describe.skipIf(!sqliteAvailable)('GET /api/syncronate/polimorphic/webhook/health (no auth)', () => {
    it('returns success envelope with ok status', async () => {
      const res = await request(app).get('/api/syncronate/polimorphic/webhook/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ status: 'ok', timestamp: expect.any(String) });
    });
  });

  describe.skipIf(!sqliteAvailable)('GET /api/syncronate/feeds (authenticated)', () => {
    it('returns 401 when unauthenticated (JWT middleware)', async () => {
      const res = await request(app).get('/api/syncronate/feeds');
      expect(res.status).toBe(401);
      // No success:true for auth errors from JWT middleware
    });

    it('returns success envelope with feeds array for admin', async () => {
      const token = await adminToken();
      const res = await request(app)
        .get('/api/syncronate/feeds')
        .set('Authorization', `Bearer ${token}`)
        .set('x-request-id', 'test-req-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.correlationId).toBe('string');
      expect(res.body.data).toHaveProperty('feeds');
      expect(Array.isArray(res.body.data.feeds)).toBe(true);
    });
  });

  describe.skipIf(!sqliteAvailable)('POST /api/syncronate/feeds — validation', () => {
    it('returns 400 with friendly error when required fields are missing', async () => {
      const token = await adminToken();
      const res = await request(app)
        .post('/api/syncronate/feeds')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Incomplete Feed' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(typeof res.body.correlationId).toBe('string');
      expect(res.body.error).toHaveProperty('message');
      expect(res.body.error).toHaveProperty('code', 'MISSING_FIELDS');
    });

    it('creates feed and returns it in data envelope', async () => {
      const token = await adminToken();
      const res = await request(app)
        .post('/api/syncronate/feeds')
        .set('Authorization', `Bearer ${token}`)
        .send({
          displayName: 'Test Feed',
          source: { connectorId: 'src-1', type: 'monday', config: { boardId: '123' } },
          sinks: [],
          fieldMap: [],
          syncConfig: {},
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.correlationId).toBe('string');
      expect(res.body.data).toHaveProperty('feedId');
      expect(res.body.data.displayName).toBe('Test Feed');
      expect(res.body.data.status).toBe('draft');
    });
  });

  describe.skipIf(!sqliteAvailable)('GET /api/syncronate/feeds/:feedId/status', () => {
    it('returns 404 with friendly error for unknown feed', async () => {
      const token = await adminToken();
      const res = await request(app)
        .get('/api/syncronate/feeds/nonexistent-feed/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toHaveProperty('code', 'FEED_NOT_FOUND');
    });

    it('returns status summary for a real feed', async () => {
      const token = await adminToken();
      // Create a feed first
      const createRes = await request(app)
        .post('/api/syncronate/feeds')
        .set('Authorization', `Bearer ${token}`)
        .send({
          displayName: 'Status Test Feed',
          source: { connectorId: 'src-2', type: 'salesforce', config: {} },
          sinks: [],
          fieldMap: [],
          syncConfig: {},
        });
      const feedId = createRes.body.data.feedId;

      const statusRes = await request(app)
        .get(`/api/syncronate/feeds/${feedId}/status`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.data).toMatchObject({
        feedId,
        displayName: 'Status Test Feed',
        status: 'draft',
        lastSyncAt: null,
        syncRunning: false,
        lastJobResult: null,
      });
    });
  });

  describe.skipIf(!sqliteAvailable)('Error response shape', () => {
    it('includes machine-readable code in error responses', async () => {
      const token = await adminToken();
      const res = await request(app)
        .get('/api/syncronate/feeds/does-not-exist')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        correlationId: expect.any(String),
        error: {
          message: expect.any(String),
          code: 'FEED_NOT_FOUND',
        },
      });
    });

    it('error messages are human-readable (no raw stack/internal details)', async () => {
      const token = await adminToken();
      const res = await request(app)
        .get('/api/syncronate/feeds/no-such-feed')
        .set('Authorization', `Bearer ${token}`);
      // Friendly message, not something like "SQLITE_ERROR: no such table"
      expect(res.body.error.message).not.toMatch(/SQLITE/);
      expect(res.body.error.message.length).toBeGreaterThan(10);
    });
  });
});
