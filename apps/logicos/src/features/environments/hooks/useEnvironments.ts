import { useState, useEffect, useCallback } from 'react'
import { CaseSpace } from '@/lib/types'
import { filterEnvironmentsForUser, getDemoUserScope, type SuttonViewer } from '@/lib/environmentAccess'
import { listCaseSpaces, createCaseSpace as apiCreate, updateCaseSpace, deleteCaseSpace as apiDelete } from '@/services/casespaceApi'
import { BUILDER_SESSION_STORAGE_KEY_PREFIX, listBuilderSessions, deleteBuilderSession } from '@/lib/vault-modules'
import { ensureLogicvilleCaseSpace, LOGICVILLE_ENVIRONMENT_ID, ensurePhillipstonCaseSpace, PHILLIPSTON_ENVIRONMENT_ID } from '../constants/logicville'
import { LEGACY_DEMO_ENVIRONMENT_IDS } from '../constants/demoEnvironments'
import { builderSessionToEnvironment, mergePrimaryEnvironment } from '../lib/environmentResolution'
import { toast } from 'sonner'

async function loadAll(viewer?: SuttonViewer | null): Promise<CaseSpace[]> {
  const demoScope = getDemoUserScope(viewer ?? null)
  const serverEnvs = await listCaseSpaces().catch(() => [] as CaseSpace[])
  let merged = serverEnvs.filter(environment => !LEGACY_DEMO_ENVIRONMENT_IDS.has(environment.id))

  if (!demoScope) {
    // Merge builder sessions as a fallback — covers the case where API persist failed during activation
    try {
      const existingIds = new Set(merged.map(e => e.id))
      merged = [
        ...merged,
        ...listBuilderSessions(null)
          .filter(session => !existingIds.has(session.id) && !LEGACY_DEMO_ENVIRONMENT_IDS.has(session.id))
          .map(builderSessionToEnvironment),
      ]
    } catch { /* ignore */ }
    const [logicville, phillipston] = await Promise.all([
      ensureLogicvilleCaseSpace(merged),
      ensurePhillipstonCaseSpace(merged),
    ])
    const mergedWithSeeds = mergePrimaryEnvironment(logicville, merged)
    // Inject Phillipston after Logicville if not already present
    if (!mergedWithSeeds.find(e => e.id === PHILLIPSTON_ENVIRONMENT_ID)) {
      mergedWithSeeds.push(phillipston)
    }
    return mergedWithSeeds
  }

  try {
    const raw = localStorage.getItem('logicworkspace-casespaces')
    if (raw) {
      const local: CaseSpace[] = JSON.parse(raw)
      const serverIds = new Set(serverEnvs.map(e => e.id))
      const localOnly = local.filter(cs => !serverIds.has(cs.id) && !LEGACY_DEMO_ENVIRONMENT_IDS.has(cs.id))
      if (localOnly.length > 0) {
        merged = [...merged, ...localOnly]
        const results = await Promise.allSettled(localOnly.map(cs => apiCreate(cs)))
        // Only remove from localStorage if apiCreate actually returned a non-null CaseSpace
        const pushed = localOnly.filter((_, i) => {
          const r = results[i]
          return r.status === 'fulfilled' && (r as PromiseFulfilledResult<CaseSpace | null>).value !== null
        }).map(cs => cs.id)
        if (pushed.length > 0) {
          const remaining = local.filter(cs => !pushed.includes(cs.id))
          if (remaining.length === 0) localStorage.removeItem('logicworkspace-casespaces')
          else localStorage.setItem('logicworkspace-casespaces', JSON.stringify(remaining))
        }
      }
    }
  } catch { /* offline */ }

  // Always merge in builder sessions (VaultModuleMaker) — these are localStorage-only
  try {
    const existingIds = new Set(merged.map(e => e.id))
    merged = [
      ...merged,
      ...listBuilderSessions(demoScope)
        .filter(session => !existingIds.has(session.id) && !LEGACY_DEMO_ENVIRONMENT_IDS.has(session.id))
        .map(builderSessionToEnvironment),
    ]
  } catch { /* ignore */ }
  const [logicville, phillipston] = await Promise.all([
    ensureLogicvilleCaseSpace(merged),
    ensurePhillipstonCaseSpace(merged),
  ])
  const withoutSeeds = merged.filter(e => e.id !== LOGICVILLE_ENVIRONMENT_ID && e.id !== PHILLIPSTON_ENVIRONMENT_ID)
  const result = mergePrimaryEnvironment(logicville, withoutSeeds)
  if (!result.find(e => e.id === PHILLIPSTON_ENVIRONMENT_ID)) result.push(phillipston)
  return result
}

export function useEnvironments(viewer?: SuttonViewer | null) {
  const [environments, setEnvironments] = useState<CaseSpace[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const merged = await loadAll(viewer)
    setEnvironments(filterEnvironmentsForUser(merged, viewer))
    setLoading(false)
  }, [viewer])

  useEffect(() => {
    setLoading(true)
    refresh()

    // Re-merge whenever Module Builder or Apps/Bots write to localStorage
    const WATCHED = ['appforge-apps', 'studio-bots', 'logicworkspace-casespaces']
    function onStorage(e: StorageEvent) {
      if (!e.key || WATCHED.includes(e.key) || e.key.startsWith(BUILDER_SESSION_STORAGE_KEY_PREFIX)) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const createEnvironment = async (env: CaseSpace) => {
    // Optimistically add to state; also attempt to persist to server
    setEnvironments(prev => [...prev, env])
    const created = await apiCreate(env)
    if (created && created.id !== env.id) {
      // server returned a different id — swap it in
      setEnvironments(prev => prev.map(e => e.id === env.id ? created : e))
    } else if (!created) {
      // API failed — keep the optimistic entry (it's saved in localStorage by caller)
      toast.error('Could not sync to server — saved locally')
    }
  }

  const updateEnvironment = async (id: string, updates: Partial<CaseSpace>) => {
    setEnvironments(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    const updated = await updateCaseSpace(id, updates)
    if (!updated) toast.error('Could not sync update — saved locally')
  }

  const deleteEnvironment = async (id: string) => {
    const { ok, status } = await apiDelete(id)
    if (ok || status === 404) {
      // 404 = local-only (builder session never persisted to server) — clean it up
      if (status === 404) deleteBuilderSession(id)
      setEnvironments(prev => prev.filter(e => e.id !== id))
      toast.success('Environment deleted')
    } else if (status === 403) {
      toast.error("This environment can't be deleted")
    } else {
      toast.error('Failed to delete — please try again')
    }
  }

  return { environments, loading, refresh, createEnvironment, updateEnvironment, deleteEnvironment }
}
