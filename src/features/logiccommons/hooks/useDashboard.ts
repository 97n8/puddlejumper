import { useQuery } from '@tanstack/react-query'
import { pjBase } from '@/services/pjBase'

export interface ModuleStats {
  module_key: string
  display_name: string
  total: number
  open: number
  in_progress: number
  closed: number
  overdue: number
}

export interface DashboardStats {
  modules: ModuleStats[]
  summary: {
    total_records: number
    open_alerts: number
    overdue_records: number
    active_modules: number
  }
}

export function useDashboard() {
  return useQuery<DashboardStats>({
    queryKey: ['commons', 'dashboard'],
    queryFn: async () => {
      const res = await fetch(`${pjBase}/api/v1/commons/dashboard`, {
        credentials: 'include',
        headers: { 'x-puddlejumper-request': 'true' },
      })
      if (!res.ok) throw new Error('Failed to load dashboard')
      return res.json()
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
