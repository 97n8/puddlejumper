import { useState, useEffect } from 'react'
import type { EnvironmentMember } from '../types/environment'
import { pjBase } from '@/services/pjBase'

// Pull team members from local vault-settings when API returns empty (builder-session envs)
function localMembers(environmentId: string): EnvironmentMember[] {
  try {
    const settings: Record<string, { teamMembers?: EnvironmentMember[] }> =
      JSON.parse(localStorage.getItem(`vault-settings-${environmentId}`) ?? '{}')
    const seen = new Set<string>()
    const out: EnvironmentMember[] = []
    for (const mod of Object.values(settings)) {
      for (const m of mod.teamMembers ?? []) {
        if (!seen.has(m.id)) { seen.add(m.id); out.push(m) }
      }
    }
    return out
  } catch { return [] }
}

export function useEnvironmentMembers(environmentId?: string | null) {
  const [members, setMembers] = useState<EnvironmentMember[]>(() => environmentId ? localMembers(environmentId) : [])

  useEffect(() => {
    if (!environmentId) {
      setMembers([])
      return
    }

    let cancelled = false
    fetch(`${pjBase}/api/environments/${environmentId}/members`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: EnvironmentMember[]) => {
        if (!cancelled) {
          const apiMembers = Array.isArray(data) ? data : []
          setMembers(apiMembers.length > 0 ? apiMembers : localMembers(environmentId))
        }
      })
      .catch(() => { if (!cancelled) setMembers(localMembers(environmentId)) })
    return () => { cancelled = true }
  }, [environmentId])

  return { members, setMembers }
}
