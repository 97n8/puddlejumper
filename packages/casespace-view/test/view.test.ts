// @pj/casespace-view — projection reconciliation tests.
// Render the thread. Do not create the thread.
//
// The projection is driven by the REAL @pj/pipeline runner so every tile is
// reconciled against genuine proof-backed runtime rows — never hand-built
// fixtures. Proves: each tile reconciles to its source table, Show Proof uses
// the same audit_events as Recent Changes, no invented rows, and an empty
// CaseSpace renders a clean zero-state.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  runPipeline,
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
} from '@pj/pipeline';
import { projectCaseSpaceView } from '../src/index.js';

const TENANT = 't_view';
const DEPLOYMENT = 'dpl_view';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

function seedAll(db: DatabaseHandle): void {
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

function scalar(db: DatabaseHandle, sql: string, ...args: unknown[]): number {
  return (db.prepare(sql).get(...args) as { n: number }).n;
}

describe('@pj/casespace-view — projection over runtime', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
    seedAll(db);
  });

  it('empty CaseSpace renders a clean zero-state', () => {
    const view = projectCaseSpaceView(db, {
      tenant_id: TENANT,
      case_space_id: 'cs-empty',
    });
    expect(view.caseSpaceId).toBe('cs-empty');
    expect(view.currentState).toEqual({ active: 0, waitingApproval: 0, blocked: 0 });
    expect(view.waitingOn).toEqual([]);
    expect(view.recentChanges).toEqual([]);
    expect(view.generatedOutputs).toEqual([]);
    expect(view.proof).toEqual([]);
  });

  it('Current State counts reconcile to case_space_action_state', () => {
    // timedesk.muni run: summarize/flag allowed (attempted), export/approve
    // payroll pending (waiting approval).
    runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-muni',
      item: { employee_id: 'emp-7' },
    });

    const view = projectCaseSpaceView(db, { tenant_id: TENANT, case_space_id: 'cs-muni' });

    const active = scalar(
      db,
      `SELECT COUNT(*) AS n FROM case_space_action_state
       WHERE tenant_id = ? AND case_space_id = ? AND status IN ('attempted','done')`,
      TENANT,
      'cs-muni',
    );
    const pending = scalar(
      db,
      `SELECT COUNT(*) AS n FROM case_space_action_state
       WHERE tenant_id = ? AND case_space_id = ? AND status = 'pending'`,
      TENANT,
      'cs-muni',
    );
    const failed = scalar(
      db,
      `SELECT COUNT(*) AS n FROM case_space_action_state
       WHERE tenant_id = ? AND case_space_id = ? AND status = 'failed'`,
      TENANT,
      'cs-muni',
    );

    expect(view.currentState.active).toBe(active);
    expect(view.currentState.waitingApproval).toBe(pending);
    expect(view.currentState.blocked).toBe(failed);
    // Sanity: muni produces two pending payroll actions.
    expect(view.currentState.waitingApproval).toBe(2);
  });

  it('Waiting On reconciles to open holds', () => {
    runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-muni',
      item: { employee_id: 'emp-7' },
    });

    const view = projectCaseSpaceView(db, { tenant_id: TENANT, case_space_id: 'cs-muni' });

    const heldRows = db
      .prepare(
        `SELECT hold_id, action FROM holds
         WHERE tenant_id = ? AND case_space_id = ? AND status = 'held'
         ORDER BY created_at ASC`,
      )
      .all(TENANT, 'cs-muni') as Array<{ hold_id: string; action: string }>;

    expect(view.waitingOn.map((w) => w.holdId)).toEqual(heldRows.map((h) => h.hold_id));
    expect(view.waitingOn.map((w) => w.action)).toEqual(heldRows.map((h) => h.action));
    expect(view.waitingOn).toHaveLength(2);
  });

  it('Generated Outputs reconciles to generated_outputs', () => {
    runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      case_space_id: 'cs-stay',
      item: { id: 'res-1' },
    });

    const view = projectCaseSpaceView(db, { tenant_id: TENANT, case_space_id: 'cs-stay' });

    const rows = db
      .prepare(
        `SELECT output_id, status FROM generated_outputs
         WHERE tenant_id = ? AND case_space_id = ?`,
      )
      .all(TENANT, 'cs-stay') as Array<{ output_id: string; status: string }>;

    expect(view.generatedOutputs).toHaveLength(rows.length);
    expect(new Set(view.generatedOutputs.map((o) => o.outputId))).toEqual(
      new Set(rows.map((r) => r.output_id)),
    );
    expect(view.generatedOutputs[0]?.title).toBe('Guest Arrival Brief');
    expect(view.generatedOutputs[0]?.status).toBe('generated');
  });

  it('Recent Changes reconciles to audit_events for the CaseSpace', () => {
    const result = runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      case_space_id: 'cs-stay',
      item: { id: 'res-1' },
    });

    const view = projectCaseSpaceView(db, { tenant_id: TENANT, case_space_id: 'cs-stay' });

    // The run's pipeline.run proof event is linked (case_space_id == process_id).
    const ids = view.recentChanges.map((c) => c.auditEventId);
    expect(ids).toContain(result.proof_event_id);
    // Every recent-change row corresponds to a real audit_events row.
    for (const c of view.recentChanges) {
      const exists = scalar(
        db,
        `SELECT COUNT(*) AS n FROM audit_events WHERE event_id = ?`,
        c.auditEventId,
      );
      expect(exists).toBe(1);
    }
  });

  it('Show Proof uses the SAME audit_events as Recent Changes', () => {
    runPipeline(db, {
      pack: 'finance.biz',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: FINANCE_BIZ.module,
      environment: FINANCE_BIZ.environment,
      case_space_id: 'cs-biz',
      item: { id: 'txn-2', vendor: 'Acme', amount: 5000 },
    });

    const view = projectCaseSpaceView(db, { tenant_id: TENANT, case_space_id: 'cs-biz' });

    // THE invariant: recentChanges is a summarized view of proof — identical
    // ids, types, timestamps, and ORDER. Never independently sourced.
    expect(view.recentChanges).toHaveLength(view.proof.length);
    expect(view.proof.map((p) => p.auditEventId)).toEqual(
      view.recentChanges.map((c) => c.auditEventId),
    );
    expect(view.proof.map((p) => p.type)).toEqual(
      view.recentChanges.map((c) => c.type),
    );
    expect(view.proof.map((p) => p.createdAt)).toEqual(
      view.recentChanges.map((c) => c.createdAt),
    );
    // Proof carries the raw payload object; Recent Changes carries a summary.
    expect(view.proof.length).toBeGreaterThan(0);
    expect(typeof view.proof[0].payload).toBe('object');
    expect(typeof view.recentChanges[0].summary).toBe('string');
  });

  it('invents no rows — every tile id traces to a real source row', () => {
    runPipeline(db, {
      pack: 'finance.biz',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: FINANCE_BIZ.module,
      environment: FINANCE_BIZ.environment,
      case_space_id: 'cs-biz',
      item: { id: 'txn-2', vendor: 'Acme', amount: 5000 },
    });
    const view = projectCaseSpaceView(db, { tenant_id: TENANT, case_space_id: 'cs-biz' });

    for (const w of view.waitingOn) {
      expect(scalar(db, `SELECT COUNT(*) AS n FROM holds WHERE hold_id = ?`, w.holdId)).toBe(1);
    }
    for (const o of view.generatedOutputs) {
      expect(
        scalar(db, `SELECT COUNT(*) AS n FROM generated_outputs WHERE output_id = ?`, o.outputId),
      ).toBe(1);
    }
    for (const p of view.proof) {
      expect(
        scalar(db, `SELECT COUNT(*) AS n FROM audit_events WHERE event_id = ?`, p.auditEventId),
      ).toBe(1);
    }
  });

  it('does not leak another CaseSpace thread into this one', () => {
    runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      case_space_id: 'cs-a',
      item: { id: 'res-a' },
    });
    runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-b',
      item: { employee_id: 'emp-b' },
    });

    const a = projectCaseSpaceView(db, { tenant_id: TENANT, case_space_id: 'cs-a' });
    const b = projectCaseSpaceView(db, { tenant_id: TENANT, case_space_id: 'cs-b' });

    // cs-a (guestops) has outputs + no holds; cs-b (muni) has holds.
    expect(a.waitingOn).toHaveLength(0);
    expect(b.waitingOn).toHaveLength(2);
    // Proof event ids are disjoint between the two CaseSpaces.
    const aIds = new Set(a.proof.map((p) => p.auditEventId));
    const bIds = b.proof.map((p) => p.auditEventId);
    for (const id of bIds) expect(aIds.has(id)).toBe(false);
  });
});
