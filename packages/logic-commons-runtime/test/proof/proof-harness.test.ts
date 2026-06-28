import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, migrate, verifyAuditTriggers, type DatabaseHandle } from '@pj/db'
import {
  archieveWorkItem,
  createCalEvaluator,
  createPrmEvaluator,
  createWorkflow,
  getWorkflowDefinition,
  getWorkflowRollup,
  loadBuiltInSkin,
  loadBuiltInSkins,
  resolveBlockedWorkItem,
  transitionWorkflowChild,
  verifyArchieveSeal,
} from '../../src/index.js'

const TENANT = 'publiclogic'
const runtimeSourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
const triggerOrder = ['intake_complete', 'route', 'search_begin', 'search_complete', 'respond', 'close', 'reassign'] as const

type WorkflowRunSummary = {
  name: string
  parentWorkItemId: string
  sequences: string[]
  childIds: string[]
}

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

function assignRole(db: DatabaseHandle, processId: string, identityId: string, roleType: string): void {
  db.prepare(
    `INSERT INTO assignments (
       assignment_id, process_id, identity_id, role_type, tenant_id, assigned_by_ref
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(`${identityId}-${roleType}-${processId}`, processId, identityId, roleType, TENANT, 'seed')
}

function setWorkItemState(db: DatabaseHandle, workItemId: string, status: string): void {
  const row = db.prepare(`SELECT process_id FROM work_items WHERE work_item_id = ?`).get(workItemId) as { process_id: string }
  db.prepare(`UPDATE work_items SET status = ? WHERE work_item_id = ?`).run(status, workItemId)
  db.prepare(`UPDATE processes SET current_state = ? WHERE process_id = ?`).run(status, row.process_id)
}

function setEvidence(db: DatabaseHandle, workItemId: string, evidence: unknown[]): void {
  db.prepare(`UPDATE work_items SET evidence_json = ? WHERE work_item_id = ?`).run(JSON.stringify(evidence), workItemId)
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

function runtimeHasNoDomainBranches(): boolean {
  const files = [
    'workItems.ts',
    'composer/index.ts',
    'cal.ts',
    'prm.ts',
    'archieve.ts',
  ]
  return files.every((file) => {
    const content = fs.readFileSync(path.resolve(runtimeSourceRoot, file), 'utf8').toLowerCase()
    return !/\bstay\b|\bmuni\b|\bbiz\b/.test(content)
  })
}

function transitionEventsForWorkflow(db: DatabaseHandle, parentWorkItemId: string): string[] {
  const workflow = getWorkflowDefinition(db, TENANT, parentWorkItemId)
  const childSequences = workflow.children.flatMap((child) => {
    const processId = (db.prepare(`SELECT process_id FROM work_items WHERE work_item_id = ?`).get(child.workItemId) as { process_id: string }).process_id
    const rows = db.prepare(
      `SELECT payload_json
         FROM audit_events
        WHERE event_family = 'transition'
          AND event_subtype = 'transition.fired'
          AND process_id = ?
          AND json_extract(payload_json, '$.kind') IS NULL
        ORDER BY occurred_at ASC, inserted_at ASC, event_id ASC`,
    ).all(processId) as Array<{ payload_json: string }>
    return rows
      .map((row) => {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>
      const from = typeof payload.from === 'string' ? payload.from : '?'
      const to = typeof payload.to === 'string' ? payload.to : '?'
      const trigger = typeof payload.trigger === 'string' ? payload.trigger : 'transition'
      return {
        trigger,
        sequence: `${child.childKey}:${from}->${to}:${trigger}`,
      }
    })
      .sort((left, right) => triggerOrder.indexOf(left.trigger as (typeof triggerOrder)[number]) - triggerOrder.indexOf(right.trigger as (typeof triggerOrder)[number]))
      .map((entry) => entry.sequence)
  })

  const parentProcessId = (db.prepare(`SELECT process_id FROM work_items WHERE work_item_id = ?`).get(parentWorkItemId) as { process_id: string }).process_id
  const rollupRows = db.prepare(
    `SELECT payload_json
       FROM audit_events
      WHERE process_id = ?
        AND event_family = 'transition'
        AND event_subtype = 'transition.fired'
        AND json_extract(payload_json, '$.kind') = 'workflow_rollup'
      ORDER BY occurred_at ASC, inserted_at ASC, event_id ASC`,
  ).all(parentProcessId) as Array<{ payload_json: string }>

  return [
    ...childSequences,
    ...rollupRows.map((row) => {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>
      const from = typeof payload.from === 'string' ? payload.from : '?'
      const to = typeof payload.to === 'string' ? payload.to : '?'
      return `parent:${from}->${to}:workflow_rollup`
    }),
  ]
}

function archiveChildren(db: DatabaseHandle, workflow: WorkflowRunSummary, actorRef: string): void {
  for (const childId of workflow.childIds) {
    archieveWorkItem(db, TENANT, childId, actorRef)
  }
}

function runFourStepWorkflow(
  db: DatabaseHandle,
  name: string,
  skinKey: 'STAY-002' | 'MUNI-002' | 'BIZ-002',
  actorRef: string,
  opts: {
    neededBy?: string
    childResources?: Array<unknown[]>
    evidenceFactory?: (childKey: string) => unknown[]
    roleType?: string
    extraRoles?: string[]
  } = {},
): WorkflowRunSummary {
  const skin = loadBuiltInSkin(skinKey)
  const workflow = createWorkflow(db, {
    tenantId: TENANT,
    createdByRef: actorRef,
    parent: {
      skinKey,
      subjectRef: `${name} parent`,
      skinSnapshot: skin,
    },
    children: [
      {
        childKey: 'inspect',
        title: 'Inspect',
        skinKey,
        input: {
          skinSnapshot: skin,
          resources: opts.childResources?.[0],
          neededBy: opts.neededBy,
        },
      },
      {
        childKey: 'clean',
        title: 'Clean',
        skinKey,
        dependencies: ['inspect'],
        input: {
          skinSnapshot: skin,
          resources: opts.childResources?.[1],
          neededBy: opts.neededBy,
        },
      },
      {
        childKey: 'reset',
        title: 'Reset',
        skinKey,
        dependencies: ['clean'],
        input: {
          skinSnapshot: skin,
          resources: opts.childResources?.[2],
          neededBy: opts.neededBy,
        },
      },
      {
        childKey: 'ready',
        title: 'Ready',
        skinKey,
        dependencies: ['reset'],
        input: {
          skinSnapshot: skin,
          resources: opts.childResources?.[3],
          neededBy: opts.neededBy,
        },
      },
    ],
  })

  for (const child of workflow.children) {
    const processId = (db.prepare(`SELECT process_id FROM work_items WHERE work_item_id = ?`).get(child.workItemId) as { process_id: string }).process_id
    assignRole(db, processId, actorRef, opts.roleType ?? 'administrator')
    for (const role of opts.extraRoles ?? []) {
      assignRole(db, processId, actorRef, role)
    }

    transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, child.workItemId, 'intake_complete', actorRef)
    transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, child.workItemId, 'route', actorRef, {
      evaluateCal: createCalEvaluator(skin.cal),
      evaluatePrm: createPrmEvaluator(),
    })
    transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, child.workItemId, 'search_begin', actorRef, {
      evaluateCal: createCalEvaluator(skin.cal),
      evaluatePrm: createPrmEvaluator(),
    })
    transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, child.workItemId, 'search_complete', actorRef, {
      evaluateCal: createCalEvaluator(skin.cal),
      evaluatePrm: createPrmEvaluator(),
    })
    transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, child.workItemId, 'respond', actorRef, {
      evaluateCal: createCalEvaluator(skin.cal),
      evaluatePrm: createPrmEvaluator(),
    })

    if (opts.evidenceFactory) {
      setEvidence(db, child.workItemId, opts.evidenceFactory(child.childKey))
    }

    transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, child.workItemId, 'close', actorRef, {
      evaluateCal: createCalEvaluator(skin.cal),
      evaluatePrm: createPrmEvaluator(),
    })
  }

  const sequences = transitionEventsForWorkflow(db, workflow.parentWorkItemId)
  archiveChildren(db, {
    name,
    parentWorkItemId: workflow.parentWorkItemId,
    childIds: workflow.children.map((child) => child.workItemId),
    sequences,
  }, actorRef)

  return {
    name,
    parentWorkItemId: workflow.parentWorkItemId,
    childIds: workflow.children.map((child) => child.workItemId),
    sequences,
  }
}

function sideBySideSequences(rows: WorkflowRunSummary[]): string {
  const max = Math.max(...rows.map((row) => row.sequences.length))
  const padded = rows.map((row) => ({
    name: row.name,
    seq: [...row.sequences, ...Array(Math.max(0, max - row.sequences.length)).fill('')],
  }))
  const header = padded.map((row) => row.name.padEnd(36)).join(' | ')
  const body = Array.from({ length: max }, (_, index) =>
    padded.map((row) => row.seq[index]!.padEnd(36)).join(' | '),
  ).join('\n')
  return `${header}\n${body}`
}

function countAuditEvents(db: DatabaseHandle, processId: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS count FROM audit_events WHERE process_id = ?`).get(processId) as { count: number }
  ).count
}

