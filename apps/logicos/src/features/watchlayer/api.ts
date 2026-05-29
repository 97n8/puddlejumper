import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjFetch } from '../../lib/api'
import type { WatchAlert, DigestSummary } from './types'

export function useWatchAlerts(params?: { severity?: string; domain?: string; status?: string }) {
  const filtered = params
    ? Object.fromEntries(Object.entries(params).filter(([, v]) => Boolean(v) && v !== 'all'))
    : {}
  const qs = Object.keys(filtered).length
    ? '?' + new URLSearchParams(filtered as Record<string, string>).toString()
    : ''
  return useQuery<WatchAlert[]>({
    queryKey: ['watch', 'alerts', params],
    queryFn: () => pjFetch<WatchAlert[]>(`/v1/watch/alerts${qs}`),
    refetchInterval: 60_000,
  })
}

export function useWatchDigest() {
  return useQuery<DigestSummary>({
    queryKey: ['watch', 'digest'],
    queryFn: () => pjFetch<DigestSummary>('/v1/watch/digest'),
    refetchInterval: 60_000,
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId, resolution_notes }: { alertId: string; resolution_notes?: string }) =>
      pjFetch<WatchAlert>(`/v1/watch/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution_notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watch'] }),
  })
}

export function useRunChecks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => pjFetch<void>('/v1/watch/run', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watch'] }),
  })
}
