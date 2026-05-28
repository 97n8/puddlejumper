import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjFetch } from '@/lib/api'
import type { ProcurementItem, ProcurementStatus } from './types'

export function useProcurements() {
  return useQuery<ProcurementItem[]>({
    queryKey: ['procurement', 'items'],
    queryFn: () => pjFetch<ProcurementItem[]>('/v1/procurement/items'),
    staleTime: 30_000,
  })
}

export function useCreateProcurement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<ProcurementItem, 'id' | 'departmentId' | 'mglCompliant' | 'createdAt' | 'status'>) =>
      pjFetch<ProcurementItem>('/v1/procurement/items', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement'] }),
  })
}

export function useUpdateProcurementStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProcurementStatus }) =>
      pjFetch<ProcurementItem>(`/v1/procurement/items/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement'] }),
  })
}
