// Split-Row framework registry.
// Source: Phase 4 prompt + Master Spec Part 5.
//
// Loads a deployment's divergence manifest into memory, after running the
// lint gate to completion. On lint failure the overlay is refused; the
// caller (server boot) is expected to exit. On success the overlay is
// kept in a process-level Map keyed by deployment_id and every resolved
// binding emits `divergence.binding_exercised` to the audit log.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { appendAuditEvent, type DatabaseHandle } from '@pj/db';
import type {
  Binding,
  DivergenceManifest,
  LintResult,
  SplitPointId,
} from '@publiclogic/core';
import { canonicalJson } from './canonical-json.js';
import { splitRowLint } from './lint.js';

export const CANON_VERSION = '1.0.0';
const MANIFEST_FILENAME = 'divergence_manifest.yaml';

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export interface BoundOverlay {
  deploymentId: string;
  overlayName: string;
  overlayVersion: string;
  canonVersion: string;
  manifestHash: string;
  resolve<T = unknown>(splitPoint: SplitPointId, context?: ResolveContext): T | undefined;
}

export interface ResolveContext {
  /** Process type for SP.STATE.NAMES / SP.STATE.GUARDS / etc. */
  process_type?: string;
  /** Carry-through tenant for the binding_exercised audit event. */
  tenant_id?: string;
  /** Process id, if the binding is being read for a specific process. */
  process_id?: string;
  /** Actor that triggered the resolution. */
  actor_ref?: string;
}

export type LoadResult =
  | { ok: true; overlay: BoundOverlay }
  | { ok: false; lint: LintResult & { ok: false } };

// ── module-level cache ──────────────────────────────────────────────────────

const overlays = new Map<string, { manifest: DivergenceManifest; manifestHash: string }>();

// Strictly for tests + boot resets.
export function _resetRegistry(): void {
  overlays.clear();
}

function bindingFor(
  manifest: DivergenceManifest,
  splitPoint: SplitPointId,
  context?: ResolveContext,
): Binding | undefined {
  return manifest.bindings.find(
    (b) =>
      b.split_point === splitPoint &&
      (context?.process_type ? b.process_type === context.process_type : true),
  );
}

function resolvedValueOf(
  binding: Binding,
  overlayDir: string,
  db: DatabaseHandle,
): unknown {
  if (binding.value !== undefined) return binding.value;
  if (typeof binding.value_ref === 'string') {
    const full = path.join(overlayDir, binding.value_ref);
    return yaml.load(fs.readFileSync(full, 'utf8'));
  }
  if (typeof binding.artifact_id === 'string') {
    const row = db
      .prepare(`SELECT content_yaml FROM shared_bindings WHERE binding_id = ?`)
      .get(binding.artifact_id) as { content_yaml: string } | undefined;
    if (!row) return undefined;
    return yaml.load(row.content_yaml);
  }
  return undefined;
}

// ── loadOverlay ─────────────────────────────────────────────────────────────

/**
 * Run lint, persist the manifest to deployment_manifests, emit
 * `divergence.manifest_loaded` (or `divergence.lint_failed`), and cache
 * the parsed manifest in process memory.
 */