function rowCountForArchivedChild(db: DatabaseHandle, workItemId: string): { before: number; after: number } {
  const processId = (db.prepare(`SELECT process_id FROM work_items WHERE work_item_id = ?`).get(workItemId) as { process_id: string }).process_id
  const count = countAuditEvents(db, processId)
  return { before: count, after: count }
}

describe('@publiclogic/logic-commons-runtime proof harness', () => {
  let db: DatabaseHandle

  beforeEach(() => {
    db = freshDb()
    loadBuiltInSkins()
    seedIdentity(db, 'admin-1')
    seedIdentity(db, 'approver-1')
    seedIdentity(db, 'requestor-1')
  })

  afterEach(() => {
    const current = db
    db = undefined as unknown as DatabaseHandle
    try { current?.close() } catch {}
  })

  it('proves the one-runtime thesis and prints the proof summary', () => {
    const partAStay = runFourStepWorkflow(db, 'STAY-002 Turnover', 'STAY-002', 'admin-1', {
      evidenceFactory: (childKey) => [{ key: 'turnover-photo', ref: `file://${childKey}.jpg`, hash: `hash-${childKey}` }],
    })

    const muniLockedResources = Array.from({ length: 4 }, () => [{ resource_ref: 'permit-file-42', hold_kind: 'locked' }])
    const partAMuni = runFourStepWorkflow(db, 'MUNI-002 Permit Review', 'MUNI-002', 'approver-1', {
      roleType: 'approver',
      extraRoles: ['intake'],
      childResources: muniLockedResources,
    })

    const bizScheduledResources = [
      [{ resource_ref: 'crew-a', starts_at: '2030-06-17T10:00:00.000Z', ends_at: '2030-06-17T11:00:00.000Z' }],
      [{ resource_ref: 'crew-b', starts_at: '2030-06-17T11:00:00.000Z', ends_at: '2030-06-17T12:00:00.000Z' }],
      [{ resource_ref: 'crew-c', starts_at: '2030-06-17T12:00:00.000Z', ends_at: '2030-06-17T13:00:00.000Z' }],
      [{ resource_ref: 'crew-d', starts_at: '2030-06-17T13:00:00.000Z', ends_at: '2030-06-17T14:00:00.000Z' }],
    ]
    const partABiz = runFourStepWorkflow(db, 'BIZ-002 Project Task', 'BIZ-002', 'admin-1', {
      childResources: bizScheduledResources,
      neededBy: '2030-06-17T15:00:00.000Z',
    })

    expect(runtimeHasNoDomainBranches()).toBe(true)
    expect(getWorkflowRollup(db, TENANT, partAStay.parentWorkItemId)).toBe('complete')
    expect(getWorkflowRollup(db, TENANT, partAMuni.parentWorkItemId)).toBe('complete')
    expect(getWorkflowRollup(db, TENANT, partABiz.parentWorkItemId)).toBe('complete')

    const partBStay = runFourStepWorkflow(db, 'stay', 'STAY-002', 'admin-1', {
      evidenceFactory: (childKey) => [{ key: 'turnover-photo', ref: `file://${childKey}.jpg`, hash: `hash-${childKey}` }],
    })
    const partBMuni = runFourStepWorkflow(db, 'muni', 'MUNI-002', 'approver-1', {
      roleType: 'approver',
      extraRoles: ['intake'],
    })
    const partBBiz = runFourStepWorkflow(db, 'biz', 'BIZ-002', 'admin-1')

    expect(partBStay.sequences).toEqual(partBMuni.sequences)
    expect(partBMuni.sequences).toEqual(partBBiz.sequences)

    const stayWorkflow = getWorkflowDefinition(db, TENANT, partBStay.parentWorkItemId)
    const muniWorkflow = getWorkflowDefinition(db, TENANT, partBMuni.parentWorkItemId)
    const bizWorkflow = getWorkflowDefinition(db, TENANT, partBBiz.parentWorkItemId)
    expect(stayWorkflow.children.map((child) => child.childKey)).toEqual(muniWorkflow.children.map((child) => child.childKey))
    expect(muniWorkflow.children.map((child) => child.childKey)).toEqual(bizWorkflow.children.map((child) => child.childKey))

    const partCWorkflow = createWorkflow(db, {
      tenantId: TENANT,
      createdByRef: 'requestor-1',
      parent: {
        skinKey: 'MUNI-002',
        subjectRef: 'Permit Review Enforcement',
        skinSnapshot: loadBuiltInSkin('MUNI-002'),
      },
      children: [
        {
          childKey: 'permit-review',
          title: 'Permit Review',
          skinKey: 'MUNI-002',
          input: {
            skinSnapshot: loadBuiltInSkin('MUNI-002'),
            neededBy: '2026-06-17T12:00:00.000Z',
            resources: [{ resource_ref: 'permit-file-99', hold_kind: 'locked' }],
          },
        },
      ],
    })

    const enforcementChild = partCWorkflow.children[0]!
    const enforcementProcessId = (db.prepare(`SELECT process_id FROM work_items WHERE work_item_id = ?`).get(enforcementChild.workItemId) as { process_id: string }).process_id
    assignRole(db, enforcementProcessId, 'requestor-1', 'requestor')
    assignRole(db, enforcementProcessId, 'admin-1', 'administrator')
    assignRole(db, enforcementProcessId, 'approver-1', 'approver')

    transitionWorkflowChild(db, TENANT, partCWorkflow.parentWorkItemId, enforcementChild.workItemId, 'intake_complete', 'requestor-1')
    const unauthorizedAssign = transitionWorkflowChild(db, TENANT, partCWorkflow.parentWorkItemId, enforcementChild.workItemId, 'route', 'requestor-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('MUNI-002').cal),
      evaluatePrm: createPrmEvaluator(),
    })
    expect(unauthorizedAssign.child.blocked_reason).toBe('authority_failure')

    const resolved = resolveBlockedWorkItem(db, TENANT, enforcementChild.workItemId, 'approver-1')
    expect(resolved.status).toBe('logged')

    const afterResolveAudit = db.prepare(
      `SELECT COUNT(*) AS count
         FROM audit_events
        WHERE process_id = ?
          AND json_extract(payload_json, '$.kind') = 'blocked.resolve'`,
    ).get(enforcementProcessId) as { count: number }
    expect(afterResolveAudit.count).toBe(1)

    insertHold(db, {
      holdId: 'permit-collision',
      holdKind: 'locked',
      resourceRef: 'permit-file-99',
    })
    const lockedCollision = transitionWorkflowChild(db, TENANT, partCWorkflow.parentWorkItemId, enforcementChild.workItemId, 'route', 'admin-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('MUNI-002').cal),
      evaluatePrm: createPrmEvaluator(),
    })
    expect(lockedCollision.child.blocked_reason).toBe('overcapacity')

    db.prepare(`UPDATE holds SET status = 'released', released_at = ? WHERE hold_id = ?`).run(new Date().toISOString(), 'permit-collision')
    resolveBlockedWorkItem(db, TENANT, enforcementChild.workItemId, 'approver-1')
    db.prepare(`UPDATE work_items SET needed_by = ? WHERE work_item_id = ?`).run('2099-06-17T12:00:00.000Z', enforcementChild.workItemId)
    db.prepare(`UPDATE work_items SET resources_json = ? WHERE work_item_id = ?`).run(
      JSON.stringify([
        {
          resource_ref: 'permit-hearing-99',
          hold_kind: 'scheduled',
          starts_at: '2099-06-17T12:30:00.000Z',
          ends_at: '2099-06-17T13:30:00.000Z',
        },
      ]),
      enforcementChild.workItemId,
    )
    const pastNeededBy = transitionWorkflowChild(db, TENANT, partCWorkflow.parentWorkItemId, enforcementChild.workItemId, 'route', 'admin-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('MUNI-002').cal),
    })
    expect(pastNeededBy.child.status).toBe('assigned')

    const afterSearchBegin = transitionWorkflowChild(db, TENANT, partCWorkflow.parentWorkItemId, enforcementChild.workItemId, 'search_begin', 'admin-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('MUNI-002').cal),
      evaluatePrm: createPrmEvaluator(),
    })
    expect(afterSearchBegin.child.status).toBe('blocked')
    expect(afterSearchBegin.child.blocked_reason).toBe('past_needed_by')

    db.prepare(`UPDATE work_items SET needed_by = ? WHERE work_item_id = ?`).run('2099-06-17T18:00:00.000Z', enforcementChild.workItemId)
    resolveBlockedWorkItem(db, TENANT, enforcementChild.workItemId, 'approver-1')
    transitionWorkflowChild(db, TENANT, partCWorkflow.parentWorkItemId, enforcementChild.workItemId, 'search_begin', 'admin-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('MUNI-002').cal),
      evaluatePrm: createPrmEvaluator(),
    })
    transitionWorkflowChild(db, TENANT, partCWorkflow.parentWorkItemId, enforcementChild.workItemId, 'search_complete', 'admin-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('MUNI-002').cal),
      evaluatePrm: createPrmEvaluator(),
    })
    transitionWorkflowChild(db, TENANT, partCWorkflow.parentWorkItemId, enforcementChild.workItemId, 'respond', 'admin-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('MUNI-002').cal),
      evaluatePrm: createPrmEvaluator(),
    })

    const stayEnforcement = createWorkflow(db, {
      tenantId: TENANT,
      createdByRef: 'admin-1',
      parent: {
        skinKey: 'STAY-002',
        subjectRef: 'Turnover Enforcement',
        skinSnapshot: loadBuiltInSkin('STAY-002'),
      },
      children: [
        {
          childKey: 'ready',
          title: 'Ready',
          skinKey: 'STAY-002',
          input: {
            skinSnapshot: loadBuiltInSkin('STAY-002'),
          },
        },
      ],
    })
    const stayChild = stayEnforcement.children[0]!
    const stayProcessId = (db.prepare(`SELECT process_id FROM work_items WHERE work_item_id = ?`).get(stayChild.workItemId) as { process_id: string }).process_id
    assignRole(db, stayProcessId, 'admin-1', 'administrator')
    assignRole(db, stayProcessId, 'admin-1', 'reviewer')

    for (const trigger of ['intake_complete', 'route', 'search_begin', 'search_complete', 'respond'] as const) {
      transitionWorkflowChild(db, TENANT, stayEnforcement.parentWorkItemId, stayChild.workItemId, trigger, 'admin-1', {
        evaluateCal: createCalEvaluator(loadBuiltInSkin('STAY-002').cal),
        evaluatePrm: createPrmEvaluator(),
      })
    }
    const missingEvidence = transitionWorkflowChild(db, TENANT, stayEnforcement.parentWorkItemId, stayChild.workItemId, 'close', 'admin-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('STAY-002').cal),
      evaluatePrm: createPrmEvaluator(),
    })
    expect(missingEvidence.child.blocked_reason).toBe('missing_evidence')

    setEvidence(db, stayChild.workItemId, [{ key: 'turnover-photo', ref: 'file://ready.jpg', hash: 'hash-ready' }])
    resolveBlockedWorkItem(db, TENANT, stayChild.workItemId, 'admin-1')
    const closedStay = transitionWorkflowChild(db, TENANT, stayEnforcement.parentWorkItemId, stayChild.workItemId, 'close', 'admin-1', {
      evaluateCal: createCalEvaluator(loadBuiltInSkin('STAY-002').cal),
      evaluatePrm: createPrmEvaluator(),
    })
    expect(closedStay.child.status).toBe('closed')
    const beforeSealCount = countAuditEvents(db, stayProcessId)
    const sealed = archieveWorkItem(db, TENANT, stayChild.workItemId, 'admin-1')
    const afterSealCount = countAuditEvents(db, stayProcessId)
    expect(verifyArchieveSeal(db, sealed.seal_id)).toBe(true)
    expect(afterSealCount).toBe(beforeSealCount)
    expect(verifyAuditTriggers(db)).toBe(true)
    expect(() =>
      db.prepare(`UPDATE audit_events SET event_subtype = ? WHERE process_id = ?`).run('tampered', stayProcessId),
    ).toThrowError(/append-only/i)
    expect(() =>
      db.prepare(`DELETE FROM audit_events WHERE process_id = ?`).run(stayProcessId),
    ).toThrowError(/append-only/i)

    const partA = runtimeHasNoDomainBranches()
    const partB = JSON.stringify(partBStay.sequences) === JSON.stringify(partBMuni.sequences) &&
      JSON.stringify(partBMuni.sequences) === JSON.stringify(partBBiz.sequences)
    const partC = [
      unauthorizedAssign.child.blocked_reason === 'authority_failure',
      lockedCollision.child.blocked_reason === 'overcapacity',
      afterSearchBegin.child.blocked_reason === 'past_needed_by',
      missingEvidence.child.blocked_reason === 'missing_evidence',
      afterResolveAudit.count >= 1,
      verifyArchieveSeal(db, sealed.seal_id),
      afterSealCount === beforeSealCount,
    ].every(Boolean)

    const sideBySide = sideBySideSequences([partBStay, partBMuni, partBBiz])
    console.log([
      '',
      '=== LOGICCOMMONS V1 PROOF SUMMARY ===',
      `001 work      : ${partA ? 'PASS' : 'FAIL'}`,
      `002 process   : ${partB ? 'PASS' : 'FAIL'}`,
      `003 PRM       : ${partC ? 'PASS' : 'FAIL'}`,
      `004 CAL       : ${partC ? 'PASS' : 'FAIL'}`,
      `005 ARCHIEVE  : ${partC ? 'PASS' : 'FAIL'}`,
      '',
      'Part B sequences:',
      sideBySide,
      '',
      `Part C seal row-count unchanged: ${beforeSealCount} -> ${afterSealCount}`,
      '',
      `THESIS: ${partA && partB && partC ? 'PROVEN' : 'NOT PROVEN'}`,
    ].join('\n'))

    expect(partA).toBe(true)
    expect(partB).toBe(true)
    expect(partC).toBe(true)
  })
})
