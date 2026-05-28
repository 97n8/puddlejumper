import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Buildings, ArrowLeft, Plus, MagnifyingGlass,
  ArrowClockwise, Trash, DownloadSimple, Upload, PencilSimple,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { pjFetch } from '@/lib/api'
import type { OrgPosition } from '../types'
import {
  useOrgChart, useOrgDelegations, useCreateDelegation,
  useRevokeDelegation, useOrgImport, usePublishImport,
} from '../api'

// ── Zod schemas ──────────────────────────────────────────────────────────────

const GOVERNANCE_ROLES = [
  { id: 'administrator',         label: 'Administrator' },
  { id: 'finance_authority',     label: 'Finance Authority' },
  { id: 'grant_manager',         label: 'Grant Manager' },
  { id: 'project_owner',         label: 'Project Owner' },
  { id: 'auditor',               label: 'Auditor' },
  { id: 'procurement_authority', label: 'Procurement Authority' },
  { id: 'records_authority',     label: 'Records Authority (RAO)' },
] as const

const positionSchema = z.object({
  employeeId: z.string().min(1, 'Required'),
  fullName: z.string().min(1, 'Required'),
  title: z.string().min(1, 'Required'),
  department: z.string().min(1, 'Required'),
  supervisorId: z.string().optional(),
  email: z.string().email('Valid email required'),
  employmentStatus: z.enum(['active', 'inactive', 'vacant', 'acting', 'interim']),
  authorityLevel: z.coerce.number().min(1).max(10),
  governanceRoles: z.array(z.string()).optional(),
  actingForPositionId: z.string().optional(),
  actingStartDate: z.string().optional(),
  separationDate: z.string().optional(),
})

const delegationSchema = z.object({
  delegatorId: z.string().min(1, 'Required'),
  delegateeId: z.string().min(1, 'Required'),
  scope: z.enum(['procurement', 'approvals', 'records', 'finance', 'all']),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().optional(),
  reason: z.string().min(1, 'Required'),
})

type PositionForm = z.infer<typeof positionSchema>
type DelegationForm = z.infer<typeof delegationSchema>

// ── Status badge helper ────────────────────────────────────────────────────

const CSV_HEADERS = [
  'employee_id', 'full_name', 'title', 'department', 'supervisor_id',
  'email', 'employment_status', 'authority_level', 'acting_for_position_id', 'separation_date',
]

