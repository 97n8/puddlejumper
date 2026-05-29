import { describe, expect, it } from 'vitest'
import type { CaseSpace } from '@/lib/types'
import type { BuilderSession } from '@/lib/vault-modules'
import {
  builderSessionToEnvironment,
  mergePrimaryEnvironment,
  resolveEnvironmentFromSources,
} from '@/features/environments/lib/environmentResolution'

function makeEnvironment(overrides: Partial<CaseSpace> = {}): CaseSpace {
  return {
    id: overrides.id ?? 'env-1',
    name: overrides.name ?? 'Environment One',
    description: overrides.description ?? 'Demo environment',
    type: overrides.type ?? 'vault',
    town: overrides.town ?? 'Town One',
    color: overrides.color ?? '#123456',
    icon: overrides.icon ?? '🏛️',
    vaultModuleIds: overrides.vaultModuleIds ?? [],
    visibility: overrides.visibility ?? 'organization',
    members: overrides.members ?? [],
    fileCount: overrides.fileCount ?? 0,
    folderCount: overrides.folderCount ?? 0,
    templateCount: overrides.templateCount ?? 0,
    connectionIds: overrides.connectionIds ?? [],
    createdAt: overrides.createdAt ?? 1,
    lastAccessed: overrides.lastAccessed ?? 2,
  }
}

function makeBuilderSession(overrides: Partial<BuilderSession> = {}): BuilderSession {
  return {
    id: overrides.id ?? 'session-1',
    town: overrides.town ?? 'Town Session',
    selectedModuleIds: overrides.selectedModuleIds ?? ['VAULTPRR'],
    configs: overrides.configs ?? {},
    status: overrides.status ?? 'activated',
    createdAt: overrides.createdAt ?? 10,
    updatedAt: overrides.updatedAt ?? 20,
    brandConfig: overrides.brandConfig ?? { displayName: 'Session Display', color: '#0F4C8A', icon: '🚀' },
    connectConfig: overrides.connectConfig ?? { connectors: [], folders: [], templates: [] },
    source: overrides.source ?? 'builder',
  }
}

describe('environmentResolution helpers', () => {
  it('puts the primary environment first without duplicating it', () => {
    const primary = makeEnvironment({ id: 'logicville' })
    const other = makeEnvironment({ id: 'env-2', name: 'Other Environment' })

    expect(mergePrimaryEnvironment(primary, [other, primary]).map((environment) => environment.id)).toEqual(['logicville', 'env-2'])
  })

  it('maps builder sessions into environment cards using the brand display name', () => {
    const session = makeBuilderSession()

    expect(builderSessionToEnvironment(session)).toMatchObject({
      id: 'session-1',
      name: 'Session Display',
      town: 'Town Session',
      description: '1 compliance module · activated',
    })
  })

  it('resolves a server environment before checking builder sessions', () => {
    const environment = makeEnvironment({ id: 'env-2', name: 'Server Environment' })
    const session = makeBuilderSession({ id: 'env-2', brandConfig: { displayName: 'Session Name', color: '#000', icon: 'S' } })

    expect(resolveEnvironmentFromSources('env-2', [environment], [session])?.name).toBe('Server Environment')
  })

  it('falls back to a builder session when no server environment exists', () => {
    const session = makeBuilderSession({ id: 'session-2', town: 'Builder Town' })

    expect(resolveEnvironmentFromSources('session-2', [], [session])).toMatchObject({
      id: 'session-2',
      name: 'Session Display',
      town: 'Builder Town',
    })
  })

  it('returns null when no server environment or builder session exists', () => {
    expect(resolveEnvironmentFromSources('missing-env', [], [])).toBeNull()
  })
})
