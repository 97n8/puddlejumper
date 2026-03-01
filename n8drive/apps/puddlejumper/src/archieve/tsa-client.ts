import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { type NotarizationRecord } from './types.js';

const DEFAULT_TSA_URL = 'https://freetsa.org/tsr';

// Build a minimal RFC 3161 timestamp request for a SHA-256 hash.
// This is a best-effort ASN.1 DER encoding of a TimeStampReq.
// Structure: SEQUENCE { version INTEGER(1), messageImprint SEQUENCE { hashAlgorithm AlgorithmIdentifier, hashedMessage OCTET STRING }, nonce INTEGER, certReq BOOLEAN }
function buildTsrRequest(hashHex: string): Buffer {
  const hashBytes = Buffer.from(hashHex, 'hex');

  // SHA-256 OID: 2.16.840.1.101.3.4.2.1
  const sha256Oid = Buffer.from([
    0x30, 0x0d,                                           // SEQUENCE (13 bytes)
    0x06, 0x09,                                           // OID (9 bytes)
    0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, // 2.16.840.1.101.3.4.2.1
    0x05, 0x00,                                           // NULL parameters
  ]);

  // MessageImprint: SEQUENCE { AlgorithmIdentifier, OCTET STRING(hash) }
  const hashOctet = Buffer.concat([Buffer.from([0x04, hashBytes.length]), hashBytes]);
  const msgImprint = Buffer.concat([sha256Oid, hashOctet]);
  const msgImprintSeq = Buffer.concat([
    Buffer.from([0x30, msgImprint.length]),
    msgImprint,
  ]);

  // version INTEGER(1)
  const version = Buffer.from([0x02, 0x01, 0x01]);

  // nonce INTEGER (8 random bytes)
  const nonceBytes = crypto.randomBytes(8);
  const nonce = Buffer.concat([Buffer.from([0x02, 0x08]), nonceBytes]);

  // certReq BOOLEAN TRUE
  const certReq = Buffer.from([0x01, 0x01, 0xff]);

  // Outer SEQUENCE
  const inner = Buffer.concat([version, msgImprintSeq, nonce, certReq]);
  const request = Buffer.concat([Buffer.from([0x30, inner.length]), inner]);

  return request;
}

async function submitToTsa(rootHash: string, tsaUrl: string): Promise<string> {
  const reqBody = buildTsrRequest(rootHash);

  const resp = await fetch(tsaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/timestamp-query' },
    body: reqBody.buffer as ArrayBuffer,
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(`TSA returned HTTP ${resp.status}: ${resp.statusText}`);
  }

  const buf = await resp.arrayBuffer();
  return Buffer.from(buf).toString('base64url');
}

export async function notarizeTenant(
  db: Database.Database,
  tenantId: string,
  date: string
): Promise<NotarizationRecord> {
  const tsaUrl = process.env.ARCHIEVE_TSA_URL ?? DEFAULT_TSA_URL;
  const tsaTokenPath = process.env.ARCHIEVE_TSA_TOKEN_PATH;

  // Get all delivered events for tenant ordered by chainPos
  const rows = db.prepare(
    `SELECT hash FROM archieve_delivered WHERE tenant_id = ? ORDER BY chain_pos ASC`
  ).all(tenantId) as Array<{ hash: string }>;

  if (rows.length === 0) {
    throw new Error(`No events to notarize for tenant ${tenantId}`);
  }

  // Compute root hash: SHA-256 of concatenated hashes in order
  const combined = rows.map(r => r.hash).join('');
  const rootHash = crypto.createHash('sha256').update(combined, 'utf8').digest('hex');

  // Chain head = last event_id for this tenant
  const chainHeadRow = db.prepare(
    `SELECT event_id FROM archieve_delivered WHERE tenant_id = ? ORDER BY chain_pos DESC LIMIT 1`
  ).get(tenantId) as { event_id: string } | undefined;
  const chainHead = chainHeadRow?.event_id ?? '';

  let tsaToken = '';
  try {
    tsaToken = await submitToTsa(rootHash, tsaUrl);
  } catch (err) {
    console.warn(`[archieve] TSA submission failed for tenant ${tenantId}:`, (err as Error).message);
    // Store a synthetic token indicating the attempt
    tsaToken = Buffer.from(JSON.stringify({
      status: 'tsa_unavailable',
      rootHash,
      attemptedAt: new Date().toISOString(),
    })).toString('base64url');
  }

  // Save .tsr file if path is configured
  if (tsaTokenPath) {
    try {
      const dir = path.join(tsaTokenPath, tenantId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${date}.tsr`), Buffer.from(tsaToken, 'base64url'));
    } catch (err) {
      console.warn('[archieve] failed to write TSR file:', (err as Error).message);
    }
  }

  // Persist to DB
  db.prepare(`
    INSERT OR REPLACE INTO archieve_notarizations
      (tenant_id, date, chain_head, root_hash, tsa_token, tsa_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tenantId, date, chainHead, rootHash, tsaToken, tsaUrl);

  return { date, chainHead, rootHash, tsaToken, tsaUrl };
}

export async function runDailyNotarization(db: Database.Database): Promise<void> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Get distinct tenants
  const tenants = db.prepare(
    `SELECT DISTINCT tenant_id FROM archieve_delivered`
  ).all() as Array<{ tenant_id: string }>;

  for (const { tenant_id } of tenants) {
    try {
      await notarizeTenant(db, tenant_id, date);
      console.log(`[archieve] notarization completed for tenant ${tenant_id} date ${date}`);
    } catch (err) {
      console.error(`[archieve] notarization failed for tenant ${tenant_id}:`, (err as Error).message);
    }
  }
}

// Schedule daily notarization at 00:00 UTC using setInterval (node-cron not available)
export function scheduleNotarization(db: Database.Database): void {
  function msUntilMidnightUTC(): number {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return midnight.getTime() - now.getTime();
  }

  function scheduleNext() {
    const delay = msUntilMidnightUTC();
    setTimeout(() => {
      runDailyNotarization(db).catch(err =>
        console.error('[archieve] daily notarization error:', err)
      );
      scheduleNext();
    }, delay).unref();
  }

  scheduleNext();
  console.log('[archieve] TSA notarization scheduled (next run at midnight UTC)');
}
