import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { Plus } from 'lucide-react'
import { IntakeRecordApiError, useRecordsList, useSeedDemoData } from '../hooks/useIntakeRecord'
import { ModuleDetail } from './ModuleDetail'
import type { PRRRecord } from '../types'
import { pjBase } from '@/services/pjBase'

ModuleRegistry.registerModules([AllCommunityModule])

const STAGE_LABELS: Record<string, string[]> = {
  'VAULTCLERK.PublicRecords':   ['Received', 'Acknowledged', 'Records search', 'Draft response', 'Delivery', 'Closed'],
  'VAULTCLERK.OpenMeeting':     ['Meeting setup', 'Notice review', 'Posting', 'Packet gen', 'Meeting held', 'Minutes draft', 'Minutes approval', 'Publication'],
  'VAULTCLERK.BoardCompliance': ['Disclosure received', 'Review', 'Acknowledgement', 'Filing', 'Annual reconciliation'],
  'VAULTFISCAL.Procurement':    ['Request', 'Classification', 'Quote / bid', 'Award', 'Contract', 'Evidence', 'Archive'],
  'VAULTFISCAL.Budget':         ['Scenario', 'Review', 'Adoption', 'Cherry Sheet', 'Actual tracking', 'Closeout'],
  'VAULTFISCAL.Grants':         ['Award', 'Drawdown', 'Reporting', 'Closeout'],
  'VAULTTIME.PersonnelAdmin':   ['Position open', 'Recruitment', 'Appointment', 'Onboarding', 'Separation'],
  'VAULTPERMIT.Building':       ['Application', 'Review', 'Conditions', 'Approval / denial', 'Appeal window', 'Closeout'],
  'VAULTFIX.WorkOrder':         ['Request', 'Assignment', 'In progress', 'Resolution', 'Closeout', 'Asset update'],
}

const MODULE_LABELS: Record<string, { desc: string; requester: string; newLabel: string }> = {
  'VAULTCLERK.PublicRecords':   { desc: 'Request',             requester: 'Requester',    newLabel: 'New Request' },
  'VAULTCLERK.OpenMeeting':     { desc: 'Meeting / Hearing',   requester: 'Body',         newLabel: 'New Meeting' },
  'VAULTCLERK.BoardCompliance': { desc: 'Filing / Disclosure', requester: 'Board Member', newLabel: 'New Filing' },
  'VAULTFISCAL.Procurement':    { desc: 'Contract / Purchase', requester: 'Requestor',    newLabel: 'New Case' },
  'VAULTFISCAL.Budget':         { desc: 'Budget Item',         requester: 'Submitted By', newLabel: 'New Budget' },
  'VAULTFISCAL.Grants':         { desc: 'Grant Award',         requester: 'Manager',      newLabel: 'New Grant' },
  'VAULTTIME.PersonnelAdmin':   { desc: 'Personnel Action',    requester: 'Requested By', newLabel: 'New Action' },
  'VAULTPERMIT.Building':       { desc: 'Application / Address', requester: 'Applicant',  newLabel: 'New Permit' },
  'VAULTFIX.WorkOrder':         { desc: 'Description',         requester: 'Reported By',  newLabel: 'New Work Order' },
}

const STATUS_CHIP: Record<string, string> = {
  open:        'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-50 text-blue-700',
  closed:      'bg-green-50 text-green-700',
}

function getStageName(record: PRRRecord, moduleKey: string): string {
  if (record.workflow_stages) {
    try {
      const stages = JSON.parse(record.workflow_stages) as Array<{ label: string; status: string }>
      const active = stages.find(s => s.status === 'active')
      if (active) return active.label
    } catch { /* fall through */ }
  }
  const step = record.current_step ?? 1
  const labels = STAGE_LABELS[moduleKey] ?? []
  return labels[step - 1] ?? `Step ${step}`
}

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

interface Props {
  moduleKey: string
  displayName: string
  statute: string
  basePath: string
}

