import { useQuery } from '@tanstack/react-query'
import { pjBase } from '@/services/pjBase'

async function fetchContext() {
  const res = await fetch(`${pjBase}/api/v1/commons/context`, {
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  })
  if (!res.ok) throw new Error('Failed to load municipality context')
  return res.json()
}

export function useCommonsContext() {
  return useQuery({
    queryKey: ['commons', 'context'],
    queryFn: fetchContext,
    staleTime: 60_000,
  })
}
