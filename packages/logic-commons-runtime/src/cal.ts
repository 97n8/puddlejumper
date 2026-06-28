import { can } from '@pj/org-manager'
import type { CanonicalAction, RoleType } from '@publiclogic/core'
import type { DatabaseHandle } from '@pj/db'
import type { GateDecision, WorkItem } from './workItems.js'
import type { PrrTrigger } from './prrMachine.js'

export interface CalGateDefinition {
  action?: CanonicalAction
  requiredEvidence?: string[]
  approvalRole?: RoleType
}

export interface CalDefinition {
  gates?: Partial<Record<PrrTrigger, CalGateDefinition>>
}

function actionForTrigger(trigger: PrrTrigger): CanonicalAction {
  switch (trigger) {
    case 'route':
      return 'process.assign'
    case 'close':
      return 'process.close'
    default:
      return 'process.transition'
  }
}

function hasEvidence(item: WorkItem, requiredEvidence: string[]): boolean {
  const evidenceKeys = new Set<string>()
  for (const entry of item.evidence) {
    if (typeof entry === 'string') {
      evidenceKeys.add(entry)
      continue
    }
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const key = record.key ?? record.type ?? record.id
    if (typeof key === 'string' && key.trim()) {
      evidenceKeys.add(key)
    }
  }
  return requiredEvidence.every((key) => evidenceKeys.has(key))
}

function actorHasApprovalRole(
  db: DatabaseHandle,
  tenantId: string,
  processId: string,
  actorRef: string,
  roleType: RoleType,
): boolean {
  const row = db.prepare(
    `SELECT 1
       FROM assignments
      WHERE tenant_id = ?
        AND process_id = ?
        AND identity_id = ?
        AND role_type = ?
        AND unassigned_at IS NULL
      LIMIT 1`,
  ).get(tenantId, processId, actorRef, roleType)
  return Boolean(row)
}

export function evaluateCal(
  db: DatabaseHandle,
  item: WorkItem,
  trigger: PrrTrigger,
  actorRef: string,
  definition: CalDefinition,
): GateDecision {
  const gate = definition.gates?.[trigger]

  if (!gate) {
    if (trigger === 'route' || trigger === 'close') {
      return {
        ok: false,
        code: 'authority_failure',
        reason: `no CAL gate configured for trigger '${trigger}'`,
      }
    }
    return { ok: true }
  }

  const action = gate.action ?? actionForTrigger(trigger)
  if (!can(db, actorRef, action, item.process_id, item.tenant_id)) {
    return {
      ok: false,
      code: 'authority_failure',
      reason: `actor '${actorRef}' lacks ${action} authority for '${trigger}'`,
    }
  }

  if (gate.approvalRole && !actorHasApprovalRole(db, item.tenant_id, item.process_id, actorRef, gate.approvalRole)) {
    return {
      ok: false,
      code: 'authority_failure',
      reason: `actor '${actorRef}' does not hold required approval role '${gate.approvalRole}'`,
    }
  }

  if (gate.requiredEvidence?.length && !hasEvidence(item, gate.requiredEvidence)) {
    return {
      ok: false,
      code: 'missing_evidence',
      reason: `missing required evidence: ${gate.requiredEvidence.join(', ')}`,
    }
  }

  return { ok: true }
}

export function createCalEvaluator(definition: CalDefinition) {
  return (db: DatabaseHandle, item: WorkItem, trigger: PrrTrigger, actorRef: string): GateDecision =>
    evaluateCal(db, item, trigger, actorRef, definition)
}
