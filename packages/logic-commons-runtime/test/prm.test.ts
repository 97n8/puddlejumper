import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, migrate, type DatabaseHandle } from '@pj/db'
import { createPrmEvaluator, createWorkItem, transitionWorkItem } from '../src/index.js'

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

function insertHold(
  db: DatabaseHandle,
  input: {
    holdId: string
    workItemId?: string | null
    holdKind?: 'scheduled' | 'locked'
    resourceRef: string
    startsAt?: string | null
    endsAt?: string | null
  },
): void {
  db.prepare(
    `INSERT INTO holds (
       hold_id, tenant_id, work_item_id, hold_kind, resource_ref, starts_at, ends_at, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'held')`,
  ).run(
    input.holdId,
    TENANT,
    input.workItemId ?? null,
    input.holdKind ?? 'scheduled',
    input.resourceRef,
    input.startsAt ?? null,
    input.endsAt ?? null,
  )
}

describe('@publiclogic/logic-commons-runtime PRM', () => {
  let db: DatabaseHandle

  beforeEach(() => {
    db = freshDb()
  })

  afterEach(() => {
    const current = db
    db = undefined as unknown as DatabaseHandle
    try { current?.close() } catch {}
  })

  it('blocks overlapping scheduled holds on the same resource_ref', () => {
    insertHold(db, {
      holdId: 'hold-existing',
      resourceRef: 'unit-7',
      startsAt: '2026-06-17T14:00:00.000Z',
      endsAt: '2026-06-17T16:00:00.000Z',
    })

    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      runtimeKey: 'ops-003',
      opsPreset: 'OPS-003',
      skinKey: 'stay-002',
      resources: [
        {
          resource_ref: 'unit-7',
          starts_at: '2026-06-17T15:00:00.000Z',
          ends_at: '2026-06-17T17:00:00.000Z',
        },
      ],
    })

    const blocked = transitionWorkItem(db, TENANT, item.work_item_id, 'intake_complete', 'id-nate', {
      evaluatePrm: createPrmEvaluator(),
    })

    expect(blocked.status).toBe('blocked')
    expect(blocked.blocked_reason).toBe('overcapacity')
    expect(blocked.decision_required).toBe(true)
  })

  it('blocks a locked permit-file collision, but not the same ref as subject alone', () => {
    insertHold(db, {
      holdId: 'hold-permit',
      holdKind: 'locked',
      resourceRef: 'permit-file-42',
    })

    const subjectOnly = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      runtimeKey: 'ops-003',
      opsPreset: 'OPS-003',
      skinKey: 'muni-002',
      subjectRef: 'permit-file-42',
    })

    const subjectOnlyResult = transitionWorkItem(
      db,
      TENANT,
      subjectOnly.work_item_id,
      'intake_complete',
      'id-nate',
      { evaluatePrm: createPrmEvaluator() },
    )

    expect(subjectOnlyResult.status).toBe('logged')

    const lockedResource = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      runtimeKey: 'ops-003',
      opsPreset: 'OPS-003',
      skinKey: 'muni-002',
      subjectRef: 'permit-file-42',
      resources: [
        {
          resource_ref: 'permit-file-42',
          hold_kind: 'locked',
        },
      ],
    })

    const blocked = transitionWorkItem(
      db,
      TENANT,
      lockedResource.work_item_id,
      'intake_complete',
      'id-nate',
      { evaluatePrm: createPrmEvaluator() },
    )

    expect(blocked.status).toBe('blocked')
    expect(blocked.blocked_reason).toBe('overcapacity')
    expect(blocked.decision_required).toBe(true)
  })

  it('blocks when a planned hold ends after needed_by', () => {
    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      runtimeKey: 'ops-003',
      opsPreset: 'OPS-003',
      skinKey: 'biz-002',
      neededBy: '2026-06-17T15:00:00.000Z',
      resources: [
        {
          resource_ref: 'crew-1',
          starts_at: '2026-06-17T14:00:00.000Z',
          ends_at: '2026-06-17T16:00:00.000Z',
        },
      ],
    })

    const blocked = transitionWorkItem(db, TENANT, item.work_item_id, 'intake_complete', 'id-nate', {
      evaluatePrm: createPrmEvaluator(),
    })

    expect(blocked.status).toBe('blocked')
    expect(blocked.blocked_reason).toBe('past_needed_by')
    expect(blocked.decision_required).toBe(true)
  })

  it('blocks when the earliest planned window has passed and no live hold exists', () => {
    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      runtimeKey: 'ops-003',
      opsPreset: 'OPS-003',
      skinKey: 'biz-002',
      resources: [
        {
          resource_ref: 'crew-2',
          starts_at: '2026-06-17T10:00:00.000Z',
          ends_at: '2026-06-17T11:00:00.000Z',
        },
      ],
    })

    const blocked = transitionWorkItem(db, TENANT, item.work_item_id, 'intake_complete', 'id-nate', {
      evaluatePrm: createPrmEvaluator({
        now: () => new Date('2026-06-17T12:00:00.000Z'),
      }),
    })

    expect(blocked.status).toBe('blocked')
    expect(blocked.blocked_reason).toBe('unassigned_past_window')
    expect(blocked.decision_required).toBe(true)
  })
})
