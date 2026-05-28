import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjFetch } from '@/lib/api'
import type { AuditEvent, EvidencePackage } from './types'

export function useAuditEvents() {
  return useQuery<AuditEvent[]>({
    queryKey: ['evidence', 'audit-events'],
    queryFn: () => pjFetch<AuditEvent[]>('/v1/audit/events?limit=100'),
    staleTime: 30_000,
  })
}

export function useEvidencePackages() {
  return useQuery<EvidencePackage[]>({
    queryKey: ['evidence', 'packages'],
    queryFn: () => pjFetch<EvidencePackage[]>('/v1/evidence/packages'),
    staleTime: 30_000,
  })
}

export function useGeneratePackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; description: string; eventIds: string[] }) =>
      pjFetch<EvidencePackage>('/v1/evidence/packages', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evidence', 'packages'] }),
  })
}
