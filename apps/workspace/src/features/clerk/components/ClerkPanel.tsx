import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, ArrowClockwise, CalendarCheck, ShieldCheck, Warning,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { pjFetch } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type MeetingType = 'Regular' | 'Special' | 'Emergency' | 'Executive Session'
type MeetingStatus = 'Scheduled' | 'In Progress' | 'Pending Minutes' | 'Compliant' | 'Non-Compliant'

interface Meeting {
  id: string
  boardName: string
  meetingDate: string
  meetingType: MeetingType
  location?: string
  agendaPosted: boolean
  agendaPostedDate?: string
  status: MeetingStatus
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<MeetingStatus, string> = {
  'Scheduled': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Pending Minutes': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Compliant': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Non-Compliant': 'bg-red-500/10 text-red-600 border-red-500/20',
}

const TYPE_CLASS: Record<MeetingType, string> = {
  'Regular': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  'Special': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Emergency': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Executive Session': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function daysRelative(dateStr: string) {
  const diff = Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff > 0) return `In ${diff}d`
  return `${Math.abs(diff)}d ago`
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormState {
  boardName: string
  meetingDate: string
  meetingType: MeetingType
  location: string
  agendaPosted: boolean
  agendaPostedDate: string
}

const DEFAULT_FORM: FormState = {
  boardName: '', meetingDate: '', meetingType: 'Regular',
  location: '', agendaPosted: false, agendaPostedDate: '',
}

function hoursUntilMeeting(meetingDate: string): number | null {
  if (!meetingDate) return null
  return (new Date(meetingDate).getTime() - Date.now()) / 3_600_000
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ClerkPanel({ onBack }: { onBack: () => void }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<Meeting[]>('/v1/clerk/meetings')
      setMeetings(data ?? [])
    } catch {
      setMeetings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const scheduled = meetings.filter(m => ['Scheduled', 'In Progress'].includes(m.status))
  const pendingMinutes = meetings.filter(m => m.status === 'Pending Minutes')
  const nonCompliant = meetings.filter(m => m.status === 'Non-Compliant')

  const hours = hoursUntilMeeting(form.meetingDate)
  const under48 = hours !== null && hours < 48 && hours > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.boardName || !form.meetingDate) {
      toast.error('Board name and meeting date are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/clerk/meetings', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast.success('Meeting created')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to create meeting')
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
        <CalendarCheck size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Meeting Records</h1>
          <p className="text-xs text-muted-foreground leading-tight">Open Meeting Law · MGL c.30A §§18-25</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading}>
            <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus size={14} />
            New
          </Button>
        </div>
      </div>

      {/* Governance banner */}
      <div className="shrink-0 px-5 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Minutes → 7 years · Vote records → permanent · Legal notices → 7 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> What must happen in what order is governed — staff see guidance, server enforces</span>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="meetings" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="meetings">
                Meetings
                {scheduled.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{scheduled.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="minutes">
                Minutes
                {pendingMinutes.length > 0 && <span className="ml-1.5 text-xs bg-amber-500/20 text-amber-600 rounded-full px-1.5">{pendingMinutes.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="meetings" className="p-5 space-y-3">
            {meetings.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No meetings scheduled. Add a board meeting to start tracking OML compliance.
              </p>
            ) : meetings.map(m => (
              <div key={m.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{m.boardName}</div>
                    <div className="text-xs text-muted-foreground">{new Date(m.meetingDate).toLocaleString()} · {m.location || 'No location'}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge label={m.meetingType} className={TYPE_CLASS[m.meetingType]} />
                    <Badge label={m.status} className={STATUS_CLASS[m.status]} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {m.agendaPosted ? (
                    <span className="text-emerald-600 font-medium">✓ Agenda posted</span>
                  ) : (
                    <span className="text-red-500 font-medium flex items-center gap-1"><Warning size={12} /> Agenda not posted</span>
                  )}
                  <span className="text-muted-foreground">{daysRelative(m.meetingDate)}</span>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="minutes" className="p-5 space-y-3">
            {pendingMinutes.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No meetings pending minutes.</p>
            ) : pendingMinutes.map(m => (
              <div key={m.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium text-sm">{m.boardName}</div>
                    <div className="text-xs text-muted-foreground">{new Date(m.meetingDate).toLocaleDateString()}</div>
                  </div>
                  <Badge label="Pending Minutes" className={STATUS_CLASS['Pending Minutes']} />
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="compliance" className="p-5 space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Gate — Compliance Requirements</div>
              <p>A meeting cannot be marked compliant until: agenda posted ≥48hr before meeting, minutes drafted within 30 days, all votes recorded by name, legal notice verified.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold">{meetings.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Total</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-emerald-600">{meetings.filter(m => m.status === 'Compliant').length}</div>
                <div className="text-xs text-muted-foreground mt-1">Compliant</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-2xl font-bold text-red-600">{nonCompliant.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Non-Compliant</div>
              </div>
            </div>
            {nonCompliant.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Non-Compliant Meetings</h3>
                {nonCompliant.map(m => (
                  <div key={m.id} className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                    <div className="font-medium text-sm">{m.boardName}</div>
                    <div className="text-xs text-muted-foreground">{new Date(m.meetingDate).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Meeting Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Meeting</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="clerk-board">Board / Committee Name *</Label>
              <Input id="clerk-board" value={form.boardName} onChange={e => setForm(f => ({ ...f, boardName: e.target.value }))} placeholder="e.g., Select Board" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="clerk-date">Meeting Date & Time *</Label>
                <Input id="clerk-date" type="datetime-local" value={form.meetingDate} onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))} />
                {under48 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1"><Warning size={11} /> Less than 48 hours away — agenda posting may be non-compliant</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clerk-type">Meeting Type</Label>
                <select id="clerk-type" value={form.meetingType} onChange={e => setForm(f => ({ ...f, meetingType: e.target.value as MeetingType }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option>Regular</option>
                  <option>Special</option>
                  <option>Emergency</option>
                  <option>Executive Session</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clerk-loc">Location</Label>
              <Input id="clerk-loc" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g., Town Hall — Room 1" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="clerk-posted" checked={form.agendaPosted} onChange={e => setForm(f => ({ ...f, agendaPosted: e.target.checked }))} className="h-4 w-4 rounded border" />
              <Label htmlFor="clerk-posted">Agenda already posted?</Label>
            </div>
            {form.agendaPosted && (
              <div className="space-y-1.5">
                <Label htmlFor="clerk-posted-date">Date Posted</Label>
                <Input id="clerk-posted-date" type="date" value={form.agendaPostedDate} onChange={e => setForm(f => ({ ...f, agendaPostedDate: e.target.value }))} />
              </div>
            )}
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
