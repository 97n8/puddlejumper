import crypto from 'node:crypto';
import type { Database as DB } from 'better-sqlite3';
import { CIVIC_FLOW_FRAMEWORKS, getCivicFlowFramework } from './frameworkRegistry.js';

export type CivicFlowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type CivicFlowRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'halted_for_review';
export type CivicFlowStepKind = 'condition' | 'action' | 'review_gate';
export type CivicFlowDecisionSource = 'human' | 'system';

export interface CivicFlowRecord {
  id: string;
  org_id: string;
  name: string;
  linked_app: string;
  framework_id: string;
  trigger_spec: Record<string, unknown>;
  scenario: Record<string, unknown>;
  status: CivicFlowStatus;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_run_at?: string | null;
  last_run_status?: CivicFlowRunStatus | null;
  last_run_duration_ms?: number | null;
}

export interface CivicFlowRunRecord {
  id: string;
  flow_id: string;
  org_id: string;
  started_at: string;
  finished_at: string | null;
  status: CivicFlowRunStatus;
  context: Record<string, unknown>;
  error: string | null;
}

export interface CivicFlowStepRecord {
  id: string;
  run_id: string;
  step_index: number;
  kind: CivicFlowStepKind;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  decided_by: CivicFlowDecisionSource;
  actor_id: string | null;
  status: string;
  ts: string;
}

const FLOW_SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  actor_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now','utc'))
);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created
  ON audit_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource
  ON audit_events(resource_type, resource_id, created_at DESC);
CREATE TRIGGER IF NOT EXISTS audit_events_no_update
  BEFORE UPDATE ON audit_events
  BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
  BEFORE DELETE ON audit_events
  BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;

