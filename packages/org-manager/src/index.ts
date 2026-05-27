// @pj/org-manager — authority resolution.
//
// Resolves position (identities, assignments, role-based permissions),
// emits auth + role audit events via @pj/db. Never opens its own database
// connection: every public function takes a `db` handle as the first arg.
//
// Source: Master Build Spec v1.1, Part 6 (Module Map → Org Manager) +
// Phase 3 prompt.

import crypto from 'node:crypto';
import { appendAuditEvent, type DatabaseHandle } from '@pj/db';

// crypto.randomUUID is what we use for identity_id below; this import is
// shared with the assign() implementation already in this module.
import type {
  AuditEventSubtype,
  CanonicalAction,
  Identity,
  RoleType,
} from '@publiclogic/core';
import {
  CANONICAL_ROLE_TYPES,
  isCanonicalRoleType,
  rolePermits,
} from './permissions.js';
import {
  PJIdentityNotFound,
  PJInvalidRoleType,
  PJNoEligibleIdentity,
} from './errors.js';

export { CANONICAL_ACTIONS, CANONICAL_ROLE_TYPES, DEFAULT_PERMISSIONS } from './permissions.js';
export { PJIdentityNotFound, PJInvalidRoleType, PJNoEligibleIdentity } from './errors.js';

// ── Canon constants ─────────────────────────────────────────────────────────

const CANON_VERSION = '1.0.0';
function deploymentId(): string {
  return process.env.PJ_DEPLOYMENT_ID ?? 'default';
}

// ── Row types ────────────────────────────────────────────────────────────────

type IdentityRow = {
  identity_id: string;
  tenant_id: string;
  kind: 'person' | 'service' | 'delegation';
  active: 0 | 1;
  created_at: string;
  deactivated_at: string | null;
};

type AssignmentRow = {
  assignment_id: string;
  process_id: string;
  identity_id: string;
  role_type: RoleType;
  tenant_id: string;
  assigned_at: string;
  unassigned_at: string | null;
  assigned_by_ref: string | null;
};

function rowToIdentity(row: IdentityRow): Identity {
  return {
    identity_id: row.identity_id,
    tenant_id: row.tenant_id,
    kind: row.kind,
    active: row.active === 1,
    created_at: row.created_at,
    deactivated_at: row.deactivated_at,
  };
}

// ── createTenant ────────────────────────────────────────────────────────────

export interface TenantRow {
  id: string;
  name: string;
  canon_version: string;
  created_at: string;
}

export interface CreateTenantResult {
  tenant: TenantRow;
  created: boolean;
}

/**
 * Idempotent tenant upsert.  If a row with `id` already exists this is a
 * no-op (does not overwrite name; tenant rename is a deliberate API action,
 * not a seed concern).  Returns `created: true` only on first insert so
 * callers can emit `tenant.seeded` once per tenant lifetime.
 */
export function createTenant(
  db: DatabaseHandle,
  args: { id: string; name: string; canonVersion?: string },
): CreateTenantResult {
  const existing = db
    .prepare(`SELECT id, name, canon_version, created_at FROM tenants WHERE id = ?`)
    .get(args.id) as TenantRow | undefined;
  if (existing) return { tenant: existing, created: false };

  db.prepare(
    `INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)`,
  ).run(args.id, args.name, args.canonVersion ?? CANON_VERSION);

  const row = db
    .prepare(`SELECT id, name, canon_version, created_at FROM tenants WHERE id = ?`)
    .get(args.id) as TenantRow;
  return { tenant: row, created: true };
}

// ── createIdentity ──────────────────────────────────────────────────────────

export interface CreateIdentityArgs {
  tenantId: string;
  kind?: 'person' | 'service' | 'delegation';
  email?: string;
  displayName?: string;
}

export interface CreateIdentityResult {
  identity: Identity & { email: string | null; display_name: string | null };
  created: boolean;
}

/**
 * Idempotent identity create scoped by `(tenant_id, email)`.  If an active
 * identity with the same email already exists in the tenant this is a
 * no-op.  OAuth subjects are NOT set here — they're linked on first login
 * via the onUserAuthenticated hook in apps/logic-commons.
 */
