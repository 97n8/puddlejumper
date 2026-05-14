/**
 * Governance Process Runtime (GPR) Interfaces
 * 
 * GPR is a defended technical claim:
 * PJ enforces the conditions under which work can happen
 * (authority, policy, audit) rather than executing the work itself.
 * 
 * "Runtime" not "engine." The runtime is the environment.
 * 
 * // GPR
 */

import type { VaultEvaluation } from "../vault/index.js";
import type { AuditEvent } from "../audit/index.js";

/** A governance flow — the path from decision to action */
export interface GovernanceFlow {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  /** The VAULT conditions this flow requires */
  requiredConditions: string[];
  /** Steps in the flow — each must pass VAULT */
  steps: FlowStep[];
  status: FlowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FlowStep {
  id: string;
  flowId: string;
  order: number;
  name: string;
  /** Who this step routes to — resolved by Org Manager */
  assigneeRole: string;
  /** VAULT evaluation for this step */
  vaultEvaluation?: VaultEvaluation;
  /** Audit trail for this step */
  auditEvents: AuditEvent[];
  status: StepStatus;
}

export type FlowStatus = "draft" | "active" | "completed" | "suspended" | "archived";
export type StepStatus = "pending" | "in_progress" | "approved" | "rejected" | "skipped";

/** Tenant — the organizational boundary */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** Which PJ modules are provisioned */
  modules: PJModule[];
  /** Cloud sync connections */
  syncConnections: string[]; // connection IDs
  createdAt: string;
}

export type PJModule =
  | "logicos"
  | "vault"
  | "cal"
  | "archieve"
  | "sync8"
  | "org-manager"
  | "puddles"
  | "formkey";

// ── CaseSpace ──

/**
 * CaseSpace — the runtime context for a user session.
 * 
 * The join of identity, authority, tools, rules, milestones,
 * and institutional context. This is what makes PJ a runtime.
 * Without it, PJ is a collection of tools.
 * 
 * The casespace is the environment — every action happens inside it,
 * automatically scoped to tenant, evaluated against authority,
 * logged to the audit trail, and visible to the governance flow.
 * 
 * Inbound: identity arrives (SSO, magic link). Formkey submissions
 * create flows. Records sync in from cloud providers.
 * 
 * Outbound: Transfer (the T in VAULT) delivers governed artifacts
 * to systems of record — SharePoint, Google Drive, CivicPlus, state
 * portals, resident inboxes — with the governance fingerprint attached.
 */
export interface CaseSpace {
  sessionId: string;
  tenantId: string;

  /** Identity — from Microsoft, Google, or magic link */
  user: {
    id: string;
    email: string;
    name: string;
    provider: "microsoft" | "google" | "magic_link";
  };

  /** Position — from Org Manager. Not a role check. Structural position. */
  position: {
    orgNodeId: string;
    title: string;
    department: string;
    reportsTo: string;
  };

  /** MCP tools available to this position */
  tools: string[]; // qualified tool names (domain.tool)

  /** Governance flows pending action from this user */
  activeFlows: string[]; // flow IDs

  /** VAULT, ARCHIEVE, CAL rules in effect */
  activeRules: CaseSpaceRule[];

  /** Deadlines from CAL that affect this user's flows */
  deadlines: CaseSpaceDeadline[];

  /** Formkeys this position can receive submissions from */
  formkeys: string[]; // formkey IDs

  /** Cloud sync targets available for Transfer */
  syncTargets: string[]; // connection IDs

  createdAt: string;
  expiresAt: string;
}

export interface CaseSpaceRule {
  source: "vault" | "archieve" | "cal";
  policyId: string;
  label: string;
  /** Statutory or policy reference */
  authority: string;
}

export interface CaseSpaceDeadline {
  flowId?: string;
  label: string;
  date: string;
  /** Statutory basis */
  authority: string;
}
