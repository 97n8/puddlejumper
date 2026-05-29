import { useQuery } from '@tanstack/react-query'
import { pjBase } from '@/services/pjBase'

async function fetchArtifacts(instanceId: string) {
  const res = await fetch(`${pjBase}/api/v1/commons/outputs/bundle/${instanceId}`, {
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  })
  if (!res.ok) throw new Error('Failed to load outputs')
  return res.json()
}

export function useOutputs(instanceId: string | undefined) {
  return useQuery({
    queryKey: ['commons', 'outputs', instanceId],
    queryFn: () => fetchArtifacts(instanceId!),
    enabled: !!instanceId,
    staleTime: 30_000,
  })
}
