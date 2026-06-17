import { appendAuditEvent, type DatabaseHandle } from '@pj/db'
import {
  createWorkItem,
  getWorkItem,
  transitionWorkItem,
  type CreateWorkItemInput,
  type GateDecision,
  type TransitionWorkItemOptions,
  type WorkItem,
} from '../workItems.js'
import type { PrrTrigger } from '../prrMachine.js'

const CANON_VERSION = '1.0.0'

export type WorkflowRollupStatus = 'pending' | 'in_progress' | 'blocked' | 'complete'

export interface WorkflowChildDefinition {
  childKey: string
  title: string
  skinKey: string
  dependencies?: string[]
  input?: Omit<CreateWorkItemInput, 'tenantId' | 'createdByRef' | 'runtimeKey' | 'opsPreset' | 'skinKey' | 'parentWorkItemId'>
}

export interface CreateWorkflowInput {
  tenantId: string
  createdByRef: string
  parent: Omit<CreateWorkItemInput, 'tenantId' | 'createdByRef' | 'runtimeKey' | 'opsPreset' | 'parentWorkItemId'>
  children: WorkflowChildDefinition[]
}

export interface WorkflowChild {
  childKey: string
  title: string
  workItemId: string
  dependencies: string[]
}

export interface WorkflowDefinition {
  parentWorkItemId: string
  children: WorkflowChild[]
}

function deploymentId(): string {
  return process.env.PJ_DEPLOYMENT_ID ?? 'default'
}

function workflowChildMeta(item: WorkItem): WorkflowChild {
  const dependencyKeys = Array.isArray(item.fields.workflow_dependencies)
    ? item.fields.workflow_dependencies.filter((value): value is string => typeof value === 'string')
    : []
  return {
    childKey: typeof item.fields.workflow_child_key === 'string' ? item.fields.workflow_child_key : item.work_item_id,
    title: typeof item.fields.workflow_child_title === 'string' ? item.fields.workflow_child_title : item.work_item_id,
    workItemId: item.work_item_id,
    dependencies: dependencyKeys,
  }
}

function loadChildItems(db: DatabaseHandle, tenantId: string, parentWorkItemId: string): WorkItem[] {
  const rows = db.prepare(
    `SELECT work_item_id
       FROM work_items
      WHERE tenant_id = ? AND parent_work_item_id = ?
      ORDER BY json_extract(fields_json, '$.workflow_order') ASC, created_at ASC, work_item_id ASC`,
  ).all(tenantId, parentWorkItemId) as Array<{ work_item_id: string }>

  return rows
    .map((row) => getWorkItem(db, tenantId, row.work_item_id))
    .filter((item): item is WorkItem => Boolean(item))
}

function loadWorkflowDefinition(db: DatabaseHandle, tenantId: string, parentWorkItemId: string): WorkflowDefinition {
  return {
    parentWorkItemId,
    children: loadChildItems(db, tenantId, parentWorkItemId).map(workflowChildMeta),
  }
}

function deriveRollupStatus(children: WorkItem[]): WorkflowRollupStatus {
  if (children.length === 0) return 'pending'
  if (children.every((child) => child.status === 'closed' || child.status === 'archived')) {
    return 'complete'
  }
  if (children.some((child) => child.status === 'blocked')) {
    return 'blocked'
  }
  if (children.some((child) => child.status !== 'received' && child.status !== 'logged')) {
    return 'in_progress'
  }
  return 'pending'
}

function lastRollupStatus(db: DatabaseHandle, parentProcessId: string): WorkflowRollupStatus | null {
  const row = db.prepare(
    `SELECT payload_json
       FROM audit_events
      WHERE process_id = ?
        AND event_family = 'transition'
        AND event_subtype = 'transition.fired'
        AND json_extract(payload_json, '$.kind') = 'workflow_rollup'
      ORDER BY occurred_at DESC, inserted_at DESC
      LIMIT 1`,
  ).get(parentProcessId) as { payload_json: string } | undefined
  if (!row) return null
  const payload = JSON.parse(row.payload_json) as { to?: WorkflowRollupStatus }
  return payload.to ?? null
}

function dependencyGateForChild(
  db: DatabaseHandle,
  item: WorkItem,
  trigger: PrrTrigger,
  _actorRef: string,
): GateDecision {
  if (trigger !== 'search_begin') {
    return { ok: true }
  }
  const childMeta = workflowChildMeta(item)
  const parentId = item.parent_work_item_id
  const siblings = parentId ? loadChildItems(db, item.tenant_id, parentId) : []
  const siblingIdsByKey = new Map(
    siblings.map((sibling) => [workflowChildMeta(sibling).childKey, sibling.work_item_id]),
  )

  for (const dependencyKey of childMeta.dependencies) {
    const dependencyId = siblingIdsByKey.get(dependencyKey)
    if (!dependencyId) {
      return {
        ok: false,
        code: 'dependency_incomplete',
        reason: `dependency '${dependencyKey}' is missing`,
      }
    }
    const dependency = getWorkItem(db, item.tenant_id, dependencyId)
    if (!dependency) {
      return {
        ok: false,
        code: 'dependency_incomplete',
        reason: `dependency '${dependencyKey}' is missing`,
      }
    }
    if (dependency.status !== 'closed' && dependency.status !== 'archived') {
      return {
        ok: false,
        code: 'dependency_incomplete',
        reason: `dependency '${dependencyKey}' is not complete`,
      }
    }
  }
  return { ok: true }
}

