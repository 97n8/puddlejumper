import crypto from 'node:crypto'
import type { DatabaseHandle } from '@pj/db'
import type { WorkItem } from './workItems.js'

type AuditEventRow = {
  event_id: string
  event_family: string
  event_subtype: string
  canon_version: string
  deployment_id: string
  tenant_id: string
  process_id: string | null
  actor_ref: string | null
  occurred_at: string
  inserted_at: string
  payload_json: string
  payload_hash: string
  prior_event_id: string | null
}

type SealRow = {
  seal_sequence: number
  seal_id: string
  tenant_id: string
  work_item_id: string | null
  process_id: string | null
  from_event_id: string
  to_event_id: string
  event_count: number
  manifest_json: string
  seal_hash: string
  prev_seal_hash: string | null
  created_by_ref: string
  created_at: string
}

export interface ArchieveProof {
  key: string
  ref: string | null
  hash: string | null
}

export interface ArchieveManifest {
  what: Record<string, unknown>
  who: string[]
  when: {
    first_event_at: string
    last_event_at: string
    sealed_at: string
  }
  proof: ArchieveProof[]
  changed: Array<{
    event_id: string
    trigger: string | null
    from: string | null
    to: string | null
    occurred_at: string
  }>
}

export interface ArchieveSeal {
  seal_id: string
  work_item_id: string
  event_range: {
    first_event_id: string
    last_event_id: string
  }
  content_hash: string
  manifest: ArchieveManifest
  sealed_at: string
  sealed_by: string
  prev_seal_hash: string | null
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T
}

function getWorkItemRow(db: DatabaseHandle, tenantId: string, workItemId: string): WorkItem {
  const row = db.prepare(
    `SELECT
       work_item_id,
       tenant_id,
       casespace_ref,
       process_id,
       parent_work_item_id,
       runtime_key,
       ops_preset,
       skin_key,
       status,
       subject_ref,
       owner_identity_id,
       default_pool,
       needed_by,
       blocked_reason,
       decision_required,
       fields_json,
       links_json,
       resources_json,
       evidence_json,
       skin_snapshot_json,
       created_at,
       updated_at,
       archived_at
     FROM work_items
     WHERE tenant_id = ? AND work_item_id = ?`,
  ).get(tenantId, workItemId) as
    | (Omit<WorkItem, 'decision_required' | 'fields' | 'links' | 'resources' | 'evidence' | 'skin_snapshot'> & {
        decision_required: 0 | 1
        fields_json: string
        links_json: string
        resources_json: string
        evidence_json: string
        skin_snapshot_json: string
      })
    | undefined

  if (!row) {
    throw new Error(`Work item '${workItemId}' not found in tenant '${tenantId}'`)
  }

  return {
    ...row,
    decision_required: row.decision_required === 1,
    fields: parseJson<Record<string, unknown>>(row.fields_json),
    links: parseJson<unknown[]>(row.links_json),
    resources: parseJson<unknown[]>(row.resources_json),
    evidence: parseJson<unknown[]>(row.evidence_json),
    skin_snapshot: parseJson<Record<string, unknown>>(row.skin_snapshot_json),
  }
}

function loadWorkItemEvents(db: DatabaseHandle, item: WorkItem): AuditEventRow[] {
  return db.prepare(
    `SELECT *
       FROM audit_events
      WHERE tenant_id = ? AND process_id = ?
      ORDER BY occurred_at ASC, inserted_at ASC, event_id ASC`,
  ).all(item.tenant_id, item.process_id) as AuditEventRow[]
}

function computeEventRangeContentHash(events: AuditEventRow[]): string {
  const normalized = events.map((event) => ({
    event_id: event.event_id,
    event_family: event.event_family,
    event_subtype: event.event_subtype,
    canon_version: event.canon_version,
    deployment_id: event.deployment_id,
    tenant_id: event.tenant_id,
    process_id: event.process_id,
    actor_ref: event.actor_ref,
    occurred_at: event.occurred_at,
    inserted_at: event.inserted_at,
    payload_json: event.payload_json,
    payload_hash: event.payload_hash,
    prior_event_id: event.prior_event_id,
  }))
  return sha256(canonicalJson(normalized))
}

function requiredCloseEvidence(item: WorkItem): string[] {
  const skinSnapshot = item.skin_snapshot as Record<string, unknown>
  const cal = skinSnapshot.cal as Record<string, unknown> | undefined
  const gates = cal?.gates as Record<string, unknown> | undefined
  const closeGate = gates?.close as Record<string, unknown> | undefined
  const required = closeGate?.requiredEvidence
  if (!Array.isArray(required)) return []
  return required.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function deriveProof(item: WorkItem): ArchieveProof[] {
  const required = new Set(requiredCloseEvidence(item))
  if (required.size === 0) return []

  const proof: ArchieveProof[] = []
  for (const entry of item.evidence) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const key = record.key ?? record.type ?? record.id
    if (typeof key !== 'string' || !required.has(key)) continue
    proof.push({
      key,
      ref: typeof record.ref === 'string' ? record.ref : null,
      hash: typeof record.hash === 'string' ? record.hash : null,
    })
  }
  return proof
}

