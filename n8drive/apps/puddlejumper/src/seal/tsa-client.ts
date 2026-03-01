import crypto from 'node:crypto';
import { SealError, SEAL_TSA_TIMEOUT } from './types.js';

const DEFAULT_TSA_URL = 'https://freetsa.org/tsr';

// Build a minimal RFC 3161 timestamp request for a SHA-256 hash.
// Reuses the same DER-encoding approach as src/archieve/tsa-client.ts.
function buildTsrRequest(hashHex: string): Buffer {
  const hashBytes = Buffer.from(hashHex, 'hex');

  // SHA-256 OID: 2.16.840.1.101.3.4.2.1
  const sha256Oid = Buffer.from([
    0x30, 0x0d,
    0x06, 0x09,
    0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
    0x05, 0x00,
  ]);

  const hashOctet = Buffer.concat([Buffer.from([0x04, hashBytes.length]), hashBytes]);
  const msgImprint = Buffer.concat([sha256Oid, hashOctet]);
  const msgImprintSeq = Buffer.concat([
    Buffer.from([0x30, msgImprint.length]),
    msgImprint,
  ]);

  const version = Buffer.from([0x02, 0x01, 0x01]);
  const nonceBytes = crypto.randomBytes(8);
  const nonce = Buffer.concat([Buffer.from([0x02, 0x08]), nonceBytes]);
  const certReq = Buffer.from([0x01, 0x01, 0xff]);

  const inner = Buffer.concat([version, msgImprintSeq, nonce, certReq]);
  const request = Buffer.concat([Buffer.from([0x30, inner.length]), inner]);

  return request;
}

async function submitToTsa(hashHex: string, tsaUrl: string, timeoutMs: number): Promise<string> {
  const reqBody = buildTsrRequest(hashHex);

  const resp = await fetch(tsaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/timestamp-query' },
    body: reqBody.buffer as ArrayBuffer,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!resp.ok) {
    throw new SealError(SEAL_TSA_TIMEOUT, `TSA returned HTTP ${resp.status}: ${resp.statusText}`);
  }

  const buf = await resp.arrayBuffer();
  return Buffer.from(buf).toString('base64url');
}

export async function requestTsaTimestamp(artifactHashHex: string): Promise<{ tsaToken: string; tsaUrl: string }> {
  const tsaUrl = process.env.SEAL_TSA_URL ?? DEFAULT_TSA_URL;
  const timeoutMs = parseInt(process.env.SEAL_TSA_TIMEOUT_MS ?? '30000', 10);

  try {
    const tsaToken = await submitToTsa(artifactHashHex, tsaUrl, timeoutMs);
    return { tsaToken, tsaUrl };
  } catch (err) {
    // One retry
    try {
      const tsaToken = await submitToTsa(artifactHashHex, tsaUrl, timeoutMs);
      return { tsaToken, tsaUrl };
    } catch {
      throw new SealError(SEAL_TSA_TIMEOUT, `TSA request failed after retry: ${(err as Error).message}`);
    }
  }
}
