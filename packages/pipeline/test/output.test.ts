// @pj/pipeline — C8 FormKey output engine tests.
// Create trusted outputs. Don't make a document platform yet.
//
// Proves the three V1 outputs generate from seeded templates, a missing
// required binding fails safely with proof, a generated_outputs row is
// written, and the pipeline proof carries output_generated.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  runPipeline,
  generateOutput,
  seedOutputTemplate,
  enrichItem,
  seedGuestopsStay,
  seedTimedeskMuni,
  seedFinanceBiz,
  GUESTOPS_STAY,
  TIMEDESK_MUNI,
  FINANCE_BIZ,
  GUEST_ARRIVAL_BRIEF,
  TIMESHEET_REVIEW_SUMMARY,
  EXPENSE_RECEIPT_REVIEW_PACKET,
} from '../src/index.js';

const TENANT = 't_test';
const DEPLOYMENT = 'dpl_test';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

function seedAllTemplates(db: DatabaseHandle): void {
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

function outputsCount(db: DatabaseHandle, status?: string): number {
  const sql = status
    ? `SELECT COUNT(*) AS n FROM generated_outputs WHERE status = '${status}'`
    : `SELECT COUNT(*) AS n FROM generated_outputs`;
  return (db.prepare(sql).get() as { n: number }).n;
}

describe('@pj/pipeline — C8 FormKey output engine', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
    seedGuestopsStay(db, TENANT);
    seedTimedeskMuni(db, TENANT);
    seedFinanceBiz(db, TENANT);
    seedAllTemplates(db);
  });

  it('guestops.stay generates a Guest Arrival Brief', () => {
    const result = runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      case_space_id: 'cs-stay',
      item: { id: 'res-1' },
    });

    expect(result.output?.status).toBe('generated');
    expect(result.output?.html).toContain('Guest Arrival Brief');
    expect(result.output?.html).toContain('Lock Code');
    expect(result.output?.missing_required).toEqual([]);
    // generated_outputs row written.
    expect(outputsCount(db, 'generated')).toBe(1);
  });

  it('timedesk.muni generates a Timesheet Review Summary', () => {
    const result = runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-muni',
      item: { employee_id: 'emp-7' },
    });

    expect(result.output?.status).toBe('generated');
    expect(result.output?.html).toContain('Timesheet Review Summary');
    expect(result.output?.html).toContain('Pay Period');
  });

  it('finance.biz generates an Expense / Receipt Review Packet', () => {
    const result = runPipeline(db, {
      pack: 'finance.biz',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: FINANCE_BIZ.module,
      environment: FINANCE_BIZ.environment,
      case_space_id: 'cs-biz',
      item: { id: 'txn-1', vendor: 'Acme', amount: 100 },
    });

    expect(result.output?.status).toBe('generated');
    expect(result.output?.html).toContain('Expense / Receipt Review Packet');
    expect(result.output?.html).toContain('Acme'); // vendor anchor rendered
  });

  it('missing required binding fails safely with proof (no throw)', () => {
    // A template that requires an anchor the enrichment never produces.
    seedOutputTemplate(db, {
      tenant_id: TENANT,
      module: 'guestops',
      environment: 'stay',
      name: 'broken_brief',
      body: {
        title: 'Broken Brief',
        format: 'html',
        bindings: [
          { label: 'Reservation', from: 'reservation_id', required: true },
          { label: 'Nonexistent', from: 'does_not_exist', required: true },
        ],
      },
    });

    const enrichment = enrichItem('guestops.stay', { id: 'res-1' });
    const out = generateOutput(
      db,
      { tenant_id: TENANT, case_space_id: 'cs-x', process_id: 'p-x' },
      'broken_brief',
      'guestops',
      enrichment,
    );

    expect(out.status).toBe('failed');
    expect(out.missing_required).toContain('does_not_exist');
    // A failed row is still persisted (fail-safe, never silent).
    expect(outputsCount(db, 'failed')).toBe(1);
  });

  it('missing template fails safely', () => {
    const enrichment = enrichItem('guestops.stay', { id: 'res-1' });
    const out = generateOutput(
      db,
      { tenant_id: TENANT, case_space_id: 'cs-y', process_id: 'p-y' },
      'no_such_template',
      'guestops',
      enrichment,
    );
    expect(out.status).toBe('failed');
    expect(out.template_id).toBeNull();
    expect(outputsCount(db, 'failed')).toBe(1);
  });

  it('pipeline proof includes output_generated', () => {
    const result = runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      case_space_id: 'cs-proof',
      item: { id: 'res-1' },
    });

    const row = db
      .prepare(
        `SELECT payload_json FROM audit_events
         WHERE event_subtype = 'pipeline.run' AND process_id = ?`,
      )
      .get(result.process_id) as { payload_json: string };
    const payload = JSON.parse(row.payload_json) as {
      output: { outcome: string; status: string; output_id: string } | null;
    };
    expect(payload.output?.outcome).toBe('output_generated');
    expect(payload.output?.status).toBe('generated');
    expect(payload.output?.output_id).toBe(result.output?.output_id);
  });

  it('pipeline proof marks output_failed when a required binding is missing', () => {
    // Re-seed guestops with a template whose required binding cannot resolve.
    // Use a fresh tenant-less template name the runner will pick up via pack.
    const db2 = freshDb();
    seedGuestopsStay(db2, TENANT);
    seedOutputTemplate(db2, {
      tenant_id: TENANT,
      module: 'guestops',
      environment: 'stay',
      name: 'guest_arrival_brief',
      body: {
        title: 'Guest Arrival Brief',
        format: 'html',
        bindings: [{ label: 'Missing', from: 'never_present', required: true }],
      },
    });

    const result = runPipeline(db2, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: 'guestops',
      environment: 'stay',
      case_space_id: 'cs-fail',
      item: { id: 'res-1' },
    });

    expect(result.output?.status).toBe('failed');
    const row = db2
      .prepare(
        `SELECT payload_json FROM audit_events
         WHERE event_subtype = 'pipeline.run' AND process_id = ?`,
      )
      .get(result.process_id) as { payload_json: string };
    const payload = JSON.parse(row.payload_json) as {
      output: { outcome: string } | null;
    };
    expect(payload.output?.outcome).toBe('output_failed');
  });
});