CREATE TABLE IF NOT EXISTS civic_flows (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  linked_app TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  trigger_spec TEXT NOT NULL,
  scenario TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','paused','archived')) DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now','utc')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','utc')),
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_civic_flows_org_status
  ON civic_flows(org_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_flows_framework
  ON civic_flows(org_id, framework_id);

CREATE TABLE IF NOT EXISTS civic_flow_runs (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES civic_flows(id),
  org_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','running','succeeded','failed','halted_for_review')),
  context TEXT NOT NULL DEFAULT '{}',
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_civic_flow_runs_flow_started
  ON civic_flow_runs(flow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_flow_runs_org_started
  ON civic_flow_runs(org_id, started_at DESC);

CREATE TABLE IF NOT EXISTS civic_flow_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES civic_flow_runs(id),
  step_index INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('condition','action','review_gate')),
  input TEXT NOT NULL DEFAULT '{}',
  output TEXT NOT NULL DEFAULT '{}',
  decided_by TEXT NOT NULL CHECK (decided_by IN ('human','system')),
  actor_id TEXT,
  status TEXT NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_civic_flow_steps_run_index
  ON civic_flow_steps(run_id, step_index ASC);

CREATE TRIGGER IF NOT EXISTS civic_flow_runs_no_update
  BEFORE UPDATE ON civic_flow_runs
  BEGIN SELECT RAISE(ABORT, 'civic_flow_runs is append-only'); END;
CREATE TRIGGER IF NOT EXISTS civic_flow_runs_no_delete
  BEFORE DELETE ON civic_flow_runs
  BEGIN SELECT RAISE(ABORT, 'civic_flow_runs is append-only'); END;
CREATE TRIGGER IF NOT EXISTS civic_flow_steps_no_update
  BEFORE UPDATE ON civic_flow_steps
  BEGIN SELECT RAISE(ABORT, 'civic_flow_steps is append-only'); END;
CREATE TRIGGER IF NOT EXISTS civic_flow_steps_no_delete
  BEFORE DELETE ON civic_flow_steps
  BEGIN SELECT RAISE(ABORT, 'civic_flow_steps is append-only'); END;

CREATE TRIGGER IF NOT EXISTS civic_flows_audit_insert
  AFTER INSERT ON civic_flows
  BEGIN
    INSERT INTO audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (
      lower(hex(randomblob(16))),
      NEW.org_id,
      'civic_flow.created',
      'civic_flow',
      NEW.id,
      NEW.created_by,
      json_object(
        'name', NEW.name,
        'linked_app', NEW.linked_app,
        'framework_id', NEW.framework_id,
        'status', NEW.status
      ),
      datetime('now','utc')
    );
  END;
CREATE TRIGGER IF NOT EXISTS civic_flows_audit_update
  AFTER UPDATE ON civic_flows
  BEGIN
    INSERT INTO audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (
      lower(hex(randomblob(16))),
      NEW.org_id,
      'civic_flow.updated',
      'civic_flow',
      NEW.id,
      NEW.created_by,
      json_object(
        'name', NEW.name,
        'linked_app', NEW.linked_app,
        'framework_id', NEW.framework_id,
        'status_before', OLD.status,
        'status_after', NEW.status
      ),
      datetime('now','utc')
    );
  END;
`;

type FlowRow = {
  id: string;
  org_id: string;
  name: string;
  linked_app: string;
  framework_id: string;
  trigger_spec: string;
  scenario: string;
  status: CivicFlowStatus;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_run_at?: string | null;
  last_run_status?: CivicFlowRunStatus | null;
  last_run_duration_ms?: number | null;
};

type FlowRunRow = {
  id: string;
  flow_id: string;
  org_id: string;
  started_at: string;
  finished_at: string | null;
  status: CivicFlowRunStatus;
  context: string;
  error: string | null;
};

type FlowStepRow = {
  id: string;
  run_id: string;
  step_index: number;
  kind: CivicFlowStepKind;
  input: string;
  output: string;
  decided_by: CivicFlowDecisionSource;
  actor_id: string | null;
  status: string;
  ts: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapFlowRow(row: FlowRow): CivicFlowRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    linked_app: row.linked_app,
    framework_id: row.framework_id,
    trigger_spec: parseJson(row.trigger_spec, {}),
    scenario: parseJson(row.scenario, {}),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    last_run_at: row.last_run_at ?? null,
    last_run_status: row.last_run_status ?? null,
    last_run_duration_ms: row.last_run_duration_ms ?? null,
  };
}

function mapFlowRunRow(row: FlowRunRow): CivicFlowRunRecord {
  return {
    id: row.id,
    flow_id: row.flow_id,
    org_id: row.org_id,
    started_at: row.started_at,
    finished_at: row.finished_at,
    status: row.status,
    context: parseJson(row.context, {}),
    error: row.error,
  };
}

function mapFlowStepRow(row: FlowStepRow): CivicFlowStepRecord {
  return {
    id: row.id,
    run_id: row.run_id,
    step_index: row.step_index,
    kind: row.kind,
    input: parseJson(row.input, {}),
    output: parseJson(row.output, {}),
    decided_by: row.decided_by,
    actor_id: row.actor_id,
    status: row.status,
    ts: row.ts,
  };
}

export function initCivicFlowStore(db: DB): void {
  db.exec(FLOW_SCHEMA);
}

export function listFlowFrameworks(db: DB, orgId: string): Array<CivicFlowFrameworkRecord> {
  const rows = db.prepare(`
    SELECT module_id, routing
    FROM module_configs
    WHERE namespace = ?
  `).all(orgId) as Array<{ module_id: string; routing: string }>;
  const routingByModule = new Map<string, Record<string, string>>();
  for (const row of rows) {
    routingByModule.set(row.module_id, parseJson(row.routing, {}));
  }

  return CIVIC_FLOW_FRAMEWORKS.map((framework) => ({
    ...framework,
    routing: routingByModule.get(framework.id) ?? {},
    configured: routingByModule.has(framework.id),
  }));
}

export interface CivicFlowFrameworkRecord {
  id: string;
  name: string;
  chapter: string;
  primaryStatute: string;
  domain: string;
  linkedApps: string[];
  routing: Record<string, string>;
  configured: boolean;
}

export function insertAuditEvent(
  db: DB,
  input: {
    orgId: string;
    eventType: string;
    resourceType: string;
    resourceId: string;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  },
): void {
  db.prepare(`
    INSERT INTO audit_events (id, org_id, event_type, resource_type, resource_id, actor_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    input.orgId,
    input.eventType,
    input.resourceType,
    input.resourceId,
    input.actorId ?? null,
    JSON.stringify(input.payload ?? {}),
    new Date().toISOString(),
  );
}

export function createFlow(
  db: DB,
  input: {
    orgId: string;
    name: string;
    linkedApp: string;
    frameworkId: string;
    triggerSpec: Record<string, unknown>;
    scenario: Record<string, unknown>;
    status?: CivicFlowStatus;
    createdBy: string;
  },
): CivicFlowRecord {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO civic_flows (
      id, org_id, name, linked_app, framework_id, trigger_spec, scenario, status, created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.orgId,
    input.name,
    input.linkedApp,
    input.frameworkId,
    JSON.stringify(input.triggerSpec),
    JSON.stringify(input.scenario),
    input.status ?? 'draft',
    now,
    now,
    input.createdBy,
  );
  return getFlow(db, input.orgId, id)!;
}

export function updateFlow(
  db: DB,
  orgId: string,
  flowId: string,
  patch: Partial<{
    name: string;
    linkedApp: string;
    frameworkId: string;
    triggerSpec: Record<string, unknown>;
    scenario: Record<string, unknown>;
    status: CivicFlowStatus;
  }>,
): CivicFlowRecord | null {
  const existing = getFlow(db, orgId, flowId);
  if (!existing) {
    return null;
  }

  const next = {
    ...existing,
    name: patch.name ?? existing.name,
    linked_app: patch.linkedApp ?? existing.linked_app,
    framework_id: patch.frameworkId ?? existing.framework_id,
    trigger_spec: patch.triggerSpec ?? existing.trigger_spec,
    scenario: patch.scenario ?? existing.scenario,
    status: patch.status ?? existing.status,
  };

  db.prepare(`
    UPDATE civic_flows
    SET name = ?, linked_app = ?, framework_id = ?, trigger_spec = ?, scenario = ?, status = ?, updated_at = ?
    WHERE id = ? AND org_id = ?
  `).run(
    next.name,
    next.linked_app,
    next.framework_id,
    JSON.stringify(next.trigger_spec),
    JSON.stringify(next.scenario),
    next.status,
    new Date().toISOString(),
    flowId,
    orgId,
  );

  return getFlow(db, orgId, flowId);
}

export function getFlow(db: DB, orgId: string, flowId: string): CivicFlowRecord | null {
  const row = db.prepare(`
    SELECT
      f.*,
      (
        SELECT r.started_at
        FROM civic_flow_runs r
        WHERE r.flow_id = f.id
        ORDER BY r.started_at DESC
        LIMIT 1
      ) AS last_run_at,
      (
        SELECT r.status
        FROM civic_flow_runs r
        WHERE r.flow_id = f.id
        ORDER BY r.started_at DESC
        LIMIT 1
      ) AS last_run_status,
      (
        SELECT CAST((julianday(r.finished_at) - julianday(r.started_at)) * 86400000 AS INTEGER)
        FROM civic_flow_runs r
        WHERE r.flow_id = f.id AND r.finished_at IS NOT NULL
        ORDER BY r.started_at DESC
        LIMIT 1
      ) AS last_run_duration_ms
    FROM civic_flows f
    WHERE f.id = ? AND f.org_id = ?
  `).get(flowId, orgId) as FlowRow | undefined;

  return row ? mapFlowRow(row) : null;
}

export function listFlows(
  db: DB,
  orgId: string,
  filters?: { status?: CivicFlowStatus },
): CivicFlowRecord[] {
  const params: unknown[] = [orgId];
  let where = 'WHERE f.org_id = ?';
  if (filters?.status) {
    where += ' AND f.status = ?';
    params.push(filters.status);
  }

  const rows = db.prepare(`
    SELECT
      f.*,
      (
        SELECT r.started_at
        FROM civic_flow_runs r
        WHERE r.flow_id = f.id
        ORDER BY r.started_at DESC
        LIMIT 1
      ) AS last_run_at,
      (
        SELECT r.status
        FROM civic_flow_runs r
        WHERE r.flow_id = f.id
        ORDER BY r.started_at DESC
        LIMIT 1
      ) AS last_run_status,
      (
        SELECT CAST((julianday(r.finished_at) - julianday(r.started_at)) * 86400000 AS INTEGER)
        FROM civic_flow_runs r
        WHERE r.flow_id = f.id AND r.finished_at IS NOT NULL
        ORDER BY r.started_at DESC
        LIMIT 1
      ) AS last_run_duration_ms
    FROM civic_flows f
    ${where}
    ORDER BY f.updated_at DESC
  `).all(...params) as FlowRow[];

  return rows.map(mapFlowRow);
}

export function listFlowRuns(
  db: DB,
  orgId: string,
  flowId: string,
  page = 1,
  perPage = 10,
): { runs: CivicFlowRunRecord[]; total: number } {
  const total = (db.prepare(`
    SELECT COUNT(*) AS count
    FROM civic_flow_runs
    WHERE org_id = ? AND flow_id = ?
  `).get(orgId, flowId) as { count: number }).count;

  const rows = db.prepare(`
    SELECT *
    FROM civic_flow_runs
    WHERE org_id = ? AND flow_id = ?
    ORDER BY started_at DESC
    LIMIT ? OFFSET ?
  `).all(orgId, flowId, perPage, (page - 1) * perPage) as FlowRunRow[];

  return { runs: rows.map(mapFlowRunRow), total };
}

export function listRunSteps(db: DB, runId: string): CivicFlowStepRecord[] {
  const rows = db.prepare(`
    SELECT *
    FROM civic_flow_steps
    WHERE run_id = ?
    ORDER BY step_index ASC
  `).all(runId) as FlowStepRow[];
  return rows.map(mapFlowStepRow);
}

export function insertFlowRunWithSteps(
  db: DB,
  run: CivicFlowRunRecord,
  steps: CivicFlowStepRecord[],
): void {
  const writeAll = db.transaction(() => {
    db.prepare(`
      INSERT INTO civic_flow_runs (id, flow_id, org_id, started_at, finished_at, status, context, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.flow_id,
      run.org_id,
      run.started_at,
      run.finished_at,
      run.status,
      JSON.stringify(run.context),
      run.error,
    );

    const insertStep = db.prepare(`
      INSERT INTO civic_flow_steps (id, run_id, step_index, kind, input, output, decided_by, actor_id, status, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const step of steps) {
      insertStep.run(
        step.id,
        step.run_id,
        step.step_index,
        step.kind,
        JSON.stringify(step.input),
        JSON.stringify(step.output),
        step.decided_by,
        step.actor_id,
        step.status,
        step.ts,
      );
    }
  });

  writeAll();
}

export function resolveFrameworkOrThrow(frameworkId: string) {
  const framework = getCivicFlowFramework(frameworkId);
  if (!framework) {
    throw new Error(`Unknown framework_id: ${frameworkId}`);
  }
  return framework;
}

export function resolveOrgRouting(
  db: DB,
  orgId: string,
  frameworkId: string,
): Record<string, string> {
  const row = db.prepare(`
    SELECT routing
    FROM module_configs
    WHERE namespace = ? AND module_id = ?
  `).get(orgId, frameworkId) as { routing: string } | undefined;
  return row ? parseJson(row.routing, {}) : {};
}

export function seedDemoFlowsIfEmpty(db: DB): void {
  const count = (db.prepare('SELECT COUNT(*) AS count FROM civic_flows').get() as { count: number }).count;
  if (count > 0) {
    return;
  }

  const seedContext = db.prepare(`
    SELECT o.namespace AS org_id, o.id AS actor_id
    FROM objects o
    WHERE o.type = 'actor' AND o.subtype = 'staff' AND o.namespace IS NOT NULL
    ORDER BY o.created_at ASC
    LIMIT 1
  `).get() as { org_id: string; actor_id: string } | undefined;

  if (!seedContext) {
    return;
  }

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO civic_flows (
      id, org_id, name, linked_app, framework_id, trigger_spec, scenario, status, created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `);

  const writeSeed = db.transaction(() => {
    for (const framework of CIVIC_FLOW_FRAMEWORKS) {
      const flowId = crypto.randomUUID();
      insert.run(
        flowId,
        seedContext.org_id,
        `${framework.name} demo flow`,
        framework.linkedApps[0] ?? 'logicsuite',
        framework.id,
        JSON.stringify({
          type: 'manual',
          eventType: 'manual',
          source: framework.linkedApps[0] ?? 'logicsuite',
        }),
        JSON.stringify({
          version: 1,
          rootId: 'start',
          nodes: [
            {
              id: 'start',
              kind: 'action',
              title: `Capture ${framework.name} intake`,
              detail: `Route through ${framework.chapter} controls`,
              next: 'review',
            },
            {
              id: 'review',
              kind: 'review_gate',
              title: `${framework.name} checkpoint`,
              detail: `Escalate for human review if ${framework.chapter} requires it`,
              humanReview: framework.chapter === 'c.268A',
            },
          ],
        }),
        now,
        now,
        seedContext.actor_id,
      );
    }
  });

  writeSeed();
}
