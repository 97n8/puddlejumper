import { useQuery } from '@tanstack/react-query'
import { pjBase } from '@/services/pjBase'

async function fetchModuleInstance(recordId: string) {
  const res = await fetch(`${pjBase}/api/v1/commons/modules/by-record/${recordId}`, {
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to load module instance')
  return res.json()
}

async function fetchReadiness(instanceId: string) {
  const res = await fetch(`${pjBase}/api/v1/commons/closeout/${instanceId}/readiness`, {
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  })
  if (!res.ok) throw new Error('Failed to load readiness')
  return res.json()
}

export function useModuleInstance(recordId: string | undefined) {
  return useQuery({
    queryKey: ['commons', 'instance', recordId],
    queryFn: () => fetchModuleInstance(recordId!),
    enabled: !!recordId,
    staleTime: 30_000,
  })
}

export function useWorkflowReadiness(instanceId: string | undefined) {
  return useQuery({
    queryKey: ['commons', 'readiness', instanceId],
    queryFn: () => fetchReadiness(instanceId!),
    enabled: !!instanceId,
    staleTime: 30_000,
  })
}
