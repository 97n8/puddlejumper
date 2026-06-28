import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjFetch } from '@/lib/api'
import type { AIInteraction, AIUsageSummary, AIModel } from './types'

export function useAIHistory() {
  return useQuery<AIInteraction[]>({
    queryKey: ['govai', 'history'],
    queryFn: () => pjFetch<AIInteraction[]>('/v1/ai/history'),
    staleTime: 30_000,
  })
}

export function useAIUsage() {
  return useQuery<AIUsageSummary>({
    queryKey: ['govai', 'usage'],
    queryFn: () => pjFetch<AIUsageSummary>('/v1/ai/usage'),
    staleTime: 60_000,
  })
}

export function useSubmitAIQuery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { model: AIModel; prompt: string }) =>
      pjFetch<{ response: string; interactionId: string; tokensUsed: number }>('/v1/ai/query', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['govai', 'history'] })
      qc.invalidateQueries({ queryKey: ['govai', 'usage'] })
    },
  })
}