export function loadOverlay(
  overlayDir: string,
  db: DatabaseHandle,
): LoadResult {
  const lint = splitRowLint(overlayDir, db, CANON_VERSION);
  const manifestPath = path.join(overlayDir, MANIFEST_FILENAME);

  if (!lint.ok) {
    appendAuditEvent(db, {
      event_family: 'divergence',
      event_subtype: 'divergence.lint_failed',
      canon_version: CANON_VERSION,
      deployment_id: overlayDir,
      tenant_id: 'system',
      process_id: null,
      actor_ref: 'system',
      payload: {
        overlay_dir: overlayDir,
        manifest_hash: lint.manifestHash,
        failure_count: lint.failures.length,
        failures: lint.failures.map((f) => ({ code: f.code, message: f.message })),
      },
    });
    return { ok: false, lint };
  }

  // Manifest is valid — parse it now (lint already validated it).
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = yaml.load(raw) as DivergenceManifest;
  const manifestHash = lint.manifestHash;
  const deploymentId = manifest.deployment_id;

  // Migration 005 keeps every manifest version forever. At most one CURRENT
  // per deployment (partial unique index); prior versions flip to SUPERSEDED.
  const prior = db
    .prepare(
      `SELECT manifest_id, manifest_hash FROM deployment_manifests
       WHERE deployment_id = ? AND status = 'CURRENT'`,
    )
    .get(deploymentId) as { manifest_id: string; manifest_hash: string } | undefined;

  const tx = db.transaction(() => {
    const sameAsCurrent = prior?.manifest_hash === manifestHash;

    if (prior && !sameAsCurrent) {
      db.prepare(
        `UPDATE deployment_manifests
         SET status = 'SUPERSEDED'
         WHERE manifest_id = ?`,
      ).run(prior.manifest_id);
    }

    // Re-loading the same hash is a no-op — keep the existing CURRENT row.
    if (!sameAsCurrent) {
      db.prepare(
        `INSERT INTO deployment_manifests (
           manifest_id, deployment_id, tenant_id, manifest_yaml, manifest_hash,
           canon_version, overlay_name, overlay_version, declared_at, declared_by,
           status
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CURRENT')`,
      ).run(
        crypto.randomUUID(),
        deploymentId,
        'system',
        raw,
        manifestHash,
        manifest.canon_version,
        manifest.overlay_name,
        manifest.overlay_version,
        manifest.declared_at,
        manifest.declared_by,
      );
    }

    appendAuditEvent(db, {
      event_family: 'divergence',
      event_subtype:
        prior && !sameAsCurrent
          ? 'divergence.manifest_changed'
          : 'divergence.manifest_loaded',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId,
      tenant_id: 'system',
      process_id: null,
      actor_ref: manifest.declared_by,
      payload: {
        manifest_hash: manifestHash,
        prior_manifest_hash: prior && prior.manifest_hash !== manifestHash ? prior.manifest_hash : null,
        canon_version: manifest.canon_version,
        overlay_name: manifest.overlay_name,
        overlay_version: manifest.overlay_version,
        bindings_count: manifest.bindings.length,
        signed: Boolean(manifest.signatures),
        signing_required: Boolean(manifest.signatures?.signing_required),
        public_key_fingerprint: manifest.signatures?.public_key
          ? sha256Hex(manifest.signatures.public_key)
          : null,
      },
    });
  });
  tx();

  overlays.set(deploymentId, { manifest, manifestHash });

  return { ok: true, overlay: makeBoundOverlay(deploymentId, manifest, manifestHash, overlayDir, db) };
}

function makeBoundOverlay(
  deploymentId: string,
  manifest: DivergenceManifest,
  manifestHash: string,
  overlayDir: string,
  db: DatabaseHandle,
): BoundOverlay {
  return {
    deploymentId,
    overlayName: manifest.overlay_name,
    overlayVersion: manifest.overlay_version,
    canonVersion: manifest.canon_version,
    manifestHash,
    resolve<T = unknown>(splitPoint: SplitPointId, context?: ResolveContext): T | undefined {
      const binding = bindingFor(manifest, splitPoint, context);
      if (!binding) return undefined;
      const value = resolvedValueOf(binding, overlayDir, db);

      appendAuditEvent(db, {
        event_family: 'divergence',
        event_subtype: 'divergence.binding_exercised',
        canon_version: CANON_VERSION,
        deployment_id: deploymentId,
        tenant_id: context?.tenant_id ?? 'system',
        process_id: context?.process_id ?? null,
        actor_ref: context?.actor_ref ?? null,
        payload: {
          split_point: splitPoint,
          process_type: context?.process_type ?? null,
          manifest_hash: manifestHash,
          value_hash: sha256Hex(canonicalJson(value)),
        },
      });

      return value as T;
    },
  };
}

// ── current ─────────────────────────────────────────────────────────────────

/** In-memory overlay handle for `deploymentId`, or null. */
export function current(deploymentId: string, db?: DatabaseHandle, overlayDir?: string): BoundOverlay | null {
  const entry = overlays.get(deploymentId);
  if (!entry) return null;
  // resolve closures need both db and overlayDir. They are captured by
  // loadOverlay; we re-create a bound overlay here only if the caller
  // provides both. Otherwise return a read-only summary without resolve.
  if (db && overlayDir) {
    return makeBoundOverlay(deploymentId, entry.manifest, entry.manifestHash, overlayDir, db);
  }
  return {
    deploymentId,
    overlayName: entry.manifest.overlay_name,
    overlayVersion: entry.manifest.overlay_version,
    canonVersion: entry.manifest.canon_version,
    manifestHash: entry.manifestHash,
    resolve: () => undefined,
  };
}