function deriveManifest(item: WorkItem, events: AuditEventRow[], sealedAt: string): ArchieveManifest {
  const changed = events
    .filter((event) => event.event_family === 'transition')
    .map((event) => {
      const payload = parseJson<Record<string, unknown>>(event.payload_json)
      return {
        event_id: event.event_id,
        trigger: typeof payload.trigger === 'string' ? payload.trigger : null,
        from: typeof payload.from === 'string' ? payload.from : null,
        to: typeof payload.to === 'string' ? payload.to : null,
        occurred_at: event.occurred_at,
      }
    })

  return {
    what: {
      work_item_id: item.work_item_id,
      process_id: item.process_id,
      runtime_key: item.runtime_key,
      ops_preset: item.ops_preset,
      skin_key: item.skin_key,
      casespace_ref: item.casespace_ref,
      subject_ref: item.subject_ref,
    },
    who: Array.from(new Set(events.map((event) => event.actor_ref).filter((value): value is string => Boolean(value)))),
    when: {
      first_event_at: events[0]!.occurred_at,
      last_event_at: events[events.length - 1]!.occurred_at,
      sealed_at: sealedAt,
    },
    proof: deriveProof(item),
    changed,
  }
}

function latestSealHash(db: DatabaseHandle, tenantId: string): string | null {
  const row = db.prepare(
    `SELECT seal_hash
       FROM seals
      WHERE tenant_id = ?
      ORDER BY seal_sequence DESC
      LIMIT 1`,
  ).get(tenantId) as { seal_hash: string } | undefined
  return row?.seal_hash ?? null
}

function rowToArchieveSeal(row: SealRow): ArchieveSeal {
  return {
    seal_id: row.seal_id,
    work_item_id: row.work_item_id!,
    event_range: {
      first_event_id: row.from_event_id,
      last_event_id: row.to_event_id,
    },
    content_hash: row.seal_hash,
    manifest: parseJson<ArchieveManifest>(row.manifest_json),
    sealed_at: row.created_at,
    sealed_by: row.created_by_ref,
    prev_seal_hash: row.prev_seal_hash,
  }
}

export function archieveWorkItem(
  db: DatabaseHandle,
  tenantId: string,
  workItemId: string,
  sealedBy: string,
): ArchieveSeal {
  const sealedAt = new Date().toISOString()
  let result: ArchieveSeal | null = null

  db.transaction(() => {
    const item = getWorkItemRow(db, tenantId, workItemId)
    if (item.status !== 'closed') {
      throw new Error(`ARCHIEVE requires closed work item status, got '${item.status}'`)
    }

    const events = loadWorkItemEvents(db, item)
    if (events.length === 0) {
      throw new Error(`No audit events found for work item '${workItemId}'`)
    }

    const sealId = crypto.randomUUID()
    const contentHash = computeEventRangeContentHash(events)
    const manifest = deriveManifest(item, events, sealedAt)
    const prevSealHash = latestSealHash(db, tenantId)

    db.prepare(
      `INSERT INTO seals (
         seal_id, tenant_id, work_item_id, process_id, from_event_id, to_event_id,
         event_count, manifest_json, seal_hash, prev_seal_hash, created_by_ref, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sealId,
      tenantId,
      item.work_item_id,
      item.process_id,
      events[0]!.event_id,
      events[events.length - 1]!.event_id,
      events.length,
      canonicalJson(manifest),
      contentHash,
      prevSealHash,
      sealedBy,
      sealedAt,
    )

    db.prepare(
      `UPDATE work_items
          SET status = 'archived',
              archived_at = ?,
              updated_at = ?,
              blocked_reason = NULL,
              decision_required = 0
        WHERE tenant_id = ? AND work_item_id = ?`,
    ).run(sealedAt, sealedAt, tenantId, workItemId)

    db.prepare(
      `UPDATE processes
          SET current_state = 'archived'
        WHERE tenant_id = ? AND process_id = ?`,
    ).run(tenantId, item.process_id)

    db.prepare(
      `UPDATE holds
          SET status = 'released',
              released_at = ?
        WHERE tenant_id = ? AND work_item_id = ? AND status = 'held'`,
    ).run(sealedAt, tenantId, workItemId)

    const sealRow = db.prepare(
      `SELECT *
         FROM seals
        WHERE seal_id = ?`,
    ).get(sealId) as SealRow

    result = rowToArchieveSeal(sealRow)
  })()

  return result!
}

export function getArchieveSeal(
  db: DatabaseHandle,
  sealId: string,
): ArchieveSeal | null {
  const row = db.prepare(`SELECT * FROM seals WHERE seal_id = ?`).get(sealId) as SealRow | undefined
  return row ? rowToArchieveSeal(row) : null
}

export function loadArchieveSealEvents(
  db: DatabaseHandle,
  sealId: string,
): AuditEventRow[] {
  const row = db.prepare(`SELECT process_id FROM seals WHERE seal_id = ?`).get(sealId) as { process_id: string | null } | undefined
  if (!row?.process_id) return []
  return db.prepare(
    `SELECT *
       FROM audit_events
      WHERE process_id = ?
      ORDER BY occurred_at ASC, inserted_at ASC, event_id ASC`,
  ).all(row.process_id) as AuditEventRow[]
}

export function verifyArchieveSeal(
  db: DatabaseHandle,
  sealId: string,
): boolean {
  const seal = getArchieveSeal(db, sealId)
  if (!seal) return false
  const events = loadArchieveSealEvents(db, sealId)
  if (events.length === 0) return false
  return computeEventRangeContentHash(events) === seal.content_hash
}

export function verifyArchieveContentHashForEvents(
  seal: ArchieveSeal,
  events: AuditEventRow[],
): boolean {
  return computeEventRangeContentHash(events) === seal.content_hash
}

export function verifyArchieveChain(
  db: DatabaseHandle,
  tenantId: string,
): boolean {
  const rows = db.prepare(
    `SELECT seal_hash, prev_seal_hash
       FROM seals
      WHERE tenant_id = ?
      ORDER BY seal_sequence ASC`,
  ).all(tenantId) as Array<{ seal_hash: string; prev_seal_hash: string | null }>

  let previous: string | null = null
  for (const row of rows) {
    if (row.prev_seal_hash !== previous) {
      return false
    }
    previous = row.seal_hash
  }
  return true
}
