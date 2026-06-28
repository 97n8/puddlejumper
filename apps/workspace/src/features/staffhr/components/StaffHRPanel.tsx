import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, ArrowClockwise, IdentificationCard, ShieldCheck, Warning,
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

type PositionType = 'Full-Time' | 'Part-Time' | 'Seasonal' | 'Appointed' | 'Elected' | 'Volunteer'
type FLSAStatus = 'Exempt' | 'Non-Exempt'
type PositionStatus = 'Filled' | 'Vacant' | 'Frozen'
type StaffStatus = 'Active' | 'On Leave' | 'Separated'
type TrainingCompliance = 'Current' | 'Expiring Soon' | 'Overdue'
type CertStatus = 'Current' | 'Expiring within 30 days' | 'Expired'

interface Position {
  id: string
  positionTitle: string
  department: string
  positionType: PositionType
  classification?: string
  flsaStatus: FLSAStatus
  unionAffiliation?: string
  authorizedFTEs: number
  status: PositionStatus
}

interface StaffMember {
  id: string
  name: string
  positionTitle: string
  department: string
  hireDate: string
  status: StaffStatus
  trainingCompliance: TrainingCompliance
}

interface Certification {
  id: string
  staffName: string
  certName: string
  issuingBody: string
  issueDate: string
  expirationDate: string
  status: CertStatus
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const POSITION_STATUS_CLASS: Record<PositionStatus, string> = {
  'Filled': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Vacant': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Frozen': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

const STAFF_STATUS_CLASS: Record<StaffStatus, string> = {
  'Active': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'On Leave': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Separated': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

const TRAINING_CLASS: Record<TrainingCompliance, string> = {
  'Current': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Expiring Soon': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Overdue': 'bg-red-500/10 text-red-600 border-red-500/20',
}

const CERT_CLASS: Record<CertStatus, string> = {
  'Current': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Expiring within 30 days': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Expired': 'bg-red-500/10 text-red-600 border-red-500/20',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function tenure(hireDateStr: string) {
  const ms = Date.now() - new Date(hireDateStr).getTime()
  const totalMonths = Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44))
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months}mo`
  return `${years}yr ${months}mo`
}

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  positionTitle: string
  department: string
  positionType: PositionType
  classification: string
  flsaStatus: FLSAStatus
  unionAffiliation: string
  authorizedFTEs: string
  status: PositionStatus
}

const DEFAULT_FORM: FormState = {
  positionTitle: '', department: '', positionType: 'Full-Time',
  classification: '', flsaStatus: 'Non-Exempt', unionAffiliation: '',
  authorizedFTEs: '1', status: 'Vacant',
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function StaffHRPanel({ onBack }: { onBack: () => void }) {
  const [positions, setPositions] = useState<Position[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await pjFetch<{ positions: Position[]; staff: StaffMember[]; certifications: Certification[] }>('/v1/staffhr/positions')
      setPositions(data?.positions ?? [])
      setStaff(data?.staff ?? [])
      setCertifications(data?.certifications ?? [])
    } catch {
      setPositions([])
      setStaff([])
      setCertifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activeStaff = staff.filter(s => s.status === 'Active')
  const expiringCerts = certifications.filter(c => c.status !== 'Current')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.positionTitle || !form.department) {
      toast.error('Position title and department are required')
      return
    }
    setSubmitting(true)
    try {
      await pjFetch('/v1/staffhr/positions', {
        method: 'POST',
        body: JSON.stringify({ ...form, authorizedFTEs: Number(form.authorizedFTEs) || 1 }),
      })
      toast.success('Position created')
      setNewOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch {
      toast.error('Failed to create position')
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
        <IdentificationCard size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">Staff & HR</h1>
          <p className="text-xs text-muted-foreground leading-tight">FLSA · MA Personnel Administration Rules · Town personnel policy</p>
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
        <span><span className="font-semibold text-foreground">ARCHIEVE:</span> Personnel files → 7 years after separation · Training records → 5 years</span>
        <span><span className="font-semibold text-foreground">VAULT:</span> Required steps are governed — staff see guidance, server enforces hard stops</span>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="positions" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="positions">
                Position Register
                {positions.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{positions.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="staff">
                Active Staff
                {activeStaff.length > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{activeStaff.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="training">
                Training & Certs
                {expiringCerts.length > 0 && <span className="ml-1.5 text-xs bg-amber-500/20 text-amber-600 rounded-full px-1.5">{expiringCerts.length}</span>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="positions" className="p-5 space-y-3">
            {positions.length === 0 && !loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No positions on record. Add positions to build the staff register and track hiring, evaluation, and separation compliance.
              </p>
            ) : positions.map(p => (
              <div key={p.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{p.positionTitle}</div>
                    <div className="text-xs text-muted-foreground">{p.department} · {p.positionType} · {p.flsaStatus}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Badge label={p.status} className={POSITION_STATUS_CLASS[p.status]} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {p.classification && <span>Grade: {p.classification}</span>}
                  <span>{p.authorizedFTEs} FTE{p.authorizedFTEs !== 1 ? 's' : ''}</span>
                  {p.unionAffiliation && <span>{p.unionAffiliation}</span>}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="staff" className="p-5 space-y-3">
            {activeStaff.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No active staff records. Staff members linked to filled positions will appear here.</p>
            ) : activeStaff.map(s => (
              <div key={s.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.positionTitle} · {s.department}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Badge label={s.status} className={STAFF_STATUS_CLASS[s.status]} />
                    <Badge label={s.trainingCompliance} className={TRAINING_CLASS[s.trainingCompliance]} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Hired {new Date(s.hireDate).toLocaleDateString()} · {tenure(s.hireDate)}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="training" className="p-5 space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> VAULT Gate — Separation Requirements</div>
              <p>Personnel actions require documented authority. Separations must trigger: access revocation within 24 hours, benefits continuation notice, continuity handoff (see Role Continuity module). Personnel files are sealed on separation and retained for 7 years.</p>
            </div>
            {certifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No certifications tracked. Certifications added to staff records will appear here.</p>
            ) : certifications.map(c => (
              <div key={c.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{c.certName}</div>
                    <div className="text-xs text-muted-foreground">{c.staffName} · {c.issuingBody}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Badge label={c.status} className={CERT_CLASS[c.status]} />
                    {c.status === 'Expiring within 30 days' && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-600"><Warning size={11} /> Renew soon</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Issued {new Date(c.issueDate).toLocaleDateString()} · Expires {new Date(c.expirationDate).toLocaleDateString()}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Position Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Position</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hr-title">Position Title *</Label>
              <Input id="hr-title" value={form.positionTitle} onChange={e => setForm(f => ({ ...f, positionTitle: e.target.value }))} placeholder="e.g., Administrative Assistant" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hr-dept">Department *</Label>
              <Input id="hr-dept" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g., Town Clerk" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hr-ptype">Position Type</Label>
                <select id="hr-ptype" value={form.positionType} onChange={e => setForm(f => ({ ...f, positionType: e.target.value as PositionType }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {(['Full-Time', 'Part-Time', 'Seasonal', 'Appointed', 'Elected', 'Volunteer'] as PositionType[]).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hr-flsa">FLSA Status</Label>
                <select id="hr-flsa" value={form.flsaStatus} onChange={e => setForm(f => ({ ...f, flsaStatus: e.target.value as FLSAStatus }))}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option>Exempt</option>
                  <option>Non-Exempt</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hr-class">Classification / Pay Grade</Label>
                <Input id="hr-class" value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))} placeholder="e.g., Grade 5" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hr-ftes">Authorized FTEs</Label>
                <Input id="hr-ftes" type="number" value={form.authorizedFTEs} onChange={e => setForm(f => ({ ...f, authorizedFTEs: e.target.value }))} min="0" step="0.5" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hr-union">Union Affiliation</Label>
              <Input id="hr-union" value={form.unionAffiliation} onChange={e => setForm(f => ({ ...f, unionAffiliation: e.target.value }))} placeholder="e.g., AFSCME Local 123 (optional)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hr-status">Status</Label>
              <select id="hr-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PositionStatus }))}
                className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option>Filled</option>
                <option>Vacant</option>
                <option>Frozen</option>
              </select>
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
