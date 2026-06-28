import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjFetch } from '../../lib/api'
import type { PRRRequest } from './types'

export function usePRRRequests() {
  return useQuery<PRRRequest[]>({
    queryKey: ['records', 'prr'],
    queryFn: async () => {
      try {
        return await pjFetch<PRRRequest[]>('/prr')
      } catch {
        return pjFetch<PRRRequest[]>('/prr/list')
      }
    },
    staleTime: 30_000,
  })
}

export function useCreatePRR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { requester_name: string; requester_email: string; request_description: string }) =>
      pjFetch<PRRRequest>('/prr/intake', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
  })
}

export function useAcknowledgePRR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      pjFetch<PRRRequest>(`/prr/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
  })
}

export function useClosePRR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      pjFetch<PRRRequest>(`/prr/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
  })
}
