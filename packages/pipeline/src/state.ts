// @pj/pipeline — C6 honest action state + holds.
// Make pending authority real. Do not act yet.
//
// Turns C5 VAULT verdicts into visible, persisted pipeline state:
//   allowed           → case_space_action_state 'attempted'
//   approval_required → case_space_action_state 'pending' + a holds row
//   denied            → case_space_action_state 'failed' (no hold)
//   no_op             → recorded in the proof only (no row; the action-state
//                       CHECK has no no-op status and there is nothing to do)
//
// NOTHING is executed: 'attempted' means "cleared to act", not "acted".
// resolveHold() resumes ONLY the held action — approved flips its state to
// 'attempted', denied flips it to 'failed' — and never touches other holds.
//
// The DB handle is injected; this module never opens its own connection.

import crypto from 'node:crypto';
import { appendAuditEvent, type DatabaseHandle } from '@pj/db';
import type { ActionDecision, VaultDecision } from './vault.js';

const CANON_VERSION = '1.0.0';

/** Scope needed to persist state for a run. */
export interface PersistScope {
  tenant_id: string;
  deployment_id: string;
  case_space_id: string;
  module: string;
  process_id?: string | null;
  actor_ref?: string | null;
}

/** One persisted action-state outcome. */
export interface ActionStateOutcome {
  action: string;
  /** case_space_action_state.status, or 'no_op' when nothing was persisted. */
  state: 'attempted' | 'pending' | 'failed' | 'no_op';
  verdict: ActionDecision['verdict'];
  action_state_id: string | null;
  hold_id: string | null;
}

/** Result of persisting a VAULT decision. */
export interface PersistResult {
  outcomes: ActionStateOutcome[];
  summary: {
    attempted: number;
    pending: number;
    failed: number;
    no_op: number;
    holds_created: number;
  };
}

function upsertActionState(
  db: DatabaseHandle,
  scope: PersistScope,
  action: string,
  status: 'attempted' | 'pending' | 'failed',
  payload: Record<string, unknown>,
): string {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO case_space_action_state (
       action_state_id, tenant_id, case_space_id, module, action, status, payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, case_space_id, module, action)
     DO UPDATE SET status = excluded.status,
                   payload_json = excluded.payload_json,
                   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  ).run(
    id,
    scope.tenant_id,
    scope.case_space_id,
    scope.module,
    action,
    status,
    JSON.stringify(payload),
  );
  // On conflict the existing row keeps its original id — read it back.
  const row = db
    .prepare(
      `SELECT action_state_id FROM case_space_action_state
       WHERE tenant_id = ? AND case_space_id = ? AND module = ? AND action = ?`,
    )
    .get(scope.tenant_id, scope.case_space_id, scope.module, action) as {
    action_state_id: string;
  };
  return row.action_state_id;
}

