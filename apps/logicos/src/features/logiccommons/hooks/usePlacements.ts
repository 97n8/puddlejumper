import { useQuery } from '@tanstack/react-query'
import { pjBase } from '@/services/pjBase'

async function fetchPlacements(instanceId: string) {
  const res = await fetch(`${pjBase}/api/v1/commons/placements/instance/${instanceId}`, {
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  })
  if (!res.ok) throw new Error('Failed to load placements')
  return res.json()
}

export function usePlacements(instanceId: string | undefined) {
  return useQuery({
    queryKey: ['commons', 'placements', instanceId],
    queryFn: () => fetchPlacements(instanceId!),
    enabled: !!instanceId,
    staleTime: 30_000,
  })
}
