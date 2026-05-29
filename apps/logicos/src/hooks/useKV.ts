/**
 * Drop-in replacement for @github/spark/hooks useKV.
 * Persists to localStorage AND syncs to PuddleJumper per-user server storage.
 *
 * On mount:
 *   1. Reads localStorage for immediate render (no flash)
 *   2. When server prefs arrive (via 'server-prefs-ready' event), upgrades the
 *      value from the server — server wins over stale localStorage.
 *
 * On write:
 *   - Writes to localStorage immediately (fast, synchronous)
 *   - Debounced write to server (600ms, via serverPrefsCache)
 *
 * API is identical: [value, setter] tuple, setter accepts a value or updater fn.
 */
import { useState, useEffect, useCallback } from 'react'
import { getServerPref, writeServerPref } from '@/services/serverPrefsCache'

type Setter<T> = (value: T | ((prev: T) => T)) => void

export function useKV<T>(key: string, defaultValue: T): [T, Setter<T>] {
  const [value, setValue] = useState<T>(() => {
    // If server prefs are already loaded (e.g. component mounts after auth), use them
    const serverVal = getServerPref(key)
    if (serverVal !== undefined) return serverVal as T
    // Otherwise use localStorage
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  // When server prefs load (async, after auth), update value if server has data
  useEffect(() => {
    const onPrefsReady = (e: Event) => {
      const serverPrefs = (e as CustomEvent<{ prefs: Record<string, unknown> }>).detail?.prefs
      if (!serverPrefs || !(key in serverPrefs)) return
      const serverVal = serverPrefs[key] as T
      setValue(serverVal)
      try { localStorage.setItem(key, JSON.stringify(serverVal)) } catch { /* quota */ }
    }
    window.addEventListener('server-prefs-ready', onPrefsReady)
    return () => window.removeEventListener('server-prefs-ready', onPrefsReady)
  }, [key])

  // Sync key change (different key passed to same hook instance)
  useEffect(() => {
    const serverVal = getServerPref(key)
    if (serverVal !== undefined) {
      setValue(serverVal as T)
      return
    }
    try {
      const raw = localStorage.getItem(key)
      setValue(raw !== null ? (JSON.parse(raw) as T) : defaultValue)
    } catch {
      setValue(defaultValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Cross-tab sync via StorageEvent
  useEffect(() => {
    const onOtherTab = (e: StorageEvent) => {
      if (e.key !== key) return
      try { setValue(e.newValue !== null ? (JSON.parse(e.newValue) as T) : defaultValue) }
      catch { setValue(defaultValue) }
    }
    // Same-tab sync (from another useKV instance)
    const onSameTab = (e: Event) => {
      const { key: k, value: v } = (e as CustomEvent<{ key: string; value: unknown }>).detail
      if (k !== key) return
      setValue(v as T)
    }
    window.addEventListener('kv-update', onSameTab)
    window.addEventListener('storage', onOtherTab)
    return () => {
      window.removeEventListener('kv-update', onSameTab)
      window.removeEventListener('storage', onOtherTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set: Setter<T> = useCallback(
    (updater) => {
      setValue((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater
        // 1. localStorage (synchronous, fast)
        try {
          localStorage.setItem(key, JSON.stringify(next))
          window.dispatchEvent(new CustomEvent('kv-update', { detail: { key, value: next } }))
        } catch { /* quota */ }
        // 2. Server (debounced, fire-and-forget)
        writeServerPref(key, next)
        return next
      })
    },
    [key],
  )

  return [value, set]
}

