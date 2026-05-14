import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  ArchieveError,
  ARCHIEVE_KMS_UNAVAILABLE,
  type ChainVerificationResult,
} from './types.js';

// ── RFC 8785 JSON Canonicalization Scheme (JCS) ───────────────────────────
// Recursively sort object keys, produce compact JSON with proper number handling.
export function jcsSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('JCS: non-finite numbers are not allowed');
    // ES6 JSON.stringify already handles numbers per RFC 8785 for finite values
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(jcsSerialize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + jcsSerialize(obj[k]));
    return '{' + pairs.join(',') + '}';
  }
  return JSON.stringify(value);
}

// ── In-memory chain state per tenant ─────────────────────────────────────
const chainTail = new Map<string, string>();
const chainLength = new Map<string, number>();

export function genesisHash(tenantId: string): string {
  return crypto.createHash('sha256').update('ARCHIEVE_GENESIS_' + tenantId, 'utf8').digest('hex');
}

export function initChainTail(tenantId: string, lastHash: string, length: number): void {
  chainTail.set(tenantId, lastHash);
  chainLength.set(tenantId, length);
}

export function getChainTail(tenantId: string): string {
  return chainTail.get(tenantId) ?? genesisHash(tenantId);
}

export function updateChainTail(tenantId: string, hash: string, pos: number): void {
  chainTail.set(tenantId, hash);
  chainLength.set(tenantId, pos);
}

export function getChainLength(tenantId: string): number {
  return chainLength.get(tenantId) ?? 0;
}

// Compute event hash per spec §5.
// Clones the event, sets hash='', and hashes JCS(event || prevHash field).
export function computeEventHash(event: object, prevHash: string): string {
  const payload = { ...event, prevHash, hash: '' };
  const jcs = jcsSerialize(payload);
  return crypto.createHash('sha256').update(jcs, 'utf8').digest('hex');
}

export function computeHmac(jcsBytes: string): string {
  const key = process.env.ARCHIEVE_HMAC_KEY;
  if (!key) throw new ArchieveError(ARCHIEVE_KMS_UNAVAILABLE, 'ARCHIEVE_HMAC_KEY not configured');
  return crypto.createHmac('sha256', key).update(jcsBytes, 'utf8').digest('base64url');
}

// ── Chain verification per spec §10.1 ────────────────────────────────────
export function verifyChain(db: Database.Database, tenantId: string): ChainVerificationResult {
  const rows = db.prepare(
    `SELECT event_id, chain_pos, hash, event_json FROM archieve_delivered
     WHERE tenant_id = ? ORDER BY chain_pos ASC`
  ).all(tenantId) as Array<{ event_id: string; chain_pos: number; hash: string; event_json: string }>;

  if (rows.length === 0) {
    return { result: 'CHAIN_VALID', eventsVerified: 0 };
  }

  let expectedPrevHash = genesisHash(tenantId);

  for (const row of rows) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(row.event_json);
    } catch {
      return {
        result: 'CHAIN_VIOLATION',
        eventId: row.event_id,
        chainPos: row.chain_pos,
        reason: 'Failed to parse event JSON',
      };
    }

    // Check prevHash linkage
    if (event.prevHash !== expectedPrevHash) {
      return {
        result: 'CHAIN_VIOLATION',
        eventId: row.event_id,
        chainPos: row.chain_pos,
        reason: 'prevHash mismatch',
        expectedPrevHash,
        foundPrevHash: String(event.prevHash),
      };
    }

    // Recompute hash
    const recomputed = computeEventHash(event, expectedPrevHash);
    if (recomputed !== row.hash) {
      return {
        result: 'CHAIN_VIOLATION',
        eventId: row.event_id,
        chainPos: row.chain_pos,
        reason: 'hash mismatch',
        expectedHash: recomputed,
        foundHash: row.hash,
      };
    }

    expectedPrevHash = row.hash;
  }

  const last = rows[rows.length - 1];
  return {
    result: 'CHAIN_VALID',
    eventsVerified: rows.length,
    chainHead: last.event_id,
    headHash: last.hash,
  };
}
