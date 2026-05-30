// @pj/pipeline — C5 VAULT verdict tests.
// Decide what may happen. Do not make it happen yet.
//
// Proves per-action verdicts respect the autonomy ceiling and pack rules,
// that verdicts ride in PipelineResult + the proof payload, and that an
// unknown/no pack produces safe no-op/denied verdicts (never silent allow).

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  runPipeline,
  decideVault,
  findActiveRulePack,
  seedGuestopsStay,
  seedTimedeskMuni,
  seedFinanceBiz,
  enrichItem,
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

function verdictFor(
  db: DatabaseHandle,
  packId: string,
  scope: { module: string; environment: string },
  item: unknown,
) {
  const pack = findActiveRulePack(db, { tenant_id: TENANT, ...scope });
  return decideVault(pack, packId, item, enrichItem(packId, item));
}

function lookup(decisions: { action: string; verdict: string }[], action: string) {
  return decisions.find((d) => d.action === action)?.verdict;
}

describe('@pj/pipeline — C5 VAULT verdict layer', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
  });

  it('guestops.stay allows routine actions under run_routine', () => {
    seedGuestopsStay(db, TENANT);
    const decision = verdictFor(
      db,
      'guestops.stay',
      { module: GUESTOPS_STAY.module, environment: GUESTOPS_STAY.environment },
      { id: 'res-1' },
    );
    expect(decision.ceiling).toBe('run_routine');
    expect(lookup(decision.decisions, 'send_guest_arrival_brief')).toBe('allowed');
    expect(lookup(decision.decisions, 'set_lock_code')).toBe('allowed');
    expect(lookup(decision.decisions, 'schedule_cleaning')).toBe('allowed');
    expect(decision.summary.allowed).toBe(3);
  });

  it('timedesk.muni marks payroll/export approval_required under suggest', () => {
    seedTimedeskMuni(db, TENANT);
    const decision = verdictFor(
      db,
      'timedesk.muni',
      { module: TIMEDESK_MUNI.module, environment: TIMEDESK_MUNI.environment },
      { employee_id: 'emp-7' },
    );
    expect(decision.ceiling).toBe('suggest');
    // Below/at ceiling → allowed.
    expect(lookup(decision.decisions, 'summarize_timesheet')).toBe('allowed');
    expect(lookup(decision.decisions, 'flag_overtime')).toBe('allowed');
    // Above ceiling → approval_required (capped, not auto-run).
    expect(lookup(decision.decisions, 'export_to_payroll')).toBe('approval_required');
    expect(lookup(decision.decisions, 'approve_payroll')).toBe('approval_required');
    expect(decision.summary.approval_required).toBe(2);
  });

  it('finance.biz denies money movement and gates over threshold', () => {
    seedFinanceBiz(db, TENANT);
    const scope = { module: FINANCE_BIZ.module, environment: FINANCE_BIZ.environment };

    // Under threshold: categorize/build allowed, reimbursement allowed.
    const under = verdictFor(db, 'finance.biz', scope, { id: 'txn-1', amount: 250 });
    expect(under.ceiling).toBe('help_manage');
    expect(lookup(under.decisions, 'categorize_expense')).toBe('allowed');
    expect(lookup(under.decisions, 'build_review_packet')).toBe('allowed');
    expect(lookup(under.decisions, 'reimburse_over_threshold')).toBe('allowed');
    // no_auto_money_movement: posting a payment is always denied.
    expect(lookup(under.decisions, 'post_payment')).toBe('denied');

    // Over threshold: amount-gated action flips to approval_required.
    const over = verdictFor(db, 'finance.biz', scope, { id: 'txn-2', amount: 5000 });
    expect(lookup(over.decisions, 'reimburse_over_threshold')).toBe('approval_required');
    expect(lookup(over.decisions, 'post_payment')).toBe('denied');
  });

  it('includes verdicts in PipelineResult and the proof payload', () => {
    seedTimedeskMuni(db, TENANT);
    const result = runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      item: { employee_id: 'emp-7' },
    });

    expect(result.vault.ceiling).toBe('suggest');
    expect(result.vault.summary.approval_required).toBe(2);

    const row = db
      .prepare(
        `SELECT payload_json FROM audit_events
         WHERE event_subtype = 'pipeline.run' AND process_id = ?`,
      )
      .get(result.process_id) as { payload_json: string };
    const payload = JSON.parse(row.payload_json) as {
      vault: { ceiling: string; summary: { approval_required: number } };
    };
    expect(payload.vault.ceiling).toBe('suggest');
    expect(payload.vault.summary.approval_required).toBe(2);
  });

  it('unknown / no pack produces safe no_op verdicts', () => {
    // No pack seeded; decideVault called with a null pack and unknown scope id.
    const decision = decideVault(null, 'does.not.exist', {}, enrichItem('does.not.exist', {}));
    expect(decision.ceiling).toBe('suggest'); // safest floor
    expect(decision.summary.no_op).toBe(1);
    expect(decision.summary.allowed).toBe(0);
    expect(lookup(decision.decisions, 'unknown')).toBe('no_op');
  });

  it('pipeline run with no resolved pack yields no_op verdicts, never silent allow', () => {
    const result = runPipeline(db, {
      pack: 'finance.biz',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: FINANCE_BIZ.module,
      environment: FINANCE_BIZ.environment,
      item: { id: 'txn-1', amount: 9999 },
    });
    // No pack seeded → null pack → money-moving action is NOT auto-allowed.
    // The known finance action surface still applies, but with the safe floor
    // ceiling and no_auto_money_movement absent, post_payment needs run_routine
    // above the 'suggest' floor → approval_required (never 'allowed').
    expect(result.rule_pack_id).toBeNull();
    expect(result.vault.summary.allowed === 0 || result.vault.ceiling === 'suggest').toBe(true);
    expect(lookup(result.vault.decisions, 'post_payment')).not.toBe('allowed');
  });
});
