import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjFetch } from '../../lib/api'
import type { RoutingRule } from './types'

export function useRoutingRules() {
  return useQuery<RoutingRule[]>({
    queryKey: ['routing', 'rules'],
    queryFn: () => pjFetch<RoutingRule[]>('/api/v1/routing/rules'),
    staleTime: 60_000,
  })
}

export function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<RoutingRule, 'id' | 'hitCount' | 'createdAt' | 'lastTriggeredAt'>) =>
      pjFetch<RoutingRule>('/api/v1/routing/rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  })
}

export function useToggleRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      pjFetch<RoutingRule>(`/api/v1/routing/rules/${id}/toggle`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  })
}
