import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { SealError, SEAL_ESK_NOT_FOUND } from './types.js';

interface ESKEntry {
  privateKeyPem: string;
  keyId: string;
  version: number;
}

interface PublicKeyEntry {
  publicKeyPem: string;
  tenantId: string;
  validFrom: string;
  supersededAt: string | null;
  version: number;
}

// Private keys: in-memory only, never written to disk
const activeESKs = new Map<string, ESKEntry>();
// keyId → public key info
const publicKeyCache = new Map<string, PublicKeyEntry>();

let _tenantsWithoutESK: string[] = [];
let _lastRotation: string | null = null;

const SEAL_KEYS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS seal_keys (
    key_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    public_key_pem TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'ECDSA-P256',
    valid_from TEXT NOT NULL,
    superseded_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_seal_keys_tenant ON seal_keys(tenant_id);
`;

export function initKeyStore(db: Database.Database): void {
  db.exec(SEAL_KEYS_SCHEMA);

  const tenantsRaw = process.env.SEAL_TENANTS ?? '';
  if (!tenantsRaw.trim()) {
    console.warn('[seal] SEAL_TENANTS is not set — no tenants loaded. SEAL signing unavailable.');
    return;
  }

  const tenants = tenantsRaw.split(',').map(t => t.trim()).filter(Boolean);

  for (const tenantId of tenants) {
    const envKey = `SEAL_ESK_${tenantId.toUpperCase()}`;
    const privateKeyPem = process.env[envKey];

    if (!privateKeyPem?.trim()) {
      console.warn(`[seal] No ESK found for tenant '${tenantId}' (env var ${envKey} not set). Signing unavailable for this tenant.`);
      _tenantsWithoutESK.push(tenantId);
      continue;
    }

    try {
      // Derive public key from private key
      const privateKey = crypto.createPrivateKey(privateKeyPem);
      const publicKey = crypto.createPublicKey(privateKey);
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

      // Determine version: check DB for existing key
      const existing = db.prepare(
        `SELECT version FROM seal_keys WHERE tenant_id = ? ORDER BY version DESC LIMIT 1`
      ).get(tenantId) as { version: number } | undefined;

      const version = existing?.version ?? 1;
      const keyId = `esk-${tenantId}-v${version}`;
      const validFrom = new Date().toISOString();

      // Cache private key in memory
      activeESKs.set(tenantId, { privateKeyPem, keyId, version });

      // Cache public key
      publicKeyCache.set(keyId, { publicKeyPem, tenantId, validFrom, supersededAt: null, version });

      // Upsert public key to DB (INSERT OR IGNORE — don't overwrite existing rows)
      db.prepare(`
        INSERT OR IGNORE INTO seal_keys (key_id, tenant_id, public_key_pem, algorithm, valid_from, version)
        VALUES (?, ?, ?, 'ECDSA-P256', ?, ?)
      `).run(keyId, tenantId, publicKeyPem, validFrom, version);

      // Restore any existing DB entries into cache
      const dbKeys = db.prepare(
        `SELECT key_id, public_key_pem, tenant_id, valid_from, superseded_at, version FROM seal_keys WHERE tenant_id = ?`
      ).all(tenantId) as Array<{ key_id: string; public_key_pem: string; tenant_id: string; valid_from: string; superseded_at: string | null; version: number }>;

      for (const row of dbKeys) {
        if (!publicKeyCache.has(row.key_id)) {
          publicKeyCache.set(row.key_id, {
            publicKeyPem: row.public_key_pem,
            tenantId: row.tenant_id,
            validFrom: row.valid_from,
            supersededAt: row.superseded_at,
            version: row.version,
          });
        }
      }

      console.log(`[seal] Loaded ESK for tenant '${tenantId}': keyId=${keyId}`);
    } catch (err) {
      console.warn(`[seal] Failed to load ESK for tenant '${tenantId}':`, (err as Error).message);
      _tenantsWithoutESK.push(tenantId);
    }
  }
}

export function getActiveESKForTenant(tenantId: string): { privateKeyPem: string; keyId: string } | null {
  const entry = activeESKs.get(tenantId);
  if (!entry) return null;
  return { privateKeyPem: entry.privateKeyPem, keyId: entry.keyId };
}

export function getPublicKeyForKeyId(keyId: string): string | null {
  return publicKeyCache.get(keyId)?.publicKeyPem ?? null;
}

export function getPublicKeyRecord(keyId: string): PublicKeyEntry | null {
  return publicKeyCache.get(keyId) ?? null;
}

export function listKeysForTenant(tenantId: string, db: Database.Database): Array<{ keyId: string; validFrom: string; supersededAt: string | null; algorithm: string }> {
  const rows = db.prepare(
    `SELECT key_id, valid_from, superseded_at, algorithm FROM seal_keys WHERE tenant_id = ? ORDER BY version ASC`
  ).all(tenantId) as Array<{ key_id: string; valid_from: string; superseded_at: string | null; algorithm: string }>;

  return rows.map(r => ({
    keyId: r.key_id,
    validFrom: r.valid_from,
    supersededAt: r.superseded_at,
    algorithm: r.algorithm,
  }));
}

export function rotateKey(tenantId: string, db: Database.Database): { newKeyId: string; publicKeyPem: string; privateKeyPem: string } {
  // Find current active key for this tenant
  const currentESK = activeESKs.get(tenantId);
  const maxVersionRow = db.prepare(
    `SELECT MAX(version) as max_v FROM seal_keys WHERE tenant_id = ?`
  ).get(tenantId) as { max_v: number | null };

  const nextVersion = (maxVersionRow?.max_v ?? 0) + 1;
  const newKeyId = `esk-${tenantId}-v${nextVersion}`;
  const now = new Date().toISOString();

  // Generate new ECDSA P-256 keypair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

  // Mark old key as superseded in DB and cache
  if (currentESK) {
    db.prepare(`UPDATE seal_keys SET superseded_at = ? WHERE key_id = ?`).run(now, currentESK.keyId);
    const oldEntry = publicKeyCache.get(currentESK.keyId);
    if (oldEntry) {
      publicKeyCache.set(currentESK.keyId, { ...oldEntry, supersededAt: now });
    }
  }

  // Insert new key in DB
  db.prepare(`
    INSERT INTO seal_keys (key_id, tenant_id, public_key_pem, algorithm, valid_from, version)
    VALUES (?, ?, ?, 'ECDSA-P256', ?, ?)
  `).run(newKeyId, tenantId, publicKeyPem, now, nextVersion);

  // Update caches
  publicKeyCache.set(newKeyId, { publicKeyPem, tenantId, validFrom: now, supersededAt: null, version: nextVersion });
  activeESKs.set(tenantId, { privateKeyPem, keyId: newKeyId, version: nextVersion });

  // Remove from tenantsWithoutESK if present
  _tenantsWithoutESK = _tenantsWithoutESK.filter(t => t !== tenantId);
  _lastRotation = now;

  console.warn(`[seal] Key rotated for tenant '${tenantId}'. New keyId: ${newKeyId}`);
  console.warn(`[seal] IMPORTANT: Store the new private key in SEAL_ESK_${tenantId.toUpperCase()} env var. It will not be saved to disk.`);

  return { newKeyId, publicKeyPem, privateKeyPem };
}

export function getSealHealthStatus(): {
  signingKeyStatus: 'loaded' | 'partially_loaded' | 'unavailable';
  tenantsWithActiveESK: number;
  tenantsWithoutESK: string[];
  lastRotation: string | null;
} {
  const tenantsWithActiveESK = activeESKs.size;
  const hasAny = tenantsWithActiveESK > 0;
  const hasMissing = _tenantsWithoutESK.length > 0;

  let signingKeyStatus: 'loaded' | 'partially_loaded' | 'unavailable';
  if (!hasAny) {
    signingKeyStatus = 'unavailable';
  } else if (hasMissing) {
    signingKeyStatus = 'partially_loaded';
  } else {
    signingKeyStatus = 'loaded';
  }

  return {
    signingKeyStatus,
    tenantsWithActiveESK,
    tenantsWithoutESK: [..._tenantsWithoutESK],
    lastRotation: _lastRotation,
  };
}

// Alias used in index.ts
export { initKeyStore as initSeal };
export function getSealHealth() {
  return getSealHealthStatus();
}
