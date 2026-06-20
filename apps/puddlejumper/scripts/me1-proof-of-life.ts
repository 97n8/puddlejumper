// Me1 proof-of-life driver — Gate 3 made visible.
//
// Walks ONE case through the full PRR lifecycle
// (received → logged → assigned → searching → reviewing → responded → closed),
// then proves the case is a projection of the event log: it closes the DB
// (kills the box), reopens the same file (restart), rebuilds `processes`
// purely from `audit_events`, and asserts the case is byte-for-byte identical.
//
// Run:  pnpm --filter @publiclogic/puddlejumper me1:proof
// Uses a throwaway file DB under the OS temp dir; nothing persistent is touched.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb, migrate } from '@pj/db';
import {
  createPRR,
  getPRR,
  transitionPRR,
  closePRR,
  rebuildProjectionFromAudit,
} from '../src/domains/prr/prr.store.js';

const TENANT = 'publiclogic';
const ACTOR = 'identity:nate';

const WALK = [
  'intake_complete', // received  → logged
  'route', //           logged    → assigned
  'search_begin', //    assigned  → searching
  'search_complete', // searching → reviewing
  'respond', //         reviewing → responded
] as const;

function line(label: string): void {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
}

function main(): void {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pj-me1-'));
  const dbPath = path.join(dbDir, 'canon.db');

  // ── Boot 1: create and walk one case ──────────────────────────────────────
  let db = getDb(dbPath);
  migrate(db);
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    TENANT, 'PublicLogic', '1.0.0',
  );

  const created = createPRR(db, TENANT, ACTOR, {
    fields: { subject: 'Proof of life — first governed case' },
  });
  const processId = created.process_id;

  for (const trigger of WALK) {
    transitionPRR(db, TENANT, processId, trigger, ACTOR);
  }
  closePRR(db, TENANT, processId, ACTOR);

  line('(a) ordered audit_events for the case');
  const events = db
    .prepare(
      `SELECT event_family, event_subtype, occurred_at, payload_json
         FROM audit_events WHERE process_id = ?
        ORDER BY occurred_at ASC, rowid ASC`,
    )
    .all(processId) as Array<{
      event_family: string;
      event_subtype: string;
      occurred_at: string;
      payload_json: string;
    }>;
  events.forEach((e, i) => {
    const p = JSON.parse(e.payload_json) as Record<string, unknown>;
    const move = e.event_subtype === 'process.created'
      ? `→ ${String(p.initial_state)}`
      : p.from && p.to
        ? `${String(p.from)} → ${String(p.to)}`
        : '';
    console.log(`  ${String(i + 1).padStart(2)}. ${e.event_subtype.padEnd(20)} ${move}`);
  });

  const before = getPRR(db, TENANT, processId);
  line('(b) projected case BEFORE restart');
  console.log(JSON.stringify(before, null, 2));

  // ── Kill the box ──────────────────────────────────────────────────────────
  db.close();

  // ── Boot 2: restart against the same file, rebuild from the log ───────────
  db = getDb(dbPath);
  db.prepare('DELETE FROM processes').run(); // prove nothing survives but the log
  const { rebuilt } = rebuildProjectionFromAudit(db, { tenantId: TENANT });
  const after = getPRR(db, TENANT, processId);
  db.close();

  line('(b) projected case AFTER restart (rebuilt from audit_events)');
  console.log(JSON.stringify(after, null, 2));

  const identical = JSON.stringify(before) === JSON.stringify(after);
  line('result');
  console.log(`  cases rebuilt from log : ${rebuilt}`);
  console.log(`  final state            : ${after?.current_state}`);
  console.log(`  before === after       : ${identical ? 'YES ✓' : 'NO ✗'}`);

  fs.rmSync(dbDir, { recursive: true, force: true });

  if (!identical || after?.current_state !== 'closed' || rebuilt !== 1) {
    console.error('\nMe1 proof-of-life FAILED — projection did not rebuild identically.');
    process.exit(1);
  }
  console.log('\nMe1 proof-of-life PASSED — the case is a projection of the event log.');
}

main();
