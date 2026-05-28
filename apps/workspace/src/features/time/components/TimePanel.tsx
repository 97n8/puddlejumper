import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, ArrowClockwise, ClockCountdown, Warning, ShieldCheck } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { pjFetch } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type DeadlineModule =
  | 'Records Requests' | 'Spending & Budget' | 'Procurement'
  | 'Meeting Records' | 'Service Requests' | 'Role Continuity'
  | 'Notices & Comms' | 'Other'

type DeadlineStatus = 'Active' | 'Overdue' | 'Extended' | 'Closed'
type AlertWindow = '1 day before' | '2 days before' | '5 days before' | '10 days before'

interface Deadline {
  id: string
  label: string
  module: DeadlineModule
  caseRef?: string
  dueDate: string
  businessDaysOnly: boolean
  statuteBasis?: string
  alertWhen: AlertWindow
  notify?: string
  status: DeadlineStatus
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function dueDateLabel(dateStr: string, status: DeadlineStatus): string {
  if (status === 'Closed') return `Closed · ${new Date(dateStr).toLocaleDateString()}`
  const d = daysUntil(dateStr)
  if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''}`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `Due in ${d} days`
}

const MODULE_CLASS: Record<DeadlineModule, string> = {
  'Records Requests': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Spending & Budget': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Procurement': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Meeting Records': 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'Service Requests': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Role Continuity': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Notices & Comms': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  'Other': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

// ── Deadline card ─────────────────────────────────────────────────────────────

function DeadlineCard({ dl, overdue }: { dl: Deadline; overdue?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-2', overdue && 'border-red-200')}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="font-medium text-sm">{dl.label}</div>
          {dl.caseRef && <div className="text-xs text-muted-foreground">Ref: {dl.caseRef}</div>}
        </div>
        <Badge label={dl.module} className={MODULE_CLASS[dl.module]} />
      </div>
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className={cn('font-medium', overdue ? 'text-red-600 flex items-center gap-1' : daysUntil(dl.dueDate) <= 2 ? 'text-amber-600' : 'text-muted-foreground')}>
          {overdue && <Warning size={11} />}
          {dueDateLabel(dl.dueDate, dl.status)}
        </span>
        {dl.businessDaysOnly && <span className="text-muted-foreground">Business days</span>}
        {dl.statuteBasis && <span className="text-muted-foreground truncate max-w-[200px]">{dl.statuteBasis}</span>}
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div className={cn('flex items-center gap-2 py-2 px-3 rounded-md text-sm font-semibold border-l-4', color)}>
      {label}
      <span className="ml-auto text-xs font-normal opacity-60">{count} item{count !== 1 ? 's' : ''}</span>
    </div>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormState {
  label: string; module: DeadlineModule; caseRef: string
  dueDate: string; businessDaysOnly: boolean; statuteBasis: string
  alertWhen: AlertWindow; notify: string
}

const DEFAULT_FORM: FormState = {
  label: '', module: 'Other', caseRef: '',
  dueDate: '', businessDaysOnly: false, statuteBasis: '',
  alertWhen: '2 days before', notify: '',
}

const MODULES: DeadlineModule[] = [
  'Records Requests', 'Spending & Budget', 'Procurement',
  'Meeting Records', 'Service Requests', 'Role Continuity',
  'Notices & Comms', 'Other',
]

// ── Main panel ────────────────────────────────────────────────────────────────

export function TimePanel({ onBack }: { onBack: () => void }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<Deadline[]>('/v1/time/deadlines')
      setDeadlines(data ?? [])
    } catch {
      setDeadlines([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const active = deadlines.filter(d => d.status !== 'Closed')
  const overdue = active.filter(d => daysUntil(d.dueDate) < 0 || d.status === 'Overdue')
  const within48 = active.filter(d => { const days = daysUntil(d.dueDate); return days >= 0 && days <= 2 })
  const upcoming = active.filter(d => { const days = daysUntil(d.dueDate); return days > 2 })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label || !form.dueDate) {
      toast.error('Label and due date are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/time/deadlines', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Deadline created')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to create deadline')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <ClockCountdown size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Deadline Tracking</h1>
          <p className="text-xs text-muted-foreground leading-tight">Module-specific — inherits from governing statute of the case</p>
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

      <div className="shrink-0 px-5 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Escalation logs → 3 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> Clocks start automatically on intake. Business-day math applied where statute requires. Extension requires documented justification and authority sign-off.</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {active.length === 0 && !loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground space-y-1">
            <p>No active deadlines.</p>
            <p className="text-xs">Deadlines are created automatically when cases are opened in Records Requests, Procurement, and other statute-governed modules. You can also add manual deadlines here.</p>
          </div>
        ) : (
          <>
            {/* Overdue */}
            {overdue.length > 0 && (
              <div className="space-y-2">
                <SectionHeader label="Overdue" color="border-l-red-500 bg-red-50/50 text-red-700" count={overdue.length} />
                {overdue.map(d => <DeadlineCard key={d.id} dl={d} overdue />)}
              </div>
            )}

            {/* Within 48 hours */}
            {within48.length > 0 && (
              <div className="space-y-2">
                <SectionHeader label="Due within 48 hours" color="border-l-amber-500 bg-amber-50/50 text-amber-700" count={within48.length} />
                {within48.map(d => <DeadlineCard key={d.id} dl={d} />)}
              </div>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div className="space-y-2">
                <SectionHeader label="Upcoming" color="border-l-slate-400 bg-muted/30 text-foreground" count={upcoming.length} />
                {upcoming.map(d => <DeadlineCard key={d.id} dl={d} />)}
              </div>
            )}

            {/* VAULT note */}
            <div className="rounded-lg border border-slate-200 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Note</div>
              <p>Clocks start automatically on intake. Business-day math applied where statute requires. Extension requires documented justification and authority sign-off.</p>
            </div>
          </>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Deadline</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="time-label">Label / Description *</Label>
              <Input id="time-label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g., PRR response due" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="time-module">Module</Label>
                <select id="time-module" value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value as DeadlineModule }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {MODULES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time-case">Case / Reference</Label>
                <Input id="time-case" value={form.caseRef} onChange={e => setForm(f => ({ ...f, caseRef: e.target.value }))} placeholder="e.g., PRR-2024-001" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time-due">Due Date *</Label>
              <Input id="time-due" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="time-bdays" checked={form.businessDaysOnly} onChange={e => setForm(f => ({ ...f, businessDaysOnly: e.target.checked }))} className="h-4 w-4 rounded border" />
              <Label htmlFor="time-bdays">Business days only</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time-statute">Statute Basis (optional)</Label>
              <Input id="time-statute" value={form.statuteBasis} onChange={e => setForm(f => ({ ...f, statuteBasis: e.target.value }))} placeholder="e.g., MGL c.66 §10 — 10 business days" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="time-alert">Alert When</Label>
                <select id="time-alert" value={form.alertWhen} onChange={e => setForm(f => ({ ...f, alertWhen: e.target.value as AlertWindow }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option>1 day before</option><option>2 days before</option><option>5 days before</option><option>10 days before</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time-notify">Notify (email)</Label>
                <Input id="time-notify" type="email" value={form.notify} onChange={e => setForm(f => ({ ...f, notify: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
