import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, ArrowClockwise, UserSwitch, ShieldCheck } from '@phosphor-icons/react'
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

type TransitionType = 'New Hire' | 'Departure' | 'Interim Coverage' | 'Leave of Absence'
type TransitionStatus = 'Initiated' | 'Handoff In Progress' | '30-Day Check' | '60-Day Check' | 'Complete'

interface Transition {
  id: string
  positionTitle: string
  transitionType: TransitionType
  departingStaff?: string
  successorStaff?: string
  effectiveDate: string
  checkIn30?: string
  checkIn60?: string
  notes?: string
  status: TransitionStatus
}

interface Playbook {
  id: string
  name: string
  transitionType: TransitionType
  stepCount: number
}

// ── Badges ────────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<TransitionStatus, string> = {
  'Initiated': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Handoff In Progress': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  '30-Day Check': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  '60-Day Check': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Complete': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
}

const TYPE_CLASS: Record<TransitionType, string> = {
  'New Hire': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Departure': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Interim Coverage': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Leave of Absence': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function daysSince(dateStr: string) {
  const d = Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (d < 0) return `Effective in ${Math.abs(d)}d`
  if (d === 0) return 'Effective today'
  return `${d}d since effective`
}

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormState {
  positionTitle: string; transitionType: TransitionType
  departingStaff: string; successorStaff: string
  effectiveDate: string; checkIn30: string; checkIn60: string; notes: string
}

const DEFAULT_FORM: FormState = {
  positionTitle: '', transitionType: 'New Hire',
  departingStaff: '', successorStaff: '',
  effectiveDate: '', checkIn30: '', checkIn60: '', notes: '',
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function OnboardPanel({ onBack }: { onBack: () => void }) {
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [trans, plays] = await Promise.allSettled([
        pjFetch<Transition[]>('/v1/onboard/transitions'),
        pjFetch<Playbook[]>('/v1/onboard/playbooks'),
      ])
      setTransitions(trans.status === 'fulfilled' ? (trans.value ?? []) : [])
      setPlaybooks(plays.status === 'fulfilled' ? (plays.value ?? []) : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const active = transitions.filter(t => t.status !== 'Complete')

  function handleEffectiveDateChange(val: string) {
    setForm(f => ({ ...f, effectiveDate: val, checkIn30: addDays(val, 30), checkIn60: addDays(val, 60) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.positionTitle || !form.effectiveDate) {
      toast.error('Position title and effective date are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/onboard/transitions', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Transition initiated')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to create transition')
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
        <UserSwitch size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Role Continuity</h1>
          <p className="text-xs text-muted-foreground leading-tight">Internal policy · VAULT-configured per town</p>
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
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Handoff files → 5 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> What must happen in what order is governed — staff see guidance, server enforces</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="active" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="active">
                Active Roles
                {active.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{active.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="transitions">Transitions</TabsTrigger>
              <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active" className="p-5 space-y-3">
            {transitions.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No active role transitions. Initiate a transition when a staff member is hired, departing, or taking leave.
              </p>
            ) : active.map(t => (
              <div key={t.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="font-medium text-sm">{t.positionTitle}</div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Badge label={t.transitionType} className={TYPE_CLASS[t.transitionType]} />
                    <Badge label={t.status} className={STATUS_CLASS[t.status]} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.departingStaff && t.successorStaff ? `${t.departingStaff} → ${t.successorStaff}` :
                   t.departingStaff ? `Departing: ${t.departingStaff}` :
                   t.successorStaff ? `Incoming: ${t.successorStaff}` : 'Staff TBD'}
                </div>
                <div className="text-xs text-muted-foreground">{daysSince(t.effectiveDate)}</div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="transitions" className="p-5 space-y-3">
            {transitions.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No transitions on record.</p>
            ) : transitions.map(t => (
              <div key={t.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium text-sm">{t.positionTitle}</div>
                    <div className="text-xs text-muted-foreground">Effective {new Date(t.effectiveDate).toLocaleDateString()}</div>
                  </div>
                  <Badge label={t.status} className={STATUS_CLASS[t.status]} />
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Gate</div>
              <p>Departure cannot be marked complete without: successor assigned, access revoked within 24hr, handoff file completed and sealed.</p>
            </div>
          </TabsContent>

          <TabsContent value="playbooks" className="p-5 space-y-3">
            {playbooks.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No playbooks configured. Contact your admin to add continuity checklist templates.</p>
            ) : playbooks.map(p => (
              <div key={p.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.stepCount} steps</div>
                  </div>
                  <Badge label={p.transitionType} className={TYPE_CLASS[p.transitionType]} />
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Transition</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ob-pos">Position Title *</Label>
              <Input id="ob-pos" value={form.positionTitle} onChange={e => setForm(f => ({ ...f, positionTitle: e.target.value }))} placeholder="e.g., Town Clerk" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-type">Transition Type</Label>
              <select id="ob-type" value={form.transitionType} onChange={e => setForm(f => ({ ...f, transitionType: e.target.value as TransitionType }))}
                className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option>New Hire</option><option>Departure</option><option>Interim Coverage</option><option>Leave of Absence</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob-depart">Departing Staff</Label>
                <Input id="ob-depart" value={form.departingStaff} onChange={e => setForm(f => ({ ...f, departingStaff: e.target.value }))} placeholder="Name (if applicable)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-successor">Successor / Incoming</Label>
                <Input id="ob-successor" value={form.successorStaff} onChange={e => setForm(f => ({ ...f, successorStaff: e.target.value }))} placeholder="Name (if known)" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-effective">Effective Date *</Label>
              <Input id="ob-effective" type="date" value={form.effectiveDate} onChange={e => handleEffectiveDateChange(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob-30">30-Day Check-In</Label>
                <Input id="ob-30" type="date" value={form.checkIn30} onChange={e => setForm(f => ({ ...f, checkIn30: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-60">60-Day Check-In</Label>
                <Input id="ob-60" type="date" value={form.checkIn60} onChange={e => setForm(f => ({ ...f, checkIn60: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-notes">Notes</Label>
              <Textarea id="ob-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional context..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Initiate'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
