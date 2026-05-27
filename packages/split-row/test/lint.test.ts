import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import { signedContent, splitRowLint } from '../src/lint.js';
import { CANON_VERSION, _resetRegistry, loadOverlay } from '../src/registry.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PHILLIPSTON_DIR = path.join(REPO_ROOT, 'pj', 'overlays', 'phillipston');

function fresh(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

function tmpOverlay(manifest: Record<string, unknown>, extras: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pj-overlay-'));
  fs.writeFileSync(path.join(dir, 'divergence_manifest.yaml'), yaml.dump(manifest));
  for (const [name, body] of Object.entries(extras)) {
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}

function baseManifest(): Record<string, unknown> {
  return {
    canon_version: CANON_VERSION,
    deployment_id: 'test',
    overlay_name: 'test',
    overlay_version: '0.1.0',
    declared_at: '2026-05-27T00:00:00Z',
    declared_by: 'tester',
    bindings: [
      {
        split_point: 'SP.STATE.NAMES',
        process_type: 'PRR',
        value: { received: 'Received' },
        rationale: 'fixture',
      },
    ],
  };
}

describe('@pj/split-row — lint', () => {
  let db: DatabaseHandle;
  beforeEach(() => {
    db = fresh();
    _resetRegistry();
  });

  it('Phillipston reference manifest lints cleanly and emits divergence.manifest_loaded', async () => {
    const result = splitRowLint(PHILLIPSTON_DIR, db, CANON_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifestHash).toMatch(/^[0-9a-f]{64}$/);

    const load = loadOverlay(PHILLIPSTON_DIR, db);
    expect(load.ok).toBe(true);

    const loaded = db
      .prepare(
        `SELECT event_subtype FROM audit_events
         WHERE event_family = 'divergence' AND event_subtype = 'divergence.manifest_loaded'
         ORDER BY rowid DESC LIMIT 1`,
      )
      .get() as { event_subtype: string } | undefined;
    expect(loaded?.event_subtype).toBe('divergence.manifest_loaded');
  });

  it('missing rationale → RATIONALE_MISSING', async () => {
    const m = baseManifest();
    (m.bindings as Array<Record<string, unknown>>)[0]!.rationale = '';
    const dir = tmpOverlay(m);
    const result = splitRowLint(dir, db, CANON_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.code === 'RATIONALE_MISSING')).toBe(true);
    }
  });

  it('wrong canon_version → CANON_VERSION_MISMATCH', async () => {
    const m = baseManifest();
    m.canon_version = '9.9.9';
    const dir = tmpOverlay(m);
    const result = splitRowLint(dir, db, CANON_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.code === 'CANON_VERSION_MISMATCH')).toBe(true);
    }
  });

  it('unknown split point → UNKNOWN_SPLIT_POINT', async () => {
    const m = baseManifest();
    (m.bindings as Array<Record<string, unknown>>)[0]!.split_point = 'SP.NOT_REAL';
    const dir = tmpOverlay(m);
    const result = splitRowLint(dir, db, CANON_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.code === 'UNKNOWN_SPLIT_POINT')).toBe(true);
    }
  });

  it('orphan .yaml file → ORPHAN_ARTIFACT', async () => {
    const m = baseManifest();
    const dir = tmpOverlay(m, { 'orphan.yaml': 'foo: 1\n' });
    const result = splitRowLint(dir, db, CANON_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.code === 'ORPHAN_ARTIFACT')).toBe(true);
    }
  });

  it('collects all failures before returning — does not short-circuit', async () => {
    const m = baseManifest();
    m.canon_version = '9.9.9';
    (m.bindings as Array<Record<string, unknown>>)[0]!.rationale = '';
    (m.bindings as Array<Record<string, unknown>>)[0]!.split_point = 'SP.NOT_REAL';
    const dir = tmpOverlay(m, { 'extra.yaml': 'x: 1\n' });
    const result = splitRowLint(dir, db, CANON_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = new Set(result.failures.map((f) => f.code));
      expect(codes.has('CANON_VERSION_MISMATCH')).toBe(true);
      expect(codes.has('RATIONALE_MISSING')).toBe(true);
      expect(codes.has('UNKNOWN_SPLIT_POINT')).toBe(true);
      expect(codes.has('ORPHAN_ARTIFACT')).toBe(true);
    }
  });

  it('signing_required: true with no signature → SIGNATURE_MISSING', async () => {
    const m = baseManifest();
    m.signatures = {
      declared_by: 'tester',
      declared_at: '2026-05-27T00:00:00Z',
      algorithm: 'Ed25519',
      public_key: '',
      signature: '',
      signing_required: true,
    };
    const dir = tmpOverlay(m);
    const result = splitRowLint(dir, db, CANON_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.code === 'SIGNATURE_MISSING')).toBe(true);
    }
  });

  it('signing_required: true with valid Ed25519 signature → ok', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const m = baseManifest();
    const baseForSig: Record<string, unknown> = {
      bindings: m.bindings,
      canon_version: m.canon_version,
      overlay_name: m.overlay_name,
      overlay_version: m.overlay_version,
      declared_at: m.declared_at,
    };
    const payload = signedContent(baseForSig as never);
    const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey);
    const pubDer = publicKey.export({ type: 'spki', format: 'der' });
    m.signatures = {
      declared_by: 'tester',
      declared_at: '2026-05-27T00:00:00Z',
      algorithm: 'Ed25519',
      public_key: Buffer.from(pubDer).toString('base64'),
      signature: sig.toString('base64'),
      signing_required: true,
    };
    const dir = tmpOverlay(m);
    const result = splitRowLint(dir, db, CANON_VERSION);
    expect(result.ok).toBe(true);
  });

  it('signing_required: true with tampered content → SIGNATURE_INVALID', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const m = baseManifest();
    const baseForSig: Record<string, unknown> = {
      bindings: m.bindings,
      canon_version: m.canon_version,
      overlay_name: m.overlay_name,
      overlay_version: m.overlay_version,
      declared_at: m.declared_at,
    };
    const sig = crypto.sign(null, Buffer.from(signedContent(baseForSig as never), 'utf8'), privateKey);
    const pubDer = publicKey.export({ type: 'spki', format: 'der' });
    m.signatures = {
      declared_by: 'tester',
      declared_at: '2026-05-27T00:00:00Z',
      algorithm: 'Ed25519',
      public_key: Buffer.from(pubDer).toString('base64'),
      signature: sig.toString('base64'),
      signing_required: true,
    };
    // Tamper: change overlay_version after signing.
    m.overlay_version = '9.9.9';
    const dir = tmpOverlay(m);
    const result = splitRowLint(dir, db, CANON_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.code === 'SIGNATURE_INVALID')).toBe(true);
    }
  });
});
