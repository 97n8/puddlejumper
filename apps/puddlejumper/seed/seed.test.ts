import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import { parseSeedYaml, seedFromInput, type SeedInput } from './seed.js';

function fresh(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

const TWO_PEOPLE: SeedInput = {
  tenant: { id: 'publiclogic', display_name: 'PublicLogic', tier: 'single' },
  identities: [
    {
      email: 'nate@publiclogic.org',
      display_name: 'Nate Boudreau',
      role: 'administrator',
      seed_process: {
        template_id: 'governance-task',
        domain: 'PublicLogic',
        title: 'Welcome to PJ',
        notes: 'First process.',
      },
    },
    {
      email: 'allie@publiclogic.org',
      display_name: 'Allison Weiss Rothschild',
      role: 'administrator',
      seed_process: {
        template_id: 'governance-task',
        domain: 'PublicLogic',
        title: 'Welcome to PJ',
        notes: "Allie's first process.",
      },
    },
  ],
};

function countEvents(db: DatabaseHandle, subtype: string): number {
  return (db
    .prepare(`SELECT COUNT(*) AS n FROM audit_events WHERE event_subtype = ?`)
    .get(subtype) as { n: number }).n;
}

describe('seed — Phase 6 (personal tenant + identities)', () => {
  let db: DatabaseHandle;
  beforeEach(() => { db = fresh(); });

  it('a) fresh DB: creates tenant + 2 identities + 2 role assignments + 2 seed processes; audit events recorded', () => {
    const { outcomes } = seedFromInput(db, TWO_PEOPLE);

    // Tenant created.
    expect(outcomes.find((o) => o.kind === 'tenant')?.status).toBe('created');
    const tenants = db.prepare(`SELECT id FROM tenants`).all() as Array<{ id: string }>;
    expect(tenants.find((t) => t.id === 'publiclogic')).toBeTruthy();

    // 2 identities created.
    const identities = db
      .prepare(`SELECT email FROM identities WHERE tenant_id = ?`)
      .all('publiclogic') as Array<{ email: string }>;
    expect(new Set(identities.map((i) => i.email))).toEqual(
      new Set(['nate@publiclogic.org', 'allie@publiclogic.org']),
    );

    // 2 role assignments (administrator, both).
    const assignments = db
      .prepare(
        `SELECT a.role_type FROM assignments a
         JOIN identities i ON i.identity_id = a.identity_id
         WHERE i.tenant_id = 'publiclogic' AND a.unassigned_at IS NULL
           AND i.email IS NOT NULL`,
      )
      .all() as Array<{ role_type: string }>;
    expect(assignments.length).toBe(2);
    expect(assignments.every((a) => a.role_type === 'administrator')).toBe(true);

    // 2 seed processes (one per person, titled "Welcome to PJ").
    const seeded = db
      .prepare(
        `SELECT process_id FROM processes
         WHERE tenant_id = 'publiclogic'
           AND json_extract(fields, '$.title') = 'Welcome to PJ'`,
      )
      .all() as Array<{ process_id: string }>;
    expect(seeded.length).toBe(2);

    // Audit events: tenant.seeded ×1, identity.seeded ×2, role.seeded ×2,
    // process.created ×3 (2 seed processes + the tenant_root sentinel).
    expect(countEvents(db, 'tenant.seeded')).toBe(1);
    expect(countEvents(db, 'identity.seeded')).toBe(2);
    expect(countEvents(db, 'role.seeded')).toBe(2);
    expect(countEvents(db, 'process.created')).toBe(3);
  });

  it('b) re-running on the same DB produces zero deltas', () => {
    seedFromInput(db, TWO_PEOPLE);

    const baselineEvents = (db
      .prepare(`SELECT COUNT(*) AS n FROM audit_events`)
      .get() as { n: number }).n;
    const baselineIdentities = (db
      .prepare(`SELECT COUNT(*) AS n FROM identities`)
      .get() as { n: number }).n;
    const baselineProcesses = (db
      .prepare(`SELECT COUNT(*) AS n FROM processes`)
      .get() as { n: number }).n;
    const baselineAssignments = (db
      .prepare(`SELECT COUNT(*) AS n FROM assignments`)
      .get() as { n: number }).n;

    const { outcomes } = seedFromInput(db, TWO_PEOPLE);

    expect((db.prepare(`SELECT COUNT(*) AS n FROM audit_events`).get() as { n: number }).n)
      .toBe(baselineEvents);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM identities`).get() as { n: number }).n)
      .toBe(baselineIdentities);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM processes`).get() as { n: number }).n)
      .toBe(baselineProcesses);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM assignments`).get() as { n: number }).n)
      .toBe(baselineAssignments);

    // Every outcome is "existing" (no creates).
    expect(outcomes.every((o) => o.status === 'existing')).toBe(true);
  });

  it('c) YAML with new identity appended: only that identity is created', () => {
    seedFromInput(db, TWO_PEOPLE);
    const beforeId = (db.prepare(`SELECT COUNT(*) AS n FROM identities`).get() as { n: number }).n;

    const extended: SeedInput = {
      ...TWO_PEOPLE,
      identities: [
        ...TWO_PEOPLE.identities,
        {
          email: 'contractor@publiclogic.org',
          display_name: 'New Contractor',
          role: 'assignee',
        },
      ],
    };
    const { outcomes } = seedFromInput(db, extended);

    const afterId = (db.prepare(`SELECT COUNT(*) AS n FROM identities`).get() as { n: number }).n;
    expect(afterId).toBe(beforeId + 1);

    const newOutcome = outcomes.find(
      (o) => o.kind === 'identity' && o.label === 'contractor@publiclogic.org',
    );
    expect(newOutcome?.status).toBe('created');

    // Existing identities untouched.
    const nateOutcome = outcomes.find(
      (o) => o.kind === 'identity' && o.label === 'nate@publiclogic.org',
    );
    expect(nateOutcome?.status).toBe('existing');
  });

  it('d) YAML with role change on existing identity: WARN, DB unchanged, exit 0', () => {
    seedFromInput(db, TWO_PEOPLE);

    const tampered: SeedInput = {
      ...TWO_PEOPLE,
      identities: TWO_PEOPLE.identities.map((p, idx) =>
        idx === 0 ? { ...p, role: 'requestor' as const } : p,
      ),
    };
    const { outcomes } = seedFromInput(db, tampered);

    const warned = outcomes.find(
      (o) => o.kind === 'role' && o.label.startsWith('nate@publiclogic.org'),
    );
    expect(warned?.status).toBe('warned');

    // DB role unchanged — still administrator.
    const role = db
      .prepare(
        `SELECT a.role_type FROM assignments a
         JOIN identities i ON i.identity_id = a.identity_id
         WHERE i.email = ? AND a.unassigned_at IS NULL
         ORDER BY a.assigned_at DESC LIMIT 1`,
      )
      .get('nate@publiclogic.org') as { role_type: string };
    expect(role.role_type).toBe('administrator');
  });

  it('e) invalid YAML (missing email): Zod fails, no DB writes (transaction rolls back)', () => {
    const beforeIdentities = (db.prepare(`SELECT COUNT(*) AS n FROM identities`).get() as { n: number }).n;

    const badYaml = `
tenant:
  id: publiclogic
  display_name: PublicLogic
  tier: single

identities:
  - display_name: Missing Email
    role: administrator
`;
    expect(() => parseSeedYaml(badYaml)).toThrowError(/email/i);

    // No writes happened (parse threw before seedFromInput ran).
    const afterIdentities = (db.prepare(`SELECT COUNT(*) AS n FROM identities`).get() as { n: number }).n;
    expect(afterIdentities).toBe(beforeIdentities);
  });
});
