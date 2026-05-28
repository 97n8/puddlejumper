import { useState, useEffect, useCallback, useRef } from 'react'
import { pjApi } from '@/services/pjApi'
import { useAuth } from '@/services/auth/AuthContext'

export interface ConnectorStatus {
  google: boolean
  microsoft: boolean
  github: boolean
}

const EMPTY: ConnectorStatus = { google: false, microsoft: false, github: false }

// Module-level cache so parallel component mounts share a single in-flight request
let _cache: ConnectorStatus = EMPTY
let _cacheTime = 0
let _inflight: Promise<ConnectorStatus> | null = null
const CACHE_TTL_MS = 30_000

/** Reset module-level cache — test use only */
export function _resetCacheForTesting() {
  _cache = EMPTY
  _cacheTime = 0
  _inflight = null
}

async function fetchStatus(): Promise<ConnectorStatus> {
  if (_inflight) return _inflight
  _inflight = (async () => {
    try {
      const result = await pjApi.connectors.status() as { connectors?: Record<string, { connected?: boolean }> }
      const c = result?.connectors ?? {}
      const next: ConnectorStatus = {
        google: c.google?.connected ?? false,
        microsoft: c.microsoft?.connected ?? false,
        github: c.github?.connected ?? false,
      }
      _cache = next
      _cacheTime = Date.now()
      return next
    } finally {
      _inflight = null
    }
  })()
  return _inflight
}

/**
 * Shared connector status hook with module-level cache.
 * Parallel component mounts share one in-flight request.
 * Cache TTL is 30s — call `refresh()` to force re-fetch.
 */
export function useConnectorStatus(): {
  status: ConnectorStatus
  loading: boolean
  refresh: () => Promise<void>
  anyConnected: boolean
} {
  const { user } = useAuth()
  const [status, setStatus] = useState<ConnectorStatus>(_cache)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    _cacheTime = 0 // invalidate cache
    setLoading(true)
    try {
      const next = await fetchStatus()
      if (mountedRef.current) setStatus(next)
    } catch {
      // noop — status stays as last known value
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!user) { setStatus(EMPTY); setLoading(false); return }

    if (Date.now() - _cacheTime < CACHE_TTL_MS) {
      setStatus(_cache)
      setLoading(false)
      return
    }

    setLoading(true)
    fetchStatus()
      .then(next => { if (mountedRef.current) { setStatus(next); setLoading(false) } })
      .catch(() => { if (mountedRef.current) setLoading(false) })

    return () => { mountedRef.current = false }
  }, [user])

  const anyConnected = status.google || status.microsoft || status.github

  return { status, loading, refresh, anyConnected }
}
