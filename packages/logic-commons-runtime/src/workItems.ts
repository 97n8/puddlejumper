import crypto from 'node:crypto'
import { can } from '@pj/org-manager'
import { appendAuditEvent, type DatabaseHandle } from '@pj/db'
import {
  INITIAL_STATE,
  PJInvalidTransition,
  validateTransition,
  type PrrState,
  type PrrTrigger,
} from './prrMachine.js'

const CANON_VERSION = '1.0.0'
const PROCESS_TYPE = 'CUSTOM' as const

function deploymentId(): string {
  return process.env.PJ_DEPLOYMENT_ID ?? 'default'
}

export type WorkItemStatus = PrrState | 'blocked' | 'archived'

export interface WorkItem {
  work_item_id: string
  tenant_id: string
  casespace_ref: string | null
  process_id: string
  parent_work_item_id: string | null
  runtime_key: string
  ops_preset: string
  skin_key: string
  status: WorkItemStatus
  subject_ref: string | null
  owner_identity_id: string | null
  default_pool: string | null
  needed_by: string | null
  blocked_reason: string | null
  decision_required: boolean
  fields: Record<string, unknown>
  links: unknown[]
  resources: unknown[]
  evidence: unknown[]
  skin_snapshot: Record<string, unknown>
  created_at: string
  updated_at: string
  archived_at: string | null
}

