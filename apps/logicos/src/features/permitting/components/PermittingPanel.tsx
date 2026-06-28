import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, ArrowClockwise, HouseSimple, ShieldCheck,
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

type PermitType = 'Building' | 'Electrical' | 'Plumbing' | 'Mechanical' | 'Zoning Variance' | 'Special Permit' | 'Sign' | 'Demolition' | 'Other'
type PermitStatus = 'Received' | 'Under Review' | 'Pending Inspection' | 'Approved' | 'Issued' | 'Certificate of Occupancy' | 'Denied' | 'Expired'
type InspectionType = 'Foundation' | 'Framing' | 'Electrical Rough' | 'Plumbing Rough' | 'Insulation' | 'Final'
type InspectionResult = 'Scheduled' | 'Passed' | 'Failed — Re-inspection Required' | 'Partial'

const REVIEW_DEPTS = ['Building', 'Fire', 'Health', 'Planning', 'Conservation', 'Engineering'] as const
type ReviewDept = typeof REVIEW_DEPTS[number]

interface Permit {
  id: string
  permitType: PermitType
  address: string
  applicantName: string
  status: PermitStatus
  daysInReview: number
  pendingReviews: ReviewDept[]
}

interface Inspection {
  id: string
  address: string
  permitType: PermitType
  inspectionType: InspectionType
  scheduledDate: string
  inspector?: string
  result: InspectionResult
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<PermitStatus, string> = {
  'Received': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  'Under Review': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Pending Inspection': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Approved': 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'Issued': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Certificate of Occupancy': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  'Denied': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Expired': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
}

const INSPECTION_CLASS: Record<InspectionResult, string> = {
  'Scheduled': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Passed': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Failed — Re-inspection Required': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Partial': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  permitType: PermitType
  address: string
  applicantName: string
  applicantContact: string
  description: string
  estimatedValue: string
  contractorName: string
  contractorLicense: string
  reviewDepts: ReviewDept[]
}

const DEFAULT_FORM: FormState = {
  permitType: 'Building', address: '', applicantName: '', applicantContact: '',
  description: '', estimatedValue: '', contractorName: '', contractorLicense: '',
  reviewDepts: ['Building'],
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function PermittingPanel({ onBack }: { onBack: () => void }) {
  const [permits, setPermits] = useState<Permit[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<{ permits: Permit[]; inspections: Inspection[] }>('/v1/permits/applications')
      setPermits(data?.permits ?? [])
      setInspections(data?.inspections ?? [])
    } catch {
      setPermits([])
      setInspections([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openPermits = permits.filter(p => !['Certificate of Occupancy', 'Denied', 'Expired'].includes(p.status))

  function toggleDept(dept: ReviewDept) {
    setForm(f => ({
      ...f,
      reviewDepts: f.reviewDepts.includes(dept)
        ? f.reviewDepts.filter(d => d !== dept)
        : [...f.reviewDepts, dept],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.address || !form.applicantName || !form.description) {
      toast.error('Address, applicant name, and description are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/permits/applications', {
        method: 'POST',
        body: JSON.stringify({ ...form, estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined }),
      })
      toast.success('Permit application submitted')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to submit permit application')
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
        <HouseSimple size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Permitting</h1>
          <p className="text-xs text-muted-foreground leading-tight">Local zoning bylaws · MGL c.40A · Local building code</p>
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
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Permits → 10 years · Violation records → 10 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> Required steps are governed — staff see guidance, server enforces hard stops</span>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="open" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="open">
                Open Permits
                {openPermits.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{openPermits.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="inspections">
                Inspections
                {inspections.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{inspections.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="violations">Violations</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="open" className="p-5 space-y-3">
            {openPermits.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No open permit applications. Permit applications submitted through the public intake form will appear here.
              </p>
            ) : openPermits.map(p => (
              <div key={p.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{p.address}</div>
                    <div className="text-xs text-muted-foreground">{p.applicantName}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Badge label={p.permitType} className="bg-slate-500/10 text-slate-600 border-slate-500/20" />
                    <Badge label={p.status} className={STATUS_CLASS[p.status]} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>{p.daysInReview}d in review</span>
                  {p.pendingReviews.map(d => (
                    <span key={d} className="rounded bg-muted px-1.5 py-0.5 text-xs">{d}</span>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="inspections" className="p-5 space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Gate — Permit Issuance Requirements</div>
              <p>A permit cannot be issued until all required department reviews are complete. A Certificate of Occupancy requires a passed final inspection. Violations must be resolved before a CO is issued for the same property.</p>
            </div>
            {inspections.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No inspections scheduled. Inspections will appear here when scheduled on a permit.</p>
            ) : inspections.map(i => (
              <div key={i.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{i.address}</div>
                    <div className="text-xs text-muted-foreground">{i.inspectionType} · {i.permitType}</div>
                  </div>
                  <Badge label={i.result} className={INSPECTION_CLASS[i.result]} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{new Date(i.scheduledDate).toLocaleString()}</span>
                  {i.inspector && <span>Inspector: {i.inspector}</span>}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="violations" className="p-5">
            <p className="py-12 text-center text-sm text-muted-foreground">
              No open code violations. Violations will appear here when filed against a property.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Permit Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Permit Application</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pm-type">Permit Type</Label>
              <select id="pm-type" value={form.permitType} onChange={e => setForm(f => ({ ...f, permitType: e.target.value as PermitType }))}
                className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {(['Building', 'Electrical', 'Plumbing', 'Mechanical', 'Zoning Variance', 'Special Permit', 'Sign', 'Demolition', 'Other'] as PermitType[]).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-addr">Property Address *</Label>
              <Input id="pm-addr" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pm-appl">Applicant Name *</Label>
                <Input id="pm-appl" value={form.applicantName} onChange={e => setForm(f => ({ ...f, applicantName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pm-contact">Applicant Contact</Label>
                <Input id="pm-contact" value={form.applicantContact} onChange={e => setForm(f => ({ ...f, applicantContact: e.target.value }))} placeholder="Email or phone" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-desc">Description of Work *</Label>
              <Textarea id="pm-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the scope of work" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pm-val">Estimated Value</Label>
                <Input id="pm-val" type="number" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pm-contr">Contractor Name</Label>
                <Input id="pm-contr" value={form.contractorName} onChange={e => setForm(f => ({ ...f, contractorName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-lic">Contractor License Number</Label>
              <Input id="pm-lic" value={form.contractorLicense} onChange={e => setForm(f => ({ ...f, contractorLicense: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Departments Requiring Review</Label>
              <div className="flex flex-wrap gap-2">
                {REVIEW_DEPTS.map(d => (
                  <label key={d} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.reviewDepts.includes(d)} onChange={() => toggleDept(d)} className="h-4 w-4 rounded border" />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
