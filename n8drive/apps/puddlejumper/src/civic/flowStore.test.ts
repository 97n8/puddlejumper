import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import {
  createFlow,
  initCivicFlowStore,
  insertFlowRunWithSteps,
  listFlowRuns,
  type CivicFlowRunRecord,
  type CivicFlowStepRecord,
} from './flowStore.js';
import { executeFlow } from './synchron8/flowExecutor.js';
import { createCivicFlowsRouter } from './routes/flows.js';

let db: Database.Database;

function createSupportTables() {
  db.exec(`
    CREATE TABLE module_configs (
      namespace TEXT NOT NULL,
      module_id TEXT NOT NULL,
      routing TEXT NOT NULL DEFAULT '{}',
      officer_name TEXT NOT NULL DEFAULT '',
      officer_title TEXT NOT NULL DEFAULT '',
      officer_email TEXT NOT NULL DEFAULT '',
      officer_phone TEXT NOT NULL DEFAULT '',
      automations TEXT NOT NULL DEFAULT '{}',
      retention_years INTEGER NOT NULL DEFAULT 7,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (namespace, module_id)
    );
    CREATE TABLE objects (
      id TEXT PRIMARY KEY,
      type TEXT,
      subtype TEXT,
      namespace TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function insertConfiguredModule(namespace: string, moduleId: string) {
  db.prepare(`
    INSERT INTO module_configs (namespace, module_id, routing)
    VALUES (?, ?, ?)
  `).run(namespace, moduleId, JSON.stringify({ records: 'sharepoint://records', notifications: 'teams://ops' }));
}

beforeEach(() => {
  db = new Database(':memory:');
  initCivicFlowStore(db);
  createSupportTables();
});

afterEach(() => {
  db.close();
});

describe('civic flow schema', () => {
  it('creates flow tables on a clean database', () => {
    const tables = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name IN ('civic_flows', 'civic_flow_runs', 'civic_flow_steps', 'audit_events')
      ORDER BY name
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      'audit_events',
      'civic_flow_runs',
      'civic_flow_steps',
      'civic_flows',
    ]);
  });

  it('rejects civic_flow_steps updates because the table is append-only', () => {
    const run: CivicFlowRunRecord = {
      id: 'run-1',
      flow_id: 'flow-1',
      org_id: 'org-a',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      status: 'succeeded',
      context: {},
      error: null,
    };
    const step: CivicFlowStepRecord = {
      id: 'step-1',
      run_id: 'run-1',
      step_index: 0,
      kind: 'action',
      input: {},
      output: {},
      decided_by: 'system',
      actor_id: 'actor-a',
      status: 'succeeded',
      ts: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO civic_flows (id, org_id, name, linked_app, framework_id, trigger_spec, scenario, status, created_by)
      VALUES ('flow-1', 'org-a', 'Flow', 'google', 'VAULTCLERK.PublicRecords', '{}', '{}', 'active', 'actor-a')
    `).run();
    insertFlowRunWithSteps(db, run, [step]);

    expect(() => {
      db.prepare(`UPDATE civic_flow_steps SET status = 'changed' WHERE id = 'step-1'`).run();
    }).toThrow(/append-only/i);
  });
});

