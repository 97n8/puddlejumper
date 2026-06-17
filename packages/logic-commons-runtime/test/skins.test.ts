import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, migrate, type DatabaseHandle } from '@pj/db'
import {
  createCalEvaluator,
  createWorkItem,
  loadBuiltInSkin,
  loadBuiltInSkins,
  loadSkin,
  SkinValidationError,
  transitionWorkItem,
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
  ).run(`${identityId}-${roleType}-${processId}`, processId, identityId, roleType, TENANT, 'seed')
}

describe('@publiclogic/logic-commons-runtime skins', () => {
  let db: DatabaseHandle

  beforeEach(() => {
    db = freshDb()
  })

  afterEach(() => {
    const current = db
    db = undefined as unknown as DatabaseHandle
    try { current?.close() } catch {}
  })

  it('loads the seven V1 skins as overlays', () => {
    const skins = loadBuiltInSkins()
    expect(skins).toHaveLength(7)
    expect(skins.map((skin) => skin.skinKey)).toEqual([
      'STAY-001',
      'STAY-002',
      'STAY-003',
      'MUNI-001',
      'MUNI-002',
      'BIZ-001',
      'BIZ-002',
    ])
  })

  it('a valid skin relabels, re-gates, and sets pools without runtime code changes', () => {
    const skin = loadBuiltInSkin('STAY-002')
    expect(skin.fieldLabels.subject_ref).toBe('Turnover')
    expect(skin.requiredFields).toContain('needed_by')
    expect(skin.pools.owner?.role).toBe('assignee')

    seedIdentity(db, 'admin-1')
    const item = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'admin-1',
      runtimeKey: 'ops-005',
      opsPreset: 'OPS-005',
      skinKey: skin.skinKey,
    })
    db.prepare(`UPDATE work_items SET status = 'responded' WHERE work_item_id = ?`).run(item.work_item_id)
    db.prepare(`UPDATE processes SET current_state = 'responded' WHERE process_id = ?`).run(item.process_id)
    assignRole(db, item.process_id, 'admin-1', 'administrator')

    const blocked = transitionWorkItem(db, TENANT, item.work_item_id, 'close', 'admin-1', {
      evaluateCal: createCalEvaluator(skin.cal),
    })

    expect(blocked.status).toBe('blocked')
    expect(blocked.blocked_reason).toBe('missing_evidence')
  })

  it('rejects a skin that adds a core field, naming the field', () => {
    expect(() =>
      loadSkin({
        skin_key: 'BAD-FIELD',
        domain: 'muni',
        field_labels: {
          subject_ref: 'Permit',
          invented_field: 'Nope',
        },
      }),
    ).toThrowError(new SkinValidationError("Skin 'BAD-FIELD' attempts to add or reference unknown core field 'invented_field' in field_labels"))
  })

  it('rejects a skin that adds a state', () => {
    expect(() =>
      loadSkin({
        skin_key: 'BAD-STATE',
        domain: 'muni',
        states: ['received', 'custom_state'],
      }),
    ).toThrowError(/attempts to add states/)
  })

  it("rejects a skin whose pool references an unrecognized Org Manager role", () => {
    expect(() =>
      loadSkin({
        skin_key: 'BAD-POOL',
        domain: 'biz',
        pools: {
          approver: { role: 'municipal_supervisor' },
        },
      }),
    ).toThrowError(/unknown Org Manager role 'municipal_supervisor'/)
  })

  it('produces MUNI approval and STAY evidence gates from skin config alone with the same CAL evaluator', () => {
    const muniSkin = loadBuiltInSkin('MUNI-002')
    const staySkin = loadBuiltInSkin('STAY-002')

    seedIdentity(db, 'approver-1')
    seedIdentity(db, 'admin-1')

    const muniItem = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'approver-1',
      runtimeKey: 'ops-004',
      opsPreset: 'OPS-004',
      skinKey: muniSkin.skinKey,
    })
    db.prepare(`UPDATE work_items SET status = 'responded' WHERE work_item_id = ?`).run(muniItem.work_item_id)
    db.prepare(`UPDATE processes SET current_state = 'responded' WHERE process_id = ?`).run(muniItem.process_id)
    assignRole(db, muniItem.process_id, 'approver-1', 'approver')

    const muniResult = transitionWorkItem(db, TENANT, muniItem.work_item_id, 'close', 'approver-1', {
      evaluateCal: createCalEvaluator(muniSkin.cal),
    })

    expect(muniResult.status).toBe('closed')

    const stayItem = createWorkItem(db, {
      tenantId: TENANT,
      createdByRef: 'admin-1',
      runtimeKey: 'ops-005',
      opsPreset: 'OPS-005',
      skinKey: staySkin.skinKey,
    })
    db.prepare(`UPDATE work_items SET status = 'responded' WHERE work_item_id = ?`).run(stayItem.work_item_id)
    db.prepare(`UPDATE processes SET current_state = 'responded' WHERE process_id = ?`).run(stayItem.process_id)
    assignRole(db, stayItem.process_id, 'admin-1', 'administrator')

    const stayResult = transitionWorkItem(db, TENANT, stayItem.work_item_id, 'close', 'admin-1', {
      evaluateCal: createCalEvaluator(staySkin.cal),
    })

    expect(stayResult.status).toBe('blocked')
    expect(stayResult.blocked_reason).toBe('missing_evidence')
  })
})
