import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceRecord, getWorkspaceRecord, listWorkspaceRecords, patchWorkspaceRecord } from '@/lib/logicos/store'
import type { WorkspaceRecord } from '@/lib/logicos/schema'
import { createWorkspaceDatabase } from '@/lib/logicos/sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function withDb() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'workspace-store-'))
  const db = createWorkspaceDatabase(path.join(dir, 'workspace.db'))
  return {
    db,
    cleanup() {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

describe('Workspace spine store', () => {
  it('creates a CAM record, generates an ID, and writes back the Google folder link', async () => {
    const { db, cleanup } = withDb()
    const connectorExecutor = vi.fn(async (record: WorkspaceRecord) => ({
      provider: 'google' as const,
      primaryLink: `https://drive.google.com/${record.id}`,
      googleLink: `https://drive.google.com/${record.id}`,
      externalId: `folder-${record.id}`,
    }))

    const bundle = await createWorkspaceRecord({
      title: 'Camera archive',
      area: 'CAM',
      source: 'test',
    }, {
      db,
      now: new Date('2026-05-03T19:11:38.000Z'),
      actor: { actorId: null, source: 'test', ip: null, userAgent: null },
      connectorContext: { cookieHeader: 'pj=1' },
      connectorExecutor,
    })

    expect(bundle.record.id).toBe('CAM-2026-001')
    expect(bundle.record.googleLink).toBe('https://drive.google.com/CAM-2026-001')
    expect(bundle.record.primaryLink).toBe('https://drive.google.com/CAM-2026-001')
    expect(bundle.record.routingState).toBe('completed')
    expect(bundle.audit.map(event => event.type)).toEqual([
      'record_created',
      'route_selected',
      'connector_started',
      'connector_completed',
    ])
    expect(connectorExecutor).toHaveBeenCalledOnce()
    cleanup()
  })

  it('keeps placeholder routes narrow for non-Google areas', async () => {
    const { db, cleanup } = withDb()
    const connectorExecutor = vi.fn()

    const bundle = await createWorkspaceRecord({
      title: 'Policy draft',
      area: 'PL',
      source: 'test',
    }, {
      db,
      now: new Date('2026-05-03T19:11:38.000Z'),
      actor: { actorId: null, source: 'test', ip: null, userAgent: null },
      connectorExecutor,
    })

    expect(bundle.record.id).toBe('PL-2026-001')
    expect(bundle.record.destination).toBe('microsoft')
    expect(bundle.record.connectorState).toBe('placeholder')
    expect(bundle.audit.map(event => event.type)).toEqual([
      'record_created',
      'route_selected',
    ])
    expect(connectorExecutor).not.toHaveBeenCalled()
    cleanup()
  })

  it('lists and patches records from KV storage', async () => {
    const { db, cleanup } = withDb()

    await createWorkspaceRecord({
      title: 'Life archive',
      area: 'LIFE',
      source: 'test',
    }, {
      db,
      now: new Date('2026-05-03T19:11:38.000Z'),
      actor: { actorId: null, source: 'test', ip: null, userAgent: null },
      connectorContext: { cookieHeader: 'pj=1' },
      connectorExecutor: async (record: WorkspaceRecord) => ({
        provider: 'google',
        primaryLink: `https://drive.google.com/${record.id}`,
        googleLink: `https://drive.google.com/${record.id}`,
      }),
    })

    const records = await listWorkspaceRecords({ area: 'LIFE' }, db)
    expect(records).toHaveLength(1)

    const patched = await patchWorkspaceRecord(records[0].id, {
      nextAction: 'Review folder contents',
      notes: 'Imported from webhook',
    }, {
      db,
      now: new Date('2026-05-03T20:00:00.000Z'),
      actor: { actorId: null, source: 'test', ip: null, userAgent: null },
    })

    expect(patched?.record.nextAction).toBe('Review folder contents')
    expect(patched?.record.notes).toBe('Imported from webhook')

    const loaded = await getWorkspaceRecord(records[0].id, db)
    expect(loaded?.record.notes).toBe('Imported from webhook')
    cleanup()
  })
})