export function ModulePanel({ moduleKey, displayName, statute, basePath }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const pathParts = location.pathname.split('/')
  // basePath is like /commons/open-meeting, so segments 1=commons, 2=open-meeting
  const baseSegmentCount = basePath.split('/').filter(Boolean).length
  const recordId = pathParts[baseSegmentCount + 1] && pathParts[baseSegmentCount + 1] !== 'new'
    ? pathParts[baseSegmentCount + 1]
    : undefined

  if (recordId) {
    return (
      <ModuleDetail
        recordId={recordId}
        displayName={displayName}
        onBack={() => {
          const historyIndex = typeof window !== 'undefined' && typeof window.history.state?.idx === 'number'
            ? window.history.state.idx
            : 0
          if (historyIndex > 0) {
            navigate(-1)
            return
          }
          navigate(basePath)
        }}
      />
    )
  }

  return (
    <ModuleListView
      moduleKey={moduleKey}
      displayName={displayName}
      statute={statute}
      basePath={basePath}
    />
  )
}

function ModuleListView({ moduleKey, displayName, statute, basePath }: Props) {
  const navigate = useNavigate()
  const { data: records, isLoading, error } = useRecordsList(moduleKey)
  const seed = useSeedDemoData()
  const now = new Date()
  const labels = useMemo(
    () => MODULE_LABELS[moduleKey] ?? { desc: 'Description', requester: 'Requester', newLabel: 'New Record' },
    [moduleKey],
  )

  const list: PRRRecord[] = records ?? []
  const openCount = list.filter(r => r.status === 'open').length
  const inProgressCount = list.filter(r => r.status === 'in_progress').length
  const overdueCount = list.filter(r => r.sla_due_at && new Date(r.sla_due_at) < now && r.status !== 'closed').length

  const columnDefs = useMemo<ColDef<PRRRecord>[]>(() => [
    {
      field: 'id',
      headerName: 'ID',
      width: 90,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) => (
        <button
          className="text-primary hover:underline font-mono text-xs"
          onClick={() => navigate(`${basePath}/${params.value as string}`)}
        >
          {(params.value as string).slice(-8)}
        </button>
      ),
    },
    {
      field: 'request_description',
      headerName: labels.desc,
      flex: 1,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) => (
        <span className="text-xs truncate block leading-5">{params.value as string}</span>
      ),
    },
    {
      field: 'requester_name',
      headerName: labels.requester,
      width: 160,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) =>
        <span className="text-xs">{(params.value as string) ?? '—'}</span>,
    },
    {
      headerName: 'Stage',
      width: 175,
      valueGetter: (params) => params.data ? getStageName(params.data, moduleKey) : '',
      cellRenderer: (params: ICellRendererParams<PRRRecord>) =>
        <span className="text-xs">{params.value as string}</span>,
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
      field: 'created_at',
      headerName: 'Date',
      width: 105,
      cellRenderer: (params: ICellRendererParams<PRRRecord>) =>
        <span className="text-xs">{new Date(params.value as string).toLocaleDateString()}</span>,
    },
  ], [navigate, moduleKey, basePath, labels])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-4 flex-wrap shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">{displayName}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-mono bg-slate-100 rounded px-2 py-0.5">{moduleKey}</span>
            <span className="text-xs text-muted-foreground">{statute}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {list.length > 0 && (
            <>
              <span className="text-xs bg-slate-100 text-slate-700 rounded-md px-2 py-0.5 font-medium">Open: {openCount}</span>
              <span className="text-xs bg-blue-50 text-blue-700 rounded-md px-2 py-0.5 font-medium">Active: {inProgressCount}</span>
              {overdueCount > 0 && (
                <span className="text-xs bg-red-50 text-red-700 rounded-md px-2 py-0.5 font-medium">Overdue: {overdueCount}</span>
              )}
            </>
          )}
          <button
            onClick={() => navigate(`${basePath}/new`)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            {labels.newLabel}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">
            {getRecordsErrorMessage(error)}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-10">
            <div className="text-4xl">📂</div>
            <div>
              <p className="text-sm font-semibold">No {displayName.toLowerCase()} records yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Load the Logicville demo to see this module in action, or create your first record.
              </p>
            </div>
            <button
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
              className="text-xs font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {seed.isPending ? 'Loading demo…' : 'Load Logicville demo data'}
            </button>
          </div>
        ) : (
          <div className="ag-theme-quartz h-full w-full">
            <AgGridReact<PRRRecord>
              rowData={list}
              columnDefs={columnDefs}
              rowHeight={44}
              defaultColDef={{ resizable: true, sortable: true }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