type WorkItemRow = {
  work_item_id: string
  tenant_id: string
  casespace_ref: string | null
  process_id: string
  parent_work_item_id: string | null
  runtime_key: string
  ops_preset: string
  skin_key: string
  status: WorkItemStatus
  subject_ref: string | null
  owner_identity_id: string | null
  default_pool: string | null
  needed_by: string | null
  blocked_reason: string | null
  decision_required: 0 | 1
  fields_json: string
  links_json: string
  resources_json: string
  evidence_json: string
  skin_snapshot_json: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface CreateWorkItemInput {
  tenantId: string
  createdByRef: string
  runtimeKey: string
  opsPreset: string
  skinKey: string
  casespaceRef?: string | null
  parentWorkItemId?: string | null
  subjectRef?: string | null
  ownerIdentityId?: string | null
  defaultPool?: string | null
  neededBy?: string | null
  fields?: Record<string, unknown>
  links?: unknown[]
  resources?: unknown[]
  evidence?: unknown[]
  skinSnapshot?: Record<string, unknown>
}

export type GateDecision =
  | { ok: true }
  | { ok: false; reason: string; code: string }

type TransitionGate = (
  db: DatabaseHandle,
  item: WorkItem,
  trigger: PrrTrigger,
  actorRef: string,
) => GateDecision

export interface TransitionWorkItemOptions {
  evaluateCal?: TransitionGate
  evaluatePrm?: TransitionGate
  evaluatePreconditions?: TransitionGate[]
}

const BLOCK_META_KEY = '__block'

function rowToWorkItem(row: WorkItemRow): WorkItem {
  return {
    work_item_id: row.work_item_id,
    tenant_id: row.tenant_id,
    casespace_ref: row.casespace_ref,
    process_id: row.process_id,
    parent_work_item_id: row.parent_work_item_id,
    runtime_key: row.runtime_key,
    ops_preset: row.ops_preset,
    skin_key: row.skin_key,
    status: row.status,
    subject_ref: row.subject_ref,
    owner_identity_id: row.owner_identity_id,
    default_pool: row.default_pool,
    needed_by: row.needed_by,
    blocked_reason: row.blocked_reason,
    decision_required: row.decision_required === 1,
    fields: JSON.parse(row.fields_json) as Record<string, unknown>,
    links: JSON.parse(row.links_json) as unknown[],
    resources: JSON.parse(row.resources_json) as unknown[],
    evidence: JSON.parse(row.evidence_json) as unknown[],
    skin_snapshot: JSON.parse(row.skin_snapshot_json) as Record<string, unknown>,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  }
}

function parseBlockedMeta(item: WorkItem): { previous_status?: string; trigger?: string } | null {
  const meta = item.fields[BLOCK_META_KEY]
  if (!meta || typeof meta !== 'object') return null
  return meta as { previous_status?: string; trigger?: string }
}

function isPoolRoleAuthority(
  db: DatabaseHandle,
  item: WorkItem,
  actorRef: string,
): boolean {
  const pools = item.skin_snapshot.pools as Record<string, unknown> | undefined
  const decider = pools?.decider as Record<string, unknown> | undefined
  const approver = pools?.approver as Record<string, unknown> | undefined
  const closer = pools?.closer as Record<string, unknown> | undefined
  const pool = decider ?? approver ?? closer

  const identityId = typeof pool?.identityId === 'string'
    ? pool.identityId
    : typeof pool?.identity_id === 'string'
      ? pool.identity_id
      : null
  if (identityId) {
    return identityId === actorRef
  }

  const role = typeof pool?.role === 'string' ? pool.role : null
  if (!role) {
    return can(db, actorRef, 'process.transition', item.process_id, item.tenant_id)
  }

  const row = db.prepare(
    `SELECT 1
       FROM assignments
      WHERE tenant_id = ?
        AND process_id = ?
        AND identity_id = ?
        AND role_type = ?
        AND unassigned_at IS NULL
      LIMIT 1`,
  ).get(item.tenant_id, item.process_id, actorRef, role)
  return Boolean(row)
}

function isMachineState(value: string): value is PrrState {
  return (
    value === 'received' ||
    value === 'logged' ||
    value === 'assigned' ||
    value === 'searching' ||
    value === 'reviewing' ||
    value === 'responded' ||
    value === 'closed'
  )
}

function parseWorkItemState(item: WorkItem, trigger: PrrTrigger): PrrState {
  const status = item.status
  if (
    status === 'received' ||
    status === 'logged' ||
    status === 'assigned' ||
    status === 'searching' ||
    status === 'reviewing' ||
    status === 'responded' ||
    status === 'closed'
  ) {
    return status
  }
  if (status === 'blocked') {
    const meta = parseBlockedMeta(item)
    if (meta?.previous_status && isMachineState(meta.previous_status)) {
      return meta.previous_status
    }
  }
  throw new PJInvalidTransition(
    'received',
    trigger,
    `work item is in non-machine status '${status}'`,
  )
}

function blockWorkItem(
  db: DatabaseHandle,
  item: WorkItem,
  actorRef: string,
  trigger: PrrTrigger,
  failure: Extract<GateDecision, { ok: false }>,
  occurredAt: string,
): void {
  const nextFields = {
    ...item.fields,
    [BLOCK_META_KEY]: {
      previous_status: item.status,
      trigger,
      code: failure.code,
      reason: failure.reason,
    },
  }
  db.prepare(
    `UPDATE work_items
       SET status = 'blocked',
           blocked_reason = ?,
           decision_required = 1,
           fields_json = ?,
           updated_at = ?
     WHERE work_item_id = ? AND tenant_id = ?`,
  ).run(
    failure.code,
    JSON.stringify(nextFields),
    occurredAt,
    item.work_item_id,
    item.tenant_id,
  )

  db.prepare(
    `UPDATE processes
       SET current_state = ?
     WHERE process_id = ? AND tenant_id = ?`,
  ).run('blocked', item.process_id, item.tenant_id)

  appendAuditEvent(db, {
    event_family: 'transition',
    event_subtype: 'transition.refused',
    canon_version: CANON_VERSION,
    deployment_id: deploymentId(),
    tenant_id: item.tenant_id,
    process_id: item.process_id,
    actor_ref: actorRef,
    occurred_at: occurredAt,
    payload: {
      work_item_id: item.work_item_id,
      from: item.status,
      to: 'blocked',
      trigger,
      reason: failure.reason,
      code: failure.code,
      decision_required: true,
    },
  })
}

export function getWorkItem(
  db: DatabaseHandle,
  tenantId: string,
  workItemId: string,
): WorkItem | null {
  const row = db.prepare(
    `SELECT * FROM work_items WHERE work_item_id = ? AND tenant_id = ?`,
  ).get(workItemId, tenantId) as WorkItemRow | undefined
  return row ? rowToWorkItem(row) : null
}

export function createWorkItem(
  db: DatabaseHandle,
  input: CreateWorkItemInput,
): WorkItem {
  const workItemId = crypto.randomUUID()
  const processId = crypto.randomUUID()
  const now = new Date().toISOString()
  const fieldsJson = JSON.stringify(input.fields ?? {})
  const linksJson = JSON.stringify(input.links ?? [])
  const resourcesJson = JSON.stringify(input.resources ?? [])
  const evidenceJson = JSON.stringify(input.evidence ?? [])
  const skinSnapshotJson = JSON.stringify(input.skinSnapshot ?? {})

  db.transaction(() => {
    db.prepare(
      `INSERT INTO processes (
         process_id, process_type, canon_version, tenant_id, deployment_id,
         current_state, created_at, created_by_ref, assignee_ref, fields, links
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      processId,
      PROCESS_TYPE,
      CANON_VERSION,
      input.tenantId,
      deploymentId(),
      INITIAL_STATE,
      now,
      input.createdByRef,
      input.ownerIdentityId ?? null,
      fieldsJson,
      linksJson,
    )

    db.prepare(
      `INSERT INTO work_items (
         work_item_id, tenant_id, casespace_ref, process_id, parent_work_item_id,
         runtime_key, ops_preset, skin_key, status, subject_ref,
         owner_identity_id, default_pool, needed_by, blocked_reason,
         decision_required, fields_json, links_json, resources_json,
         evidence_json, skin_snapshot_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      workItemId,
      input.tenantId,
      input.casespaceRef ?? null,
      processId,
      input.parentWorkItemId ?? null,
      input.runtimeKey,
      input.opsPreset,
      input.skinKey,
      INITIAL_STATE,
      input.subjectRef ?? null,
      input.ownerIdentityId ?? null,
      input.defaultPool ?? null,
      input.neededBy ?? null,
      null,
      fieldsJson,
      linksJson,
      resourcesJson,
      evidenceJson,
      skinSnapshotJson,
      now,
      now,
    )

    appendAuditEvent(db, {
      event_family: 'process',
      event_subtype: 'process.created',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: input.tenantId,
      process_id: processId,
      actor_ref: input.createdByRef,
      occurred_at: now,
      payload: {
        work_item_id: workItemId,
        runtime_key: input.runtimeKey,
        ops_preset: input.opsPreset,
        skin_key: input.skinKey,
        casespace_ref: input.casespaceRef ?? null,
      },
    })
  })()

  return getWorkItem(db, input.tenantId, workItemId)!
}

export function transitionWorkItem(
  db: DatabaseHandle,
  tenantId: string,
  workItemId: string,
  trigger: PrrTrigger,
  actorRef: string,
  opts: TransitionWorkItemOptions = {},
): WorkItem {
  const occurredAt = new Date().toISOString()

  db.transaction(() => {
    const item = getWorkItem(db, tenantId, workItemId)
    if (!item) {
      throw new PJInvalidTransition(
        INITIAL_STATE,
        trigger,
        `work item '${workItemId}' not found in tenant`,
      )
    }

    const machineState = parseWorkItemState(item, trigger)
    const check = validateTransition(machineState, trigger)
    if (!check.valid) {
      throw new PJInvalidTransition(machineState, trigger, check.reason)
    }

    for (const gate of opts.evaluatePreconditions ?? []) {
      const decision = gate(db, item, trigger, actorRef)
      if (!decision.ok) {
        blockWorkItem(db, item, actorRef, trigger, decision, occurredAt)
        return
      }
    }

    const calDecision = opts.evaluateCal?.(db, item, trigger, actorRef) ?? { ok: true }
    if (!calDecision.ok) {
      blockWorkItem(db, item, actorRef, trigger, calDecision, occurredAt)
      return
    }

    const prmDecision = opts.evaluatePrm?.(db, item, trigger, actorRef) ?? { ok: true }
    if (!prmDecision.ok) {
      blockWorkItem(db, item, actorRef, trigger, prmDecision, occurredAt)
      return
    }

    const nextFields = { ...item.fields }
    delete nextFields[BLOCK_META_KEY]
    db.prepare(
      `UPDATE work_items
         SET status = ?, blocked_reason = NULL, decision_required = 0, fields_json = ?, updated_at = ?
       WHERE work_item_id = ? AND tenant_id = ?`,
    ).run(check.to, JSON.stringify(nextFields), occurredAt, workItemId, tenantId)

    db.prepare(
      `UPDATE processes
         SET current_state = ?, assignee_ref = COALESCE(?, assignee_ref)
       WHERE process_id = ? AND tenant_id = ?`,
    ).run(check.to, item.owner_identity_id, item.process_id, tenantId)

    appendAuditEvent(db, {
      event_family: 'transition',
      event_subtype: 'transition.fired',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id: item.process_id,
      actor_ref: actorRef,
      occurred_at: occurredAt,
      payload: {
        work_item_id: item.work_item_id,
        from: item.status,
        to: check.to,
        trigger,
      },
    })
  })()

  return getWorkItem(db, tenantId, workItemId)!
}

export function resolveBlockedWorkItem(
  db: DatabaseHandle,
  tenantId: string,
  workItemId: string,
  actorRef: string,
): WorkItem {
  const occurredAt = new Date().toISOString()

  db.transaction(() => {
    const item = getWorkItem(db, tenantId, workItemId)
    if (!item) {
      throw new Error(`Work item '${workItemId}' not found in tenant '${tenantId}'`)
    }
    if (item.status !== 'blocked' || !item.decision_required) {
      throw new Error(`Work item '${workItemId}' is not awaiting decision authority`)
    }
    if (!isPoolRoleAuthority(db, item, actorRef)) {
      throw new Error(`Actor '${actorRef}' lacks decision authority for '${workItemId}'`)
    }

    const meta = parseBlockedMeta(item)
    const restoredStatus = meta?.previous_status && isMachineState(meta.previous_status)
      ? meta.previous_status
      : INITIAL_STATE

    const nextFields = { ...item.fields }
    delete nextFields[BLOCK_META_KEY]

    db.prepare(
      `UPDATE work_items
          SET status = ?,
              blocked_reason = NULL,
              decision_required = 0,
              fields_json = ?,
              updated_at = ?
        WHERE tenant_id = ? AND work_item_id = ?`,
    ).run(restoredStatus, JSON.stringify(nextFields), occurredAt, tenantId, workItemId)

    db.prepare(
      `UPDATE processes
          SET current_state = ?
        WHERE tenant_id = ? AND process_id = ?`,
    ).run(restoredStatus, tenantId, item.process_id)

    appendAuditEvent(db, {
      event_family: 'transition',
      event_subtype: 'transition.fired',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id: item.process_id,
      actor_ref: actorRef,
      occurred_at: occurredAt,
      payload: {
        kind: 'blocked.resolve',
        work_item_id: item.work_item_id,
        from: 'blocked',
        to: restoredStatus,
        trigger: meta?.trigger ?? 'resolve',
      },
    })
  })()

  return getWorkItem(db, tenantId, workItemId)!
}
