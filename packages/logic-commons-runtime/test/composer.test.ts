import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, migrate, type DatabaseHandle } from '@pj/db'
import {
  createWorkflow,
  getWorkflowDefinition,
  getWorkflowRollup,
  transitionWorkflowChild,
} from '../src/index.js'

const TENANT = 'publiclogic'
const composerSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/composer/index.ts',
)

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

function fullSequenceForChild(
  db: DatabaseHandle,
  parentId: string,
  childId: string,
): void {
  const triggers = [
    'intake_complete',
    'route',
    'search_begin',
    'search_complete',
    'respond',
    'close',
  ] as const
  for (const trigger of triggers) {
    transitionWorkflowChild(db, TENANT, parentId, childId, trigger, 'id-nate')
  }
}

describe('@publiclogic/logic-commons-runtime composer', () => {
  let db: DatabaseHandle

  beforeEach(() => {
    db = freshDb()
  })

  afterEach(() => {
    const current = db
    db = undefined as unknown as DatabaseHandle
    try { current?.close() } catch {}
  })

  it('contains no direct status writes in composer source', () => {
    const source = fs.readFileSync(composerSourcePath, 'utf8')
    expect(source).not.toMatch(/UPDATE\s+work_items/i)
    expect(source).not.toMatch(/UPDATE\s+processes/i)
    expect(source).toMatch(/transitionWorkItem/)
  })

  it('runs a 4-step linear graph to complete and appends a parent rollup audit event', () => {
    const workflow = createWorkflow(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      parent: {
        skinKey: 'BIZ-002',
        subjectRef: 'Turnover workflow',
      },
      children: [
        { childKey: 'inspect', title: 'Inspect', skinKey: 'STAY-002' },
        { childKey: 'clean', title: 'Clean', skinKey: 'STAY-002', dependencies: ['inspect'] },
        { childKey: 'reset', title: 'Reset', skinKey: 'STAY-002', dependencies: ['clean'] },
        { childKey: 'ready', title: 'Ready', skinKey: 'STAY-002', dependencies: ['reset'] },
      ],
    })

    for (const child of workflow.children) {
      fullSequenceForChild(db, workflow.parentWorkItemId, child.workItemId)
    }

    expect(getWorkflowRollup(db, TENANT, workflow.parentWorkItemId)).toBe('complete')

    const parent = db.prepare(
      `SELECT process_id FROM work_items WHERE work_item_id = ?`,
    ).get(workflow.parentWorkItemId) as { process_id: string }
    const rollupEvents = db.prepare(
      `SELECT COUNT(*) AS count
         FROM audit_events
        WHERE process_id = ?
          AND event_family = 'transition'
          AND event_subtype = 'transition.fired'
          AND json_extract(payload_json, '$.kind') = 'workflow_rollup'`,
    ).get(parent.process_id) as { count: number }

    expect(rollupEvents.count).toBeGreaterThan(0)
  })

  it('blocks a child started before its dependency completes, then proceeds once it does', () => {
    const workflow = createWorkflow(db, {
      tenantId: TENANT,
      createdByRef: 'id-nate',
      parent: {
        skinKey: 'BIZ-002',
        subjectRef: 'Linear workflow',
      },
      children: [
        { childKey: 'inspect', title: 'Inspect', skinKey: 'STAY-002' },
        { childKey: 'clean', title: 'Clean', skinKey: 'STAY-002', dependencies: ['inspect'] },
      ],
    })

    const inspect = workflow.children.find((child) => child.childKey === 'inspect')!
    const clean = workflow.children.find((child) => child.childKey === 'clean')!

    transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, clean.workItemId, 'intake_complete', 'id-nate')
    transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, clean.workItemId, 'route', 'id-nate')
    const blocked = transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, clean.workItemId, 'search_begin', 'id-nate')

    expect(blocked.child.status).toBe('blocked')
    expect(blocked.child.blocked_reason).toBe('dependency_incomplete')

    fullSequenceForChild(db, workflow.parentWorkItemId, inspect.workItemId)

    const resumed = transitionWorkflowChild(db, TENANT, workflow.parentWorkItemId, clean.workItemId, 'search_begin', 'id-nate')
    expect(resumed.child.status).toBe('searching')
  })

  it('contains no stay/muni/biz branching in composer source', () => {
    const source = fs.readFileSync(composerSourcePath, 'utf8').toLowerCase()
    expect(source).not.toMatch(/\bstay\b/)
    expect(source).not.toMatch(/\bmuni\b/)
    expect(source).not.toMatch(/\bbiz\b/)
  })
})
