import { describe, expect, it, vi } from 'vitest'
import { createLogicOSRecord, getLogicOSRecord, listLogicOSRecords, patchLogicOSRecord } from '@/lib/logicos/store'
import type { LogicOSRecord } from '@/lib/logicos/schema'
import { createLogicOSDatabase } from '@/lib/logicos/sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function withDb() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'logicos-store-'))
  const db = createLogicOSDatabase(path.join(dir, 'logicos.db'))
  return {
    db,
    cleanup() {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

describe('LogicOS spine store', () => {
  it('creates a CAM record, generates an ID, and writes back the Google folder link', async () => {
    const { db, cleanup } = withDb()
    const connectorExecutor = vi.fn(async (record: LogicOSRecord) => ({
      provider: 'google' as const,
      primaryLink: `https://drive.google.com/${record.id}`,
      googleLink: `https://drive.google.com/${record.id}`,
      externalId: `folder-${record.id}`,
    }))

    const bundle = await createLogicOSRecord({
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

    const bundle = await createLogicOSRecord({
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

    await createLogicOSRecord({
      title: 'Life archive',
      area: 'LIFE',
      source: 'test',
    }, {
      db,
      now: new Date('2026-05-03T19:11:38.000Z'),
      actor: { actorId: null, source: 'test', ip: null, userAgent: null },
      connectorContext: { cookieHeader: 'pj=1' },
      connectorExecutor: async (record: LogicOSRecord) => ({
        provider: 'google',
        primaryLink: `https://drive.google.com/${record.id}`,
        googleLink: `https://drive.google.com/${record.id}`,
      }),
    })

    const records = await listLogicOSRecords({ area: 'LIFE' }, db)
    expect(records).toHaveLength(1)

    const patched = await patchLogicOSRecord(records[0].id, {
      nextAction: 'Review folder contents',
      notes: 'Imported from webhook',
    }, {
      db,
      now: new Date('2026-05-03T20:00:00.000Z'),
      actor: { actorId: null, source: 'test', ip: null, userAgent: null },
    })

    expect(patched?.record.nextAction).toBe('Review folder contents')
    expect(patched?.record.notes).toBe('Imported from webhook')

    const loaded = await getLogicOSRecord(records[0].id, db)
    expect(loaded?.record.notes).toBe('Imported from webhook')
    cleanup()
  })
})
