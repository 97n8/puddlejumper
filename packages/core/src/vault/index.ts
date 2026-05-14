/**
 * VAULT Framework
 * Verification · Authority · Utility · Legitimacy · Transfer
 * 
 * Written by Nathan Boudreau.
 * Operationalized by Dr. Allison Weiss Rothschild.
 * 
 * Five conditions that must be true before a governance action should happen.
 * Authority is a runtime condition — not a role check, not a permission bit.
 * VAULT evaluates whether the structural preconditions for action exist.
 * 
 * // GPR
 */

/** The five VAULT conditions */
export type VaultCondition =
  | "verification"
  | "authority"
  | "utility"
  | "legitimacy"
  | "transfer";

/** Result of evaluating a single VAULT condition */
export interface VaultConditionResult {
  condition: VaultCondition;
  satisfied: boolean;
  evaluatedAt: string; // ISO 8601
  evaluatedBy: string; // actor or system
  evidence?: string;   // human-readable reason
  policyRef?: string;  // statute, bylaw, SOP reference
}

/** Full VAULT evaluation for a governance action */
export interface VaultEvaluation {
  id: string;
  tenantId: string;
  actionId: string;
  actionType: string;
  conditions: Record<VaultCondition, VaultConditionResult>;
  allSatisfied: boolean;
  evaluatedAt: string;
  /** Immutable once written — enforced by audit_events trigger */
  auditEventId: string;
}

/** VAULT module definition — what a module must implement */
export interface VaultModule {
  id: string;
  name: string;
  department: string;
  conditions: VaultCondition[];
  evaluate(context: VaultEvaluationContext): Promise<VaultEvaluation>;
}

/** Context passed into a VAULT evaluation */
export interface VaultEvaluationContext {
  tenantId: string;
  actorId: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  /** Statutory or policy basis for the action */
  policyBasis?: string;
}

export const VAULT_CONDITIONS: VaultCondition[] = [
  "verification",
  "authority",
  "utility",
  "legitimacy",
  "transfer",
];