function insertHold(
  db: DatabaseHandle,
  scope: PersistScope,
  action: string,
  actionStateId: string,
  reason: string,
): string {
  const holdId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO holds (
       hold_id, tenant_id, case_space_id, process_id, action, status, reason, payload_json
     ) VALUES (?, ?, ?, ?, ?, 'held', ?, ?)`,
  ).run(
    holdId,
    scope.tenant_id,
    scope.case_space_id,
    scope.process_id ?? null,
    action,
    reason,
    // Carry everything resolveHold needs so it never has to guess scope.
    JSON.stringify({
      module: scope.module,
      action_state_id: actionStateId,
      deployment_id: scope.deployment_id,
      verdict: 'approval_required',
    }),
  );
  return holdId;
}

/**
 * Persist a VAULT decision as honest state. One transaction per run. Pending
 * verdicts also create a holds row. Returns the per-action outcomes + summary.
 */
export function persistDecision(
  db: DatabaseHandle,
  scope: PersistScope,
  decision: VaultDecision,
): PersistResult {
  const apply = db.transaction((): ActionStateOutcome[] => {
    const outcomes: ActionStateOutcome[] = [];
    for (const d of decision.decisions) {
      if (d.verdict === 'no_op') {
        outcomes.push({
          action: d.action,
          state: 'no_op',
          verdict: d.verdict,
          action_state_id: null,
          hold_id: null,
        });
        continue;
      }

      if (d.verdict === 'allowed') {
        const id = upsertActionState(db, scope, d.action, 'attempted', {
          verdict: d.verdict,
          reason: d.reason,
        });
        outcomes.push({
          action: d.action,
          state: 'attempted',
          verdict: d.verdict,
          action_state_id: id,
          hold_id: null,
        });
        continue;
      }

      if (d.verdict === 'denied') {
        const id = upsertActionState(db, scope, d.action, 'failed', {
          verdict: d.verdict,
          reason: d.reason,
        });
        outcomes.push({
          action: d.action,
          state: 'failed',
          verdict: d.verdict,
          action_state_id: id,
          hold_id: null,
        });
        continue;
      }

      // approval_required → pending action state + a hold.
      const id = upsertActionState(db, scope, d.action, 'pending', {
        verdict: d.verdict,
        reason: d.reason,
      });
      const holdId = insertHold(db, scope, d.action, id, d.reason);
      outcomes.push({
        action: d.action,
        state: 'pending',
        verdict: d.verdict,
        action_state_id: id,
        hold_id: holdId,
      });
    }
    return outcomes;
  });

  const outcomes = apply();
  return {
    outcomes,
    summary: {
      attempted: outcomes.filter((o) => o.state === 'attempted').length,
      pending: outcomes.filter((o) => o.state === 'pending').length,
      failed: outcomes.filter((o) => o.state === 'failed').length,
      no_op: outcomes.filter((o) => o.state === 'no_op').length,
      holds_created: outcomes.filter((o) => o.hold_id !== null).length,
    },
  };
}

/** Raised when a hold cannot be resolved (missing or already resolved). */
export class PJHoldNotResolvable extends Error {
  readonly code = 'PJHoldNotResolvable' as const;
  readonly hold_id: string;
  constructor(holdId: string, detail: string) {
    super(`hold '${holdId}' not resolvable: ${detail}`);
    this.name = 'PJHoldNotResolvable';
    this.hold_id = holdId;
  }
}

export interface ResolveHoldResult {
  hold_id: string;
  resolution: 'approved' | 'denied';
  /** New state of the single resumed action. */
  action_state: 'attempted' | 'failed';
  action_state_id: string | null;
  proof_event_id: string;
}

type HoldRow = {
  hold_id: string;
  tenant_id: string;
  case_space_id: string | null;
  action: string | null;
  status: string;
  payload_json: string;
};

/**
 * Resolve a held action. `approved` lifts the hold and resumes ONLY that
 * action's state to 'attempted' (cleared to act — not executed here).
 * `denied` lifts the hold and marks that action's state 'failed'. No other
 * hold or action is touched. Writes one Recordstream proof event.
 */
export function resolveHold(
  db: DatabaseHandle,
  holdId: string,
  resolution: 'approved' | 'denied',
): ResolveHoldResult {
  const hold = db
    .prepare(`SELECT * FROM holds WHERE hold_id = ?`)
    .get(holdId) as HoldRow | undefined;
  if (!hold) {
    throw new PJHoldNotResolvable(holdId, 'no such hold');
  }
  if (hold.status !== 'held') {
    throw new PJHoldNotResolvable(holdId, `already '${hold.status}'`);
  }

  let link: { module?: string; action_state_id?: string; deployment_id?: string };
  try {
    link = JSON.parse(hold.payload_json) as typeof link;
  } catch {
    link = {};
  }
  const actionStateId = link.action_state_id ?? null;
  const nextState: 'attempted' | 'failed' =
    resolution === 'approved' ? 'attempted' : 'failed';
  const deploymentId = link.deployment_id ?? 'default';

  const apply = db.transaction(() => {
    // Lift the hold (held → released). The resolution itself is recorded on
    // the row reason + in the proof event below.
    db.prepare(
      `UPDATE holds SET status = 'released', released_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         reason = ? WHERE hold_id = ?`,
    ).run(resolution, holdId);

    // Resume ONLY this action's state.
    if (actionStateId) {
      db.prepare(
        `UPDATE case_space_action_state
           SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE action_state_id = ?`,
      ).run(nextState, actionStateId);
    }
  });
  apply();

  const proof = appendAuditEvent(db, {
    event_family: 'system',
    event_subtype: 'hold.resolved',
    canon_version: CANON_VERSION,
    deployment_id: deploymentId,
    tenant_id: hold.tenant_id,
    process_id: null,
    actor_ref: null,
    payload: {
      hold_id: holdId,
      resolution,
      action: hold.action,
      action_state_id: actionStateId,
      action_state: nextState,
    },
  });

  return {
    hold_id: holdId,
    resolution,
    action_state: nextState,
    action_state_id: actionStateId,
    proof_event_id: proof.event_id,
  };
}
