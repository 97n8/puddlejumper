import crypto from 'node:crypto'
import type Database from 'better-sqlite3'

export type ProjectDomain = 'civic' | 'campaign' | 'client' | 'personal' | 'business' | 'compliance' | 'general'
export type ProjectGovernance = 'none' | 'light' | 'governed' | 'statutory'
export type ProjectStatus = 'active' | 'paused' | 'archived'
export type ProjectSourceKind = 'document' | 'link' | 'statute' | 'contract' | 'recording' | 'code' | 'note' | 'image'
export type ProjectFlowStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface ProjectRecord {
  id: string
  owner_id: string
  name: string
  kicker: string
  domain: ProjectDomain
  governance: ProjectGovernance
  color: string
  status: ProjectStatus
  framework_id: string | null
  tools: string[]
  connections: string[]
  ai_models: string[]
  meta: Record<string, unknown>
  pinned: boolean
  created_at: string
  updated_at: string
  last_opened_at: string | null
}

export interface ProjectSourceRecord {
  id: string
  project_id: string
  owner_id: string
  kind: ProjectSourceKind
  title: string
  reference: string
  summary: string | null
  content_hash: string | null
  size_bytes: number | null
  mime_type: string | null
  meta: Record<string, unknown>
  created_at: string
}

export interface DocketItemRecord {
  id: string
  project_id: string
  owner_id: string
  text: string
  done: boolean
  completed_at: string | null
  due_at: string | null
  priority: 'none' | 'low' | 'medium' | 'high'
  created_at: string
  updated_at: string
}

export interface CaptureRecord {
  id: string
  project_id: string | null
  owner_id: string
  text: string
  synced: boolean
  meta: Record<string, unknown>
  created_at: string
}

export interface FlowRecord {
  id: string
  project_id: string
  owner_id: string
  name: string
  framework_id: string | null
  trigger_spec: Record<string, unknown>
  scenario: Record<string, unknown>
  status: ProjectFlowStatus
  created_at: string
  updated_at: string
}

export interface FlowRunRecord {
  id: string
  flow_id: string
  project_id: string
  owner_id: string
  started_at: string
  finished_at: string | null
  status: string
  context: Record<string, unknown>
  error: string | null
}

export interface FlowStepRecord {
  id: string
  run_id: string
  step_index: number
  kind: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  decided_by: string
  actor_id: string | null
  status: string
  ts: string
}

type ProjectRow = Omit<ProjectRecord, 'tools' | 'connections' | 'ai_models' | 'meta' | 'pinned' | 'last_opened_at'> & {
  tools: string
  connections: string
  ai_models: string
  meta: string
  pinned: number
  last_opened_at: string | null
}

type SourceRow = Omit<ProjectSourceRecord, 'meta'> & { meta: string }
type DocketRow = Omit<DocketItemRecord, 'done'> & { done: number }
type CaptureRow = Omit<CaptureRecord, 'synced' | 'meta'> & { synced: number; meta: string }
type FlowRow = Omit<FlowRecord, 'trigger_spec' | 'scenario'> & { trigger_spec: string; scenario: string }
type FlowRunRow = Omit<FlowRunRecord, 'context'> & { context: string }
type FlowStepRow = Omit<FlowStepRecord, 'input' | 'output'> & { input: string; output: string }

type ProjectInput = {
  id?: string
  owner_id: string
  name: string
  kicker?: string
  domain?: ProjectDomain
  governance?: ProjectGovernance
  color?: string
  status?: ProjectStatus
  framework_id?: string | null
  tools?: string[]
  connections?: string[]
  ai_models?: string[]
  meta?: Record<string, unknown>
  pinned?: boolean
  last_opened_at?: string | null
}

type SourceInput = {
  id?: string
  project_id: string
  owner_id: string
  kind: ProjectSourceKind
  title: string
  reference?: string
  summary?: string | null
  content_hash?: string | null
  size_bytes?: number | null
  mime_type?: string | null
  meta?: Record<string, unknown>
}

type DocketInput = {
  id?: string
  project_id: string
  owner_id: string
  text: string
  due_at?: string | null
  priority?: 'none' | 'low' | 'medium' | 'high'
}

type CaptureInput = {
  id?: string
  project_id?: string | null
  owner_id: string
  text: string
  meta?: Record<string, unknown>
}

type FlowInput = {
  id?: string
  project_id: string
  owner_id: string
  name: string
  framework_id?: string | null
  trigger_spec?: Record<string, unknown>
  scenario?: Record<string, unknown>
  status?: ProjectFlowStatus
}

type FlowRunInput = {
  id?: string
  flow_id: string
  project_id: string
  owner_id: string
  started_at?: string
  finished_at?: string | null
  status: string
  context?: Record<string, unknown>
  error?: string | null
  steps: Array<{
    id?: string
    step_index: number
    kind: string
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    decided_by?: string
    actor_id?: string | null
    status: string
    ts?: string
  }>
}

