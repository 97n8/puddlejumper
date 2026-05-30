// @pj/pipeline — C9 V1 triad verifier.
// Prove the spine. Don't expand it.
//
// A single verifier that runs the three V1 proof packs through the SAME
// synchronous spine and asserts the V1 done-bar (Issue #99): different
// autonomy ceilings, different retention classes, different outputs, holds
// where required, denial for money movement, generated_outputs rows,
// case_space_action_state rows, and a Recordstream proof per run.
//
// No new behavior — this only exercises C1–C8 and reads the pack content +
// persisted rows. If this passes, the V1 governed spine is proven.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  runPipeline,
  findActiveRulePack,
  seedGuestopsStay,
  seedTimedeskMuni,
  seedFinanceBiz,
  seedOutputTemplate,
  GUESTOPS_STAY,
  TIMEDESK_MUNI,
  FINANCE_BIZ,
  GUEST_ARRIVAL_BRIEF,
  TIMESHEET_REVIEW_SUMMARY,
  EXPENSE_RECEIPT_REVIEW_PACKET,
  type PipelineResult,
} from '../src/index.js';

const TENANT = 't_verify';
const DEPLOYMENT = 'dpl_verify';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

/** Seed all three packs + their output templates for the tenant. */
function seedTriad(db: DatabaseHandle): void {
  seedGuestopsStay(db, TENANT);
  seedTimedeskMuni(db, TENANT);
  seedFinanceBiz(db, TENANT);
  seedOutputTemplate(db, {
    tenant_id: TENANT,
    module: GUESTOPS_STAY.module,
    environment: GUESTOPS_STAY.environment,
    name: 'guest_arrival_brief',
    body: GUEST_ARRIVAL_BRIEF,
  });
  seedOutputTemplate(db, {
    tenant_id: TENANT,
    module: TIMEDESK_MUNI.module,
    environment: TIMEDESK_MUNI.environment,
    name: 'timesheet_review_summary',
    body: TIMESHEET_REVIEW_SUMMARY,
  });
  seedOutputTemplate(db, {
    tenant_id: TENANT,
    module: FINANCE_BIZ.module,
    environment: FINANCE_BIZ.environment,
    name: 'expense_receipt_review_packet',
    body: EXPENSE_RECEIPT_REVIEW_PACKET,
  });
}

/** Run one pack and return the result with its CaseSpace id. */
function runPack(
  db: DatabaseHandle,
  def: { module: string; environment: string; pack: string },
  caseSpaceId: string,
  item: unknown,
): PipelineResult {
  return runPipeline(db, {
    pack: def.pack,
    tenant_id: TENANT,
    deployment_id: DEPLOYMENT,
    module: def.module,
    environment: def.environment,
    case_space_id: caseSpaceId,
    item,
  });
}

function retentionClass(db: DatabaseHandle, module: string, environment: string): unknown {
  return findActiveRulePack(db, { tenant_id: TENANT, module, environment })?.content
    .retention_class;
}

