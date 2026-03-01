import express from 'express';
import type { Router } from 'express';
import type Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import { verify } from './verifier.js';
import { rotateKey } from './key-store.js';
import { getPublicKeyRecord, listKeysForTenant } from './key-store.js';
import { provisionTenantESK } from './provisioner.js';
import { archieveLog } from '../archieve/index.js';
import { ArchieveEventType } from '../archieve/event-catalog.js';
import type { SealToken } from './types.js';

export function createSealRouter(db: Database.Database): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();

  // POST /api/seal/verify — auth: tenant-admin+
  router.post('/verify', authMiddleware, (req, res) => {
    const auth = getAuthContext(req);
    const role = auth?.role;
    if (role !== 'admin' && role !== 'platform-admin' && role !== 'tenant-admin') {
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return;
    }

    const { artifact, token } = req.body as { artifact?: string; token?: SealToken };
    if (!artifact || !token) {
      res.status(400).json({ error: 'Missing artifact or token' });
      return;
    }

    let artifactBuf: Buffer;
    try {
      artifactBuf = Buffer.from(artifact, 'base64');
    } catch {
      res.status(400).json({ error: 'artifact must be base64-encoded' });
      return;
    }

    verify(artifactBuf, token)
      .then(result => res.json(result))
      .catch(err => res.status(500).json({ error: (err as Error).message }));
  });

  // GET /api/seal/public-key — no auth required
  router.get('/public-key', (req, res) => {
    const { tenantId, keyId } = req.query as { tenantId?: string; keyId?: string };

    if (!keyId && !tenantId) {
      res.status(400).json({ error: 'Provide keyId or tenantId query param' });
      return;
    }

    let resolvedKeyId = keyId;
    if (!resolvedKeyId && tenantId) {
      // Find latest non-superseded key for tenant
      const rows = db.prepare(
        `SELECT key_id FROM seal_keys WHERE tenant_id = ? AND superseded_at IS NULL ORDER BY version DESC LIMIT 1`
      ).get(tenantId) as { key_id: string } | undefined;
      if (!rows) {
        res.status(404).json({ error: 'No active key found for tenant' });
        return;
      }
      resolvedKeyId = rows.key_id;
    }

    const record = getPublicKeyRecord(resolvedKeyId!);
    if (!record) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }

    res.json({
      keyId: resolvedKeyId,
      tenantId: record.tenantId,
      algorithm: 'ECDSA-P256',
      publicKeyPem: record.publicKeyPem,
      validFrom: record.validFrom,
      supersededAt: record.supersededAt,
    });
  });

  // GET /api/seal/keys — auth: tenant-admin+
  router.get('/keys', authMiddleware, (req, res) => {
    const auth = getAuthContext(req);
    const role = auth?.role;
    if (role !== 'admin' && role !== 'platform-admin' && role !== 'tenant-admin') {
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return;
    }

    const tenantId = auth?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }

    try {
      const keys = listKeysForTenant(tenantId, db);
      res.json({ tenantId, keys });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/seal/rotate — auth: platform-admin only
  router.post('/rotate', authMiddleware, (req, res) => {
    const auth = getAuthContext(req);
    if (auth?.role !== 'admin' && auth?.role !== 'platform-admin') {
      res.status(403).json({ error: 'Forbidden: platform-admin only' });
      return;
    }

    const { tenantId } = req.body as { tenantId?: string };
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenantId' });
      return;
    }

    try {
      const previousKeyId = db.prepare(
        `SELECT key_id FROM seal_keys WHERE tenant_id = ? AND superseded_at IS NULL ORDER BY version DESC LIMIT 1`
      ).get(tenantId) as { key_id: string } | undefined;

      const result = rotateKey(tenantId, db);

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'seal',
          eventType: ArchieveEventType.SEAL_KEY_ROTATED,
          actor: {
            userId: auth?.userId ?? auth?.sub ?? 'system',
            role: auth?.role ?? 'system',
            sessionId: auth?.sessionId ?? req.headers['x-request-id'] as string ?? 'seal-rotate',
          },
          severity: 'info',
          data: { previousKeyId: previousKeyId?.key_id ?? null, newKeyId: result.newKeyId },
        });
      } catch (logErr) {
        console.warn('[seal] Failed to log SEAL_KEY_ROTATED:', (logErr as Error).message);
      }

      res.json({
        newKeyId: result.newKeyId,
        publicKeyPem: result.publicKeyPem,
        privateKeyPem: result.privateKeyPem,
        warning: `Store the private key in SEAL_ESK_${tenantId.toUpperCase()} env var. It will not be saved.`,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/seal/provision — auth: platform-admin only
  router.post('/provision', authMiddleware, (req, res) => {
    const auth = getAuthContext(req);
    if (auth?.role !== 'admin' && auth?.role !== 'platform-admin') {
      res.status(403).json({ error: 'Forbidden: platform-admin only' });
      return;
    }

    const { tenantId } = req.body as { tenantId?: string };
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenantId' });
      return;
    }

    try {
      const result = provisionTenantESK(tenantId, db);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