type FlowRunPatch = {
  status: string
  finished_at?: string | null
  error?: string | null
  actor_id?: string | null
  review_note?: string | null
}

const PROJECT_SCHEMA = `
CREATE TABLE IF NOT EXISTS project_audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  actor_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now','utc'))
);
CREATE INDEX IF NOT EXISTS idx_project_audit_events_org_created
  ON project_audit_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_audit_events_resource
  ON project_audit_events(resource_type, resource_id, created_at DESC);
CREATE TRIGGER IF NOT EXISTS project_audit_events_no_update
  BEFORE UPDATE ON project_audit_events
  BEGIN SELECT RAISE(ABORT, 'project_audit_events is append-only'); END;
CREATE TRIGGER IF NOT EXISTS project_audit_events_no_delete
  BEFORE DELETE ON project_audit_events
  BEGIN SELECT RAISE(ABORT, 'project_audit_events is append-only'); END;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kicker TEXT NOT NULL DEFAULT 'Project',
  domain TEXT NOT NULL DEFAULT 'general'
    CHECK (domain IN ('civic','campaign','client','personal','business','compliance','general')),
  governance TEXT NOT NULL DEFAULT 'none'
    CHECK (governance IN ('none','light','governed','statutory')),
  color TEXT NOT NULL DEFAULT '#3a4350',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','archived')),
  framework_id TEXT,
  tools TEXT NOT NULL DEFAULT '["capture","docket","notes"]',
  connections TEXT NOT NULL DEFAULT '[]',
  ai_models TEXT NOT NULL DEFAULT '["claude"]',
  meta TEXT NOT NULL DEFAULT '{}',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','utc')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','utc')),
  last_opened_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_owner_updated
  ON projects(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner_status
  ON projects(owner_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('document','link','statute','contract','recording','code','note','image')),
  title TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  summary TEXT,
  content_hash TEXT,
  size_bytes INTEGER,
  mime_type TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now','utc'))
);
CREATE INDEX IF NOT EXISTS idx_project_sources_project_created
  ON project_sources(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS docket_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  due_at TEXT,
  priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none','low','medium','high')),
  created_at TEXT NOT NULL DEFAULT (datetime('now','utc')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','utc'))
);
CREATE INDEX IF NOT EXISTS idx_docket_items_project_created
  ON docket_items(project_id, done, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docket_items_owner_due
  ON docket_items(owner_id, done, due_at, created_at DESC);

CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL,
  text TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now','utc'))
);
CREATE INDEX IF NOT EXISTS idx_captures_owner_created
  ON captures(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  framework_id TEXT,
  trigger_spec TEXT NOT NULL DEFAULT '{}',
  scenario TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now','utc')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','utc'))
);
CREATE INDEX IF NOT EXISTS idx_flows_project_updated
  ON flows(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS flow_runs (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '{}',
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_started
  ON flow_runs(flow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_runs_owner_started
  ON flow_runs(owner_id, started_at DESC);

CREATE TABLE IF NOT EXISTS flow_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  kind TEXT NOT NULL,
  input TEXT NOT NULL DEFAULT '{}',
  output TEXT NOT NULL DEFAULT '{}',
  decided_by TEXT NOT NULL,
  actor_id TEXT,
  status TEXT NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flow_steps_run_index
  ON flow_steps(run_id, step_index ASC);

CREATE TRIGGER IF NOT EXISTS flow_runs_no_update
  BEFORE UPDATE ON flow_runs
  WHEN NEW.id != OLD.id
    OR NEW.flow_id != OLD.flow_id
    OR NEW.project_id != OLD.project_id
    OR NEW.owner_id != OLD.owner_id
    OR NEW.started_at != OLD.started_at
    OR NEW.context != OLD.context
  BEGIN SELECT RAISE(ABORT, 'flow_runs only allows status transitions'); END;
CREATE TRIGGER IF NOT EXISTS flow_runs_no_delete
  BEFORE DELETE ON flow_runs
  BEGIN SELECT RAISE(ABORT, 'flow_runs is append-only'); END;
CREATE TRIGGER IF NOT EXISTS flow_steps_no_update
  BEFORE UPDATE ON flow_steps
  BEGIN SELECT RAISE(ABORT, 'flow_steps is append-only'); END;
CREATE TRIGGER IF NOT EXISTS flow_steps_no_delete
  BEFORE DELETE ON flow_steps
  BEGIN SELECT RAISE(ABORT, 'flow_steps is append-only'); END;

CREATE TRIGGER IF NOT EXISTS projects_audit_insert
  AFTER INSERT ON projects
  BEGIN
    INSERT INTO project_audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (
      lower(hex(randomblob(16))),
      NEW.owner_id,
      'project.created',
      'project',
      NEW.id,
      NEW.owner_id,
      json_object('name', NEW.name, 'domain', NEW.domain, 'governance', NEW.governance, 'status', NEW.status),
      datetime('now','utc')
    );
  END;
CREATE TRIGGER IF NOT EXISTS projects_audit_update
  AFTER UPDATE ON projects
  BEGIN
    INSERT INTO project_audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (
      lower(hex(randomblob(16))),
      NEW.owner_id,
      'project.updated',
      'project',
      NEW.id,
      NEW.owner_id,
      json_object('name', NEW.name, 'domain', NEW.domain, 'governance', NEW.governance, 'status_before', OLD.status, 'status_after', NEW.status),
      datetime('now','utc')
    );
  END;

CREATE TRIGGER IF NOT EXISTS flows_audit_insert
  AFTER INSERT ON flows
  BEGIN
    INSERT INTO project_audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (
      lower(hex(randomblob(16))),
      NEW.owner_id,
      'project_flow.created',
      'flow',
      NEW.id,
      NEW.owner_id,
      json_object('project_id', NEW.project_id, 'name', NEW.name, 'framework_id', NEW.framework_id, 'status', NEW.status),
      datetime('now','utc')
    );
  END;
CREATE TRIGGER IF NOT EXISTS flows_audit_update
  AFTER UPDATE ON flows
  BEGIN
    INSERT INTO project_audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (
      lower(hex(randomblob(16))),
      NEW.owner_id,
      'project_flow.updated',
      'flow',
      NEW.id,
      NEW.owner_id,
      json_object('project_id', NEW.project_id, 'name', NEW.name, 'status_before', OLD.status, 'status_after', NEW.status),
      datetime('now','utc')
    );
  END;

CREATE TRIGGER IF NOT EXISTS captures_audit_insert
  AFTER INSERT ON captures
  BEGIN
    INSERT INTO project_audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (
      lower(hex(randomblob(16))),
      NEW.owner_id,
      'capture.created',
      'capture',
      NEW.id,
      NEW.owner_id,
      json_object('project_id', NEW.project_id, 'synced', NEW.synced),
      datetime('now','utc')
    );
  END;
CREATE TRIGGER IF NOT EXISTS captures_audit_update
  AFTER UPDATE ON captures
  BEGIN
    INSERT INTO project_audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (
      lower(hex(randomblob(16))),
      NEW.owner_id,
      'capture.updated',
      'capture',
      NEW.id,
      NEW.owner_id,
      json_object('project_id', NEW.project_id, 'synced_before', OLD.synced, 'synced_after', NEW.synced),
      datetime('now','utc')
    );
  END;
`

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function asJson(value: unknown): string {
  return JSON.stringify(value ?? {})
}

