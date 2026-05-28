import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjBase } from '@/services/pjBase'
import type { CommonsAlert } from '../types'

async function fetchAlerts(params?: { severity?: string; domain?: string }): Promise<CommonsAlert[]> {
  const url = new URL(`${pjBase}/api/v1/commons/alerts`)
  if (params?.severity && params.severity !== 'all') url.searchParams.set('severity', params.severity)
  if (params?.domain   && params.domain   !== 'all') url.searchParams.set('domain',   params.domain)
  const res = await fetch(url.toString(), {
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  })
  if (!res.ok) throw new Error('Failed to load alerts')
  return res.json()
}

export function useCommonsAlerts(params?: { severity?: string; domain?: string }) {
  return useQuery({
    queryKey: ['commons', 'alerts', params],
    queryFn: () => fetchAlerts(params),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (alertId: string) =>
      fetch(`${pjBase}/api/v1/commons/alerts/${alertId}/acknowledge`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'x-puddlejumper-request': 'true' },
      }),
    onError: (err) => console.error('Acknowledge failed', err),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commons', 'alerts'] }),
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId, notes }: { alertId: string; notes: string }) =>
      fetch(`${pjBase}/api/v1/commons/alerts/${alertId}/resolve`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-puddlejumper-request': 'true' },
        body: JSON.stringify({ notes }),
      }),
    onError: (err) => console.error('Resolve failed', err),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commons', 'alerts'] }),
  })
}
