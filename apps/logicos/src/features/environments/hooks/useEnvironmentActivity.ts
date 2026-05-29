import { useState, useEffect } from 'react'
import type { EnvironmentActivity } from '../types/environment'
import { pjBase } from '@/services/pjBase'

export function useEnvironmentActivity(environmentId?: string | null) {
  const [activities, setActivities] = useState<EnvironmentActivity[]>([])

  useEffect(() => {
    if (!environmentId) {
      setActivities([])
      return
    }

    let cancelled = false
    fetch(`${pjBase}/api/environments/${environmentId}/activity`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setActivities(Array.isArray(data) ? data : []) })
      .catch(err => console.error('[EnvironmentActivity] fetch failed:', err))
    return () => { cancelled = true }
  }, [environmentId])

  return { activities }
}
