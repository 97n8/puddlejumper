import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, migrate, type DatabaseHandle } from '@pj/db'
import { createCalEvaluator, createWorkItem, transitionWorkItem } from '../src/index.js'

const TENANT = 'publiclogic'

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:')
  migrate(db)
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    TENANT,
    'PublicLogic',
    '1.0.0',
  )
  return db
}

function seedIdentity(db: DatabaseHandle, identityId: string): void {
  db.prepare(
    `INSERT INTO identities (identity_id, tenant_id, kind, active, email, display_name)
     VALUES (?, ?, 'person', 1, ?, ?)`,
  ).run(identityId, TENANT, `${identityId}@publiclogic.org`, identityId)
}

function assignRole(
  db: DatabaseHandle,
  processId: string,
  identityId: string,
  roleType: string,
): void {
  db.prepare(
    `INSERT INTO assignments (
       assignment_id, process_id, identity_id, role_type, tenant_id, assigned_by_ref
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(`${identityId}-${roleType}`, processId, identityId, roleType, TENANT, 'seed')
}

describe('@publiclogic/logic-commons-runtime CAL', () => {
  let db: DatabaseHandle

  beforeEach(() => {
    db = freshDb()
  })

  afterEach(() => {
    const current = db
    db = undefined as unknown as DatabaseHandle
    try { current?.close() } catch {}
  })

  it('routes unauthorized assign attempts to blocked with authority_failure', () => {
    seedIdentity(db, 'requestor-1')
    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'requestor-1',
      runtimeKey: 'ops-001',
      opsPreset: 'OPS-001',
      skinKey: 'muni-002',
    })
    db.prepare(
      `UPDATE work_items SET status = 'logged' WHERE work_item_id = ?`,
    ).run(item.work_item_id)
    db.prepare(
      `UPDATE processes SET current_state = 'logged' WHERE process_id = ?`,
    ).run(item.process_id)
    assignRole(db, item.process_id, 'requestor-1', 'requestor')

    const next = transitionWorkItem(
      db,
      TENANT,
      item.work_item_id,
      'route',
      'requestor-1',
      {
        evaluateCal: createCalEvaluator({
          gates: {
            route: {},
          },
        }),
      },
    )

    expect(next.status).toBe('blocked')
    expect(next.blocked_reason).toBe('authority_failure')
  })

  it('permits assign when the canonical identity holds the needed Org Manager role', () => {
    seedIdentity(db, 'intake-1')
    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'intake-1',
      runtimeKey: 'ops-001',
      opsPreset: 'OPS-001',
      skinKey: 'muni-002',
    })
    db.prepare(
      `UPDATE work_items SET status = 'logged' WHERE work_item_id = ?`,
    ).run(item.work_item_id)
    db.prepare(
      `UPDATE processes SET current_state = 'logged' WHERE process_id = ?`,
    ).run(item.process_id)
    assignRole(db, item.process_id, 'intake-1', 'intake')

    const next = transitionWorkItem(
      db,
      TENANT,
      item.work_item_id,
      'route',
      'intake-1',
      {
        evaluateCal: createCalEvaluator({
          gates: {
            route: {},
          },
        }),
      },
    )

    expect(next.status).toBe('assigned')
    expect(next.blocked_reason).toBeNull()
  })

  it('blocks close with missing_evidence when the CAL gate requires proof', () => {
    seedIdentity(db, 'admin-1')
    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'admin-1',
      runtimeKey: 'ops-005',
      opsPreset: 'OPS-005',
      skinKey: 'stay-002',
    })
    db.prepare(
      `UPDATE work_items SET status = 'responded' WHERE work_item_id = ?`,
    ).run(item.work_item_id)
    db.prepare(
      `UPDATE processes SET current_state = 'responded' WHERE process_id = ?`,
    ).run(item.process_id)
    assignRole(db, item.process_id, 'admin-1', 'administrator')

    const blocked = transitionWorkItem(
      db,
      TENANT,
      item.work_item_id,
      'close',
      'admin-1',
      {
        evaluateCal: createCalEvaluator({
          gates: {
            close: {
              requiredEvidence: ['turnover-photo'],
            },
          },
        }),
      },
    )

    expect(blocked.status).toBe('blocked')
    expect(blocked.blocked_reason).toBe('missing_evidence')
    expect(blocked.decision_required).toBe(true)
  })
})