export function createIdentity(
  db: DatabaseHandle,
  args: CreateIdentityArgs,
): CreateIdentityResult {
  const kind = args.kind ?? 'person';
  const email = args.email ?? null;
  const displayName = args.displayName ?? null;

  if (email) {
    const existing = db
      .prepare(
        `SELECT * FROM identities WHERE tenant_id = ? AND email = ?`,
      )
      .get(args.tenantId, email) as
        | (IdentityRow & { email: string | null; display_name: string | null })
        | undefined;
    if (existing) {
      return {
        identity: { ...rowToIdentity(existing), email: existing.email, display_name: existing.display_name },
        created: false,
      };
    }
  }

  const identity_id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO identities (identity_id, tenant_id, kind, active, email, display_name)
     VALUES (?, ?, ?, 1, ?, ?)`,
  ).run(identity_id, args.tenantId, kind, email, displayName);

  const row = db
    .prepare(`SELECT * FROM identities WHERE identity_id = ?`)
    .get(identity_id) as IdentityRow & { email: string | null; display_name: string | null };

  return {
    identity: { ...rowToIdentity(row), email: row.email, display_name: row.display_name },
    created: true,
  };
}

// ── whois ───────────────────────────────────────────────────────────────────

export interface WhoisResult extends Identity {
  /** Canonical role_type drawn from the most recent active assignment. */
  title?: string;
}

/**
 * Look up an identity by id, scoped to a tenant. The optional `title`
 * field is the role_type from the most recent active assignment in this
 * tenant — overlays may later transform it into a display string via
 * `SP.ROLE.BINDING`.
 *
 * Throws PJIdentityNotFound if no row matches.
 */
export function whois(
  db: DatabaseHandle,
  identityId: string,
  tenantId: string,
): WhoisResult {
  const row = db
    .prepare(
      `SELECT * FROM identities WHERE identity_id = ? AND tenant_id = ?`,
    )
    .get(identityId, tenantId) as IdentityRow | undefined;
  if (!row) throw new PJIdentityNotFound(identityId, tenantId);

  const titleRow = db
    .prepare(
      `SELECT role_type FROM assignments
       WHERE identity_id = ? AND tenant_id = ? AND unassigned_at IS NULL
       ORDER BY assigned_at DESC LIMIT 1`,
    )
    .get(identityId, tenantId) as { role_type: string } | undefined;

  const identity = rowToIdentity(row);
  return titleRow ? { ...identity, title: titleRow.role_type } : identity;
}

// ── can ─────────────────────────────────────────────────────────────────────

function activeAssignmentsFor(
  db: DatabaseHandle,
  identityId: string,
  processId: string,
  tenantId: string,
): AssignmentRow[] {
  return db
    .prepare(
      `SELECT * FROM assignments
       WHERE identity_id = ? AND process_id = ? AND tenant_id = ?
         AND unassigned_at IS NULL
       ORDER BY assigned_at ASC`,
    )
    .all(identityId, processId, tenantId) as AssignmentRow[];
}

function emitAuth(
  db: DatabaseHandle,
  tenantId: string,
  identityId: string,
  action: CanonicalAction,
  processId: string,
  roleType: RoleType | null,
  permitted: boolean,
  reason: string,
): void {
  const subtype: AuditEventSubtype = permitted ? 'auth.granted' : 'auth.refused';
  appendAuditEvent(db, {
    event_family: 'auth',
    event_subtype: subtype,
    canon_version: CANON_VERSION,
    deployment_id: deploymentId(),
    tenant_id: tenantId,
    process_id: processId,
    actor_ref: identityId,
    payload: {
      identity_id: identityId,
      action,
      process_id: processId,
      role_type: roleType,
      permitted,
      reason,
    },
  });
}

/**
 * Check whether `identityId` may perform `action` on `processId`.
 * Always emits `auth.granted` or `auth.refused` to audit_events.
 *
 * Default (no overlay) policy: an identity must have an active assignment
 * whose `role_type` is permitted the action by `DEFAULT_PERMISSIONS`.
 */
export function can(
  db: DatabaseHandle,
  identityId: string,
  action: CanonicalAction,
  processId: string,
  tenantId: string,
): boolean {
  // Identity must exist; missing → refuse.
  let identity: Identity;
  try {
    identity = whois(db, identityId, tenantId);
  } catch {
    emitAuth(db, tenantId, identityId, action, processId, null, false, 'identity_not_found');
    return false;
  }
  if (!identity.active) {
    emitAuth(db, tenantId, identityId, action, processId, null, false, 'identity_inactive');
    return false;
  }

  const assignments = activeAssignmentsFor(db, identityId, processId, tenantId);
  if (assignments.length === 0) {
    emitAuth(db, tenantId, identityId, action, processId, null, false, 'no_active_assignment');
    return false;
  }

  for (const a of assignments) {
    if (rolePermits(a.role_type, action)) {
      emitAuth(db, tenantId, identityId, action, processId, a.role_type, true, 'role_permits');
      return true;
    }
  }

  // None of the roles permit the action.
  emitAuth(
    db,
    tenantId,
    identityId,
    action,
    processId,
    assignments[0]!.role_type,
    false,
    'role_denies',
  );
  return false;
}

// ── assign ──────────────────────────────────────────────────────────────────

export type AssignCriteria =
  | { strategy: 'named_default'; identity_ref: string }
  | { strategy: 'round_robin'; role_type: RoleType }
  | { strategy: 'lookup_table'; table: Record<string, string>; key: string };

function selectIdentity(
  db: DatabaseHandle,
  tenantId: string,
  roleType: RoleType,
  criteria: AssignCriteria,
): string {
  if (criteria.strategy === 'named_default') {
    return criteria.identity_ref;
  }
  if (criteria.strategy === 'lookup_table') {
    const id = criteria.table[criteria.key];
    if (!id) {
      throw new PJNoEligibleIdentity(
        roleType,
        'lookup_table',
        `key '${criteria.key}' has no entry`,
      );
    }
    return id;
  }
  // round_robin — pick the active identity in this tenant with the fewest
  // open assignments. Eligibility is "active and in this tenant"; the
  // role passed in `criteria.role_type` is used only for the audit trail
  // (we don't constrain to identities currently bearing that role).
  const rows = db
    .prepare(
      `SELECT i.identity_id AS id,
              (SELECT COUNT(*) FROM assignments a
                 WHERE a.identity_id = i.identity_id
                   AND a.unassigned_at IS NULL) AS open_count
       FROM identities i
       WHERE i.tenant_id = ? AND i.active = 1
       ORDER BY open_count ASC, i.identity_id ASC
       LIMIT 1`,
    )
    .get(tenantId) as { id: string; open_count: number } | undefined;
  if (!rows) {
    throw new PJNoEligibleIdentity(roleType, 'round_robin', 'no active identities in tenant');
  }
  return rows.id;
}

/**
 * Assign `roleType` on `processId` to an identity chosen by `criteria`.
 * Validates the role is canonical and the selected identity is active.
 * Inserts into `assignments` and emits `role.assigned`.
 * Returns the chosen identity_id.
 */
export function assign(
  db: DatabaseHandle,
  processId: string,
  roleType: RoleType,
  criteria: AssignCriteria,
  tenantId: string,
  assignedByRef: string,
): string {
  if (!isCanonicalRoleType(roleType)) {
    throw new PJInvalidRoleType(roleType);
  }

  const identityId = selectIdentity(db, tenantId, roleType, criteria);

  // Identity must exist and be active in this tenant.
  const identity = whois(db, identityId, tenantId);
  if (!identity.active) {
    throw new PJNoEligibleIdentity(roleType, criteria.strategy, `identity '${identityId}' is inactive`);
  }

  const assignment_id = crypto.randomUUID();
  const assigned_at = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO assignments (
         assignment_id, process_id, identity_id, role_type, tenant_id,
         assigned_at, assigned_by_ref
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(assignment_id, processId, identityId, roleType, tenantId, assigned_at, assignedByRef);

    appendAuditEvent(db, {
      event_family: 'role',
      event_subtype: 'role.assigned',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id: processId,
      actor_ref: assignedByRef,
      occurred_at: assigned_at,
      payload: {
        assignment_id,
        process_id: processId,
        identity_id: identityId,
        role_type: roleType,
        strategy: criteria.strategy,
        assigned_by_ref: assignedByRef,
      },
    });
  });
  tx();

  return identityId;
}

// ── deactivateIdentity ──────────────────────────────────────────────────────

/**
 * Mark an identity inactive and close all of its open assignments.
 * Emits `role.deactivated` with the count of assignments closed.
 */
export function deactivateIdentity(
  db: DatabaseHandle,
  identityId: string,
  tenantId: string,
): void {
  // Existence + tenant scope check.
  whois(db, identityId, tenantId);

  const deactivated_at = new Date().toISOString();
  let openCount = 0;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE identities
       SET active = 0, deactivated_at = ?
       WHERE identity_id = ? AND tenant_id = ?`,
    ).run(deactivated_at, identityId, tenantId);

    const result = db
      .prepare(
        `UPDATE assignments
         SET unassigned_at = ?
         WHERE identity_id = ? AND tenant_id = ? AND unassigned_at IS NULL`,
      )
      .run(deactivated_at, identityId, tenantId);
    openCount = result.changes;

    appendAuditEvent(db, {
      event_family: 'role',
      event_subtype: 'role.deactivated',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id: null,
      actor_ref: identityId,
      occurred_at: deactivated_at,
      payload: {
        identity_id: identityId,
        open_assignments_closed: openCount,
      },
    });
  });
  tx();
}

// Re-export the role/action types so consumers don't double-import.
export type { CanonicalAction, RoleType } from '@publiclogic/core';
/** Sanity-check constant for the closed canon role set (8 roles, Part 3). */
export const ROLE_TYPE_COUNT = CANONICAL_ROLE_TYPES.length;
