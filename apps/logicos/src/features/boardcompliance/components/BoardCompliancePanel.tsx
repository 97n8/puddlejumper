import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, ArrowClockwise, Gavel, ShieldCheck, Warning,
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

type AppointmentType = 'Elected' | 'Appointed by Select Board' | 'Appointed by Town Manager' | 'Appointed by Board'
type DisclosureStatus = 'Filed' | 'Pending' | 'Overdue'
type TermStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Vacant'
type VacancyStatus = 'Open' | 'Applications Accepted' | 'Interview' | 'Appointment Pending' | 'Filled'

interface Appointment {
  id: string
  boardName: string
  memberName: string
  appointmentType: AppointmentType
  termStart: string
  termEnd: string
  seatDesignation?: string
  disclosureStatus: DisclosureStatus
  termStatus: TermStatus
}

interface Vacancy {
  id: string
  boardName: string
  seatDescription: string
  vacancyDate: string
  status: VacancyStatus
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const DISCLOSURE_CLASS: Record<DisclosureStatus, string> = {
  'Filed': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Overdue': 'bg-red-500/10 text-red-600 border-red-500/20',
}

const TERM_CLASS: Record<TermStatus, string> = {
  'Active': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Expiring Soon': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Expired': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Vacant': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

const VACANCY_CLASS: Record<VacancyStatus, string> = {
  'Open': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Applications Accepted': 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'Interview': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Appointment Pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Filled': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
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

function termEndClass(termEnd: string) {
  const d = daysUntil(termEnd)
  if (d < 0) return 'text-red-500'
  if (d <= 90) return 'text-amber-600'
  return 'text-muted-foreground'
}

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  boardName: string
  memberName: string
  appointmentType: AppointmentType
  termStart: string
  termEnd: string
  seatDesignation: string
  conflictFiled: boolean
  notes: string
}

const DEFAULT_FORM: FormState = {
  boardName: '', memberName: '', appointmentType: 'Appointed by Select Board',
  termStart: '', termEnd: '', seatDesignation: '', conflictFiled: false, notes: '',
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function BoardCompliancePanel({ onBack }: { onBack: () => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<{ appointments: Appointment[]; vacancies: Vacancy[] }>('/v1/boardcompliance/appointments')
      setAppointments(data?.appointments ?? [])
      setVacancies(data?.vacancies ?? [])
    } catch {
      setAppointments([])
      setVacancies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const disclosures = appointments.filter(a => a.disclosureStatus !== 'Filed')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.boardName || !form.memberName || !form.termStart || !form.termEnd) {
      toast.error('Board name, member name, and term dates are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/boardcompliance/appointments', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Appointment recorded')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to record appointment')
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
        <Gavel size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Board Compliance</h1>
          <p className="text-xs text-muted-foreground leading-tight">Ethics law · Open Meeting Law · MGL c.30A</p>
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
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Ethics disclosures → 6 years · Appointment records → permanent</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> Required steps are governed — staff see guidance, server enforces hard stops</span>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="appointments" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="appointments">
                Appointments
                {appointments.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{appointments.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="disclosures">
                Disclosures
                {disclosures.length > 0 && <span className="ml-1.5 text-xs bg-amber-500/20 text-amber-600 rounded-full px-1.5">{disclosures.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="vacancies">
                Vacancies
                {vacancies.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{vacancies.length}</span>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="appointments" className="p-5 space-y-3">
            {appointments.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No board appointments on record. Add a member to start tracking term expirations and disclosure compliance.
              </p>
            ) : appointments.map(a => (
              <div key={a.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{a.memberName}</div>
                    <div className="text-xs text-muted-foreground">{a.boardName} · {a.appointmentType}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Badge label={a.disclosureStatus} className={DISCLOSURE_CLASS[a.disclosureStatus]} />
                    <Badge label={a.termStatus} className={TERM_CLASS[a.termStatus]} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={termEndClass(a.termEnd)}>Term ends {new Date(a.termEnd).toLocaleDateString()}</span>
                  {a.seatDesignation && <span className="text-muted-foreground">Seat: {a.seatDesignation}</span>}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="disclosures" className="p-5 space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Gate — Ethics Disclosure Requirements</div>
              <p>Ethics disclosures must be filed annually. Conflict of interest log is updated on any vote where a board member has a disclosed interest. Expired terms require re-appointment or successor before seat can be considered active.</p>
            </div>
            {disclosures.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">All disclosures are current. No pending or overdue filings.</p>
            ) : disclosures.map(a => (
              <div key={a.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium text-sm">{a.memberName}</div>
                    <div className="text-xs text-muted-foreground">{a.boardName}</div>
                  </div>
                  <Badge label={a.disclosureStatus} className={DISCLOSURE_CLASS[a.disclosureStatus]} />
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="vacancies" className="p-5 space-y-3">
            {vacancies.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No open vacancies tracked. Vacancies created from expired or departed appointments will appear here.</p>
            ) : vacancies.map(v => (
              <div key={v.id} className="rounded-lg border bg-card p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{v.boardName}</div>
                    <div className="text-xs text-muted-foreground">{v.seatDescription}</div>
                  </div>
                  <Badge label={v.status} className={VACANCY_CLASS[v.status]} />
                </div>
                <div className="text-xs text-muted-foreground">Vacant since {new Date(v.vacancyDate).toLocaleDateString()}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bc-board">Board / Committee Name *</Label>
              <Input id="bc-board" value={form.boardName} onChange={e => setForm(f => ({ ...f, boardName: e.target.value }))} placeholder="e.g., Planning Board" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-member">Member Name *</Label>
              <Input id="bc-member" value={form.memberName} onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-type">Appointment Type</Label>
              <select id="bc-type" value={form.appointmentType} onChange={e => setForm(f => ({ ...f, appointmentType: e.target.value as AppointmentType }))}
                className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option>Elected</option>
                <option>Appointed by Select Board</option>
                <option>Appointed by Town Manager</option>
                <option>Appointed by Board</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bc-start">Term Start *</Label>
                <Input id="bc-start" type="date" value={form.termStart} onChange={e => setForm(f => ({ ...f, termStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bc-end">Term End *</Label>
                <Input id="bc-end" type="date" value={form.termEnd} onChange={e => setForm(f => ({ ...f, termEnd: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-seat">Seat Number / Designation</Label>
              <Input id="bc-seat" value={form.seatDesignation} onChange={e => setForm(f => ({ ...f, seatDesignation: e.target.value }))} placeholder="e.g., Seat 3 or At-Large" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="bc-conflict" checked={form.conflictFiled} onChange={e => setForm(f => ({ ...f, conflictFiled: e.target.checked }))} className="h-4 w-4 rounded border" />
              <Label htmlFor="bc-conflict">Conflict of interest disclosure filed?</Label>
            </div>
            {!form.conflictFiled && (
              <p className="text-xs text-amber-600 flex items-center gap-1"><Warning size={11} /> Disclosure must be filed before first vote</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="bc-notes">Notes</Label>
              <Textarea id="bc-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
