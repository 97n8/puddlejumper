import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, ArrowClockwise, TreeStructure, ShieldCheck,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { pjFetch } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type GrantType = 'Federal' | 'State' | 'Private Foundation' | 'Municipal Partnership'
type GrantStatus =
  | 'Research' | 'Application in Progress' | 'Submitted' | 'Awarded'
  | 'Active' | 'Reporting Due' | 'Closed' | 'Declined'

interface Grant {
  id: string
  grantName: string
  grantingAgency: string
  grantType: GrantType
  programNumber?: string
  amount?: number
  applicationDeadline?: string
  periodStart?: string
  periodEnd?: string
  staffLead?: string
  status: GrantStatus
  reportingOverdue?: boolean
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<GrantStatus, string> = {
  'Research': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  'Application in Progress': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Submitted': 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'Awarded': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Active': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Reporting Due': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Closed': 'bg-slate-400/10 text-slate-500 border-slate-400/20',
  'Declined': 'bg-red-500/10 text-red-600 border-red-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

const PIPELINE_STATUSES: GrantStatus[] = ['Research', 'Application in Progress', 'Submitted']
const ACTIVE_STATUSES: GrantStatus[] = ['Awarded', 'Active', 'Reporting Due']
const CLOSED_STATUSES: GrantStatus[] = ['Closed', 'Declined']

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  grantName: string
  grantingAgency: string
  grantType: GrantType
  programNumber: string
  amount: string
  applicationDeadline: string
  periodStart: string
  periodEnd: string
  staffLead: string
  notes: string
}

const DEFAULT_FORM: FormState = {
  grantName: '', grantingAgency: '', grantType: 'Federal', programNumber: '',
  amount: '', applicationDeadline: '', periodStart: '', periodEnd: '',
  staffLead: '', notes: '',
}

// ── Grant card ─────────────────────────────────────────────────────────────────

function GrantCard({ grant }: { grant: Grant }) {
  const deadlineDays = grant.applicationDeadline ? daysUntil(grant.applicationDeadline) : null
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="font-medium text-sm">{grant.grantName}</div>
          <div className="text-xs text-muted-foreground">{grant.grantingAgency} · {grant.grantType}</div>
        </div>
        <div className="flex gap-1.5 flex-wrap shrink-0">
          <Badge label={grant.status} className={STATUS_CLASS[grant.status]} />
          {grant.reportingOverdue && (
            <Badge label="Reporting Overdue" className="bg-red-500/10 text-red-600 border-red-500/20" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {grant.amount != null && (
          <span className="font-medium text-foreground">${grant.amount.toLocaleString()}</span>
        )}
        {deadlineDays !== null && (
          <span className={deadlineDays < 14 ? 'text-amber-600 font-medium' : ''}>
            {deadlineDays < 0 ? 'Deadline passed' : `Deadline in ${deadlineDays}d`}
          </span>
        )}
        {grant.staffLead && <span>Lead: {grant.staffLead}</span>}
        {grant.programNumber && <span>{grant.programNumber}</span>}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function GrantsWorkflowPanel({ onBack }: { onBack: () => void }) {
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<Grant[]>('/v1/grants/pipeline')
      setGrants(data ?? [])
    } catch {
      setGrants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const pipeline = grants.filter(g => PIPELINE_STATUSES.includes(g.status))
  const active = grants.filter(g => ACTIVE_STATUSES.includes(g.status))
  const closed = grants.filter(g => CLOSED_STATUSES.includes(g.status))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.grantName || !form.grantingAgency) {
      toast.error('Grant name and granting agency are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/grants/pipeline', {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: form.amount ? Number(form.amount) : undefined }),
      })
      toast.success('Grant added to pipeline')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to add grant')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <TreeStructure size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Grants</h1>
          <p className="text-xs text-muted-foreground leading-tight">2 CFR 200 · ARPA compliance rules · MA DLCS requirements</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading}>
            <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus size={14} /> New
          </Button>
        </div>
      </div>

      {/* Governance banner */}
      <div className="shrink-0 px-5 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Grant files → 7 years · Audit packages → 7 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> Required steps are governed — staff see guidance, server enforces hard stops</span>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="pipeline" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="pipeline">
                Pipeline
                {pipeline.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{pipeline.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="active">
                Active
                {active.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{active.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pipeline" className="p-5 space-y-3">
            {pipeline.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No grants in the pipeline. Add a grant opportunity to start tracking the application lifecycle and compliance requirements.
              </p>
            ) : pipeline.map(g => <GrantCard key={g.id} grant={g} />)}
          </TabsContent>

          <TabsContent value="active" className="p-5 space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Gate — Active Grant Compliance</div>
              <p>2 CFR 200 requires: expenditures aligned to approved budget, progress reports on schedule, procurement via competitive process. Closeout requires final report + financial reconciliation + audit package.</p>
            </div>
            {active.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active grants. Awarded grants will appear here.</p>
            ) : active.map(g => <GrantCard key={g.id} grant={g} />)}
          </TabsContent>

          <TabsContent value="closed" className="p-5 space-y-3">
            {closed.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No closed grants. Completed and declined grants will appear here.</p>
            ) : closed.map(g => <GrantCard key={g.id} grant={g} />)}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Grant Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Grant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gw-name">Grant Name *</Label>
              <Input id="gw-name" value={form.grantName} onChange={e => setForm(f => ({ ...f, grantName: e.target.value }))} placeholder="e.g., Community Development Block Grant" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-agency">Granting Agency *</Label>
              <Input id="gw-agency" value={form.grantingAgency} onChange={e => setForm(f => ({ ...f, grantingAgency: e.target.value }))} placeholder="e.g., HUD, FEMA, MA DLCS" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gw-type">Grant Type</Label>
                <select id="gw-type" value={form.grantType} onChange={e => setForm(f => ({ ...f, grantType: e.target.value as GrantType }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option>Federal</option>
                  <option>State</option>
                  <option>Private Foundation</option>
                  <option>Municipal Partnership</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gw-cfda">Program / CFDA Number</Label>
                <Input id="gw-cfda" value={form.programNumber} onChange={e => setForm(f => ({ ...f, programNumber: e.target.value }))} placeholder="e.g., 14.218" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gw-amount">Estimated Amount</Label>
                <Input id="gw-amount" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gw-deadline">Application Deadline</Label>
                <Input id="gw-deadline" type="date" value={form.applicationDeadline} onChange={e => setForm(f => ({ ...f, applicationDeadline: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gw-pstart">Grant Period Start</Label>
                <Input id="gw-pstart" type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gw-pend">Grant Period End</Label>
                <Input id="gw-pend" type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-lead">Staff Lead</Label>
              <Input id="gw-lead" value={form.staffLead} onChange={e => setForm(f => ({ ...f, staffLead: e.target.value }))} placeholder="Name of responsible staff member" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-notes">Notes</Label>
              <Textarea id="gw-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Eligibility notes, contacts, etc." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Grant'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