function nowIso(): string {
  return new Date().toISOString()
}

function ensureStatutory(governance: ProjectGovernance, frameworkId: string | null | undefined): void {
  if (governance === 'statutory' && !frameworkId) {
    throw new Error('framework_id is required when governance is statutory')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function listScenarioNodes(scenario: Record<string, unknown>): Array<Record<string, unknown>> {
  const nodes = scenario.nodes
  return Array.isArray(nodes) ? nodes.filter(isRecord) : []
}

function flowRequiresReview(flow: FlowRecord): boolean {
  return listScenarioNodes(flow.scenario).some((node) => {
    return node.kind === 'review_gate' || node.human_review === true || node.humanReview === true
  })
}

function reviewStepApproved(step: FlowRunInput['steps'][number]): boolean {
  if (step.kind !== 'review_gate' && step.kind !== 'human_review') {
    return false
  }
  if ((step.decided_by ?? 'human') !== 'human') {
    return false
  }
  const normalizedStatus = step.status.trim().toLowerCase()
  if (['approved', 'completed', 'passed', 'satisfied', 'succeeded'].includes(normalizedStatus)) {
    return true
  }
  if (!isRecord(step.output)) {
    return false
  }
  return step.output.approved === true
    || step.output.satisfied === true
    || step.output.review_decision === 'approved'
}

function applyFlowGovernanceGate(
  db: Database.Database,
  payload: FlowRunInput,
): { run: FlowRunInput; haltedForReview: boolean; flow: FlowRecord; project: ProjectRecord } {
  const project = getProject(db, payload.owner_id, payload.project_id)
  if (!project) {
    throw new Error('Project not found')
  }
  const flow = getFlow(db, payload.owner_id, payload.flow_id)
  if (!flow || flow.project_id !== payload.project_id) {
    throw new Error('Flow not found')
  }

  const governed = project.governance === 'governed' || project.governance === 'statutory'
  const approvedReview = payload.steps.some(reviewStepApproved)
  if (!governed || !flowRequiresReview(flow) || approvedReview) {
    return { run: payload, haltedForReview: false, flow, project }
  }

  const haltedAt = nowIso()
  const nextStepIndex = payload.steps.reduce((max, step) => Math.max(max, step.step_index), -1) + 1
  return {
    run: {
      ...payload,
      status: 'halted_for_review',
      finished_at: null,
      error: 'Awaiting human review',
      steps: [
        ...payload.steps,
        {
          step_index: nextStepIndex,
          kind: 'review_gate',
          input: {
            governance: project.governance,
            project_id: project.id,
            flow_id: flow.id,
          },
          output: {
            halted: true,
            reason: 'human_review_required',
          },
          decided_by: 'human',
          actor_id: null,
          status: 'halted_for_review',
          ts: haltedAt,
        },
      ],
    },
    haltedForReview: true,
    flow,
    project,
  }
}

function insertProjectAuditEvent(
  db: Database.Database,
  input: {
    org_id: string
    event_type: string
    resource_type: string
    resource_id: string
    actor_id?: string | null
    payload?: Record<string, unknown>
  },
): void {
  db.prepare(`
    INSERT INTO project_audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    input.org_id,
    input.event_type,
    input.resource_type,
    input.resource_id,
    input.actor_id ?? null,
    asJson(input.payload ?? {}),
    nowIso(),
  )
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    ...row,
    tools: parseJson(row.tools, []),
    connections: parseJson(row.connections, []),
    ai_models: parseJson(row.ai_models, []),
    meta: parseJson(row.meta, {}),
    pinned: row.pinned === 1,
    last_opened_at: row.last_opened_at ?? null,
  }
}

function mapSourceRow(row: SourceRow): ProjectSourceRecord {
  return { ...row, meta: parseJson(row.meta, {}) }
}

function mapDocketRow(row: DocketRow): DocketItemRecord {
  return { ...row, done: row.done === 1 }
}

function mapCaptureRow(row: CaptureRow): CaptureRecord {
  return { ...row, synced: row.synced === 1, meta: parseJson(row.meta, {}) }
}

function mapFlowRow(row: FlowRow): FlowRecord {
  return { ...row, trigger_spec: parseJson(row.trigger_spec, {}), scenario: parseJson(row.scenario, {}) }
}

function mapFlowRunRow(row: FlowRunRow): FlowRunRecord {
  return { ...row, context: parseJson(row.context, {}) }
}

function mapFlowStepRow(row: FlowStepRow): FlowStepRecord {
  return { ...row, input: parseJson(row.input, {}), output: parseJson(row.output, {}) }
}

function getProjectRow(db: Database.Database, ownerId: string, projectId: string): ProjectRow | undefined {
  return db.prepare('SELECT * FROM projects WHERE owner_id = ? AND id = ?').get(ownerId, projectId) as ProjectRow | undefined
}

export function initProjectStore(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.exec('DROP TRIGGER IF EXISTS flow_runs_no_update;')
  db.exec(PROJECT_SCHEMA)
}

export function createProject(db: Database.Database, input: ProjectInput): ProjectRecord {
  const projectId = input.id ?? crypto.randomUUID()
  const governance = input.governance ?? 'none'
  const frameworkId = input.framework_id ?? null
  ensureStatutory(governance, frameworkId)
  const createdAt = nowIso()
  db.prepare(`
    INSERT INTO projects (
      id, owner_id, name, kicker, domain, governance, color, status, framework_id,
      tools, connections, ai_models, meta, pinned, created_at, updated_at, last_opened_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    input.owner_id,
    input.name,
    input.kicker ?? 'Project',
    input.domain ?? 'general',
    governance,
    input.color ?? '#3a4350',
    input.status ?? 'active',
    frameworkId,
    asJson(input.tools ?? ['capture', 'docket', 'notes']),
    asJson(input.connections ?? []),
    asJson(input.ai_models ?? ['claude']),
    asJson(input.meta ?? {}),
    input.pinned ? 1 : 0,
    createdAt,
    createdAt,
    input.last_opened_at ?? null,
  )
  return getProject(db, input.owner_id, projectId)!
}

export function getProject(db: Database.Database, ownerId: string, projectId: string): ProjectRecord | null {
  const row = getProjectRow(db, ownerId, projectId)
  return row ? mapProjectRow(row) : null
}

export function listProjects(db: Database.Database, ownerId: string): ProjectRecord[] {
  const rows = db.prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY pinned DESC, COALESCE(last_opened_at, updated_at) DESC, created_at DESC').all(ownerId) as ProjectRow[]
  return rows.map(mapProjectRow)
}

export function updateProject(db: Database.Database, ownerId: string, projectId: string, patch: Partial<ProjectInput>): ProjectRecord | null {
  const existing = getProject(db, ownerId, projectId)
  if (!existing) return null
  const nextGovernance = patch.governance ?? existing.governance
  const nextFrameworkId = patch.framework_id === undefined ? existing.framework_id : patch.framework_id
  ensureStatutory(nextGovernance, nextFrameworkId)

  const merged: ProjectRecord = {
    ...existing,
    ...patch,
    governance: nextGovernance,
    framework_id: nextFrameworkId ?? null,
    tools: patch.tools ?? existing.tools,
    connections: patch.connections ?? existing.connections,
    ai_models: patch.ai_models ?? existing.ai_models,
    meta: patch.meta ?? existing.meta,
    pinned: patch.pinned ?? existing.pinned,
    last_opened_at: patch.last_opened_at === undefined ? existing.last_opened_at : patch.last_opened_at,
    updated_at: nowIso(),
  }

  db.prepare(`
    UPDATE projects
       SET name = ?, kicker = ?, domain = ?, governance = ?, color = ?, status = ?, framework_id = ?,
           tools = ?, connections = ?, ai_models = ?, meta = ?, pinned = ?, updated_at = ?, last_opened_at = ?
     WHERE owner_id = ? AND id = ?
  `).run(
    merged.name,
    merged.kicker,
    merged.domain,
    merged.governance,
    merged.color,
    merged.status,
    merged.framework_id,
    asJson(merged.tools),
    asJson(merged.connections),
    asJson(merged.ai_models),
    asJson(merged.meta),
    merged.pinned ? 1 : 0,
    merged.updated_at,
    merged.last_opened_at,
    ownerId,
    projectId,
  )

  return getProject(db, ownerId, projectId)
}

export function deleteProject(db: Database.Database, ownerId: string, projectId: string): boolean {
  const result = db.prepare('DELETE FROM projects WHERE owner_id = ? AND id = ?').run(ownerId, projectId)
  return result.changes > 0
}

export function addSource(db: Database.Database, input: SourceInput): ProjectSourceRecord {
  const sourceId = input.id ?? crypto.randomUUID()
  db.prepare(`
    INSERT INTO project_sources (
      id, project_id, owner_id, kind, title, reference, summary, content_hash, size_bytes, mime_type, meta
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sourceId,
    input.project_id,
    input.owner_id,
    input.kind,
    input.title,
    input.reference ?? '',
    input.summary ?? null,
    input.content_hash ?? null,
    input.size_bytes ?? null,
    input.mime_type ?? null,
    asJson(input.meta ?? {}),
  )
  return getSource(db, input.owner_id, sourceId)!
}

export function listSources(db: Database.Database, ownerId: string, projectId: string): ProjectSourceRecord[] {
  const rows = db.prepare('SELECT * FROM project_sources WHERE owner_id = ? AND project_id = ? ORDER BY created_at DESC').all(ownerId, projectId) as SourceRow[]
  return rows.map(mapSourceRow)
}

export function getSource(db: Database.Database, ownerId: string, sourceId: string): ProjectSourceRecord | null {
  const row = db.prepare('SELECT * FROM project_sources WHERE owner_id = ? AND id = ?').get(ownerId, sourceId) as SourceRow | undefined
  return row ? mapSourceRow(row) : null
}

export function deleteSource(db: Database.Database, ownerId: string, sourceId: string): boolean {
  const result = db.prepare('DELETE FROM project_sources WHERE owner_id = ? AND id = ?').run(ownerId, sourceId)
  return result.changes > 0
}

export function addDocketItem(db: Database.Database, input: DocketInput): DocketItemRecord {
  const itemId = input.id ?? crypto.randomUUID()
  const createdAt = nowIso()
  db.prepare(`
    INSERT INTO docket_items (
      id, project_id, owner_id, text, done, completed_at, due_at, priority, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?, ?)
  `).run(
    itemId,
    input.project_id,
    input.owner_id,
    input.text,
    input.due_at ?? null,
    input.priority ?? 'none',
    createdAt,
    createdAt,
  )
  const row = db.prepare('SELECT * FROM docket_items WHERE owner_id = ? AND id = ?').get(input.owner_id, itemId) as DocketRow
  return mapDocketRow(row)
}

export function toggleDocketItem(db: Database.Database, ownerId: string, itemId: string): DocketItemRecord | null {
  const row = db.prepare('SELECT * FROM docket_items WHERE owner_id = ? AND id = ?').get(ownerId, itemId) as DocketRow | undefined
  if (!row) return null
  const nextDone = row.done === 1 ? 0 : 1
  const completedAt = nextDone === 1 ? nowIso() : null
  const updatedAt = nowIso()
  db.prepare('UPDATE docket_items SET done = ?, completed_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?')
    .run(nextDone, completedAt, updatedAt, ownerId, itemId)
  const updated = db.prepare('SELECT * FROM docket_items WHERE owner_id = ? AND id = ?').get(ownerId, itemId) as DocketRow
  return mapDocketRow(updated)
}

export function deleteDocketItem(db: Database.Database, ownerId: string, itemId: string): boolean {
  const result = db.prepare('DELETE FROM docket_items WHERE owner_id = ? AND id = ?').run(ownerId, itemId)
  return result.changes > 0
}

export function listDocketItems(db: Database.Database, ownerId: string, projectId?: string): DocketItemRecord[] {
  const rows = projectId
    ? db.prepare('SELECT * FROM docket_items WHERE owner_id = ? AND project_id = ? ORDER BY done ASC, COALESCE(due_at, created_at) ASC, created_at DESC').all(ownerId, projectId) as DocketRow[]
    : db.prepare('SELECT * FROM docket_items WHERE owner_id = ? ORDER BY done ASC, COALESCE(due_at, created_at) ASC, created_at DESC').all(ownerId) as DocketRow[]
  return rows.map(mapDocketRow)
}

export function createCapture(db: Database.Database, input: CaptureInput): CaptureRecord {
  const captureId = input.id ?? crypto.randomUUID()
  db.prepare(`
    INSERT INTO captures (id, project_id, owner_id, text, synced, meta, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(
    captureId,
    input.project_id ?? null,
    input.owner_id,
    input.text,
    asJson(input.meta ?? {}),
    nowIso(),
  )
  const row = db.prepare('SELECT * FROM captures WHERE owner_id = ? AND id = ?').get(input.owner_id, captureId) as CaptureRow
  return mapCaptureRow(row)
}

export function markCaptureSynced(db: Database.Database, ownerId: string, captureId: string): CaptureRecord | null {
  const result = db.prepare('UPDATE captures SET synced = 1 WHERE owner_id = ? AND id = ?').run(ownerId, captureId)
  if (result.changes === 0) return null
  const row = db.prepare('SELECT * FROM captures WHERE owner_id = ? AND id = ?').get(ownerId, captureId) as CaptureRow
  return mapCaptureRow(row)
}

export function listCaptures(db: Database.Database, ownerId: string): CaptureRecord[] {
  const rows = db.prepare('SELECT * FROM captures WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId) as CaptureRow[]
  return rows.map(mapCaptureRow)
}

function validateFlowProjectGovernance(db: Database.Database, ownerId: string, projectId: string, frameworkId: string | null | undefined): void {
  const project = getProject(db, ownerId, projectId)
  if (!project) throw new Error('Project not found')
  if (project.governance === 'statutory' && !frameworkId) {
    throw new Error('framework_id is required when project governance is statutory')
  }
}

export function createFlow(db: Database.Database, input: FlowInput): FlowRecord {
  const flowId = input.id ?? crypto.randomUUID()
  validateFlowProjectGovernance(db, input.owner_id, input.project_id, input.framework_id ?? null)
  const createdAt = nowIso()
  db.prepare(`
    INSERT INTO flows (
      id, project_id, owner_id, name, framework_id, trigger_spec, scenario, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    flowId,
    input.project_id,
    input.owner_id,
    input.name,
    input.framework_id ?? null,
    asJson(input.trigger_spec ?? {}),
    asJson(input.scenario ?? {}),
    input.status ?? 'draft',
    createdAt,
    createdAt,
  )
  return getFlow(db, input.owner_id, flowId)!
}

export function getFlow(db: Database.Database, ownerId: string, flowId: string): FlowRecord | null {
  const row = db.prepare('SELECT * FROM flows WHERE owner_id = ? AND id = ?').get(ownerId, flowId) as FlowRow | undefined
  return row ? mapFlowRow(row) : null
}

export function listFlows(db: Database.Database, ownerId: string, projectId: string): FlowRecord[] {
  const rows = db.prepare('SELECT * FROM flows WHERE owner_id = ? AND project_id = ? ORDER BY updated_at DESC').all(ownerId, projectId) as FlowRow[]
  return rows.map(mapFlowRow)
}

export function updateFlow(db: Database.Database, ownerId: string, flowId: string, patch: Partial<FlowInput>): FlowRecord | null {
  const existing = getFlow(db, ownerId, flowId)
  if (!existing) return null
  validateFlowProjectGovernance(db, ownerId, existing.project_id, patch.framework_id === undefined ? existing.framework_id : patch.framework_id)
  const merged: FlowRecord = {
    ...existing,
    ...patch,
    framework_id: patch.framework_id === undefined ? existing.framework_id : patch.framework_id,
    trigger_spec: patch.trigger_spec ?? existing.trigger_spec,
    scenario: patch.scenario ?? existing.scenario,
    updated_at: nowIso(),
  }
  db.prepare(`
    UPDATE flows
       SET name = ?, framework_id = ?, trigger_spec = ?, scenario = ?, status = ?, updated_at = ?
     WHERE owner_id = ? AND id = ?
  `).run(
    merged.name,
    merged.framework_id,
    asJson(merged.trigger_spec),
    asJson(merged.scenario),
    merged.status,
    merged.updated_at,
    ownerId,
    flowId,
  )
  return getFlow(db, ownerId, flowId)
}

export function insertFlowRun(db: Database.Database, input: FlowRunInput): FlowRunRecord {
  const insert = db.transaction((payload: FlowRunInput) => {
    const gated = applyFlowGovernanceGate(db, payload)
    const runPayload = gated.run
    const runId = payload.id ?? crypto.randomUUID()
    db.prepare(`
      INSERT INTO flow_runs (
        id, flow_id, project_id, owner_id, started_at, finished_at, status, context, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      runPayload.flow_id,
      runPayload.project_id,
      runPayload.owner_id,
      runPayload.started_at ?? nowIso(),
      runPayload.finished_at ?? null,
      runPayload.status,
      asJson(runPayload.context ?? {}),
      runPayload.error ?? null,
    )
    const insertStep = db.prepare(`
      INSERT INTO flow_steps (
        id, run_id, step_index, kind, input, output, decided_by, actor_id, status, ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const step of runPayload.steps) {
      insertStep.run(
        step.id ?? crypto.randomUUID(),
        runId,
        step.step_index,
        step.kind,
        asJson(step.input ?? {}),
        asJson(step.output ?? {}),
        step.decided_by ?? 'human',
        step.actor_id ?? null,
        step.status,
        step.ts ?? nowIso(),
      )
    }
    if (gated.haltedForReview) {
      insertProjectAuditEvent(db, {
        org_id: runPayload.owner_id,
        event_type: 'project_flow.halted_for_review',
        resource_type: 'flow_run',
        resource_id: runId,
        payload: {
          flow_id: gated.flow.id,
          project_id: gated.project.id,
          governance: gated.project.governance,
        },
      })
    }
    return runId
  })
  const runId = insert(input)
  const row = db.prepare('SELECT * FROM flow_runs WHERE owner_id = ? AND id = ?').get(input.owner_id, runId) as FlowRunRow
  return mapFlowRunRow(row)
}

export function updateFlowRun(db: Database.Database, ownerId: string, runId: string, patch: FlowRunPatch): FlowRunRecord | null {
  const existing = db.prepare('SELECT * FROM flow_runs WHERE owner_id = ? AND id = ?').get(ownerId, runId) as FlowRunRow | undefined
  if (!existing) {
    return null
  }

  const nextStatus = patch.status
  const nextFinishedAt = patch.finished_at === undefined
    ? (nextStatus === 'succeeded' || nextStatus === 'failed' ? nowIso() : existing.finished_at)
    : patch.finished_at
  const nextError = patch.error === undefined
    ? (nextStatus === 'succeeded' ? null : existing.error)
    : patch.error

  const update = db.transaction(() => {
    db.prepare(`
      UPDATE flow_runs
         SET status = ?, finished_at = ?, error = ?
       WHERE owner_id = ? AND id = ?
    `).run(nextStatus, nextFinishedAt, nextError, ownerId, runId)

    if (existing.status === 'halted_for_review' && nextStatus === 'succeeded') {
      const nextStepIndexRow = db.prepare('SELECT COALESCE(MAX(step_index), -1) + 1 as next_step_index FROM flow_steps WHERE run_id = ?')
        .get(runId) as { next_step_index: number }
      db.prepare(`
        INSERT INTO flow_steps (
          id, run_id, step_index, kind, input, output, decided_by, actor_id, status, ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        runId,
        nextStepIndexRow.next_step_index,
        'review_gate',
        asJson({ resumed_from: existing.status }),
        asJson({ approved: true, note: patch.review_note ?? null }),
        'human',
        patch.actor_id ?? null,
        'approved',
        nowIso(),
      )
      insertProjectAuditEvent(db, {
        org_id: ownerId,
        event_type: 'project_flow.review_approved',
        resource_type: 'flow_run',
        resource_id: runId,
        actor_id: patch.actor_id ?? null,
        payload: {
          resumed_from: existing.status,
          next_status: nextStatus,
        },
      })
    }
  })

  update()
  const row = db.prepare('SELECT * FROM flow_runs WHERE owner_id = ? AND id = ?').get(ownerId, runId) as FlowRunRow | undefined
  return row ? mapFlowRunRow(row) : null
}

export function listFlowRuns(db: Database.Database, ownerId: string, flowId?: string, projectId?: string): FlowRunRecord[] {
  const rows = flowId
    ? db.prepare('SELECT * FROM flow_runs WHERE owner_id = ? AND flow_id = ? ORDER BY started_at DESC').all(ownerId, flowId) as FlowRunRow[]
    : projectId
      ? db.prepare('SELECT * FROM flow_runs WHERE owner_id = ? AND project_id = ? ORDER BY started_at DESC').all(ownerId, projectId) as FlowRunRow[]
      : db.prepare('SELECT * FROM flow_runs WHERE owner_id = ? ORDER BY started_at DESC').all(ownerId) as FlowRunRow[]
  return rows.map(mapFlowRunRow)
}

export function listRunSteps(db: Database.Database, ownerId: string, runId: string): FlowStepRecord[] {
  const rows = db.prepare(`
    SELECT fs.*
      FROM flow_steps fs
      JOIN flow_runs fr ON fr.id = fs.run_id
     WHERE fr.owner_id = ? AND fr.id = ?
     ORDER BY fs.step_index ASC
  `).all(ownerId, runId) as FlowStepRow[]
  return rows.map(mapFlowStepRow)
}

export function buildProjectAIContext(db: Database.Database, ownerId: string, projectId: string): string {
  const project = getProject(db, ownerId, projectId)
  if (!project) throw new Error('Project not found')
  const sources = listSources(db, ownerId, projectId).slice(0, 12)
  const openDocket = listDocketItems(db, ownerId, projectId).filter((item) => !item.done).slice(0, 12)
  const lines = [
    `Project: ${project.name}`,
    `Kicker: ${project.kicker}`,
    `Domain: ${project.domain}`,
    `Governance: ${project.governance}`,
    `Status: ${project.status}`,
    project.framework_id ? `Framework: ${project.framework_id}` : null,
    project.connections.length > 0 ? `Connections: ${project.connections.join(', ')}` : null,
    project.tools.length > 0 ? `Tools: ${project.tools.join(', ')}` : null,
    '',
    'Use this project context to assist the operator. AI assists, never decides.',
    '',
    'Source summaries:',
    ...(sources.length > 0
      ? sources.map((source) => `- [${source.kind}] ${source.title}${source.summary ? ` — ${source.summary}` : ''}${source.reference ? ` (${source.reference})` : ''}`)
      : ['- None attached yet.']),
    '',
    'Open docket items:',
    ...(openDocket.length > 0
      ? openDocket.map((item) => `- ${item.text}${item.due_at ? ` (due ${item.due_at})` : ''}${item.priority !== 'none' ? ` [priority: ${item.priority}]` : ''}`)
      : ['- None open.']),
  ]
  return lines.filter((line): line is string => line !== null).join('\n')
}

export function seedDemoProjectsIfEmpty(db: Database.Database, ownerId: string): void {
  const row = db.prepare('SELECT COUNT(*) as count FROM projects WHERE owner_id = ?').get(ownerId) as { count: number } | undefined
  if ((row?.count ?? 0) > 0) return

  const seeded = [
    { name: 'Municipal PRR Desk', kicker: 'Town Clerk', domain: 'civic' as const, governance: 'statutory' as const, framework_id: 'VAULTCLERK.PublicRecords', pinned: true, connections: ['PuddleJumper', 'VAULT', 'Google Drive'] },
    { name: 'Ward Campaign Ops', kicker: 'Field', domain: 'campaign' as const, governance: 'light' as const, pinned: true, connections: ['Google Drive', 'Gmail'] },
    { name: 'Client Delivery Lane', kicker: 'Client', domain: 'client' as const, governance: 'governed' as const, pinned: false, connections: ['PuddleJumper', 'Google Drive', 'Microsoft'] },
    { name: 'STR Operations', kicker: 'Personal Business', domain: 'business' as const, governance: 'light' as const, framework_id: 'STR.Operations', pinned: false, connections: ['Google Drive'] },
    { name: 'NMTC Compliance', kicker: 'Compliance', domain: 'compliance' as const, governance: 'governed' as const, framework_id: 'NMTC.Compliance', pinned: false, connections: ['PuddleJumper', 'VAULT'] },
    { name: 'Personal Command', kicker: 'Personal', domain: 'personal' as const, governance: 'none' as const, pinned: false, connections: [] },
  ]

  for (const item of seeded) {
    const project = createProject(db, {
      owner_id: ownerId,
      name: item.name,
      kicker: item.kicker,
      domain: item.domain,
      governance: item.governance,
      framework_id: item.framework_id ?? null,
      pinned: item.pinned,
      connections: item.connections,
    })
    addDocketItem(db, { owner_id: ownerId, project_id: project.id, text: `Open ${project.name} and review the current lane.`, priority: 'medium' })
  }
}
