import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import Database from 'better-sqlite3'

vi.mock('@publiclogic/core', () => ({
  getAuthContext: (req: express.Request & { auth?: Record<string, unknown> }) => req.auth ?? null,
}))

import { createProjectRouter } from '../src/projects/routes/projectRoutes.js'
import {
  createFlow,
  createProject,
  initProjectStore,
  insertFlowRun,
  listRunSteps,
  updateFlowRun,
} from '../src/projects/projectStore.js'

describe('projects module hardening', () => {
  let tmpDir: string
  let db: Database.Database

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-module-test-'))
    db = new Database(path.join(tmpDir, 'projects.db'))
    initProjectStore(db)
  })

  afterEach(() => {
    db.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function buildApp() {
    const app = express()
    app.use(express.json())
    app.use((req: express.Request & { auth?: Record<string, unknown> }, _res, next) => {
      req.auth = { userId: 'user-1' }
      next()
    })
    app.use('/api/projects', createProjectRouter(db))
    return app
  }

  it('returns structured zod errors for invalid create-project payloads', async () => {
    const app = buildApp()

    const res = await request(app)
      .post('/api/projects')
      .send({ governance: 'governed' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('Invalid request')
    expect(res.body.detail.fieldErrors.name).toBeDefined()
  })

  it('halts governed flow runs until a human review is recorded, then resumes cleanly', () => {
    const project = createProject(db, {
      owner_id: 'user-1',
      name: 'Applied Interactive',
      governance: 'governed',
    })
    const flow = createFlow(db, {
      owner_id: 'user-1',
      project_id: project.id,
      name: 'Launch review gate',
      scenario: {
        version: 1,
        root_id: 'gate-1',
        nodes: [
          { id: 'gate-1', kind: 'review_gate', title: 'Human review', human_review: true },
        ],
      },
      status: 'active',
    })

    const haltedRun = insertFlowRun(db, {
      owner_id: 'user-1',
      project_id: project.id,
      flow_id: flow.id,
      status: 'running',
      context: { source: 'meeting-demo' },
      steps: [],
    })

    expect(haltedRun.status).toBe('halted_for_review')
    expect(haltedRun.error).toBe('Awaiting human review')

    const haltedSteps = listRunSteps(db, 'user-1', haltedRun.id)
    expect(haltedSteps).toHaveLength(1)
    expect(haltedSteps[0]?.kind).toBe('review_gate')
    expect(haltedSteps[0]?.status).toBe('halted_for_review')

    const resumedRun = updateFlowRun(db, 'user-1', haltedRun.id, {
      status: 'succeeded',
      actor_id: 'reviewer-1',
      review_note: 'Approved for execution',
    })

    expect(resumedRun?.status).toBe('succeeded')
    expect(resumedRun?.finished_at).toBeTruthy()
    expect(resumedRun?.error).toBeNull()

    const resumedSteps = listRunSteps(db, 'user-1', haltedRun.id)
    expect(resumedSteps).toHaveLength(2)
    expect(resumedSteps[1]?.kind).toBe('review_gate')
    expect(resumedSteps[1]?.status).toBe('approved')
    expect(resumedSteps[1]?.decided_by).toBe('human')
    expect(resumedSteps[1]?.actor_id).toBe('reviewer-1')

    expect(() => {
      db.prepare('UPDATE flow_runs SET context = ? WHERE owner_id = ? AND id = ?')
        .run(JSON.stringify({ mutated: true }), 'user-1', haltedRun.id)
    }).toThrow(/flow_runs only allows status transitions/)
  })
})
