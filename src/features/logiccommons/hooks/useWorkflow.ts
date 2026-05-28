import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pjBase } from '@/services/pjBase'

export function useWorkflow(instanceId: string | undefined) {
  const qc = useQueryClient()

  const advance = useMutation({
    mutationFn: () =>
      fetch(`${pjBase}/api/v1/commons/workflows/${instanceId}/advance`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'x-puddlejumper-request': 'true' },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commons', 'instance'] })
      qc.invalidateQueries({ queryKey: ['commons', 'workflow'] })
    },
  })

  return { advance: advance.mutate, isLoading: advance.isPending }
}
