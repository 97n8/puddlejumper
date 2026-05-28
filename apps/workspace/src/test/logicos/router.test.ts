import { describe, expect, it } from 'vitest'
import { selectLogicOSRoute } from '@/lib/logicos/router'
import { createLogicOSDatabase } from '@/lib/logicos/sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('selectLogicOSRoute', () => {
  function withDb() {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'logicos-router-'))
    const db = createLogicOSDatabase(path.join(dir, 'logicos.db'))
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
    expect(selectLogicOSRoute({ area: 'CAM' }, db)).toMatchObject({
      provider: 'google',
      home: 'google',
      connectorMode: 'google-folder',
    })
    expect(selectLogicOSRoute({ area: 'LIFE' }, db)).toMatchObject({
      provider: 'google',
      home: 'google',
      connectorMode: 'google-folder',
    })
    cleanup()
  })

  it('keeps PL and LAB on placeholder connectors', () => {
    const { db, cleanup } = withDb()
    expect(selectLogicOSRoute({ area: 'PL' }, db)).toMatchObject({
      provider: 'microsoft',
      connectorMode: 'placeholder',
    })
    expect(selectLogicOSRoute({ area: 'LAB' }, db)).toMatchObject({
      provider: 'github',
      connectorMode: 'placeholder',
    })
    cleanup()
  })

  it('lets PI choose a home but still stays placeholder-only', () => {
    const { db, cleanup } = withDb()
    expect(selectLogicOSRoute({ area: 'PI' }, db)).toMatchObject({
      provider: 'microsoft',
      home: 'microsoft',
      connectorMode: 'placeholder',
    })
    expect(selectLogicOSRoute({ area: 'PI', home: 'google' }, db)).toMatchObject({
      provider: 'google',
      home: 'google',
      connectorMode: 'placeholder',
    })
    cleanup()
  })
})
