// @pj/pipeline — C4 deterministic enrichment tests.
// Make the CaseSpace smarter. Don't connect the world yet.
//
// Proves the same pipeline enriches the three V1 inputs differently, that an
// unknown scope yields empty (not failure) enrichment, and that the proof
// payload carries the enrichment summary.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import { enrichItem, runPipeline } from '../src/index.js';

const TENANT = 't_test';
const DEPLOYMENT = 'dpl_test';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

function keysFor(pack: string, item: unknown): string[] {
  return enrichItem(pack, item).summary.keys;
}

describe('@pj/pipeline — C4 enrichment seed layer', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
  });

  it('guestops.stay returns arrival/departure/cleaning/lock anchors', () => {
    const keys = keysFor('guestops.stay', { id: 'res-1' });
    expect(keys).toEqual([
      'reservation_id',
      'arrival',
      'departure',
      'cleaning_window',
      'lock_code',
    ]);
  });

  it('timedesk.muni returns employee/department/pay-period/overtime anchors', () => {
    const keys = keysFor('timedesk.muni', { employee_id: 'emp-7' });
    expect(keys).toEqual([
      'employee_id',
      'department',
      'pay_period',
      'overtime_hours',
    ]);
  });

  it('finance.biz returns vendor/invoice/receipt/tax-category anchors', () => {
    const keys = keysFor('finance.biz', { id: 'txn-9', vendor: 'Acme' });
    expect(keys).toEqual([
      'transaction_id',
      'vendor',
      'invoice_ref',
      'receipt_ref',
      'tax_category',
    ]);
    // Reads supplied item fields deterministically.
    const result = enrichItem('finance.biz', { id: 'txn-9', vendor: 'Acme' });
    expect(result.anchors.find((a) => a.key === 'vendor')?.value).toBe('Acme');
  });

  it('unknown scope returns empty enrichment, not failure', () => {
    const result = enrichItem('does.not.exist', { whatever: true });
    expect(result.anchors).toEqual([]);
    expect(result.summary.count).toBe(0);
    expect(result.summary.keys).toEqual([]);
  });

  it('is deterministic for the same input', () => {
    const a = enrichItem('guestops.stay', { id: 'res-1' });
    const b = enrichItem('guestops.stay', { id: 'res-1' });
    expect(a).toEqual(b);
  });

  it('pipeline proof payload includes the enrichment summary', () => {
    const result = runPipeline(db, {
      pack: 'finance.biz',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: 'finance',
      environment: 'biz',
      item: { id: 'txn-9', vendor: 'Acme' },
    });

    expect(result.enrichment.pack).toBe('finance.biz');
    expect(result.enrichment.summary.count).toBe(5);

    const row = db
      .prepare(
        `SELECT payload_json FROM audit_events
         WHERE event_subtype = 'pipeline.run' AND process_id = ?`,
      )
      .get(result.process_id) as { payload_json: string };
    const payload = JSON.parse(row.payload_json) as {
      enrichment: { count: number; keys: string[] };
    };
    expect(payload.enrichment.count).toBe(5);
    expect(payload.enrichment.keys).toContain('tax_category');
  });

  it('runs the same spine with different enrichment per V1 pack', () => {
    const counts = (['guestops.stay', 'timedesk.muni', 'finance.biz'] as const).map(
      (pack) =>
        runPipeline(db, {
          pack,
          tenant_id: TENANT,
          deployment_id: DEPLOYMENT,
          item: { id: 'seed-1' },
        }).enrichment?.summary.count,
    );
    expect(counts).toEqual([5, 4, 5]);
  });
});
