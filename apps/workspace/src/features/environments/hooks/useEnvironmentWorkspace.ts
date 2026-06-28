import { useCallback, useEffect, useState } from 'react'
import { CaseSpace } from '@/lib/types'
import {
  CaseSpaceApiError,
  listCaseSpaces,
  logCaseSpaceResolutionFailure,
  updateCaseSpace as apiUpdate,
} from '@/services/casespaceApi'
import { listBuilderSessions } from '@/lib/vault-modules'
import { getDemoUserScope, type SuttonViewer } from '@/lib/environmentAccess'
import { ensureLogicvilleCaseSpace } from '../constants/logicville'
import { mergePrimaryEnvironment, resolveEnvironmentFromSources } from '../lib/environmentResolution'

export type EnvironmentWorkspaceState =
  | { status: 'loading' }
  | { status: 'unauthenticated'; message: string }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'not_found'; requestedId: string }
  | { status: 'ok'; environment: CaseSpace }

type UseEnvironmentWorkspaceResult = EnvironmentWorkspaceState & {
  refresh: () => Promise<void>
  setEnvironment: (environment: CaseSpace) => void
}

function getRequestScope(environmentId: string, viewer?: SuttonViewer | null) {
  const currentPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : ''
  const requestScope = currentPath || `/casespaces/${environmentId}`
  const demoScope = getDemoUserScope(viewer ?? null)
  return demoScope ? `${requestScope} [demo:${demoScope}]` : requestScope
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

async function resolveWorkspaceState(
  environmentId: string,
  viewer?: SuttonViewer | null,
): Promise<EnvironmentWorkspaceState> {
  const demoScope = getDemoUserScope(viewer ?? null)
  let spaces: CaseSpace[]

  try {
    spaces = await listCaseSpaces()
  } catch (error) {
    if (error instanceof CaseSpaceApiError && (error.status === 401 || error.status === 403)) {
      return { status: 'unauthenticated', message: error.message }
    }

    return {
      status: 'error',
      message: getErrorMessage(error, 'Unable to load case spaces.'),
    }
  }

  try {
    const builderSessions = demoScope ? listBuilderSessions(demoScope) : []
    if (spaces.length === 0 && builderSessions.length === 0) {
      return { status: 'empty' }
    }

    if (!demoScope) {
      const logicville = await ensureLogicvilleCaseSpace(spaces)
      const mergedSpaces = mergePrimaryEnvironment(logicville, spaces)
      const found = resolveEnvironmentFromSources(environmentId, mergedSpaces)
      if (!found) return { status: 'not_found', requestedId: environmentId }

      if (spaces.some(space => space.id === found.id)) {
        const updated = await apiUpdate(found.id, { lastAccessed: Date.now() }).catch(() => null)
        if (updated) return { status: 'ok', environment: updated }
      }

      return { status: 'ok', environment: found }
    }

    const found = resolveEnvironmentFromSources(environmentId, spaces, builderSessions)
    if (!found) return { status: 'not_found', requestedId: environmentId }

    if (spaces.some(space => space.id === found.id)) {
      const updated = await apiUpdate(found.id, { lastAccessed: Date.now() }).catch(() => null)
      if (updated) return { status: 'ok', environment: updated }
    }

    return { status: 'ok', environment: found }
  } catch (error) {
    return {
      status: 'error',
      message: getErrorMessage(error, 'Unable to resolve this case space.'),
    }
  }
}

export function useEnvironmentWorkspace(environmentId: string, viewer?: SuttonViewer | null) {
  const [state, setState] = useState<EnvironmentWorkspaceState>({ status: 'loading' })

  const logFailure = useCallback((status: 'unauthenticated' | 'not_found') => {
    void Promise.resolve(logCaseSpaceResolutionFailure({
      requestedId: environmentId,
      outcome: status,
      requestScope: getRequestScope(environmentId, viewer),
      actor: viewer?.sub ?? null,
    })).catch(() => {})
  }, [environmentId, viewer])

  const load = useCallback(async () => {
    const nextState = await resolveWorkspaceState(environmentId, viewer)
    if (nextState.status === 'unauthenticated' || nextState.status === 'not_found') {
      logFailure(nextState.status)
    }
    return nextState
  }, [environmentId, logFailure, viewer])

  useEffect(() => {
    let cancelled = false

    setState({ status: 'loading' })
    void load().then((nextState) => {
      if (!cancelled) setState(nextState)
    })

    return () => { cancelled = true }
  }, [load])

  const refresh = useCallback(async () => {
    setState({ status: 'loading' })
    const nextState = await load()
    setState(nextState)
  }, [load])

  const setEnvironment = useCallback((environment: CaseSpace) => {
    setState({ status: 'ok', environment })
  }, [])

  return { ...state, refresh, setEnvironment } as UseEnvironmentWorkspaceResult
}
