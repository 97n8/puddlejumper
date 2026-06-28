import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, ArrowClockwise, Megaphone, ShieldCheck, Warning } from '@phosphor-icons/react'
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

type NoticeType = 'Meeting Agenda' | 'Public Hearing' | 'Legal Notice' | 'Emergency Alert' | 'General Public Notice'
type NoticeStatus = 'Draft' | 'Pending Posting' | 'Posted — Awaiting Proof' | 'Proof On File' | 'Compliant'
type Channel = 'Town Website' | 'Town Hall Bulletin Board' | 'Newspaper' | 'GovDelivery' | 'Email List'

const ALL_CHANNELS: Channel[] = ['Town Website', 'Town Hall Bulletin Board', 'Newspaper', 'GovDelivery', 'Email List']

interface Notice {
  id: string
  noticeType: NoticeType
  title: string
  body: string
  requiredPostingDate: string
  channels: Channel[]
  referenceCase?: string
  status: NoticeStatus
}

// ── Badges ────────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<NoticeStatus, string> = {
  'Draft': 'bg-muted text-muted-foreground border-border',
  'Pending Posting': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Posted — Awaiting Proof': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Proof On File': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Compliant': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
}

const TYPE_CLASS: Record<NoticeType, string> = {
  'Meeting Agenda': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Public Hearing': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Legal Notice': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Emergency Alert': 'bg-red-500/10 text-red-600 border-red-500/20',
  'General Public Notice': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function isOverdue(dateStr: string) {
  return new Date(dateStr).getTime() < Date.now()
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormState {
  noticeType: NoticeType; title: string; body: string
  requiredPostingDate: string; channels: Channel[]; referenceCase: string
}

const DEFAULT_FORM: FormState = {
  noticeType: 'Meeting Agenda', title: '', body: '',
  requiredPostingDate: '', channels: [], referenceCase: '',
}

function toggleChannel(channels: Channel[], ch: Channel): Channel[] {
  return channels.includes(ch) ? channels.filter(c => c !== ch) : [...channels, ch]
}

// ── Notice card ───────────────────────────────────────────────────────────────

function NoticeCard({ notice }: { notice: Notice }) {
  const overdue = isOverdue(notice.requiredPostingDate) && notice.status !== 'Compliant'
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="font-medium text-sm">{notice.title}</div>
          {notice.referenceCase && <div className="text-xs text-muted-foreground">Ref: {notice.referenceCase}</div>}
        </div>
        <div className="flex gap-1.5 flex-wrap shrink-0">
          <Badge label={notice.noticeType} className={TYPE_CLASS[notice.noticeType]} />
          <Badge label={notice.status} className={STATUS_CLASS[notice.status]} />
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className={cn('font-medium', overdue ? 'text-red-600 flex items-center gap-1' : 'text-muted-foreground')}>
          {overdue && <Warning size={11} />}
          Required by {new Date(notice.requiredPostingDate).toLocaleDateString()}
          {overdue && ' — overdue'}
        </span>
        {notice.channels.length > 0 && (
          <span className="text-muted-foreground">{notice.channels.join(', ')}</span>
        )}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function CommsPanel({ onBack }: { onBack: () => void }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<Notice[]>('/v1/comms/notices')
      setNotices(data ?? [])
    } catch {
      setNotices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const active = notices.filter(n => !['Proof On File', 'Compliant'].includes(n.status))
  const published = notices.filter(n => ['Proof On File', 'Compliant'].includes(n.status))
  const emergency = notices.filter(n => n.noticeType === 'Emergency Alert')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.requiredPostingDate) {
      toast.error('Title and required posting date are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/comms/notices', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Notice created')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to create notice')
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
        <Megaphone size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Notices & Communications</h1>
          <p className="text-xs text-muted-foreground leading-tight">OML posting requirements · Local emergency notification policy</p>
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
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Publication proofs → 7 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> What must happen in what order is governed — staff see guidance, server enforces</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="active" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="active">
                Active
                {active.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{active.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="published">
                Published
                {published.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{published.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="emergency">
                Emergency
                {emergency.length > 0 && <span className="ml-1.5 text-xs bg-red-500/20 text-red-600 rounded-full px-1.5">{emergency.length}</span>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active" className="p-5 space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Gate</div>
              <p>A legal notice is not compliant until a publication proof is attached. Meeting notices must be posted ≥48hr before the meeting.</p>
            </div>
            {active.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No active notices. Create a notice to track legal publication requirements and collect posting proofs.
              </p>
            ) : active.map(n => <NoticeCard key={n.id} notice={n} />)}
          </TabsContent>

          <TabsContent value="published" className="p-5 space-y-3">
            {published.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No notices with publication proof on file.</p>
            ) : published.map(n => <NoticeCard key={n.id} notice={n} />)}
          </TabsContent>

          <TabsContent value="emergency" className="p-5 space-y-3">
            {emergency.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No emergency alerts logged.</p>
            ) : emergency.map(n => <NoticeCard key={n.id} notice={n} />)}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Notice</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="comms-type">Notice Type</Label>
              <select id="comms-type" value={form.noticeType} onChange={e => setForm(f => ({ ...f, noticeType: e.target.value as NoticeType }))}
                className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option>Meeting Agenda</option><option>Public Hearing</option><option>Legal Notice</option>
                <option>Emergency Alert</option><option>General Public Notice</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comms-title">Title / Subject *</Label>
              <Input id="comms-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Select Board Meeting — January 2026" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comms-body">Body / Content *</Label>
              <Textarea id="comms-body" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} placeholder="Notice text..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comms-date">Required Posting Date *</Label>
                <Input id="comms-date" type="date" value={form.requiredPostingDate} onChange={e => setForm(f => ({ ...f, requiredPostingDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comms-ref">Reference Case (optional)</Label>
                <Input id="comms-ref" value={form.referenceCase} onChange={e => setForm(f => ({ ...f, referenceCase: e.target.value }))} placeholder="e.g., PRR-2024-001" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Publication Channels</Label>
              <div className="space-y-1.5">
                {ALL_CHANNELS.map(ch => (
                  <label key={ch} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.channels.includes(ch)} onChange={() => setForm(f => ({ ...f, channels: toggleChannel(f.channels, ch) }))} className="h-4 w-4 rounded border" />
                    {ch}
                  </label>
                ))}
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
