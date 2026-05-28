import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { IntakeRecordApiError, useRecordsList, useSeedDemoData } from '../../hooks/useIntakeRecord'
import { pjBase } from '@/services/pjBase'
import type { PRRRecord } from '../../types'

ModuleRegistry.registerModules([AllCommunityModule])

function getRecordsErrorMessage(error: unknown): string {
  if (error instanceof IntakeRecordApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again to load records.'
    if (error.status === 403) return 'You do not have access to these records.'
    return error.message || 'Failed to load records from the Commons service.'
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (import.meta.env.DEV) {
    return `Failed to load records. Check PuddleJumper at ${pjBase || 'localhost:3002'}.`
  }
  return 'Failed to load records from the Commons service.'
}

const STAGE_LABELS = ['Received', 'Acknowledged', 'Records search', 'Draft response', 'Delivery', 'Closed']

function getStageName(record: PRRRecord): string {
  if (record.workflow_stages) {
    try {
      const stages = JSON.parse(record.workflow_stages) as Array<{ label: string; status: string }>
      const active = stages.find(s => s.status === 'active')
      if (active) return active.label
      const last = stages.filter(s => s.status === 'complete').pop()
      if (last) return last.label
    } catch { /* fall through */ }
  }
  const step = record.current_step ?? 1
  return STAGE_LABELS[step - 1] ?? `Step ${step}`
}

const STATUS_CHIP: Record<string, string> = {
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-50 text-blue-700',
  closed: 'bg-green-50 text-green-700',
}

export function PRRList() {
  const navigate = useNavigate()
  const { data: records, isLoading, error } = useRecordsList('VAULTCLERK.PublicRecords')
  const seed = useSeedDemoData()

  const columnDefs = useMemo<ColDef<PRRRecord>[]>(() => [
    {
      field: 'id',
      headerName: 'ID',
      width: 100,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) => (
        <button
          className="text-primary hover:underline font-mono text-xs"
          onClick={() => navigate(`/commons/public-records/${params.value as string}`)}
        >
          {(params.value as string).slice(0, 12)}…
        </button>
      ),
    },
    {
      field: 'requester_name',
      headerName: 'Requester',
      width: 160,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) =>
        <span>{params.value as string ?? '—'}</span>,
    },
    {
      headerName: 'Stage',
      width: 180,
      valueGetter: (params) => params.data ? getStageName(params.data) : '',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) => {
        const v = params.value as string
        return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CHIP[v] ?? ''}`}>{v.replace('_', ' ')}</span>
      },
    },
    {
      field: 'sla_due_at',
      headerName: 'SLA Due',
      width: 120,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) => {
        if (!params.value) return <span className="text-muted-foreground text-xs">—</span>
        const due = new Date(params.value as string)
        const now = new Date()
        const isOverdue = due < now
        const isSoon = !isOverdue && (due.getTime() - now.getTime()) < 3 * 24 * 60 * 60 * 1000
        const cls = isOverdue ? 'text-red-600 font-semibold' : isSoon ? 'text-amber-600' : ''
        return <span className={cls}>{due.toLocaleDateString()}</span>
      },
    },
    {
      field: 'created_at',
      headerName: 'Received',
      width: 110,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) =>
        new Date(params.value as string).toLocaleDateString(),
    },
    {
      field: 'intake_channel',
      headerName: 'Channel',
      width: 100,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) =>
        <span className="capitalize text-xs">{(params.value as string ?? '').replace('_', ' ')}</span>,
    },
  ], [navigate])

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading records…</div>
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{getRecordsErrorMessage(error)}</div>
  }

  if (!records || records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-10">
        <div className="text-4xl">📂</div>
        <div>
          <p className="text-sm font-semibold">No public records requests yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a new request or load the Logicville demo data to get started.</p>
        </div>
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="text-xs font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {seed.isPending ? 'Loading demo…' : 'Load Logicville demo data'}
        </button>
      </div>
    )
  }

  return (
    <div className="ag-theme-quartz h-full w-full" style={{ minHeight: 400 }}>
      <AgGridReact<PRRRecord>
        rowData={records}
        columnDefs={columnDefs}
        rowHeight={44}
        defaultColDef={{ resizable: true, sortable: true }}
      />
    </div>
  )
}
