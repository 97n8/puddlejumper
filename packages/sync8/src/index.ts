/**
 * SYNCHRON8 — PJ-Native Automation Engine + Cloud Sync
 * 
 * Not n8n. Not BullMQ. PJ-native.
 * 
 * Two jobs:
 * 1. Automation — governance-aware jobs that respect VAULT and produce audit trails
 * 2. Cloud Sync — bidirectional sync with M365/Google/CivicPlus
 * 
 * Sync cost model (near-zero by design):
 * 
 *   OUTBOUND  Push-on-transfer    Event-driven. Fires when VAULT Transfer
 *                                 completes. One API call per artifact.
 *                                 No polling. No persistent connection.
 * 
 *   INBOUND   Pull-on-casespace   Delta query on session start. Microsoft
 *                                 Graph and Google Drive both support delta
 *                                 tokens — "what changed since last check."
 *                                 One call per session open. Token is a
 *                                 string stored in SQLite.
 * 
 *   RECONCILE SYNCHRON8 cron      Nightly or hourly batch. Catches drift.
 *                                 Reconciles governed folders against PJ
 *                                 state. Writes audit events for changes.
 * 
 *   COST      Near zero           Free API tiers (Graph: 10K/day, Drive:
 *                                 12K/day). Municipal workflow volume is
 *                                 orders of magnitude below limits.
 *                                 No managed DB. No webhook subscriptions.
 *                                 No persistent connections.
 * 
 * Cloud Sync is governance-aware:
 * - Won't sync an artifact that hasn't completed VAULT evaluation
 * - Won't delete a record that ARCHIEVE says must be retained
 * - Provisions structure on first connect (retention labels, department scoping,
 *   metadata columns, permissions) — like SharePoint provisioning but driven
 *   by the governance model, not by an admin clicking through a wizard
 * - Attaches governance fingerprint to synced artifacts (VAULT evaluation ID,
 *   audit chain hash, retention policy, authority that produced it)
 * 
 * // GPR
 */

import type { SyncTarget } from "@pj/formkey";

// ── Automation ──

export interface Sync8Job {
  id: string;
  tenantId: string;
  name: string;
  trigger: Sync8Trigger;
  steps: Sync8Step[];
  status: "active" | "paused" | "failed" | "completed";
  createdAt: string;
  lastRunAt?: string;
}

export interface Sync8Trigger {
  type: "cron" | "event" | "webhook" | "manual" | "transfer_complete";
  config: Record<string, unknown>;
}

export interface Sync8Step {
  id: string;
  action: string;
  params: Record<string, unknown>;
  /** Must this step pass VAULT before executing? */
  requiresVault: boolean;
  order: number;
}

// ── Cloud Sync ──

export interface CloudSyncConnection {
  id: string;
  tenantId: string;
  provider: SyncTarget["provider"];
  config: Record<string, string>;
  status: "connected" | "provisioning" | "error" | "disconnected";
  /** Has initial structure been provisioned? */
  provisioned: boolean;
  /** Sync strategy — no persistent connections, no webhook subscriptions */
  outbound: "push_on_transfer";      // always event-driven
  inbound: "pull_on_casespace" | "batch_reconcile" | "both";
  /** Delta token for pull-on-casespace. One string, stored in SQLite. */
  deltaToken?: string;
  /** Reconciliation schedule (cron expression) */
  reconcileSchedule?: string;         // e.g. "0 2 * * *" (nightly at 2am)
  /** Last successful sync */
  lastSyncAt?: string;
  createdAt: string;
}

/** What gets provisioned when a cloud connection is first established */
export interface ProvisionManifest {
  connectionId: string;
  tenantId: string;
  /** Document libraries / folders to create */
  structures: ProvisionStructure[];
  /** Metadata columns to add (maps to PJ fields) */
  metadata: ProvisionMetadata[];
  /** Retention labels from ARCHIEVE */
  retentionLabels: ProvisionRetention[];
  /** Permission scoping from Org Manager */
  permissions: ProvisionPermission[];
}

export interface ProvisionStructure {
  path: string;            // e.g. "Administration/Town Clerk/PRR"
  department: string;
  description: string;
}

export interface ProvisionMetadata {
  name: string;            // Column name
  type: "text" | "date" | "choice" | "number";
  /** Maps to a PJ field */
  pjField: string;         // e.g. "flow.status", "vault.evaluation_id"
}

export interface ProvisionRetention {
  label: string;           // e.g. "Permanent — Vital Records"
  policyId: string;        // ARCHIEVE policy ID
  retentionDays: number | null; // null = permanent
}

export interface ProvisionPermission {
  path: string;
  orgNodeId: string;       // Org Manager node that gets access
  level: "read" | "write" | "admin";
}

/** A governance fingerprint attached to every synced artifact */
export interface GovernanceFingerprint {
  /** PJ flow ID that produced this artifact */
  flowId: string;
  /** VAULT evaluation ID — proof of governed process */
  vaultEvaluationId: string;
  /** Audit chain hash at time of transfer */
  auditHash: string;
  /** ARCHIEVE retention policy governing this artifact */
  retentionPolicyId: string;
  /** Authority (Org Manager node) that approved transfer */
  authorityNodeId: string;
  /** Timestamp of transfer */
  transferredAt: string;
  /** PJ tenant */
  tenantId: string;
}

// ── Artifact Delivery ──

/** An artifact generated from flow state, ready for transfer */
export interface GovernedArtifact {
  id: string;
  flowId: string;
  tenantId: string;
  /** What kind of document was generated */
  artifactType: "letter" | "certificate" | "minutes" | "report" | "notice" | "permit" | "response";
  /** Generated content — file bytes or structured data */
  contentType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "text/html";
  /** Where this artifact should be delivered */
  syncTarget: SyncTarget;
  /** Governance proof embedded in the artifact */
  fingerprint: GovernanceFingerprint;
  /** Has transfer completed? */
  delivered: boolean;
  deliveredAt?: string;
  createdAt: string;
}

export class Sync8Engine {
  // Slot: existing SYNCHRON8 implementation
  // Now includes cloud sync orchestration and artifact delivery
}