function StatusBadge({ status }: { status: OrgPosition['employmentStatus'] }) {
  const cls = {
    active: 'bg-emerald-500/10 text-emerald-600',
    vacant: 'bg-amber-500/10 text-amber-600',
    acting: 'bg-blue-500/10 text-blue-600',
    interim: 'bg-blue-500/10 text-blue-600',
    inactive: 'bg-muted text-muted-foreground',
  }[status]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {status}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function OrgManagerPanel({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('chart')

  const [newPositionOpen, setNewPositionOpen] = useState(false)
  const [editPosition, setEditPosition] = useState<OrgPosition | null>(null)
  const [newDelegationOpen, setNewDelegationOpen] = useState(false)

  const [csvRows, setCsvRows] = useState<string[][] | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[] | null>(null)
  const [importId, setImportId] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<Array<{ row: number; field: string; message: string }> | null>(null)
  const [importSuccess, setImportSuccess] = useState<number | null>(null)

  const { data: positions = [], isLoading: loadingPositions, refetch: refetchPositions } = useOrgChart()
  const { data: delegations = [], isLoading: loadingDelegations } = useOrgDelegations()
  const createDelegation = useCreateDelegation()
  const revokeDelegationMutation = useRevokeDelegation()
  const orgImportMutation = useOrgImport()
  const publishImportMutation = usePublishImport()

  // ── Helpers ────────────────────────────────────────────────────────────

  const positionName = (id: string | null) => {
    if (!id) return '—'
    const p = positions.find(p => p.id === id)
    return p ? `${p.fullName} (${p.title})` : id
  }

  // ── Position form ──────────────────────────────────────────────────────

  const positionForm = useForm<PositionForm>({
    resolver: zodResolver(positionSchema),
    defaultValues: { employmentStatus: 'active', authorityLevel: 5, governanceRoles: [] },
  })

  const openEditPosition = (p: OrgPosition) => {
    setEditPosition(p)
    positionForm.reset({
      employeeId: p.employeeId,
      fullName: p.fullName,
      title: p.title,
      department: p.department,
      supervisorId: p.supervisorId ?? '',
      email: p.email,
      employmentStatus: p.employmentStatus,
      authorityLevel: p.authorityLevel,
      governanceRoles: p.governanceRoles ?? [],
      actingForPositionId: p.actingForPositionId ?? '',
      actingStartDate: p.actingStartDate ?? '',
      separationDate: p.separationDate ?? '',
    })
    setNewPositionOpen(true)
  }

  const openNewPosition = () => {
    setEditPosition(null)
    positionForm.reset({ employmentStatus: 'active', authorityLevel: 5, governanceRoles: [] })
    setNewPositionOpen(true)
  }

  const onSubmitPosition = async (data: PositionForm) => {
    try {
      if (editPosition) {
        await pjFetch(`/v1/org/positions/${editPosition.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        })
        toast.success('Position updated')
      } else {
        await pjFetch('/v1/org/positions', {
          method: 'POST',
          body: JSON.stringify(data),
        })
        toast.success('Position created')
      }
      setNewPositionOpen(false)
      setEditPosition(null)
      positionForm.reset()
      refetchPositions()
    } catch {
      toast.error(editPosition ? 'Failed to update position' : 'Failed to create position')
    }
  }

  // ── Delegation form ────────────────────────────────────────────────────

  const delegationForm = useForm<DelegationForm>({
    resolver: zodResolver(delegationSchema),
    defaultValues: { scope: 'approvals' },
  })

  const onSubmitDelegation = async (data: DelegationForm) => {
    try {
      await createDelegation.mutateAsync(data)
      toast.success('Delegation created')
      setNewDelegationOpen(false)
      delegationForm.reset()
    } catch {
      toast.error('Failed to create delegation')
    }
  }

  const revokeDelegation = async (id: string) => {
    try {
      await revokeDelegationMutation.mutateAsync(id)
      toast.success('Delegation revoked')
    } catch {
      toast.error('Failed to revoke delegation')
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_HEADERS.join(',') + '\n'], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'org-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { toast.error('CSV has no data rows'); return }
      const headers = lines[0].split(',').map(h => h.trim())
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()))
      setCsvHeaders(headers)
      setCsvRows(rows)
      setImportId(null)
      setImportErrors(null)
      setImportSuccess(null)
    }
    reader.readAsText(file)
  }

  const validateAndImport = async () => {
    if (!csvRows || !csvHeaders) return
    try {
      const payload = {
        rows: csvRows.map(r => Object.fromEntries(csvHeaders.map((h, i) => [h, r[i] ?? '']))),
      }
      const result = await orgImportMutation.mutateAsync(payload)
      setImportId(result.importId ?? result.id ?? null)
      setImportErrors(result.errors ?? [])
      setImportSuccess(result.successCount ?? result.success ?? 0)
      if (!result.errors?.length) {
        toast.success(`${result.successCount ?? result.success ?? 0} rows validated`)
      } else {
        toast.warning(`Validation found ${result.errors.length} error(s)`)
      }
    } catch {
      toast.error('Import request failed')
    }
  }

  const publishImport = async () => {
    if (!importId) return
    try {
      await publishImportMutation.mutateAsync(importId)
      toast.success('Org chart published')
      setImportId(null)
      setCsvRows(null)
      setCsvHeaders(null)
      setImportErrors(null)
      setImportSuccess(null)
      refetchPositions()
    } catch {
      toast.error('Publish failed')
    }
  }

  // ── Filtered positions ─────────────────────────────────────────────────

  const filtered = positions.filter(p => {
    const q = search.toLowerCase()
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q)
    )
  })

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <Buildings size={20} className="text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">Org Manager</h1>
          <p className="text-xs text-muted-foreground">Track positions, authority, and who's authorized to act on behalf of whom</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetchPositions()} aria-label="Refresh">
          <ArrowClockwise size={16} />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="chart">Org Chart</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="delegations">Delegations</TabsTrigger>
            </TabsList>

            {/* ── Tab: Org Chart ── */}
            <TabsContent value="chart">
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search by name, title, department…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={openNewPosition}>
                  <Plus size={15} className="mr-1.5" />
                  New Position
                </Button>
              </div>

              {loadingPositions ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-md" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {search ? 'No positions match your search.' : 'No positions on file. Import your org chart from a CSV or add positions manually. Each position tracks authority level, employment status, and supervisor relationships.'}
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Title</th>
                        <th className="text-left px-3 py-2 font-medium">Department</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-left px-3 py-2 font-medium">Level</th>
                        <th className="text-left px-3 py-2 font-medium">Supervisor</th>
                        <th className="text-left px-3 py-2 font-medium">Governance Roles</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(p => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 font-medium">{p.fullName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.title}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.department}</td>
                          <td className="px-3 py-2"><StatusBadge status={p.employmentStatus} /></td>
                          <td className="px-3 py-2 text-center">{p.authorityLevel}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{positionName(p.supervisorId)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {(p.governanceRoles ?? []).map(r => (
                                <span key={r} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                                  {GOVERNANCE_ROLES.find(g => g.id === r)?.label ?? r}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => openEditPosition(p)} aria-label="Edit"
                            >
                              <PencilSimple size={13} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Import ── */}
            <TabsContent value="import">
              <div className="space-y-6 max-w-2xl">

                {/* ── CivicPlus sync section ── */}
                <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                  <p className="text-sm font-medium text-blue-900">Sync from CivicPlus</p>
                  <p className="text-xs text-blue-700">
                    Staff positions and department data from CivicPlus are pulled into Org Manager automatically
                    once a CivicPlus Staff feed is running in Syncronate. Set up the feed there, then new
                    and changed positions appear here after the next scheduled run.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    To pull calendar and meeting data, set up a CivicPlus Calendar feed in Syncronate.
                    Recurring meetings, board appointments, and public notices sync into Deadline Tracking and Flows automatically.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <DownloadSimple size={15} className="mr-1.5" />
                    Download CSV Template
                  </Button>
                  <Label
                    htmlFor="csv-upload"
                    className="flex items-center gap-1.5 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Upload size={15} />
                    Choose CSV file
                  </Label>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={onCsvFile}
                  />
                </div>

                {csvRows && csvHeaders && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Previewing {csvRows.length} row(s) — showing first 10
                    </p>
                    <div className="rounded-md border overflow-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            {csvHeaders.map(h => (
                              <th key={h} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.slice(0, 10).map((row, i) => (
                            <tr key={i} className="border-b last:border-0">
                              {row.map((cell, j) => (
                                <td key={j} className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={validateAndImport} disabled={orgImportMutation.isPending}>
                        {orgImportMutation.isPending ? 'Validating…' : 'Validate & Import'}
                      </Button>
                      {importId && !importErrors?.length && (
                        <Button size="sm" variant="default" onClick={publishImport} disabled={publishImportMutation.isPending}>
                          {publishImportMutation.isPending ? 'Publishing…' : 'Publish'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {importSuccess !== null && (
                  <div className="rounded-md border p-4 space-y-2">
                    <p className="text-sm font-medium text-emerald-600">{importSuccess} row(s) validated successfully</p>
                    {importErrors && importErrors.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">{importErrors.length} error(s):</p>
                        {importErrors.map((err, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            Row {err.row} · <span className="font-medium">{err.field}</span> — {err.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab: Delegations ── */}
            <TabsContent value="delegations">
              <div className="flex justify-end mb-4">
                <Button size="sm" onClick={() => setNewDelegationOpen(true)}>
                  <Plus size={15} className="mr-1.5" />
                  New Delegation
                </Button>
              </div>

              {loadingDelegations ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-md" />
                  ))}
                </div>
              ) : delegations.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  No delegations yet.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium">Delegator → Delegatee</th>
                        <th className="text-left px-3 py-2 font-medium">Scope</th>
                        <th className="text-left px-3 py-2 font-medium">Start</th>
                        <th className="text-left px-3 py-2 font-medium">End</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {delegations.map(d => (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2">
                            <span className="font-medium">{positionName(d.delegatorId)}</span>
                            <span className="text-muted-foreground mx-1">→</span>
                            <span>{positionName(d.delegateeId)}</span>
                          </td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">{d.scope}</td>
                          <td className="px-3 py-2 text-muted-foreground">{d.startDate}</td>
                          <td className="px-3 py-2 text-muted-foreground">{d.endDate ?? '—'}</td>
                          <td className="px-3 py-2">
                            {d.revokedAt ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">revoked</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600">active</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {!d.revokedAt && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => revokeDelegation(d.id)}
                                aria-label="Revoke"
                              >
                                <Trash size={14} />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── New / Edit Position Dialog ── */}
      <Dialog open={newPositionOpen} onOpenChange={open => { setNewPositionOpen(open); if (!open) setEditPosition(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPosition ? 'Edit Position' : 'New Position'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={positionForm.handleSubmit(onSubmitPosition)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Employee ID</Label>
                <Input {...positionForm.register('employeeId')} />
                {positionForm.formState.errors.employeeId && (
                  <p className="text-xs text-destructive">{positionForm.formState.errors.employeeId.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input {...positionForm.register('fullName')} />
                {positionForm.formState.errors.fullName && (
                  <p className="text-xs text-destructive">{positionForm.formState.errors.fullName.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input {...positionForm.register('title')} />
                {positionForm.formState.errors.title && (
                  <p className="text-xs text-destructive">{positionForm.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input {...positionForm.register('department')} />
                {positionForm.formState.errors.department && (
                  <p className="text-xs text-destructive">{positionForm.formState.errors.department.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" {...positionForm.register('email')} />
                {positionForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{positionForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Authority Level (1 = limited, 10 = full signing authority)</Label>
                <Input type="number" min={1} max={10} {...positionForm.register('authorityLevel')} />
                {positionForm.formState.errors.authorityLevel && (
                  <p className="text-xs text-destructive">{positionForm.formState.errors.authorityLevel.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Employment Status</Label>
                <Select
                  value={positionForm.watch('employmentStatus')}
                  onValueChange={v => positionForm.setValue('employmentStatus', v as PositionForm['employmentStatus'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="vacant">Vacant</SelectItem>
                    <SelectItem value="acting">Acting</SelectItem>
                    <SelectItem value="interim">Interim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Supervisor <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select
                  value={positionForm.watch('supervisorId') ?? ''}
                  onValueChange={v => positionForm.setValue('supervisorId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supervisor</SelectItem>
                    {positions
                      .filter(p => !editPosition || p.id !== editPosition.id)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.fullName} — {p.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Acting/Interim fields */}
            {(positionForm.watch('employmentStatus') === 'acting' || positionForm.watch('employmentStatus') === 'interim') && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50">
                <div className="space-y-1">
                  <Label>Acting For <span className="text-muted-foreground text-xs">(position)</span></Label>
                  <Select
                    value={positionForm.watch('actingForPositionId') ?? ''}
                    onValueChange={v => positionForm.setValue('actingForPositionId', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {positions
                        .filter(p => !editPosition || p.id !== editPosition.id)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.fullName} — {p.title}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Acting Start Date</Label>
                  <Input type="date" {...positionForm.register('actingStartDate')} />
                </div>
              </div>
            )}

            {/* Governance Roles */}
            <div className="space-y-2">
              <Label>Governance Roles <span className="text-muted-foreground text-xs">(resolved at runtime by CGM and other modules)</span></Label>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-md border bg-muted/30">
                {GOVERNANCE_ROLES.map(role => {
                  const current = positionForm.watch('governanceRoles') ?? []
                  const checked = current.includes(role.id)
                  return (
                    <div key={role.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={checked}
                        onCheckedChange={val => {
                          const next = val
                            ? [...current, role.id]
                            : current.filter(r => r !== role.id)
                          positionForm.setValue('governanceRoles', next)
                        }}
                      />
                      <label htmlFor={`role-${role.id}`} className="text-xs cursor-pointer select-none">
                        {role.label}
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Separation date */}
            <div className="space-y-1">
              <Label>Separation Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="date" {...positionForm.register('separationDate')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setNewPositionOpen(false); setEditPosition(null) }}>Cancel</Button>
              <Button type="submit" disabled={positionForm.formState.isSubmitting}>
                {positionForm.formState.isSubmitting ? (editPosition ? 'Saving…' : 'Creating…') : (editPosition ? 'Save Changes' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── New Delegation Dialog ── */}
      <Dialog open={newDelegationOpen} onOpenChange={setNewDelegationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Delegation</DialogTitle>
          </DialogHeader>
          <form onSubmit={delegationForm.handleSubmit(onSubmitDelegation)} className="space-y-3">
            <div className="space-y-1">
              <Label>Delegator (from)</Label>
              <Select
                value={delegationForm.watch('delegatorId') ?? ''}
                onValueChange={v => delegationForm.setValue('delegatorId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select delegator" />
                </SelectTrigger>
                <SelectContent>
                  {positions.filter(p => p.employmentStatus === 'active' || p.employmentStatus === 'interim').map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.fullName} — {p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {delegationForm.formState.errors.delegatorId && (
                <p className="text-xs text-destructive">{delegationForm.formState.errors.delegatorId.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Delegatee (to)</Label>
              <Select
                value={delegationForm.watch('delegateeId') ?? ''}
                onValueChange={v => delegationForm.setValue('delegateeId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select delegatee" />
                </SelectTrigger>
                <SelectContent>
                  {positions.filter(p => p.employmentStatus !== 'inactive').map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.fullName} — {p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {delegationForm.formState.errors.delegateeId && (
                <p className="text-xs text-destructive">{delegationForm.formState.errors.delegateeId.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Scope</Label>
              <Select
                value={delegationForm.watch('scope')}
                onValueChange={v => delegationForm.setValue('scope', v as DelegationForm['scope'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approvals">General approvals</SelectItem>
                  <SelectItem value="finance">Finance & budget authority</SelectItem>
                  <SelectItem value="procurement">Procurement sign-off</SelectItem>
                  <SelectItem value="records">Records management</SelectItem>
                  <SelectItem value="all">All authority (full delegation)</SelectItem>
                </SelectContent>
              </Select>
              {delegationForm.formState.errors.scope && (
                <p className="text-xs text-destructive">{delegationForm.formState.errors.scope.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" {...delegationForm.register('startDate')} />
                {delegationForm.formState.errors.startDate && (
                  <p className="text-xs text-destructive">{delegationForm.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>End Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="date" {...delegationForm.register('endDate')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input {...delegationForm.register('reason')} placeholder="Brief reason for delegation" />
              {delegationForm.formState.errors.reason && (
                <p className="text-xs text-destructive">{delegationForm.formState.errors.reason.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNewDelegationOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={delegationForm.formState.isSubmitting}>
                {delegationForm.formState.isSubmitting ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
