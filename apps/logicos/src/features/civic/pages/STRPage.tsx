/**
 * STRPage — Short-Term Rental & Lodging Management (Civic module)
 *
 * Municipal-side management of the short-term rental program:
 *   - Host registration and operator licensing
 *   - Unit compliance and annual inspections
 *   - Lodging excise tax tracking (MGL Ch. 64G)
 *   - Complaint intake and resolution
 *   - Renewal workflows and status dashboards
 */

import { useState } from 'react'
import { ArrowLeft, Plus, HouseSimple, WarningCircle, CheckCircle, ClockCountdown, CurrencyDollar, MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type UnitStatus = 'registered' | 'pending' | 'inspection_due' | 'non_compliant' | 'suspended' | 'expired'
type ListingPlatform = 'Airbnb' | 'VRBO' | 'Booking.com' | 'Direct' | 'Other'

interface StayUnit {
  id: string
  address: string
  hostName: string
  hostEmail: string
  hostPhone?: string
  platform: ListingPlatform
  unitType: 'entire_home' | 'private_room' | 'shared_room' | 'hotel'
  bedrooms: number
  licenseNumber?: string
  status: UnitStatus
  registeredDate?: string
  renewalDue?: string
  lastInspectionDate?: string
  nextInspectionDate?: string
  exciseTaxAccountId?: string
  quarterlyRevenue?: number
  complaints: number
  notes?: string
}

interface NewUnitForm {
  address: string
  hostName: string
  hostEmail: string
  hostPhone: string
  platform: ListingPlatform
  unitType: StayUnit['unitType']
  bedrooms: string
  notes: string
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_UNITS: StayUnit[] = [
  {
    id: 'str-001',
    address: '14 Maple Street, Unit 2',
    hostName: 'Patricia Walsh',
    hostEmail: 'pwalsh@email.com',
    hostPhone: '(508) 555-0142',
    platform: 'Airbnb',
    unitType: 'entire_home',
    bedrooms: 3,
    licenseNumber: 'STR-2024-0001',
    status: 'registered',
    registeredDate: '2024-01-15',
    renewalDue: '2025-01-15',
    lastInspectionDate: '2024-01-10',
    nextInspectionDate: '2025-01-10',
    exciseTaxAccountId: 'LT-2024-0001',
    quarterlyRevenue: 8400,
    complaints: 0,
  },
  {
    id: 'str-002',
    address: '7 Oak Avenue',
    hostName: 'Robert Chen',
    hostEmail: 'rchen@email.com',
    platform: 'VRBO',
    unitType: 'entire_home',
    bedrooms: 4,
    licenseNumber: 'STR-2024-0002',
    status: 'inspection_due',
    registeredDate: '2024-03-01',
    renewalDue: '2025-03-01',
    lastInspectionDate: '2024-03-01',
    nextInspectionDate: '2024-12-01',
    exciseTaxAccountId: 'LT-2024-0002',
    quarterlyRevenue: 12200,
    complaints: 1,
    notes: 'Noise complaint filed 2024-11-03 — neighbor dispute re: late check-ins.',
  },
  {
    id: 'str-003',
    address: '23 Elm Court',
    hostName: 'Sarah Fontaine',
    hostEmail: 'sfontaine@email.com',
    hostPhone: '(617) 555-0099',
    platform: 'Airbnb',
    unitType: 'private_room',
    bedrooms: 1,
    status: 'pending',
    registeredDate: '2024-11-20',
    complaints: 0,
    notes: 'Application submitted. Awaiting initial inspection scheduling.',
  },
  {
    id: 'str-004',
    address: '88 Pine Road',
    hostName: 'Marcus Delgado',
    hostEmail: 'mdelgado@email.com',
    platform: 'Direct',
    unitType: 'entire_home',
    bedrooms: 5,
    licenseNumber: 'STR-2023-0034',
    status: 'non_compliant',
    registeredDate: '2023-06-01',
    renewalDue: '2024-06-01',
    lastInspectionDate: '2023-06-01',
    exciseTaxAccountId: 'LT-2023-0034',
    quarterlyRevenue: 0,
    complaints: 3,
    notes: 'License expired. Operating without valid registration. Violation notice issued 2024-06-15.',
  },
  {
    id: 'str-005',
    address: '5 Birch Lane, Suite A',
    hostName: 'Sunrise Hospitality LLC',
    hostEmail: 'ops@sunrisehospitality.com',
    hostPhone: '(781) 555-0201',
    platform: 'Booking.com',
    unitType: 'hotel',
    bedrooms: 12,
    licenseNumber: 'STR-2024-0018',
    status: 'registered',
    registeredDate: '2024-02-01',
    renewalDue: '2025-02-01',
    lastInspectionDate: '2024-01-28',
    nextInspectionDate: '2025-01-28',
    exciseTaxAccountId: 'LT-2024-0018',
    quarterlyRevenue: 48000,
    complaints: 0,
  },
]

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<UnitStatus, string> = {
  registered: 'Registered',
  pending: 'Pending Review',
  inspection_due: 'Inspection Due',
  non_compliant: 'Non-Compliant',
  suspended: 'Suspended',
  expired: 'Expired',
}

const STATUS_CLASS: Record<UnitStatus, string> = {
  registered: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  pending: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  inspection_due: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  non_compliant: 'bg-red-500/10 text-red-700 border-red-500/20',
  suspended: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  expired: 'bg-slate-400/10 text-slate-500 border-slate-400/20',
}

const UNIT_TYPE_LABELS: Record<StayUnit['unitType'], string> = {
  entire_home: 'Entire Home',
  private_room: 'Private Room',
  shared_room: 'Shared Room',
  hotel: 'Hotel / Inn',
}

function StatusBadge({ status }: { status: UnitStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', STATUS_CLASS[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; accent: string
}) {
  return (
    <div className={cn('rounded-xl border p-4 flex gap-3 items-start', accent)}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Unit row ───────────────────────────────────────────────────────────────────

function UnitRow({ unit, onClick }: { unit: StayUnit; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-4 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{unit.address}</p>
          <p className="text-xs text-muted-foreground">{unit.hostName} · {UNIT_TYPE_LABELS[unit.unitType]} · {unit.bedrooms} BR · {unit.platform}</p>
        </div>
        <StatusBadge status={unit.status} />
      </div>
      <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
        {unit.licenseNumber && <span>License: {unit.licenseNumber}</span>}
        {unit.renewalDue && <span>Renewal: {unit.renewalDue}</span>}
        {unit.nextInspectionDate && <span>Inspection: {unit.nextInspectionDate}</span>}
        {unit.complaints > 0 && (
          <span className="text-amber-600 flex items-center gap-0.5">
            <WarningCircle size={11} weight="fill" /> {unit.complaints} complaint{unit.complaints > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  )
}

// ── Detail drawer (inline) ────────────────────────────────────────────────────

function UnitDetail({ unit, onClose }: { unit: StayUnit; onClose: () => void }) {
  function Row({ label, value }: { label: string; value?: React.ReactNode }) {
    if (!value && value !== 0) return null
    return (
      <div className="flex justify-between gap-4 py-1.5 border-b border-border last:border-0">
        <span className="text-muted-foreground text-sm shrink-0">{label}</span>
        <span className="text-sm text-right font-medium">{value}</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{unit.address}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{UNIT_TYPE_LABELS[unit.unitType]} · {unit.bedrooms} bedrooms</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={unit.status} />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm px-2">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-muted/30 p-3 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Host</p>
          <Row label="Name" value={unit.hostName} />
          <Row label="Email" value={
            <a href={`mailto:${unit.hostEmail}`} className="text-primary hover:underline">{unit.hostEmail}</a>
          } />
          <Row label="Phone" value={unit.hostPhone} />
          <Row label="Platform" value={unit.platform} />
        </div>
        <div className="rounded-lg bg-muted/30 p-3 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Registration</p>
          <Row label="License #" value={unit.licenseNumber} />
          <Row label="Registered" value={unit.registeredDate} />
          <Row label="Renewal due" value={unit.renewalDue} />
          <Row label="Tax account" value={unit.exciseTaxAccountId} />
        </div>
        <div className="rounded-lg bg-muted/30 p-3 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Inspections</p>
          <Row label="Last inspection" value={unit.lastInspectionDate} />
          <Row label="Next due" value={unit.nextInspectionDate} />
        </div>
        <div className="rounded-lg bg-muted/30 p-3 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Revenue & Compliance</p>
          <Row label="Quarterly revenue" value={unit.quarterlyRevenue != null ? `$${unit.quarterlyRevenue.toLocaleString()}` : undefined} />
          <Row label="Complaints" value={unit.complaints > 0 ? (
            <span className="text-amber-600">{unit.complaints}</span>
          ) : '0'} />
        </div>
      </div>
      {unit.notes && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-sm text-amber-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">Notes</p>
          {unit.notes}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm">Schedule Inspection</Button>
        <Button variant="outline" size="sm">Log Complaint</Button>
        <Button variant="outline" size="sm">Send Renewal Notice</Button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type Tab = 'all' | 'pending' | 'active' | 'compliance' | 'expired'

export function STRPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('all')
  const [units, setUnits] = useState<StayUnit[]>(MOCK_UNITS)
  const [selectedUnit, setSelectedUnit] = useState<StayUnit | null>(null)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<NewUnitForm>({
    address: '', hostName: '', hostEmail: '', hostPhone: '',
    platform: 'Airbnb', unitType: 'entire_home', bedrooms: '1', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const filtered = units.filter(u => {
    if (search && !u.address.toLowerCase().includes(search.toLowerCase()) &&
        !u.hostName.toLowerCase().includes(search.toLowerCase()) &&
        !(u.licenseNumber ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (tab === 'pending') return u.status === 'pending'
    if (tab === 'active') return u.status === 'registered'
    if (tab === 'compliance') return u.status === 'inspection_due' || u.status === 'non_compliant' || u.status === 'suspended'
    if (tab === 'expired') return u.status === 'expired'
    return true
  })

  const totalRevenue = units.reduce((s, u) => s + (u.quarterlyRevenue ?? 0), 0)
  const totalComplaints = units.reduce((s, u) => s + u.complaints, 0)

  async function handleCreate() {
    if (!form.address.trim() || !form.hostName.trim() || !form.hostEmail.trim()) {
      toast.error('Address, host name, and email are required')
      return
    }
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    const newUnit: StayUnit = {
      id: `str-${Date.now()}`,
      address: form.address,
      hostName: form.hostName,
      hostEmail: form.hostEmail,
      hostPhone: form.hostPhone || undefined,
      platform: form.platform,
      unitType: form.unitType,
      bedrooms: parseInt(form.bedrooms) || 1,
      status: 'pending',
      registeredDate: new Date().toISOString().split('T')[0],
      complaints: 0,
      notes: form.notes || undefined,
    }
    setUnits(prev => [newUnit, ...prev])
    setSaving(false)
    setShowNew(false)
    setForm({ address: '', hostName: '', hostEmail: '', hostPhone: '', platform: 'Airbnb', unitType: 'entire_home', bedrooms: '1', notes: '' })
    toast.success('Registration submitted — pending initial inspection')
  }

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="font-semibold text-base flex items-center gap-2">
              <HouseSimple size={16} weight="duotone" className="text-emerald-600" />
              Short-Term Rentals
            </h1>
            <p className="text-xs text-muted-foreground">MGL Ch. 64G · host licensing & compliance</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={14} className="mr-1" /> Register Unit
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Registered units"
            value={units.filter(u => u.status === 'registered').length}
            sub={`of ${units.length} total`}
            icon={<CheckCircle size={20} weight="duotone" className="text-emerald-500" />}
            accent="border-emerald-500/20 bg-emerald-500/5 text-emerald-900"
          />
          <StatCard
            label="Pending review"
            value={units.filter(u => u.status === 'pending').length}
            sub="awaiting inspection"
            icon={<ClockCountdown size={20} weight="duotone" className="text-sky-500" />}
            accent="border-sky-500/20 bg-sky-500/5 text-sky-900"
          />
          <StatCard
            label="Need attention"
            value={units.filter(u => ['inspection_due', 'non_compliant', 'suspended', 'expired'].includes(u.status)).length}
            sub={`${totalComplaints} open complaint${totalComplaints !== 1 ? 's' : ''}`}
            icon={<WarningCircle size={20} weight="duotone" className="text-amber-500" />}
            accent="border-amber-500/20 bg-amber-500/5 text-amber-900"
          />
          <StatCard
            label="Quarterly revenue"
            value={`$${(totalRevenue / 1000).toFixed(0)}k`}
            sub="tracked excise base"
            icon={<CurrencyDollar size={20} weight="duotone" className="text-violet-500" />}
            accent="border-violet-500/20 bg-violet-500/5 text-violet-900"
          />
        </div>

        {/* Search + Filter bar */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7 h-8 text-sm"
              placeholder="Search by address, host, or license…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'pending', 'active', 'compliance', 'expired'] as const).map(t => (
              <button key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                  tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                )}>
                {t === 'compliance' ? 'Action' : t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Detail pane */}
        {selectedUnit && (
          <div className="mb-3">
            <UnitDetail unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
          </div>
        )}

        {/* Unit list */}
        <div className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <HouseSimple size={32} weight="light" className="mx-auto mb-2 opacity-30" />
              No units match this filter
            </div>
          ) : (
            filtered.map(u => (
              <UnitRow key={u.id} unit={u}
                onClick={() => setSelectedUnit(u.id === selectedUnit?.id ? null : u)} />
            ))
          )}
        </div>

        {/* MGL note */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Lodging excise tax collected under MGL Ch. 64G — 5.7% state + applicable local option rate.
          Short-term rental registrations subject to local bylaw requirements.
        </p>
      </div>

      {/* New registration dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Unit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="stay-address">Unit Address *</Label>
              <Input id="stay-address" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St, Unit 1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="stay-host">Host Name *</Label>
                <Input id="stay-host" value={form.hostName}
                  onChange={e => setForm(f => ({ ...f, hostName: e.target.value }))}
                  placeholder="Full name or entity" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="stay-email">Host Email *</Label>
                <Input id="stay-email" type="email" value={form.hostEmail}
                  onChange={e => setForm(f => ({ ...f, hostEmail: e.target.value }))}
                  placeholder="host@email.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="stay-phone">Host Phone</Label>
                <Input id="stay-phone" value={form.hostPhone}
                  onChange={e => setForm(f => ({ ...f, hostPhone: e.target.value }))}
                  placeholder="(508) 555-0100" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="stay-bedrooms">Bedrooms</Label>
                <Input id="stay-bedrooms" type="number" min="1" value={form.bedrooms}
                  onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="stay-type">Unit Type</Label>
                <select id="stay-type" value={form.unitType}
                  onChange={e => setForm(f => ({ ...f, unitType: e.target.value as StayUnit['unitType'] }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="entire_home">Entire Home</option>
                  <option value="private_room">Private Room</option>
                  <option value="shared_room">Shared Room</option>
                  <option value="hotel">Hotel / Inn</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="stay-platform">Primary Platform</Label>
                <select id="stay-platform" value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value as ListingPlatform }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  {(['Airbnb', 'VRBO', 'Booking.com', 'Direct', 'Other'] as const).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="stay-notes">Notes</Label>
              <Textarea id="stay-notes" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any relevant details…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Registration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
