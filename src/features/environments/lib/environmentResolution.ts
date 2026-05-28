import type { CaseSpace } from '@/lib/types'
import type { BuilderSession } from '@/lib/vault-modules'

export function builderSessionToEnvironment(session: BuilderSession): CaseSpace {
  const moduleCount = session.selectedModuleIds.length

  return {
    id: session.id,
    name: session.brandConfig?.displayName ?? session.town,
    description: moduleCount > 0
      ? `${moduleCount} compliance module${moduleCount !== 1 ? 's' : ''} · ${session.status}`
      : 'Module setup in progress',
    type: 'vault',
    town: session.town,
    vaultModuleIds: session.selectedModuleIds,
    color: session.brandConfig?.color ?? '#3B6FD4',
    icon: session.brandConfig?.icon ?? '🏛️',
    createdAt: session.createdAt,
    lastAccessed: session.updatedAt,
    fileCount: 0,
    folderCount: 0,
    templateCount: 0,
    connectionIds: [],
  }
}

export function mergePrimaryEnvironment(primary: CaseSpace, environments: CaseSpace[]): CaseSpace[] {
  return [primary, ...environments.filter(environment => environment.id !== primary.id)]
}

export function resolveEnvironmentFromSources(
  environmentId: string,
  environments: CaseSpace[],
  builderSessions: BuilderSession[] = [],
): CaseSpace | null {
  const directMatch = environments.find(environment => environment.id === environmentId) ?? null
  if (directMatch) return directMatch

  const sessionMatch = builderSessions.find(session => session.id === environmentId)
  if (sessionMatch) {
    return builderSessionToEnvironment(sessionMatch)
  }

  return null
}
