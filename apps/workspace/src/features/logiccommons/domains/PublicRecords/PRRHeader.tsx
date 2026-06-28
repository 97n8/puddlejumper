import { useRecordsList } from '../../hooks/useIntakeRecord'
import { Plus } from 'lucide-react'
import type { PRRRecord } from '../../types'

interface Props {
  onNewRequest: () => void
}

export function PRRHeader({ onNewRequest }: Props) {
  const { data: records } = useRecordsList('VAULTCLERK.PublicRecords')
  const now = new Date()
  const list: PRRRecord[] = records ?? []
  const openCount = list.filter(r => r.status === 'open').length
  const inProgressCount = list.filter(r => r.status === 'in_progress').length
  const overdueCount = list.filter(r => r.sla_due_at && new Date(r.sla_due_at) < now && r.status !== 'closed').length
  const closedCount = list.filter(r => r.status === 'closed').length

  return (
    <div className="border-b px-6 py-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-bold">Public Records</h2>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs font-mono bg-slate-100 rounded px-2 py-0.5">VAULTCLERK.PublicRecords</span>
          <span className="text-xs text-muted-foreground">MGL c.66</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs bg-slate-100 text-slate-700 rounded-md px-2 py-0.5 font-medium">Open: {openCount}</span>
        <span className="text-xs bg-blue-50 text-blue-700 rounded-md px-2 py-0.5 font-medium">In Progress: {inProgressCount}</span>
        <span className="text-xs bg-red-50 text-red-700 rounded-md px-2 py-0.5 font-medium">Overdue: {overdueCount}</span>
        <span className="text-xs bg-slate-100 text-slate-500 rounded-md px-2 py-0.5 font-medium">Closed: {closedCount}</span>
        <button
          onClick={onNewRequest}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} />
          New Request
        </button>
      </div>
    </div>
  )
}
