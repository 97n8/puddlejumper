import type { DatabaseHandle } from '@pj/db'
import type { GateDecision, WorkItem } from './workItems.js'
import type { PrrTrigger } from './prrMachine.js'

type HoldKind = 'scheduled' | 'locked' | 'derived' | 'advisory'

interface PlannedResource {
  resourceRef: string
  holdKind: HoldKind
  startsAt: string | null
  endsAt: string | null
}

type HoldRow = {
  hold_id: string
  work_item_id: string | null
  hold_kind: HoldKind
  resource_ref: string | null
  starts_at: string | null
  ends_at: string | null
  status: 'held' | 'released' | 'expired'
}

export interface PrmOptions {
  now?: () => Date
}

function asIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value
}

function parsePlannedResources(item: WorkItem): PlannedResource[] {
  const planned: PlannedResource[] = []
  for (const entry of item.resources) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const resourceRef = record.resource_ref ?? record.resourceRef
    if (typeof resourceRef !== 'string' || !resourceRef.trim()) continue
    const holdKind = record.hold_kind ?? record.holdKind ?? record.kind
    planned.push({
      resourceRef: resourceRef.trim(),
      holdKind:
        holdKind === 'locked' ||
        holdKind === 'derived' ||
        holdKind === 'advisory'
          ? holdKind
          : 'scheduled',
      startsAt: asIsoTimestamp(record.starts_at ?? record.startsAt),
      endsAt: asIsoTimestamp(record.ends_at ?? record.endsAt),
    })
  }
  return planned
}

function overlaps(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): boolean {
  return leftStart < rightEnd && rightStart < leftEnd
}

function findLiveHoldsForResource(
  db: DatabaseHandle,
  item: WorkItem,
  resourceRef: string,
): HoldRow[] {
  return db.prepare(
    `SELECT hold_id, work_item_id, hold_kind, resource_ref, starts_at, ends_at, status
       FROM holds
      WHERE tenant_id = ?
        AND status = 'held'
        AND resource_ref = ?
        AND (work_item_id IS NULL OR work_item_id != ?)`,
  ).all(item.tenant_id, resourceRef, item.work_item_id) as HoldRow[]
}

function liveHoldCountForWorkItem(db: DatabaseHandle, item: WorkItem): number {
  const row = db.prepare(
    `SELECT COUNT(*) AS count
       FROM holds
      WHERE tenant_id = ?
        AND work_item_id = ?
        AND status = 'held'`,
  ).get(item.tenant_id, item.work_item_id) as { count: number }
  return row.count
}

function detectOvercapacity(
  db: DatabaseHandle,
  item: WorkItem,
  planned: PlannedResource[],
): GateDecision | null {
  for (const resource of planned) {
    const liveHolds = findLiveHoldsForResource(db, item, resource.resourceRef)

    if (resource.holdKind === 'locked') {
      if (liveHolds.some((hold) => hold.hold_kind === 'locked')) {
        return {
          ok: false,
          code: 'overcapacity',
          reason: `locked resource '${resource.resourceRef}' is already held`,
        }
      }
      continue
    }

    if (!resource.startsAt || !resource.endsAt) continue

    const collision = liveHolds.find((hold) => {
      if (!hold.starts_at || !hold.ends_at) return false
      return overlaps(resource.startsAt!, resource.endsAt!, hold.starts_at, hold.ends_at)
    })

    if (collision) {
      return {
        ok: false,
        code: 'overcapacity',
        reason: `resource '${resource.resourceRef}' already has an overlapping hold`,
      }
    }
  }

  return null
}

function detectPastNeededBy(item: WorkItem, planned: PlannedResource[]): GateDecision | null {
  if (!item.needed_by) return null
  const violating = planned.find((resource) => resource.endsAt && resource.endsAt > item.needed_by!)
  if (!violating) return null
  return {
    ok: false,
    code: 'past_needed_by',
    reason: `planned hold on '${violating.resourceRef}' ends after needed_by`,
  }
}

function detectUnassignedPastWindow(
  db: DatabaseHandle,
  item: WorkItem,
  planned: PlannedResource[],
  now: Date,
): GateDecision | null {
  const earliestPlannedStart = planned
    .map((resource) => resource.startsAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0]

  if (!earliestPlannedStart) return null
  if (liveHoldCountForWorkItem(db, item) > 0) return null
  if (earliestPlannedStart >= now.toISOString()) return null

  return {
    ok: false,
    code: 'unassigned_past_window',
    reason: `planned hold window opened at '${earliestPlannedStart}' without a live hold`,
  }
}

export function evaluatePrm(
  db: DatabaseHandle,
  item: WorkItem,
  _trigger: PrrTrigger,
  _actorRef: string,
  opts: PrmOptions = {},
): GateDecision {
  const planned = parsePlannedResources(item)
  if (planned.length === 0) return { ok: true }

  const overcapacity = detectOvercapacity(db, item, planned)
  if (overcapacity) return overcapacity

  const pastNeededBy = detectPastNeededBy(item, planned)
  if (pastNeededBy) return pastNeededBy

  const unassignedPastWindow = detectUnassignedPastWindow(db, item, planned, opts.now?.() ?? new Date())
  if (unassignedPastWindow) return unassignedPastWindow

  return { ok: true }
}

export function createPrmEvaluator(opts: PrmOptions = {}) {
  return (db: DatabaseHandle, item: WorkItem, trigger: PrrTrigger, actorRef: string): GateDecision =>
    evaluatePrm(db, item, trigger, actorRef, opts)
}