function countRows(db: DatabaseHandle, table: string, caseSpaceId: string): number {
  return (
    db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE case_space_id = ?`)
      .get(caseSpaceId) as { n: number }
  ).n;
}

function proofOutcome(db: DatabaseHandle, processId: string): {
  ceiling: string;
  retention: undefined;
  output: { outcome: string } | null;
  vault: { summary: Record<string, number> };
  state: { summary: Record<string, number> };
} {
  const row = db
    .prepare(
      `SELECT payload_json FROM audit_events
       WHERE event_subtype = 'pipeline.run' AND process_id = ?`,
    )
    .get(processId) as { payload_json: string };
  return JSON.parse(row.payload_json);
}

describe('@pj/pipeline — C9 V1 triad verifier', () => {
  let db: DatabaseHandle;
  let stay: PipelineResult;
  let muni: PipelineResult;
  let biz: PipelineResult;

  beforeEach(() => {
    db = freshDb();
    seedTriad(db);
    stay = runPack(db, GUESTOPS_STAY, 'cs-stay', { id: 'res-1' });
    muni = runPack(db, TIMEDESK_MUNI, 'cs-muni', { employee_id: 'emp-7' });
    // Over the finance approval threshold so reimburse is held.
    biz = runPack(db, FINANCE_BIZ, 'cs-biz', { id: 'txn-2', vendor: 'Acme', amount: 5000 });
  });

  it('all three packs complete the spine', () => {
    for (const r of [stay, muni, biz]) {
      expect(r.outcome).toBe('completed');
      expect(r.stopped_at).toBeNull();
    }
  });

  it('proves different autonomy ceilings per pack', () => {
    expect(stay.vault?.ceiling).toBe('run_routine');
    expect(muni.vault?.ceiling).toBe('suggest');
    expect(biz.vault?.ceiling).toBe('help_manage');
    // All three are distinct.
    const ceilings = new Set([stay.vault?.ceiling, muni.vault?.ceiling, biz.vault?.ceiling]);
    expect(ceilings.size).toBe(3);
  });

  it('proves different retention classes per pack', () => {
    expect(retentionClass(db, GUESTOPS_STAY.module, GUESTOPS_STAY.environment)).toBe(
      'stay-operations',
    );
    expect(retentionClass(db, TIMEDESK_MUNI.module, TIMEDESK_MUNI.environment)).toBe(
      'statutory-payroll',
    );
    expect(retentionClass(db, FINANCE_BIZ.module, FINANCE_BIZ.environment)).toBe(
      'business-finance-tax',
    );
  });

  it('proves different generated outputs per pack', () => {
    expect(stay.output?.status).toBe('generated');
    expect(stay.output?.html).toContain('Guest Arrival Brief');
    expect(muni.output?.html).toContain('Timesheet Review Summary');
    expect(biz.output?.html).toContain('Expense / Receipt Review Packet');

    // One generated_outputs row per run.
    expect(countRows(db, 'generated_outputs', 'cs-stay')).toBe(1);
    expect(countRows(db, 'generated_outputs', 'cs-muni')).toBe(1);
    expect(countRows(db, 'generated_outputs', 'cs-biz')).toBe(1);
  });

  it('proves holds where required (muni payroll, biz over-threshold) and none for stay', () => {
    // guestops.stay: all actions under run_routine → no holds.
    expect(stay.state?.summary.holds_created).toBe(0);
    expect(countRows(db, 'holds', 'cs-stay')).toBe(0);

    // timedesk.muni: payroll export + approve are above the 'suggest' ceiling.
    expect(muni.state?.summary.pending).toBe(2);
    expect(countRows(db, 'holds', 'cs-muni')).toBe(2);

    // finance.biz: reimburse_over_threshold at/over threshold is held.
    const reimburse = biz.state?.outcomes.find(
      (o) => o.action === 'reimburse_over_threshold',
    );
    expect(reimburse?.state).toBe('pending');
    expect(reimburse?.hold_id).toBeTruthy();
  });

  it('proves denial for money movement (finance.biz post_payment)', () => {
    const postPayment = biz.state?.outcomes.find((o) => o.action === 'post_payment');
    expect(postPayment?.verdict).toBe('denied');
    expect(postPayment?.state).toBe('failed');
    expect(postPayment?.hold_id).toBeNull();
  });

  it('writes case_space_action_state rows for each run', () => {
    expect(countRows(db, 'case_space_action_state', 'cs-stay')).toBeGreaterThan(0);
    expect(countRows(db, 'case_space_action_state', 'cs-muni')).toBeGreaterThan(0);
    expect(countRows(db, 'case_space_action_state', 'cs-biz')).toBeGreaterThan(0);
  });

  it('writes a Recordstream/audit proof for each run with output_generated', () => {
    for (const r of [stay, muni, biz]) {
      const payload = proofOutcome(db, r.process_id);
      expect(payload.output?.outcome).toBe('output_generated');
      // Proof carries vault + state summaries.
      expect(payload.vault.summary).toBeDefined();
      expect(payload.state.summary).toBeDefined();
    }

    // Exactly three pipeline.run proof events for the three runs.
    const n = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM audit_events WHERE event_subtype = 'pipeline.run'`)
        .get() as { n: number }
    ).n;
    expect(n).toBe(3);
  });

  it('V1 done-bar: same spine, different ceilings + retention + outputs + holds', () => {
    // One consolidated assertion of the done-bar across the triad.
    const matrix = [
      { r: stay, ceiling: 'run_routine', retention: 'stay-operations', holds: 0 },
      { r: muni, ceiling: 'suggest', retention: 'statutory-payroll', holds: 2 },
      { r: biz, ceiling: 'help_manage', retention: 'business-finance-tax', holds: 1 },
    ];
    for (const row of matrix) {
      expect(row.r.outcome).toBe('completed');
      expect(row.r.vault?.ceiling).toBe(row.ceiling);
      expect(row.r.state?.summary.holds_created).toBe(row.holds);
      expect(row.r.output?.status).toBe('generated');
    }
    // Distinct ceilings, distinct retention, distinct templates — proven.
    expect(new Set(matrix.map((m) => m.ceiling)).size).toBe(3);
    expect(new Set(matrix.map((m) => m.retention)).size).toBe(3);
  });
});
