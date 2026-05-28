import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjFetch } from '../../lib/api'
import type { FiscalYear, CompoundModel } from './types'

export function useFiscalYears() {
  return useQuery<FiscalYear[]>({
    queryKey: ['finance', 'fiscal-years'],
    queryFn: () => pjFetch<FiscalYear[]>('/v1/finance/fiscal-years'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCompoundModels(fiscalYearId?: string) {
  const qs = fiscalYearId ? `?fiscal_year_id=${fiscalYearId}` : ''
  return useQuery<CompoundModel[]>({
    queryKey: ['finance', 'models', fiscalYearId],
    queryFn: () => pjFetch<CompoundModel[]>(`/v1/finance/models${qs}`),
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateFiscalYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<FiscalYear>) =>
      pjFetch<FiscalYear>('/v1/finance/fiscal-years', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}

export function useCreateModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CompoundModel>) =>
      pjFetch<CompoundModel>('/v1/finance/models', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}

export function useDeleteModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      pjFetch<void>(`/v1/finance/models/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}
