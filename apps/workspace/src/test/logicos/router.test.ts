import { describe, expect, it } from 'vitest'
import { selectWorkspaceRoute } from '@/lib/logicos/router'
import { createWorkspaceDatabase } from '@/lib/logicos/sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('selectWorkspaceRoute', () => {
  function withDb() {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'workspace-router-'))
    const db = createWorkspaceDatabase(path.join(dir, 'workspace.db'))
    return {
      db,
      cleanup() {
        db.close()
        rmSync(dir, { recursive: true, force: true })
      },
    }
  }

  it('routes CAM and LIFE to the working Google connector', () => {
    const { db, cleanup } = withDb()
    expect(selectWorkspaceRoute({ area: 'CAM' }, db)).toMatchObject({
      provider: 'google',
      home: 'google',
      connectorMode: 'google-folder',
    })
    expect(selectWorkspaceRoute({ area: 'LIFE' }, db)).toMatchObject({
      provider: 'google',
      home: 'google',
      connectorMode: 'google-folder',
    })
    cleanup()
  })

  it('keeps PL and LAB on placeholder connectors', () => {
    const { db, cleanup } = withDb()
    expect(selectWorkspaceRoute({ area: 'PL' }, db)).toMatchObject({
      provider: 'microsoft',
      connectorMode: 'placeholder',
    })
    expect(selectWorkspaceRoute({ area: 'LAB' }, db)).toMatchObject({
      provider: 'github',
      connectorMode: 'placeholder',
    })
    cleanup()
  })

  it('lets PI choose a home but still stays placeholder-only', () => {
    const { db, cleanup } = withDb()
    expect(selectWorkspaceRoute({ area: 'PI' }, db)).toMatchObject({
      provider: 'microsoft',
      home: 'microsoft',
      connectorMode: 'placeholder',
    })
    expect(selectWorkspaceRoute({ area: 'PI', home: 'google' }, db)).toMatchObject({
      provider: 'google',
      home: 'google',
      connectorMode: 'placeholder',
    })
    cleanup()
  })
})
