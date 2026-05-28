import { useState, useEffect, useCallback } from 'react'
import { pjBase } from '@/services/pjBase'
import { pjApi } from '@/services/pjApi'
import { toast } from 'sonner'
import type { ConnectorStatus } from '../types'

export function useConnectors() {
  const [connectors, setConnectors] = useState<Record<string, ConnectorStatus>>({})
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    pjApi.connectors.status()
      .then((d: unknown) => setConnectors(((d as Record<string,unknown>)?.connectors as Record<string, ConnectorStatus>) ?? {}))
      .catch(() => { /* connector status is non-critical; failures don't block UI */ })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const connect = useCallback(async (provider: 'microsoft' | 'google') => {
    setConnecting(provider)
    try {
      const res = await fetch(`${pjBase}/api/connectors/${provider}/auth/start`, {
        method: 'POST', credentials: 'include',
      })
      const data = res.ok ? await res.json() : null
      const url = data?.authUrl
      if (url) {
        const w = window.open(url, '_blank', 'width=600,height=700')
        const iv = setInterval(() => {
          if (w?.closed) { clearInterval(iv); setConnecting(null); refresh() }
        }, 1000)
      } else {
        toast.info(`Open Settings → Connections to connect ${provider === 'microsoft' ? 'Microsoft 365' : 'Google'}.`)
        setConnecting(null)
      }
    } catch {
      toast.error(`Failed to connect ${provider}`)
      setConnecting(null)
    }
  }, [refresh])

  return { connectors, loading, connecting, refresh, connect }
}
