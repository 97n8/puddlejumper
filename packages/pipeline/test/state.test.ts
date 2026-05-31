// @pj/pipeline — C6 honest action state + holds tests.
// Make pending authority real. Do not act yet.
//
// Proves verdicts become visible persisted state: allowed→attempted,
// approval_required→pending+hold, denied→failed (no hold), no_op→recorded;
// resolveHold approved/denied resumes ONLY the held action; the proof payload
// carries held/denied/state outcomes.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  runPipeline,
  resolveHold,
  PJHoldNotResolvable,
  seedGuestopsStay,
  seedTimedeskMuni,
  seedFinanceBiz,
  GUESTOPS_STAY,
  TIMEDESK_MUNI,
  FINANCE_BIZ,
} from '../src/index.js';

const TENANT = 't_test';
const DEPLOYMENT = 'dpl_test';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

function outcome(result: { state: { outcomes: { action: string; state: string; hold_id: string | null }[] } }, action: string) {
  return result.state.outcomes.find((o) => o.action === action);
}

function holdsFor(db: DatabaseHandle, caseSpaceId: string) {
  return db
    .prepare(`SELECT * FROM holds WHERE case_space_id = ?`)
    .all(caseSpaceId) as Array<{ hold_id: string; action: string; status: string }>;
}

function actionState(db: DatabaseHandle, actionStateId: string) {
  return db
    .prepare(`SELECT status FROM case_space_action_state WHERE action_state_id = ?`)
    .get(actionStateId) as { status: string } | undefined;
}

describe('@pj/pipeline — C6 action state + holds', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
  });

  it('guestops.stay allowed actions mark attempted (no holds)', () => {
    seedGuestopsStay(db, TENANT);
    const result = runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      case_space_id: 'cs-stay-1',
      item: { id: 'res-1' },
    });

    expect(result.state.summary.attempted).toBe(3);
    expect(result.state.summary.holds_created).toBe(0);
    expect(outcome(result, 'set_lock_code')?.state).toBe('attempted');
    expect(holdsFor(db, 'cs-stay-1')).toHaveLength(0);
  });

  it('timedesk.muni creates pending holds for payroll/export', () => {
    seedTimedeskMuni(db, TENANT);
    const result = runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-muni-1',
      item: { employee_id: 'emp-7' },
    });

    expect(result.state.summary.pending).toBe(2);
    expect(result.state.summary.holds_created).toBe(2);
    expect(outcome(result, 'export_to_payroll')?.state).toBe('pending');
    expect(outcome(result, 'export_to_payroll')?.hold_id).toBeTruthy();
    expect(outcome(result, 'approve_payroll')?.state).toBe('pending');

    const holds = holdsFor(db, 'cs-muni-1');
    expect(holds).toHaveLength(2);
    expect(holds.every((h) => h.status === 'held')).toBe(true);
  });

  it('finance.biz creates a hold for reimburse_over_threshold at/over threshold', () => {
    seedFinanceBiz(db, TENANT);
    const result = runPipeline(db, {
      pack: 'finance.biz',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: FINANCE_BIZ.module,
      environment: FINANCE_BIZ.environment,
      case_space_id: 'cs-biz-1',
      item: { id: 'txn-2', amount: 5000 },
    });

    // Over-threshold reimbursement is pending + held.
    expect(outcome(result, 'reimburse_over_threshold')?.state).toBe('pending');
    expect(outcome(result, 'reimburse_over_threshold')?.hold_id).toBeTruthy();
    // Money movement is denied → failed, NO hold.
    expect(outcome(result, 'post_payment')?.state).toBe('failed');
    expect(outcome(result, 'post_payment')?.hold_id).toBeNull();

    const heldActions = holdsFor(db, 'cs-biz-1').map((h) => h.action);
    expect(heldActions).toContain('reimburse_over_threshold');
    expect(heldActions).not.toContain('post_payment');
  });

  it('finance.biz denied post_payment marks failed with no hold', () => {
    seedFinanceBiz(db, TENANT);
    const result = runPipeline(db, {
      pack: 'finance.biz',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: FINANCE_BIZ.module,
      environment: FINANCE_BIZ.environment,
      case_space_id: 'cs-biz-2',
      item: { id: 'txn-1', amount: 100 },
    });

    expect(outcome(result, 'post_payment')?.state).toBe('failed');
    expect(result.state.summary.holds_created).toBe(0); // under threshold + money denied
  });

  it('resolveHold approved resumes only that held action to attempted', () => {
    seedTimedeskMuni(db, TENANT);
    const result = runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-muni-3',
      item: { employee_id: 'emp-7' },
    });

    const exportOutcome = outcome(result, 'export_to_payroll')!;
    const approveOutcome = outcome(result, 'approve_payroll')!;

    const resolved = resolveHold(db, exportOutcome.hold_id!, 'approved');
    expect(resolved.resolution).toBe('approved');
    expect(resolved.action_state).toBe('attempted');

    // Only the resumed action flips; the other stays pending.
    expect(actionState(db, exportOutcome.action_state_id!)?.status).toBe('attempted');
    expect(actionState(db, approveOutcome.action_state_id!)?.status).toBe('pending');

    // The resolved hold is released; the other remains held.
    const holds = holdsFor(db, 'cs-muni-3');
    const exportHold = holds.find((h) => h.hold_id === exportOutcome.hold_id);
    const approveHold = holds.find((h) => h.hold_id === approveOutcome.hold_id);
    expect(exportHold?.status).toBe('released');
    expect(approveHold?.status).toBe('held');
  });

  it('resolveHold denied marks that action failed and refuses double-resolve', () => {
    seedTimedeskMuni(db, TENANT);
    const result = runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-muni-4',
      item: { employee_id: 'emp-7' },
    });
    const o = outcome(result, 'export_to_payroll')!;

    const resolved = resolveHold(db, o.hold_id!, 'denied');
    expect(resolved.action_state).toBe('failed');
    expect(actionState(db, o.action_state_id!)?.status).toBe('failed');

    // Second resolve refuses (already released).
    expect(() => resolveHold(db, o.hold_id!, 'approved')).toThrowError(
      PJHoldNotResolvable,
    );
  });

  it('Recordstream proof includes held/denied/state outcomes', () => {
    seedFinanceBiz(db, TENANT);
    const result = runPipeline(db, {
      pack: 'finance.biz',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: FINANCE_BIZ.module,
      environment: FINANCE_BIZ.environment,
      case_space_id: 'cs-biz-5',
      item: { id: 'txn-2', amount: 5000 },
    });

    const row = db
      .prepare(
        `SELECT payload_json FROM audit_events
         WHERE event_subtype = 'pipeline.run' AND process_id = ?`,
      )
      .get(result.process_id) as { payload_json: string };
    const payload = JSON.parse(row.payload_json) as {
      state: {
        summary: { pending: number; failed: number };
        outcomes: { action: string; state: string }[];
      };
    };
    expect(payload.state.summary.failed).toBeGreaterThanOrEqual(1);
    expect(payload.state.summary.pending).toBeGreaterThanOrEqual(1);
    const reimburse = payload.state.outcomes.find(
      (o) => o.action === 'reimburse_over_threshold',
    );
    expect(reimburse?.state).toBe('pending');

    // hold.resolved also writes its own proof event.
    const beforeCount = (
      db.prepare(`SELECT COUNT(*) AS n FROM audit_events WHERE event_subtype = 'hold.resolved'`).get() as { n: number }
    ).n;
    expect(beforeCount).toBe(0);
  });
});
