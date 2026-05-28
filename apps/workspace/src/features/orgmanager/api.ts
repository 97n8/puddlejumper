import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjFetch } from '../../lib/api'
import type { OrgPosition, OrgDelegation } from './types'

export function useOrgChart() {
  return useQuery<OrgPosition[]>({
    queryKey: ['org', 'chart'],
    queryFn: () => pjFetch<OrgPosition[]>('/v1/org/chart'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useOrgDelegations() {
  return useQuery<OrgDelegation[]>({
    queryKey: ['org', 'delegations'],
    queryFn: () => pjFetch<OrgDelegation[]>('/v1/org/delegations'),
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<OrgDelegation>) =>
      pjFetch<OrgDelegation>('/v1/org/delegations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org'] }),
  })
}

export function useRevokeDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      pjFetch<void>(`/v1/org/delegations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org'] }),
  })
}

export function useOrgImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { rows: Record<string, string>[] }) =>
      pjFetch<{ importId: string | null; id?: string; preview: unknown[]; errors: Array<{ row: number; field: string; message: string }>; successCount?: number; success?: number }>(
        '/v1/org/import',
        { method: 'POST', body: JSON.stringify(payload) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org'] }),
  })
}

export function usePublishImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (importId: string) =>
      pjFetch<void>(`/v1/org/import/${importId}/publish`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org'] }),
  })
}

/** Lookup helper — returns Finance Authority positions for use in other modules (e.g. CGM) */
export function useOrgRoleHolders(role: string) {
  const { data: positions = [], ...rest } = useOrgChart()
  return {
    ...rest,
    data: positions.filter(p =>
      p.employmentStatus !== 'inactive' &&
      (p.governanceRoles ?? []).includes(role),
    ),
  }
}
