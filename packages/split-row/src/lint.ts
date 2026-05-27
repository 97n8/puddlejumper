// Split-Row Runtime Contract — lint gate.
// Source: Master Build Spec v1.1, Part 5 + Part 14 + Phase 4 prompt.
//
// Runs every check to completion before returning. Never short-circuits.
// On failure the overlay is refused and the server exits at boot.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { DatabaseHandle } from '@pj/db';
import type {
  Binding,
  DivergenceManifest,
  LintFailure,
  LintFailureCode,
  LintResult,
  LintWarning,
  SplitPointId,
} from '@publiclogic/core';
import { canonicalJson } from './canonical-json.js';

// Closed set — Master Spec Part 5.
export const SPLIT_POINTS: readonly SplitPointId[] = [
  'SP.STATE.NAMES',
  'SP.STATE.GUARDS',
  'SP.ROLE.BINDING',
  'SP.ROLE.ASSIGNMENT',
  'SP.EVENT.SUBTYPE',
  'SP.FORM.FIELDS',
  'SP.NOTIFY.CHANNEL',
  'SP.INTEG.ENDPOINT',
] as const;
const SPLIT_POINT_SET = new Set<string>(SPLIT_POINTS);

const MANIFEST_FILENAME = 'divergence_manifest.yaml';

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function isStringNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function asFailure(
  code: LintFailureCode,
  message: string,
  extras: Partial<LintFailure> = {},
): LintFailure {
  return { code, message, ...extras };
}

/** Subset of manifest signed by the declaring authority (Part 14 RESOLVED-1). */
function signedContent(manifest: DivergenceManifest): string {
  const sortedBindings = [...manifest.bindings]
    .map((b) => ({ ...b }))
    .sort((a, b) => {
      const ap = `${a.split_point}|${a.process_type ?? ''}`;
      const bp = `${b.split_point}|${b.process_type ?? ''}`;
      return ap < bp ? -1 : ap > bp ? 1 : 0;
    });
  return canonicalJson({
    bindings: sortedBindings,
    canon_version: manifest.canon_version,
    declared_at: manifest.declared_at,
    overlay_name: manifest.overlay_name,
    overlay_version: manifest.overlay_version,
  });
}

/**
 * Run every check, collect all failures, return one result. The caller
 * (frameworkRegistry.loadOverlay) is responsible for emitting the
 * `divergence.lint_failed` audit event when this returns `ok: false`.
 */
