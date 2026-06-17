import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, migrate, type DatabaseHandle } from '@pj/db'
import {
  archieveWorkItem,
  createWorkItem,
  getArchieveSeal,
  loadArchieveSealEvents,
  transitionWorkItem,
  verifyArchieveChain,
  verifyArchieveContentHashForEvents,
  verifyArchieveSeal,
} from '../src/index.js'

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

function countAuditEvents(db: DatabaseHandle, processId: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS count FROM audit_events WHERE process_id = ?`).get(processId) as { count: number }
  ).count
}

function createClosedWorkItem(
  db: DatabaseHandle,
  opts: {
    workItemId?: string
    evidence?: unknown[]
    skinSnapshot?: Record<string, unknown>
  } = {},
) {
  const item = createWorkItem(db, {
    tenantId: TENANT,
    createdByRef: 'id-nate',
    runtimeKey: 'ops-005',
    opsPreset: 'OPS-005',
    skinKey: 'muni-002',
    evidence: opts.evidence,
    skinSnapshot: opts.skinSnapshot,
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
    current = transitionWorkItem(db, TENANT, current.work_item_id, trigger, 'id-nate')
  }
  return current
}

function insertHeldResource(db: DatabaseHandle, workItemId: string, resourceRef: string): void {
  db.prepare(
    `INSERT INTO holds (
       hold_id, tenant_id, work_item_id, hold_kind, resource_ref, status
     ) VALUES (?, ?, ?, 'locked', ?, 'held')`,
  ).run(`${workItemId}-${resourceRef}`, TENANT, workItemId, resourceRef)
}

describe('@publiclogic/logic-commons-runtime ARCHIEVE', () => {
  let db: DatabaseHandle

  beforeEach(() => {
    db = freshDb()
  })

  afterEach(() => {
    const current = db
    db = undefined as unknown as DatabaseHandle
    try { current?.close() } catch {}
  })

  it('writes a seal without copying audit events and releases holds', () => {
    const item = createClosedWorkItem(db, {
      evidence: [
        { key: 'permit-pdf', ref: 'file://permit.pdf', hash: 'hash-permit' },
        { key: 'site-photo', ref: 'file://site-photo.jpg', hash: 'hash-photo' },
      ],
      skinSnapshot: {
        cal: {
          gates: {
            close: {
              requiredEvidence: ['permit-pdf', 'site-photo'],
            },
          },
        },
      },
    })
    insertHeldResource(db, item.work_item_id, 'permit-file-42')

    const beforeCount = countAuditEvents(db, item.process_id)
    const seal = archieveWorkItem(db, TENANT, item.work_item_id, 'id-nate')
    const afterCount = countAuditEvents(db, item.process_id)

    expect(afterCount).toBe(beforeCount)
    expect(seal.content_hash).toBeTruthy()

    const released = db.prepare(
      `SELECT COUNT(*) AS count
         FROM holds
        WHERE work_item_id = ? AND status = 'released'`,
    ).get(item.work_item_id) as { count: number }
    expect(released.count).toBe(1)

    const stored = getArchieveSeal(db, seal.seal_id)!
    expect(stored.manifest.proof).toEqual([
      { key: 'permit-pdf', ref: 'file://permit.pdf', hash: 'hash-permit' },
      { key: 'site-photo', ref: 'file://site-photo.jpg', hash: 'hash-photo' },
    ])
  })

  it('verifies the stored content hash over the sealed event range', () => {
    const item = createClosedWorkItem(db)
    const seal = archieveWorkItem(db, TENANT, item.work_item_id, 'id-nate')

    expect(verifyArchieveSeal(db, seal.seal_id)).toBe(true)
  })

  it('is tamper-evident and audit triggers still reject direct mutation', () => {
    const item = createClosedWorkItem(db)
    const seal = archieveWorkItem(db, TENANT, item.work_item_id, 'id-nate')
    const events = loadArchieveSealEvents(db, seal.seal_id)
    const tampered = events.map((event, index) =>
      index === 0 ? { ...event, payload_json: '{"tampered":true}' } : event,
    )

    expect(verifyArchieveContentHashForEvents(seal, tampered)).toBe(false)
    expect(() =>
      db.prepare(`UPDATE audit_events SET event_subtype = ? WHERE event_id = ?`).run('tampered', events[0]!.event_id),
    ).toThrowError(/append-only/i)
    expect(() =>
      db.prepare(`DELETE FROM audit_events WHERE event_id = ?`).run(events[0]!.event_id),
    ).toThrowError(/append-only/i)
  })

  it('chains seals and detects a broken prev_seal_hash link', () => {
    const first = createClosedWorkItem(db)
    const firstSeal = archieveWorkItem(db, TENANT, first.work_item_id, 'id-nate')
    const second = createClosedWorkItem(db)
    const secondSeal = archieveWorkItem(db, TENANT, second.work_item_id, 'id-allie')

    expect(secondSeal.prev_seal_hash).toBe(firstSeal.content_hash)
    expect(verifyArchieveChain(db, TENANT)).toBe(true)

    db.prepare(`UPDATE seals SET prev_seal_hash = ? WHERE seal_id = ?`).run('broken-chain', secondSeal.seal_id)
    expect(verifyArchieveChain(db, TENANT)).toBe(false)
  })
})