describe('SYNCHRON8 flow execution', () => {
  it('runs a simple flow end-to-end and records the run trail', async () => {
    insertConfiguredModule('org-a', 'VAULTCLERK.PublicRecords');
    const flow = createFlow(db, {
      orgId: 'org-a',
      name: 'Public records draft',
      linkedApp: 'google',
      frameworkId: 'VAULTCLERK.PublicRecords',
      triggerSpec: { type: 'manual', eventType: 'manual', label: 'Manual run' },
      scenario: {
        version: 1,
        rootId: 'base-action',
        nodes: [
          { id: 'base-action', kind: 'action', title: 'Start', detail: 'Start flow', next: 'send' },
          { id: 'send', kind: 'action', title: 'Send notice', detail: 'Deliver notice', next: null },
        ],
      },
      status: 'active',
      createdBy: 'actor-a',
    });

    const { run, steps } = await executeFlow(db, flow.id, 'org-a', { caseId: 'case-1' }, 'actor-a');

    expect(run.status).toBe('succeeded');
    expect(steps).toHaveLength(2);
    expect(listFlowRuns(db, 'org-a', flow.id, 1, 10).runs[0]?.id).toBe(run.id);

    const auditCount = (db.prepare(`
      SELECT COUNT(*) AS count
      FROM audit_events
      WHERE resource_id = ?
    `).get(run.id) as { count: number }).count;
    expect(auditCount).toBeGreaterThan(0);
  });

  it('halts for review when the scenario hits a review gate', async () => {
    insertConfiguredModule('org-a', 'VAULTCLERK.BoardCompliance');
    const flow = createFlow(db, {
      orgId: 'org-a',
      name: 'Board compliance gate',
      linkedApp: 'microsoft',
      frameworkId: 'VAULTCLERK.BoardCompliance',
      triggerSpec: { type: 'manual', eventType: 'manual', label: 'Manual run' },
      scenario: {
        version: 1,
        rootId: 'gate',
        nodes: [
          { id: 'gate', kind: 'review_gate', title: 'Review', detail: 'Human review required', next: null, humanReview: true },
        ],
      },
      status: 'active',
      createdBy: 'actor-a',
    });

    const { run } = await executeFlow(db, flow.id, 'org-a', {}, 'actor-a');

    expect(run.status).toBe('halted_for_review');
    const haltedEvent = db.prepare(`
      SELECT event_type
      FROM audit_events
      WHERE resource_id = ? AND event_type = 'civic_flow.halted_for_review'
    `).get(run.id) as { event_type: string } | undefined;
    expect(haltedEvent?.event_type).toBe('civic_flow.halted_for_review');
  });

  it('records failed actions and emits an audit event', async () => {
    insertConfiguredModule('org-a', 'VAULTFISCAL.Procurement');
    const flow = createFlow(db, {
      orgId: 'org-a',
      name: 'Procurement failure path',
      linkedApp: 'microsoft',
      frameworkId: 'VAULTFISCAL.Procurement',
      triggerSpec: { type: 'manual', eventType: 'manual', label: 'Manual run' },
      scenario: {
        version: 1,
        rootId: 'fail-me',
        nodes: [
          { id: 'fail-me', kind: 'action', title: 'Fail me', detail: 'Break on purpose', next: null },
        ],
      },
      status: 'active',
      createdBy: 'actor-a',
    });

    const { run } = await executeFlow(db, flow.id, 'org-a', { failActionId: 'fail-me' }, 'actor-a');

    expect(run.status).toBe('failed');
    expect(run.error).toMatch(/fail/i);
    const failedEvent = db.prepare(`
      SELECT event_type
      FROM audit_events
      WHERE resource_id = ? AND event_type = 'civic_flow.failed'
    `).get(run.id) as { event_type: string } | undefined;
    expect(failedEvent?.event_type).toBe('civic_flow.failed');
  });
});

describe('civic flow route authz', () => {
  it('prevents org A from reading or running org B flows', async () => {
    insertConfiguredModule('org-b', 'VAULTCLERK.PublicRecords');
    const flow = createFlow(db, {
      orgId: 'org-b',
      name: 'Org B flow',
      linkedApp: 'google',
      frameworkId: 'VAULTCLERK.PublicRecords',
      triggerSpec: { type: 'manual', eventType: 'manual', label: 'Manual run' },
      scenario: {
        version: 1,
        rootId: 'base-action',
        nodes: [{ id: 'base-action', kind: 'action', title: 'Start', detail: 'Start', next: null }],
      },
      status: 'active',
      createdBy: 'actor-b',
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { civicActor?: unknown }).civicActor = {
        object_id: 'actor-a',
        town_id: 'org-a',
        role: 'town_administrator',
      };
      next();
    });
    app.use('/', createCivicFlowsRouter(db));

    await request(app).get(`/${flow.id}/runs`).expect(404);
    await request(app).post(`/${flow.id}/run`).send({ context: {} }).expect(404);
  });
});
