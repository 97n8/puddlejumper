import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { cookieParserMiddleware, signJwt } from '@publiclogic/core'
import { getDb, migrate } from '@pj/db'
import { createFileDraftsRouter } from '../src/api/routes/fileDrafts.js'

async function getAuthToken(overrides: Record<string, unknown> = {}) {
  return signJwt(
    {
      sub: 'u1',
      userId: 'u1',
      name: 'Draft Tester',
      role: 'admin',
      tenantId: 'tenant-1',
      workspaceId: 'tenant-1',
      permissions: [],
      delegations: [],
      ...overrides,
    },
    { expiresIn: '1h' },
  )
}

function buildApp() {
  const db = getDb(':memory:')
  migrate(db)

  const app = express()
  app.use(cookieParserMiddleware())
  app.use(express.json())
  app.use(async (req: any, _res, next) => {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { verifyJwt } = await import('@publiclogic/core')
        req.auth = await verifyJwt(authHeader.slice(7))
      } catch {
        // leave unauthenticated
      }
    }
    next()
  })
  app.use('/api', createFileDraftsRouter(db))

  return { app, db }
}

describe('file draft routes', () => {
  it('creates, updates, lists, and submits a governed draft with audit rows', async () => {
    const { app, db } = buildApp()
    const token = await getAuthToken()

    const createRes = await request(app)
      .post('/api/files/drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        casespaceId: 'cs-1',
        path: 'notes/today.md',
        content: 'hello world',
        cursorLine: 1,
        cursorCol: 5,
        baseContentHash: 'base-1',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.draft.casespaceId).toBe('cs-1')
    expect(createRes.body.draft.currentState).toBe('pre_received')

    const draftId = createRes.body.draft.draftId as string
    const formKey = createRes.body.draft.formKey as string

    const updateRes = await request(app)
      .put(`/api/files/drafts/${draftId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'hello governed world',
        cursorLine: 2,
        cursorCol: 1,
      })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.draft.content).toBe('hello governed world')

    const listRes = await request(app)
      .get('/api/files/drafts')
      .query({ casespaceId: 'cs-1', path: 'notes/today.md' })
      .set('Authorization', `Bearer ${token}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.drafts).toHaveLength(1)
    expect(listRes.body.drafts[0].draftId).toBe(draftId)

    const submitRes = await request(app)
      .post(`/api/files/drafts/${draftId}/submit`)
      .set('Authorization', `Bearer ${token}`)

    expect(submitRes.status).toBe(200)
    expect(submitRes.body.draft.currentState).toBe('received')
    expect(submitRes.body.draft.draftState).toBe('ready')
    expect(submitRes.body.draft.formKey).toBe(formKey)

    const activeAfterSubmit = await request(app)
      .get('/api/files/drafts')
      .query({ casespaceId: 'cs-1' })
      .set('Authorization', `Bearer ${token}`)

    expect(activeAfterSubmit.status).toBe(200)
    expect(activeAfterSubmit.body.drafts).toHaveLength(0)

    const auditRows = db.prepare(
      `SELECT event_subtype, process_id, payload_json
         FROM audit_events
        WHERE process_id = ?
        ORDER BY occurred_at ASC, event_id ASC`,
    ).all(draftId) as Array<{ event_subtype: string; process_id: string; payload_json: string }>

    expect(auditRows.map((row) => row.event_subtype)).toEqual([
      'draft.create',
      'draft.update',
      'draft.submit',
    ])
    for (const row of auditRows) {
      const payload = JSON.parse(row.payload_json) as { form_key: string; casespace_id: string }
      expect(payload.form_key).toBe(formKey)
      expect(payload.casespace_id).toBe('cs-1')
    }
  })

  it('discards a draft by closing it and emitting draft.discard', async () => {
    const { app, db } = buildApp()
    const token = await getAuthToken()

    const createRes = await request(app)
      .post('/api/files/drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        casespaceId: 'cs-2',
        path: 'drafts/discard-me.md',
        content: 'temporary',
      })

    const draftId = createRes.body.draft.draftId as string

    const discardRes = await request(app)
      .delete(`/api/files/drafts/${draftId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(discardRes.status).toBe(204)

    const row = db.prepare(
      `SELECT current_state, closed_at, fields
         FROM processes
        WHERE process_id = ?`,
    ).get(draftId) as { current_state: string; closed_at: string | null; fields: string }

    expect(row.current_state).toBe('closed')
    expect(row.closed_at).toBeTruthy()
    expect(JSON.parse(row.fields).draft_state).toBe('abandoned')

    const subtype = db.prepare(
      `SELECT event_subtype
         FROM audit_events
        WHERE process_id = ?
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT 1`,
    ).get(draftId) as { event_subtype: string }

    expect(subtype.event_subtype).toBe('draft.discard')
  })
})
