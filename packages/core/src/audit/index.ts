/**
 * Audit System Types
 * 
 * audit_events is append-only. SQLite triggers prevent UPDATE and DELETE.
 * This is not a design choice — it's an enforcement mechanism.
 * The governance process runtime produces records that can't be altered.
 * 
 * // GPR
 */

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorId: string;
  actorType: "user" | "system" | "ai_assist";
  action: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  timestamp: string; // ISO 8601
  /** Hash of previous event — chain integrity */
  previousHash?: string;
  hash: string;
}

/** What gets written when AI assists (never decides) */
export interface AiAssistEvent extends AuditEvent {
  actorType: "ai_assist";
  /** The human who will review/approve */
  reviewerId: string;
  /** AI never decides. This field must always be false at write time. */
  decisionMade: false;
  /** Human decision, written as a separate event */
  humanDecisionEventId?: string;
}

export type AuditEventInsert = Omit<AuditEvent, "id" | "hash" | "timestamp">;
