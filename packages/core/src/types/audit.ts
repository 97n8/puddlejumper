// Canon: append-only audit event stream.
// Source: Master Build Spec v1.1, Part 3 + Part 11.
// Rule 2: audit_events is append-only. UPDATE/DELETE refused at DB level.

export type AuditEventFamily =
  | 'process'
  | 'transition'
  | 'role'
  | 'auth'
  | 'divergence'
  | 'system';

// Common subtypes named in the spec. Overlays may register additional
// subtypes via SP.EVENT.SUBTYPE — those resolve to strings at runtime.
export type AuditEventSubtype =
  // process.*
  | 'process.created'
  | 'process.fields_updated'
  | 'process.closed'
  // transition.*
  | 'transition.fired'
  | 'transition.refused'
  // role.*
  | 'role.assigned'
  | 'role.changed'
  | 'role.unassigned'
  // auth.*
  | 'auth.granted'
  | 'auth.refused'
  // divergence.*
  | 'divergence.manifest_loaded'
  | 'divergence.binding_exercised'
  | 'divergence.manifest_changed'
  | 'divergence.lint_failed'
  // system.*
  | 'system.intent_dispatched'
  | 'system.intent_suppressed'
  | 'system.member_onboarded'
  // ai_assist (Puddles) — decisionMade is always false for this actor type
  | 'ai_assist.suggested'
  | 'ai_assist.confirmed'
  | 'ai_assist.dismissed'
  | 'ai_assist.blocked'
  | (string & {}); // overlay-registered subtypes

export interface AuditEvent {
  event_id: string;
  event_family: AuditEventFamily;
  event_subtype: AuditEventSubtype;
  canon_version: string;
  deployment_id: string;
  tenant_id: string;
  process_id: string | null;
  actor_ref: string | null;
  occurred_at: string;
  inserted_at: string;
  payload_json: string;
  payload_hash: string;
  prior_event_id: string | null;
}

export type AuditEventInsert = Omit<AuditEvent, 'inserted_at' | 'payload_hash'> & {
  payload_hash?: string;
};
