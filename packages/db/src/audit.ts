// @pj/db — append-only audit event writer.
// The single sanctioned write path to `audit_events` (canon rule 2).

import crypto from 'node:crypto';
import type {
  AuditEvent,
  AuditEventFamily,
  AuditEventSubtype,
} from '@publiclogic/core';
import type { DatabaseHandle } from './db.js';

export interface AppendAuditEventInput {
  /** Optional; a v4 UUID is generated when omitted. */
  event_id?: string;
  event_family: AuditEventFamily;
  event_subtype: AuditEventSubtype;
  canon_version: string;
  deployment_id: string;
  tenant_id: string;
  process_id?: string | null;
  actor_ref?: string | null;
  /** ISO 8601 timestamp. Defaults to `new Date().toISOString()`. */
  occurred_at?: string;
  /** Arbitrary payload — serialized to JSON, SHA-256'd, and stored. */
  payload: unknown;
  prior_event_id?: string | null;
}

function canonicalJson(value: unknown): string {
  // Deterministic stringify: object keys sorted, arrays preserved.
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',');
  return `{${body}}`;
}

/**
 * Append a single event to `audit_events`. The only sanctioned write path.
 *
 * `payload_json` is the canonical JSON of `input.payload`; `payload_hash`
 * is its SHA-256 digest (hex). Both are computed here so callers cannot
 * forget. The DB triggers refuse any UPDATE/DELETE on this table.
 */
export function appendAuditEvent(
  db: DatabaseHandle,
  input: AppendAuditEventInput,
): AuditEvent {
  const event_id = input.event_id ?? crypto.randomUUID();
  const occurred_at = input.occurred_at ?? new Date().toISOString();
  const payload_json = canonicalJson(input.payload);
  const payload_hash = crypto.createHash('sha256').update(payload_json).digest('hex');

  db.prepare(
    `INSERT INTO audit_events (
       event_id, event_family, event_subtype, canon_version, deployment_id,
       tenant_id, process_id, actor_ref, occurred_at,
       payload_json, payload_hash, prior_event_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event_id,
    input.event_family,
    input.event_subtype,
    input.canon_version,
    input.deployment_id,
    input.tenant_id,
    input.process_id ?? null,
    input.actor_ref ?? null,
    occurred_at,
    payload_json,
    payload_hash,
    input.prior_event_id ?? null,
  );

  return db
    .prepare('SELECT * FROM audit_events WHERE event_id = ?')
    .get(event_id) as AuditEvent;
}