export function createWorkflow(
  db: DatabaseHandle,
  input: CreateWorkflowInput,
): WorkflowDefinition {
  const parent = createWorkItem(db, {
    tenantId: input.tenantId,
    createdByRef: input.createdByRef,
    runtimeKey: 'ops-002',
    opsPreset: 'OPS-002',
    skinKey: input.parent.skinKey,
    casespaceRef: input.parent.casespaceRef,
    subjectRef: input.parent.subjectRef,
    ownerIdentityId: input.parent.ownerIdentityId,
    defaultPool: input.parent.defaultPool,
    neededBy: input.parent.neededBy,
    fields: {
      ...(input.parent.fields ?? {}),
      workflow_kind: 'composer_parent',
    },
    links: input.parent.links,
    resources: input.parent.resources,
    evidence: input.parent.evidence,
    skinSnapshot: input.parent.skinSnapshot,
  })

  for (const [index, child] of input.children.entries()) {
    const created = createWorkItem(db, {
      tenantId: input.tenantId,
      createdByRef: input.createdByRef,
      runtimeKey: 'ops-001',
      opsPreset: 'OPS-001',
      skinKey: child.skinKey,
      parentWorkItemId: parent.work_item_id,
      casespaceRef: child.input?.casespaceRef ?? input.parent.casespaceRef,
      subjectRef: child.input?.subjectRef ?? child.title,
      ownerIdentityId: child.input?.ownerIdentityId ?? null,
      defaultPool: child.input?.defaultPool ?? null,
      neededBy: child.input?.neededBy ?? null,
      fields: {
        ...(child.input?.fields ?? {}),
        workflow_child_key: child.childKey,
        workflow_child_title: child.title,
        workflow_order: index,
        workflow_dependencies: child.dependencies ?? [],
      },
      links: [],
      resources: child.input?.resources,
      evidence: child.input?.evidence,
      skinSnapshot: child.input?.skinSnapshot,
    })
    void created
  }

  return loadWorkflowDefinition(db, input.tenantId, parent.work_item_id)
}

export function getWorkflowRollup(
  db: DatabaseHandle,
  tenantId: string,
  parentWorkItemId: string,
): WorkflowRollupStatus {
  return deriveRollupStatus(loadChildItems(db, tenantId, parentWorkItemId))
}

export function reconcileWorkflowRollup(
  db: DatabaseHandle,
  tenantId: string,
  parentWorkItemId: string,
  actorRef: string,
): WorkflowRollupStatus {
  const parent = getWorkItem(db, tenantId, parentWorkItemId)
  if (!parent) {
    throw new Error(`Workflow parent '${parentWorkItemId}' not found`)
  }
  const nextStatus = getWorkflowRollup(db, tenantId, parentWorkItemId)
  const previousStatus = lastRollupStatus(db, parent.process_id) ?? 'pending'

  if (previousStatus !== nextStatus) {
    appendAuditEvent(db, {
      event_family: 'transition',
      event_subtype: 'transition.fired',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id: parent.process_id,
      actor_ref: actorRef,
      payload: {
        kind: 'workflow_rollup',
        from: previousStatus,
        to: nextStatus,
        child_count: loadChildItems(db, tenantId, parentWorkItemId).length,
      },
    })
  }

  return nextStatus
}

export function transitionWorkflowChild(
  db: DatabaseHandle,
  tenantId: string,
  parentWorkItemId: string,
  childWorkItemId: string,
  trigger: PrrTrigger,
  actorRef: string,
  opts: Omit<TransitionWorkItemOptions, 'evaluatePreconditions'> = {},
): { child: WorkItem; parentRollup: WorkflowRollupStatus } {
  const child = transitionWorkItem(db, tenantId, childWorkItemId, trigger, actorRef, {
    ...opts,
    evaluatePreconditions: [dependencyGateForChild],
  })
  const parentRollup = reconcileWorkflowRollup(db, tenantId, parentWorkItemId, actorRef)
  return { child, parentRollup }
}

export function getWorkflowDefinition(
  db: DatabaseHandle,
  tenantId: string,
  parentWorkItemId: string,
): WorkflowDefinition {
  return loadWorkflowDefinition(db, tenantId, parentWorkItemId)
}
