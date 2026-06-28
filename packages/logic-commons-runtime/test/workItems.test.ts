import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, migrate, type DatabaseHandle } from '@pj/db'
import { createWorkItem, getWorkItem, transitionWorkItem } from '../src/index.js'

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

function seedCasespace(db: DatabaseHandle, id: string): void {
  db.prepare(
    `INSERT INTO casespaces (
       casespace_id, tenant_id, slug, name, domain_key, skin_key
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, TENANT, id, id, 'muni', 'muni-002')
}

function auditCount(db: DatabaseHandle, processId: string): number {
  return (
    db.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE process_id = ?').get(processId) as { count: number }
  ).count
}

describe('@publiclogic/logic-commons-runtime work items', () => {
  let db: DatabaseHandle

  beforeEach(() => {
    db = freshDb()
  })

  afterEach(() => {
    const current = db
    db = undefined as unknown as DatabaseHandle
    try { current?.close() } catch {}
  })

  it('creates a work item on the canonical process + audit path', () => {
    seedCasespace(db, 'phillipston')

    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      runtimeKey: 'ops-001',
      opsPreset: 'OPS-001',
      skinKey: 'muni-002',
      casespaceRef: 'phillipston',
    })

    expect(item.status).toBe('received')
    expect(getWorkItem(db, TENANT, item.work_item_id)?.process_id).toBe(item.process_id)
    expect(auditCount(db, item.process_id)).toBe(1)
  })

  it('runs the happy path through the shared PRR machine and appends every transition', () => {
    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      runtimeKey: 'ops-001',
      opsPreset: 'OPS-001',
      skinKey: 'stay-002',
    })

    const triggers = [
      'intake_complete',
      'route',
      'search_begin',
      'search_complete',
      'respond',
      'close',
    ] as const

    let current = item
    for (const trigger of triggers) {
      current = transitionWorkItem(db, TENANT, current.work_item_id, trigger, 'id-allie')
    }

    expect(current.status).toBe('closed')
    expect(auditCount(db, current.process_id)).toBe(1 + triggers.length)
    const processRow = db
      .prepare('SELECT current_state FROM processes WHERE process_id = ?')
      .get(current.process_id) as { current_state: string }
    expect(processRow.current_state).toBe('closed')
  })

  it('routes a failed pre-commit gate to blocked instead of throwing', () => {
    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      runtimeKey: 'ops-001',
      opsPreset: 'OPS-001',
      skinKey: 'biz-002',
    })

    const blocked = transitionWorkItem(
      db,
      TENANT,
      item.work_item_id,
      'intake_complete',
      'id-allie',
      {
        evaluateCal: () => ({
          ok: false,
          code: 'authority_failure',
          reason: 'actor lacks assignment',
        }),
      },
    )

    expect(blocked.status).toBe('blocked')
    expect(blocked.blocked_reason).toBe('authority_failure')
    expect(blocked.decision_required).toBe(true)
  })
})
