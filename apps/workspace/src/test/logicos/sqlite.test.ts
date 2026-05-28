import { describe, expect, it } from 'vitest'
import { createWorkspaceDatabase } from '@/lib/logicos/sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function withDb() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'workspace-sqlite-'))
  const db = createWorkspaceDatabase(path.join(dir, 'workspace.db'))
  return {
    db,
    cleanup() {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

describe('Workspace sqlite migration', () => {
  it('allows audit_events inserts', () => {
    const { db, cleanup } = withDb()

    db.prepare(`
      INSERT INTO logicos_records (
        id, area, sequence_year, sequence_number, title, status,
        destination_provider, connector_mode, source, routing_state,
        connector_state, created_at, updated_at
      ) VALUES (
        'CAM-2026-001', 'CAM', 2026, 1, 'Test record', 'active',
        'google', 'google-folder', 'test', 'pending',
        'idle', '2026-05-03T00:00:00.000Z', '2026-05-03T00:00:00.000Z'
      )
    `).run()

    db.prepare(`
      INSERT INTO audit_events (
        id, record_id, event_type, actor_source, created_at
      ) VALUES (
        'evt-1', 'CAM-2026-001', 'record_created', 'test', '2026-05-03T00:00:00.000Z'
      )
    `).run()

    const count = db.prepare('SELECT COUNT(*) as count FROM audit_events').get() as { count: number }
    expect(count.count).toBe(1)
    cleanup()
  })

  it('rejects audit_events updates', () => {
    const { db, cleanup } = withDb()
    db.prepare(`
      INSERT INTO logicos_records (
        id, area, sequence_year, sequence_number, title, status,
        destination_provider, connector_mode, source, routing_state,
        connector_state, created_at, updated_at
      ) VALUES (
        'CAM-2026-001', 'CAM', 2026, 1, 'Test record', 'active',
        'google', 'google-folder', 'test', 'pending',
        'idle', '2026-05-03T00:00:00.000Z', '2026-05-03T00:00:00.000Z'
      )
    `).run()
    db.prepare(`
      INSERT INTO audit_events (
        id, record_id, event_type, actor_source, created_at
      ) VALUES (
        'evt-1', 'CAM-2026-001', 'record_created', 'test', '2026-05-03T00:00:00.000Z'
      )
    `).run()

    expect(() => {
      db.prepare(`UPDATE audit_events SET actor_source = 'changed' WHERE id = 'evt-1'`).run()
    }).toThrow(/append-only/)
    cleanup()
  })

  it('rejects audit_events deletes', () => {
    const { db, cleanup } = withDb()
    db.prepare(`
      INSERT INTO logicos_records (
        id, area, sequence_year, sequence_number, title, status,
        destination_provider, connector_mode, source, routing_state,
        connector_state, created_at, updated_at
      ) VALUES (
        'CAM-2026-001', 'CAM', 2026, 1, 'Test record', 'active',
        'google', 'google-folder', 'test', 'pending',
        'idle', '2026-05-03T00:00:00.000Z', '2026-05-03T00:00:00.000Z'
      )
    `).run()
    db.prepare(`
      INSERT INTO audit_events (
        id, record_id, event_type, actor_source, created_at
      ) VALUES (
        'evt-1', 'CAM-2026-001', 'record_created', 'test', '2026-05-03T00:00:00.000Z'
      )
    `).run()

    expect(() => {
      db.prepare(`DELETE FROM audit_events WHERE id = 'evt-1'`).run()
    }).toThrow(/append-only/)
    cleanup()
  })
})
