import type { VercelRequest } from '@vercel/node'
import type Database from 'better-sqlite3'
import {
  type CreateLogicOSRecordInput,
  type LogicOSAuditEvent,
  type LogicOSAuditEventType,
  type LogicOSListRecordsFilters,
  type LogicOSRecord,
  type PatchLogicOSRecordInput,
} from './schema'
import { selectLogicOSRoute } from './router'
import { executeLogicOSConnector, type LogicOSConnectorContext, type LogicOSConnectorSuccess } from './connectors'
import { getLogicOSDatabase } from './sqlite'

type LogicOSActor = {
  actorId: string | null
  source: string
  ip: string | null
  userAgent: string | null
}

type MutationContext = {
  db?: Database.Database
  now?: Date
  actor?: LogicOSActor
  connectorContext?: LogicOSConnectorContext
  connectorExecutor?: (
    record: LogicOSRecord,
    route: ReturnType<typeof selectLogicOSRoute>,
    context: LogicOSConnectorContext,
  ) => Promise<LogicOSConnectorSuccess>
}

export type StoredRecordBundle = {
  record: LogicOSRecord
  audit: LogicOSAuditEvent[]
}

function iso(now: Date) {
  return now.toISOString()
}

function normalizeOptional(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

type RecordRow = {
  id: string
  area: LogicOSRecord['area']
  sequence_year: number
  sequence_number: number
  title: string
  status: LogicOSRecord['status']
  created_by_actor_id: string | null
  owner_actor_id: string | null
  collaborator_actor_id: string | null
  owner_label: string | null
  collaborator_label: string | null
  home_provider: LogicOSRecord['home']
  destination_provider: LogicOSRecord['destination']
  connector_mode: LogicOSRecord['connectorMode']
  primary_link: string | null
  google_link: string | null
  m365_link: string | null
  github_link: string | null
  next_action: string | null
  due_date: string | null
  notes: string | null
  source: string
  google_parent_id: string | null
  routing_state: LogicOSRecord['routingState']
  connector_state: LogicOSRecord['connectorState']
  last_error: string | null
  external_ref: string | null
  created_at: string
  updated_at: string
}

type AuditRow = {
  id: string
  recordId: string,
  event_type: LogicOSAuditEvent['type']
  actor_id: string | null
  actor_source: string
  actor_ip: string | null
  actor_user_agent: string | null
  detail_json: string | null
  created_at: string
}

function mapRecordRow(row: RecordRow): LogicOSRecord {
  return {
    id: row.id,
    area: row.area,
    title: row.title,
    status: row.status,
    createdByActorId: row.created_by_actor_id,
    ownerActorId: row.owner_actor_id,
    collaboratorActorId: row.collaborator_actor_id,
    owner: row.owner_label,
    collaborator: row.collaborator_label,
    home: row.home_provider,
    destination: row.destination_provider,
    connectorMode: row.connector_mode,
    primaryLink: row.primary_link,
    googleLink: row.google_link,
    m365Link: row.m365_link,
    githubLink: row.github_link,
    nextAction: row.next_action,
    dueDate: row.due_date,
    notes: row.notes,
    source: row.source,
    googleParentId: row.google_parent_id,
    routingState: row.routing_state,
    connectorState: row.connector_state,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAuditRow(row: AuditRow): LogicOSAuditEvent {
  return {
    id: row.id,
    recordId: row.recordId,
    type: row.event_type,
    at: row.created_at,
    actor: {
      actorId: row.actor_id,
      source: row.actor_source,
      ip: row.actor_ip,
      userAgent: row.actor_user_agent,
    },
    detail: row.detail_json ? JSON.parse(row.detail_json) as Record<string, unknown> : null,
  }
}

function upsertRecord(db: Database.Database, record: LogicOSRecord, sequenceYear: number, sequenceNumber: number, externalRef: string | null = null) {
  db.prepare(`
    INSERT INTO logicos_records (
      id,
      area,
      sequence_year,
      sequence_number,
      title,
      status,
      created_by_actor_id,
      owner_actor_id,
      collaborator_actor_id,
      owner_label,
      collaborator_label,
      home_provider,
      destination_provider,
      connector_mode,
      primary_link,
      google_link,
      m365_link,
      github_link,
      next_action,
      due_date,
      notes,
      source,
      google_parent_id,
      routing_state,
      connector_state,
      last_error,
      external_ref,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @area,
      @sequence_year,
      @sequence_number,
      @title,
      @status,
      @created_by_actor_id,
      @owner_actor_id,
      @collaborator_actor_id,
      @owner_label,
      @collaborator_label,
      @home_provider,
      @destination_provider,
      @connector_mode,
      @primary_link,
      @google_link,
      @m365_link,
      @github_link,
      @next_action,
      @due_date,
      @notes,
      @source,
      @google_parent_id,
      @routing_state,
      @connector_state,
      @last_error,
      @external_ref,
      @created_at,
      @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      status = excluded.status,
      owner_actor_id = excluded.owner_actor_id,
      collaborator_actor_id = excluded.collaborator_actor_id,
      owner_label = excluded.owner_label,
      collaborator_label = excluded.collaborator_label,
      home_provider = excluded.home_provider,
      destination_provider = excluded.destination_provider,
      connector_mode = excluded.connector_mode,
      primary_link = excluded.primary_link,
      google_link = excluded.google_link,
      m365_link = excluded.m365_link,
      github_link = excluded.github_link,
      next_action = excluded.next_action,
      due_date = excluded.due_date,
      notes = excluded.notes,
      source = excluded.source,
      google_parent_id = excluded.google_parent_id,
      routing_state = excluded.routing_state,
      connector_state = excluded.connector_state,
      last_error = excluded.last_error,
      external_ref = excluded.external_ref,
      updated_at = excluded.updated_at
  `).run({
    id: record.id,
    area: record.area,
    sequence_year: sequenceYear,
    sequence_number: sequenceNumber,
    title: record.title,
    status: record.status,
    created_by_actor_id: record.createdByActorId,
    owner_actor_id: record.ownerActorId,
    collaborator_actor_id: record.collaboratorActorId,
    owner_label: record.owner,
    collaborator_label: record.collaborator,
    home_provider: record.home,
    destination_provider: record.destination,
    connector_mode: record.connectorMode,
    primary_link: record.primaryLink,
    google_link: record.googleLink,
    m365_link: record.m365Link,
    github_link: record.githubLink,
    next_action: record.nextAction,
    due_date: record.dueDate,
    notes: record.notes,
    source: record.source,
    google_parent_id: record.googleParentId,
    routing_state: record.routingState,
    connector_state: record.connectorState,
    last_error: record.lastError,
    external_ref: externalRef,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  })
}

function insertAuditEvent(
  db: Database.Database,
  recordId: string,
  type: LogicOSAuditEventType,
  actor: LogicOSActor,
  detail: Record<string, unknown> | null,
  now: Date,
) {
  const eventId = crypto.randomUUID()
  db.prepare(`
    INSERT INTO audit_events (
      id,
      record_id,
      event_type,
      actor_id,
      actor_source,
      actor_ip,
      actor_user_agent,
      detail_json,
      created_at
    ) VALUES (
      @id,
      @record_id,
      @event_type,
      @actor_id,
      @actor_source,
      @actor_ip,
      @actor_user_agent,
      @detail_json,
      @created_at
    )
  `).run({
    id: eventId,
    record_id: recordId,
    event_type: type,
    actor_id: actor.actorId,
    actor_source: actor.source,
    actor_ip: actor.ip,
    actor_user_agent: actor.userAgent,
    detail_json: detail ? JSON.stringify(detail) : null,
    created_at: iso(now),
  })
  return eventId
}

function nextSequence(db: Database.Database, area: LogicOSRecord['area'], year: number) {
  const select = db.prepare<[{ area: string; sequence_year: number }], { last_value: number }>(`
    SELECT last_value
    FROM id_sequence
    WHERE area = @area AND sequence_year = @sequence_year
  `)
  const existing = select.get({ area, sequence_year: year })
  const value = (existing?.last_value ?? 0) + 1
  db.prepare(`
    INSERT INTO id_sequence (area, sequence_year, last_value)
    VALUES (@area, @sequence_year, @last_value)
    ON CONFLICT(area, sequence_year) DO UPDATE SET last_value = excluded.last_value
  `).run({
    area,
    sequence_year: year,
    last_value: value,
  })
  return value
}

function loadAuditEvents(db: Database.Database, recordId: string) {
  const rows = db.prepare<[{ record_id: string }], AuditRow>(`
    SELECT
      id,
      record_id as recordId,
      event_type,
      actor_id,
      actor_source,
      actor_ip,
      actor_user_agent,
      detail_json,
      created_at
    FROM audit_events
    WHERE record_id = @record_id
    ORDER BY rowid ASC
  `).all({ record_id: recordId })
  return rows.map(mapAuditRow)
}

function loadRecordRow(db: Database.Database, id: string) {
  return db.prepare<[{ id: string }], RecordRow>(`
    SELECT
      id,
      area,
      sequence_year,
      sequence_number,
      title,
      status,
      created_by_actor_id,
      owner_actor_id,
      collaborator_actor_id,
      owner_label,
      collaborator_label,
      home_provider,
      destination_provider,
      connector_mode,
      primary_link,
      google_link,
      m365_link,
      github_link,
      next_action,
      due_date,
      notes,
      source,
      google_parent_id,
      routing_state,
      connector_state,
      last_error,
      external_ref,
      created_at,
      updated_at
    FROM logicos_records
    WHERE id = @id
  `).get({ id })
}

function appendAuditEvent(
  db: Database.Database,
  recordId: string,
  type: LogicOSAuditEventType,
  actor: LogicOSActor,
  detail: Record<string, unknown> | null,
  now: Date,
) {
  insertAuditEvent(db, recordId, type, actor, detail, now)
}

function parseSequenceFromId(id: string) {
  const match = id.match(/^([A-Z]+)-(\d{4})-(\d+)$/)
  if (!match) {
    throw new Error(`Invalid LogicOS record id: ${id}`)
  }
  return {
    year: Number(match[2]),
    number: Number(match[3]),
  }
}

function bundleForRecord(db: Database.Database, record: LogicOSRecord): StoredRecordBundle {
  return {
    record,
    audit: loadAuditEvents(db, record.id),
  }
}

async function executeRouteLifecycle(
  db: Database.Database,
  record: LogicOSRecord,
  sequenceYear: number,
  sequenceNumber: number,
  actor: LogicOSActor,
  now: Date,
  connectorContext: LogicOSConnectorContext,
  connectorExecutor: MutationContext['connectorExecutor'],
) {
  const route = selectLogicOSRoute({ area: record.area, home: record.home }, db)

  record.destination = route.provider
  record.home = route.home
  record.connectorMode = route.connectorMode
  record.routingState = route.connectorMode === 'placeholder' ? 'placeholder' : 'selected'
  record.connectorState = route.connectorMode === 'placeholder' ? 'placeholder' : 'idle'
  record.lastError = null
  record.updatedAt = iso(now)

  upsertRecord(db, record, sequenceYear, sequenceNumber)
  appendAuditEvent(db, record.id, 'route_selected', actor, {
    area: record.area,
    provider: route.provider,
    connectorMode: route.connectorMode,
    reason: route.reason,
  }, now)

  if (route.connectorMode === 'placeholder') {
    return record
  }

  record.connectorState = 'started'
  record.updatedAt = iso(now)
  upsertRecord(db, record, sequenceYear, sequenceNumber)
  appendAuditEvent(db, record.id, 'connector_started', actor, {
    provider: route.provider,
    connectorMode: route.connectorMode,
  }, now)

  try {
    const result = await (connectorExecutor ?? executeLogicOSConnector)(record, route, connectorContext)
    record.primaryLink = result.primaryLink
    record.googleLink = result.googleLink ?? record.googleLink
    record.m365Link = result.m365Link ?? record.m365Link
    record.githubLink = result.githubLink ?? record.githubLink
    record.connectorState = 'completed'
    record.routingState = 'completed'
    record.lastError = null
    record.updatedAt = iso(now)
    upsertRecord(db, record, sequenceYear, sequenceNumber, result.externalId ?? null)
    appendAuditEvent(db, record.id, 'connector_completed', actor, {
      provider: result.provider,
      primaryLink: result.primaryLink,
      externalId: result.externalId ?? null,
    }, now)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connector error'
    record.connectorState = 'failed'
    record.routingState = 'failed'
    record.lastError = message
    record.updatedAt = iso(now)
    upsertRecord(db, record, sequenceYear, sequenceNumber)
    appendAuditEvent(db, record.id, 'connector_failed', actor, {
      provider: route.provider,
      message,
    }, now)
  }

  return record
}

function actorFallback(actor?: LogicOSActor): LogicOSActor {
  return actor ?? {
    actorId: null,
    source: 'logicos_api',
    ip: null,
    userAgent: null,
  }
}

export function getLogicOSActorFromRequest(req: VercelRequest, defaultSource: string): LogicOSActor {
  const forwardedFor = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0]?.trim() || null
    : null
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null
  const actorId = typeof req.headers['x-logicos-actor-id'] === 'string' ? req.headers['x-logicos-actor-id'].trim() || null : null
  return {
    actorId,
    source: defaultSource,
    ip: forwardedFor,
    userAgent,
  }
}

export function getLogicOSConnectorContextFromRequest(req: VercelRequest): LogicOSConnectorContext {
  return {
    cookieHeader: typeof req.headers.cookie === 'string' ? req.headers.cookie : null,
  }
}

export async function createLogicOSRecord(input: CreateLogicOSRecordInput, context: MutationContext = {}) {
  const db = context.db ?? getLogicOSDatabase()
  const now = context.now ?? new Date()
  const actor = actorFallback(context.actor)
  const createdAt = iso(now)
  const year = now.getUTCFullYear()

  const sequenceNumber = db.transaction(() => nextSequence(db, input.area, year))()
  const id = `${input.area}-${year}-${String(sequenceNumber).padStart(3, '0')}`
  const initialRoute = selectLogicOSRoute({ area: input.area, home: input.home ?? null }, db)

  const record: LogicOSRecord = {
    id,
    title: input.title,
    area: input.area,
    status: input.status ?? 'active',
    createdByActorId: input.createdByActorId ?? actor.actorId,
    ownerActorId: normalizeOptional(input.ownerActorId) ?? null,
    collaboratorActorId: normalizeOptional(input.collaboratorActorId) ?? null,
    owner: normalizeOptional(input.owner),
    collaborator: normalizeOptional(input.collaborator),
    home: input.home ?? null,
    destination: initialRoute.provider,
    connectorMode: initialRoute.connectorMode,
    primaryLink: null,
    googleLink: null,
    m365Link: null,
    githubLink: null,
    nextAction: normalizeOptional(input.nextAction),
    dueDate: normalizeOptional(input.dueDate),
    notes: normalizeOptional(input.notes),
    source: input.source ?? actor.source,
    googleParentId: normalizeOptional(input.googleParentId),
    routingState: 'pending',
    connectorState: 'idle',
    lastError: null,
    createdAt,
    updatedAt: createdAt,
  }

  upsertRecord(db, record, year, sequenceNumber)
  appendAuditEvent(db, record.id, 'record_created', actor, {
    area: record.area,
    source: record.source,
    destination: record.destination,
  }, now)

  const hydrated = await executeRouteLifecycle(
    db,
    record,
    year,
    sequenceNumber,
    actor,
    now,
    context.connectorContext ?? {},
    context.connectorExecutor,
  )

  return bundleForRecord(db, hydrated)
}

export async function listLogicOSRecords(filters: LogicOSListRecordsFilters = {}, db: Database.Database = getLogicOSDatabase()) {
  const clauses = ['1 = 1']
  const params: Record<string, unknown> = {}
  if (filters.area) {
    clauses.push('area = @area')
    params.area = filters.area
  }
  if (filters.status) {
    clauses.push('status = @status')
    params.status = filters.status
  }
  if (filters.destination) {
    clauses.push('destination_provider = @destination')
    params.destination = filters.destination
  }
  if (filters.source) {
    clauses.push('source = @source')
    params.source = filters.source
  }

  const rows = db.prepare<Record<string, unknown>, RecordRow>(`
    SELECT
      id,
      area,
      sequence_year,
      sequence_number,
      title,
      status,
      created_by_actor_id,
      owner_actor_id,
      collaborator_actor_id,
      owner_label,
      collaborator_label,
      home_provider,
      destination_provider,
      connector_mode,
      primary_link,
      google_link,
      m365_link,
      github_link,
      next_action,
      due_date,
      notes,
      source,
      google_parent_id,
      routing_state,
      connector_state,
      last_error,
      external_ref,
      created_at,
      updated_at
    FROM logicos_records
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC, id DESC
  `).all(params)

  return rows.map(mapRecordRow)
}

export async function getLogicOSRecord(id: string, db: Database.Database = getLogicOSDatabase()) {
  const row = loadRecordRow(db, id)
  if (!row) return null
  return bundleForRecord(db, mapRecordRow(row))
}

export async function patchLogicOSRecord(id: string, patch: PatchLogicOSRecordInput, context: MutationContext = {}) {
  const db = context.db ?? getLogicOSDatabase()
  const now = context.now ?? new Date()
  const actor = actorFallback(context.actor)
  const currentRow = loadRecordRow(db, id)
  if (!currentRow) return null
  const current = mapRecordRow(currentRow)
  const { year, number } = parseSequenceFromId(id)

  const next: LogicOSRecord = {
    ...current,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.area !== undefined ? { area: patch.area } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.ownerActorId !== undefined ? { ownerActorId: normalizeOptional(patch.ownerActorId) } : {}),
    ...(patch.collaboratorActorId !== undefined ? { collaboratorActorId: normalizeOptional(patch.collaboratorActorId) } : {}),
    ...(patch.owner !== undefined ? { owner: normalizeOptional(patch.owner) } : {}),
    ...(patch.collaborator !== undefined ? { collaborator: normalizeOptional(patch.collaborator) } : {}),
    ...(patch.home !== undefined ? { home: patch.home } : {}),
    ...(patch.nextAction !== undefined ? { nextAction: normalizeOptional(patch.nextAction) } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: normalizeOptional(patch.dueDate) } : {}),
    ...(patch.notes !== undefined ? { notes: normalizeOptional(patch.notes) } : {}),
    ...(patch.source !== undefined ? { source: patch.source } : {}),
    ...(patch.googleParentId !== undefined ? { googleParentId: normalizeOptional(patch.googleParentId) } : {}),
    updatedAt: iso(now),
  }

  const routingInputsChanged =
    patch.area !== undefined ||
    patch.home !== undefined ||
    patch.googleParentId !== undefined

  upsertRecord(db, next, year, number, currentRow.external_ref)

  if (!routingInputsChanged) {
    return bundleForRecord(db, next)
  }

  const reroutable: LogicOSRecord = { ...next }

  const route = selectLogicOSRoute({ area: reroutable.area, home: reroutable.home }, db)
  const needsGoogleRun = route.connectorMode === 'google-folder'
    && !reroutable.googleLink

  if (!needsGoogleRun) {
    reroutable.destination = route.provider
    reroutable.home = route.home
    reroutable.connectorMode = route.connectorMode
    reroutable.routingState = route.connectorMode === 'placeholder' ? 'placeholder' : reroutable.routingState
    reroutable.connectorState = route.connectorMode === 'placeholder' ? 'placeholder' : reroutable.connectorState
    reroutable.updatedAt = iso(now)
    upsertRecord(db, reroutable, year, number, currentRow.external_ref)
    appendAuditEvent(db, reroutable.id, 'route_selected', actor, {
      area: reroutable.area,
      provider: route.provider,
      connectorMode: route.connectorMode,
      reason: route.reason,
      rerouted: true,
    }, now)
    return bundleForRecord(db, reroutable)
  }

  const executed = await executeRouteLifecycle(
    db,
    reroutable,
    year,
    number,
    actor,
    now,
    context.connectorContext ?? {},
    context.connectorExecutor,
  )
  return bundleForRecord(db, executed)
}