export function splitRowLint(
  overlayDir: string,
  db: DatabaseHandle,
  canonVersion: string,
): LintResult {
  const failures: LintFailure[] = [];
  const warnings: LintWarning[] = [];

  // Check 1 — MANIFEST_MISSING / MANIFEST_PARSE_ERROR
  const manifestPath = path.join(overlayDir, MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) {
    failures.push(
      asFailure('MANIFEST_MISSING', `manifest not found at ${manifestPath}`, { path: manifestPath }),
    );
    return { ok: false, failures, manifestHash: null, warnings };
  }

  const rawYaml = fs.readFileSync(manifestPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = yaml.load(rawYaml);
  } catch (err) {
    failures.push(
      asFailure('MANIFEST_PARSE_ERROR', `manifest YAML parse failed: ${(err as Error).message}`),
    );
    return { ok: false, failures, manifestHash: null, warnings };
  }
  if (!parsed || typeof parsed !== 'object') {
    failures.push(asFailure('MANIFEST_PARSE_ERROR', 'manifest root is not an object'));
    return { ok: false, failures, manifestHash: null, warnings };
  }

  const manifest = parsed as DivergenceManifest;
  const manifestHash = sha256Hex(canonicalJson(manifest));

  // Check 2 — CANON_VERSION_MISMATCH
  if (manifest.canon_version !== canonVersion) {
    failures.push(
      asFailure(
        'CANON_VERSION_MISMATCH',
        `manifest.canon_version '${manifest.canon_version}' !== runtime '${canonVersion}'`,
      ),
    );
  }

  const bindings: Binding[] = Array.isArray(manifest.bindings) ? manifest.bindings : [];
  if (!Array.isArray(manifest.bindings)) {
    failures.push(asFailure('BINDING_SCHEMA_INVALID', 'manifest.bindings must be an array'));
  }

  // Check 3 — UNKNOWN_SPLIT_POINT, Check 4 — BINDING_SCHEMA_INVALID,
  // Check 5 — RATIONALE_MISSING, Check 6 — VALUE_REF + artifact_id checks
  const referencedFiles = new Set<string>();

  for (let i = 0; i < bindings.length; i += 1) {
    const b = bindings[i]!;

    if (!isStringNonEmpty(b.split_point as string) || !SPLIT_POINT_SET.has(b.split_point)) {
      failures.push(
        asFailure('UNKNOWN_SPLIT_POINT', `binding[${i}].split_point '${b.split_point}' is not in the canon closed set`, {
          binding_index: i,
        }),
      );
    }

    if (!isStringNonEmpty(b.rationale)) {
      failures.push(
        asFailure('RATIONALE_MISSING', `binding[${i}] is missing a non-empty rationale`, {
          binding_index: i,
          split_point: b.split_point,
        }),
      );
    }

    const provided = [
      b.value !== undefined ? 'value' : null,
      typeof b.value_ref === 'string' ? 'value_ref' : null,
      typeof b.artifact_id === 'string' ? 'artifact_id' : null,
    ].filter(Boolean) as string[];

    if (provided.length !== 1) {
      failures.push(
        asFailure(
          'BINDING_SCHEMA_INVALID',
          `binding[${i}] must declare exactly one of value | value_ref | artifact_id (got ${provided.length}: ${provided.join(', ') || 'none'})`,
          { binding_index: i, split_point: b.split_point },
        ),
      );
    }

    if (typeof b.value_ref === 'string') {
      const refPath = path.join(overlayDir, b.value_ref);
      referencedFiles.add(path.resolve(refPath));
      if (!fs.existsSync(refPath)) {
        failures.push(
          asFailure('VALUE_REF_MISSING', `binding[${i}].value_ref '${b.value_ref}' not found on disk`, {
            binding_index: i,
            split_point: b.split_point,
            path: refPath,
          }),
        );
      } else {
        try {
          yaml.load(fs.readFileSync(refPath, 'utf8'));
        } catch (err) {
          failures.push(
            asFailure(
              'VALUE_REF_MALFORMED',
              `binding[${i}].value_ref '${b.value_ref}' is not valid YAML: ${(err as Error).message}`,
              { binding_index: i, split_point: b.split_point, path: refPath },
            ),
          );
        }
      }
    }

    if (typeof b.artifact_id === 'string') {
      const row = db
        .prepare(
          `SELECT binding_id, deprecated_at FROM shared_bindings WHERE binding_id = ?`,
        )
        .get(b.artifact_id) as { binding_id: string; deprecated_at: string | null } | undefined;
      if (!row) {
        failures.push(
          asFailure('ARTIFACT_NOT_FOUND', `binding[${i}].artifact_id '${b.artifact_id}' not in shared_bindings registry`, {
            binding_index: i,
            split_point: b.split_point,
          }),
        );
      } else if (row.deprecated_at) {
        warnings.push({
          code: 'ARTIFACT_DEPRECATED',
          message: `binding[${i}].artifact_id '${b.artifact_id}' was deprecated at ${row.deprecated_at}`,
          binding_index: i,
        });
      }
    }
  }

  // Check 7 — ORPHAN_ARTIFACT
  // Any .yaml/.yml file in overlayDir other than the manifest itself MUST be
  // referenced by at least one binding via value_ref.
  if (fs.existsSync(overlayDir)) {
    const entries = fs.readdirSync(overlayDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!(entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) continue;
      if (entry.name === MANIFEST_FILENAME) continue;
      const abs = path.resolve(path.join(overlayDir, entry.name));
      if (!referencedFiles.has(abs)) {
        failures.push(
          asFailure(
            'ORPHAN_ARTIFACT',
            `overlay file '${entry.name}' is not referenced by any binding.value_ref`,
            { path: abs },
          ),
        );
      }
    }
  }

  // Check 8 — SIGNATURE_MISSING / SIGNATURE_INVALID (Part 14 RESOLVED-1)
  const sig = manifest.signatures;
  if (sig?.signing_required) {
    if (!sig.signature || !sig.public_key) {
      failures.push(
        asFailure(
          'SIGNATURE_MISSING',
          'signing_required is true but signature or public_key is missing',
        ),
      );
    } else {
      try {
        const pubKey = crypto.createPublicKey({
          key: Buffer.from(sig.public_key, 'base64'),
          format: 'der',
          type: 'spki',
        });
        const ok = crypto.verify(
          null,
          Buffer.from(signedContent(manifest), 'utf8'),
          pubKey,
          Buffer.from(sig.signature, 'base64'),
        );
        if (!ok) {
          failures.push(
            asFailure(
              'SIGNATURE_INVALID',
              'Ed25519 signature does not verify against the manifest canonical content',
            ),
          );
        }
      } catch (err) {
        failures.push(
          asFailure(
            'SIGNATURE_INVALID',
            `Ed25519 verification threw: ${(err as Error).message}`,
          ),
        );
      }
    }
  }

  if (failures.length > 0) {
    return { ok: false, failures, manifestHash, warnings };
  }
  return { ok: true, manifestHash, warnings };
}

/** Exposed for tests that want to construct or verify the signed payload. */
export { signedContent };
