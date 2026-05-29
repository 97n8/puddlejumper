import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, ArrowClockwise, Wrench } from '@phosphor-icons/react'
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

type Priority = 'Routine' | 'Urgent' | 'Emergency'
type RequestStatus = 'Open' | 'Dispatched' | 'In Progress' | 'Pending Close' | 'Closed'
type Department = 'DPW' | 'Building' | 'Health' | 'Police' | 'Fire' | 'Parks' | 'Other'

interface ServiceRequest {
  id: string
  title: string
  description: string
  location?: string
  department: Department
  priority: Priority
  status: RequestStatus
  reporterName?: string
  reporterContact?: string
  createdAt: string
}

// ── Badges ────────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<RequestStatus, string> = {
  'Open': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Dispatched': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'In Progress': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Pending Close': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Closed': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

const PRIORITY_CLASS: Record<Priority, string> = {
  'Routine': 'bg-muted text-muted-foreground border-border',
  'Urgent': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Emergency': 'bg-red-500/10 text-red-600 border-red-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function daysOpen(createdAt: string) {
  const d = Math.round((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return d === 0 ? 'Today' : `${d}d open`
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  title: string; description: string; location: string
  department: Department; priority: Priority
  reporterName: string; reporterContact: string
}

const DEFAULT_FORM: FormState = {
  title: '', description: '', location: '',
  department: 'DPW', priority: 'Routine',
  reporterName: '', reporterContact: '',
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({ req }: { req: ServiceRequest }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="font-medium text-sm">{req.title}</div>
          <div className="text-xs text-muted-foreground line-clamp-1">{req.description}</div>
        </div>
        <div className="flex gap-1.5 flex-wrap shrink-0">
          <Badge label={req.priority} className={PRIORITY_CLASS[req.priority]} />
          <Badge label={req.status} className={STATUS_CLASS[req.status]} />
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium text-foreground">{req.department}</span>
        {req.location && <span>{req.location}</span>}
        <span>{daysOpen(req.createdAt)}</span>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FIXPanel({ onBack }: { onBack: () => void }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<ServiceRequest[]>('/v1/fix/requests')
      setRequests(data ?? [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const open = requests.filter(r => r.status !== 'Closed')
  const closed = requests.filter(r => r.status === 'Closed')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.description) {
      toast.error('Title and description are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/fix/requests', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Service request created')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to create request')
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
        <Wrench size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Service Requests</h1>
          <p className="text-xs text-muted-foreground leading-tight">Local policy · Town-configurable SLA</p>
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
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Work orders → 5 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> What must happen in what order is governed — staff see guidance, server enforces</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="open" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="open">
                Open
                {open.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{open.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="closed">
                Closed
                {closed.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{closed.length}</span>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="open" className="p-5 space-y-3">
            {open.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No open service requests. New requests submitted through the public intake form will appear here.
              </p>
            ) : open.map(r => <RequestCard key={r.id} req={r} />)}
          </TabsContent>

          <TabsContent value="closed" className="p-5 space-y-3">
            {closed.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No closed requests.</p>
            ) : closed.map(r => <RequestCard key={r.id} req={r} />)}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Service Request</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fix-title">Title / Issue Summary *</Label>
              <Input id="fix-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Pothole on Main St" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fix-desc">Description *</Label>
              <Textarea id="fix-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the issue..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fix-loc">Location / Address</Label>
              <Input id="fix-loc" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g., 123 Main St" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fix-dept">Department</Label>
                <select id="fix-dept" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {(['DPW', 'Building', 'Health', 'Police', 'Fire', 'Parks', 'Other'] as Department[]).map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fix-priority">Priority</Label>
                <select id="fix-priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option>Routine</option><option>Urgent</option><option>Emergency</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fix-reporter">Reporter Name</Label>
                <Input id="fix-reporter" value={form.reporterName} onChange={e => setForm(f => ({ ...f, reporterName: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fix-contact">Reporter Contact</Label>
                <Input id="fix-contact" value={form.reporterContact} onChange={e => setForm(f => ({ ...f, reporterContact: e.target.value }))} placeholder="Email or phone" />
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
