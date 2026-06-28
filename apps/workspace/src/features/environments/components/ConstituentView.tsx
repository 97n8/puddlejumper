// ConstituentView.tsx — World-class municipal resident CRM
// Search, profile, case history, open requests, permits, parcel, quick actions.

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  MagnifyingGlass, User, House, Phone, Envelope, IdentificationCard,
  FileText, Gavel, Tree, Wrench, CurrencyDollar, WarningCircle,
  CheckCircle, Clock, CaretRight, ArrowLeft, PlusCircle, Funnel,
  MapPin, Calendar, Clipboard, Dog, Buildings,
} from '@phosphor-icons/react'

// ── Types ──────────────────────────────────────────────────────────────────

type CaseStatus = 'open' | 'in_review' | 'closed' | 'overdue'
type CaseType = 'request' | 'permit' | 'complaint' | 'license' | 'payment' | 'hearing' | 'inspection'

interface ConstituentCase {
  id: string
  type: CaseType
  title: string
  status: CaseStatus
  date: string
  dept: string
  note?: string
}

interface Constituent {
  id: string
  firstName: string
  lastName: string
  address: string
  parcel: string
  phone: string
  email: string
  ward?: string
  propertyClass: 'residential' | 'commercial' | 'exempt'
  yearsResident: number
  cases: ConstituentCase[]
  tags?: string[]
}

// ── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_RESIDENTS: Constituent[] = [
  {
    id: 'c-001', firstName: 'Margaret', lastName: 'Donovan',
    address: '14 Elm Street, Millbrook, MA 01720', parcel: '23-045-001',
    phone: '(978) 555-0142', email: 'mdonovan@email.com',
    ward: 'Ward 2', propertyClass: 'residential', yearsResident: 22,
    tags: ['frequent'],
    cases: [
      { id: 'R-2401', type: 'complaint', title: 'Sidewalk trip hazard — Elm & Pine', status: 'open', date: '2026-03-18', dept: 'DPW', note: 'Crew scheduled for Apr 2.' },
      { id: 'P-2389', type: 'permit', title: 'Deck addition permit', status: 'closed', date: '2026-01-05', dept: 'Building', note: 'Final inspection passed.' },
      { id: 'L-2201', type: 'license', title: 'Dog license — Biscuit', status: 'closed', date: '2025-04-01', dept: 'Town Clerk' },
      { id: 'H-2290', type: 'hearing', title: 'ZBA variance — setback appeal', status: 'closed', date: '2025-09-14', dept: 'ZBA', note: 'Approved with conditions.' },
    ],
  },
  {
    id: 'c-002', firstName: 'Robert', lastName: 'Chaput',
    address: '8 Highland Ave, Millbrook, MA 01720', parcel: '12-018-003',
    phone: '(978) 555-0271', email: 'rchaput@maplenet.com',
    ward: 'Ward 1', propertyClass: 'residential', yearsResident: 7,
    cases: [
      { id: 'F-2415', type: 'request', title: 'FOIA — Police incident report', status: 'overdue', date: '2026-03-01', dept: 'Clerk / Police', note: 'Response due Mar 31. Counsel review pending.' },
      { id: 'P-2401', type: 'permit', title: 'Fence permit — rear yard', status: 'in_review', date: '2026-03-20', dept: 'Building' },
    ],
  },
  {
    id: 'c-003', firstName: 'Linda', lastName: 'Bergeron',
    address: '201 Central St, Millbrook, MA 01720', parcel: '07-002-011',
    phone: '(978) 555-0388', email: 'lbergeron@comcast.net',
    ward: 'Ward 3', propertyClass: 'residential', yearsResident: 31,
    tags: ['senior'],
    cases: [
      { id: 'R-2388', type: 'request', title: 'Streetlight outage — Central & Oak', status: 'closed', date: '2026-02-14', dept: 'DPW', note: 'Repaired Feb 22.' },
      { id: 'P-2211', type: 'payment', title: 'Property tax Q2 2026', status: 'closed', date: '2026-02-01', dept: 'Treasurer' },
      { id: 'I-2302', type: 'inspection', title: 'Annual oil burner inspection', status: 'closed', date: '2026-01-18', dept: 'Fire / Building' },
    ],
  },
  {
    id: 'c-004', firstName: 'James', lastName: 'Tran',
    address: '55 Commerce Way, Millbrook, MA 01720', parcel: '03-114-008',
    phone: '(978) 555-0519', email: 'jtran@northshorelaw.com',
    ward: 'Ward 2', propertyClass: 'commercial', yearsResident: 4,
    tags: ['business'],
    cases: [
      { id: 'P-2420', type: 'permit', title: 'Interior renovation — Suite 3A', status: 'in_review', date: '2026-03-22', dept: 'Building' },
      { id: 'L-2418', type: 'license', title: 'Business license renewal 2026', status: 'open', date: '2026-03-15', dept: 'Town Clerk', note: 'Awaiting DPH clearance.' },
      { id: 'P-2290', type: 'payment', title: 'Commercial property tax Q1 2026', status: 'closed', date: '2026-01-15', dept: 'Treasurer' },
    ],
  },
  {
    id: 'c-005', firstName: 'Sarah', lastName: 'Okafor',
    address: '77 Orchard Lane, Millbrook, MA 01720', parcel: '18-033-002',
    phone: '(978) 555-0647', email: 'sokafor@gmail.com',
    ward: 'Ward 4', propertyClass: 'residential', yearsResident: 2,
    cases: [
      { id: 'L-2408', type: 'license', title: 'Dog license — Mochi', status: 'open', date: '2026-03-10', dept: 'Town Clerk' },
      { id: 'R-2410', type: 'complaint', title: 'Drainage issue — rear yard flooding', status: 'in_review', date: '2026-03-12', dept: 'DPW / Engineering', note: 'Site visit Apr 4.' },
    ],
  },
  {
    id: 'c-006', firstName: 'Paul', lastName: 'Ferrante',
    address: '9 Birch Road, Millbrook, MA 01720', parcel: '31-007-004',
    phone: '(978) 555-0733', email: 'pferrante@verizon.net',
    ward: 'Ward 1', propertyClass: 'residential', yearsResident: 15,
    cases: [
      { id: 'P-2399', type: 'permit', title: 'Solar panel installation', status: 'closed', date: '2026-02-28', dept: 'Building / Electrical', note: 'Net metering approved.' },
      { id: 'H-2388', type: 'hearing', title: 'Conservation — wetland buffer appeal', status: 'overdue', date: '2026-03-05', dept: 'Conservation Commission', note: 'Hearing postponed twice. Rescheduled Apr 16.' },
      { id: 'P-2301', type: 'payment', title: 'Excise tax — 2023 Ford F-150', status: 'closed', date: '2026-01-20', dept: 'Treasurer' },
    ],
  },
  {
    id: 'c-007', firstName: 'Donna', lastName: 'Whitfield',
    address: '330 Main Street, Millbrook, MA 01720', parcel: '01-001-001',
    phone: '(978) 555-0812', email: 'dwhitfield@towncenter.org',
    ward: 'Ward 2', propertyClass: 'commercial', yearsResident: 18,
    tags: ['business', 'frequent'],
    cases: [
      { id: 'L-2405', type: 'license', title: 'Common victualler license — renewal', status: 'in_review', date: '2026-03-08', dept: 'Board of Health', note: 'Inspection scheduled Apr 1.' },
      { id: 'P-2385', type: 'permit', title: 'Outdoor dining permit — seasonal', status: 'open', date: '2026-03-24', dept: 'Building / Select Board' },
      { id: 'R-2370', type: 'request', title: 'Sidewalk snow removal complaint', status: 'closed', date: '2026-02-10', dept: 'DPW' },
    ],
  },
  {
    id: 'c-008', firstName: 'Marcus', lastName: 'Liu',
    address: '42 Sunset Drive, Millbrook, MA 01720', parcel: '22-091-007',
    phone: '(978) 555-0924', email: 'mliu@outlook.com',
    ward: 'Ward 3', propertyClass: 'residential', yearsResident: 9,
    cases: [
      { id: 'R-2422', type: 'complaint', title: 'Noise complaint — 44 Sunset Drive', status: 'open', date: '2026-03-25', dept: 'Police / Zoning' },
      { id: 'P-2318', type: 'permit', title: 'Shed permit — backyard', status: 'closed', date: '2025-11-14', dept: 'Building' },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_META: Record<CaseType, { icon: React.ReactNode; color: string; bg: string }> = {
  request:    { icon: <Clipboard size={12} />,       color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  permit:     { icon: <FileText size={12} />,         color: 'text-violet-400', bg: 'bg-violet-500/10' },
  complaint:  { icon: <WarningCircle size={12} />,    color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  license:    { icon: <Dog size={12} />,              color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
  payment:    { icon: <CurrencyDollar size={12} />,   color: 'text-green-400',  bg: 'bg-green-500/10' },
  hearing:    { icon: <Gavel size={12} />,            color: 'text-rose-400',   bg: 'bg-rose-500/10' },
  inspection: { icon: <Wrench size={12} />,           color: 'text-orange-400', bg: 'bg-orange-500/10' },
}

const STATUS_META: Record<CaseStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open:      { label: 'Open',      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',       icon: <Clock size={10} /> },
  in_review: { label: 'In Review', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',    icon: <Clock size={10} /> },
  closed:    { label: 'Closed',    color: 'text-muted-foreground bg-muted border-border',           icon: <CheckCircle size={10} /> },
  overdue:   { label: 'Overdue',   color: 'text-red-400 bg-red-500/10 border-red-500/20',          icon: <WarningCircle size={10} /> },
}

const PROP_CLASS_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  residential: { label: 'Residential', icon: <House size={11} />,      color: 'text-blue-400' },
  commercial:  { label: 'Commercial',  icon: <Buildings size={11} />,  color: 'text-violet-400' },
  exempt:      { label: 'Exempt',      icon: <Tree size={11} />,       color: 'text-emerald-400' },
}

function openCount(r: Constituent) {
  return r.cases.filter(c => c.status === 'open' || c.status === 'in_review' || c.status === 'overdue').length
}

function overdueCount(r: Constituent) {
  return r.cases.filter(c => c.status === 'overdue').length
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ResidentRow({ r, selected, onClick }: { r: Constituent; selected: boolean; onClick: () => void }) {
  const open = openCount(r)
  const overdue = overdueCount(r)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors flex items-center gap-3 group
        ${selected ? 'bg-primary/8 border-l-2 border-l-primary pl-[14px]' : 'hover:bg-muted/50 border-l-2 border-l-transparent'}`}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0 text-muted-foreground">
        <User size={15} weight="duotone" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{r.firstName} {r.lastName}</p>
        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
          <MapPin size={9} className="shrink-0" />{r.address.split(',')[0]}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {overdue > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold border border-red-500/20 leading-none">
            {overdue} overdue
          </span>
        )}
        {open > 0 && overdue === 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20 leading-none">
            {open} open
          </span>
        )}
        {open === 0 && <span className="text-[10px] text-muted-foreground/50">No open items</span>}
        <CaretRight size={11} className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
    </button>
  )
}

function CaseRow({ c }: { c: ConstituentCase }) {
  const tm = TYPE_META[c.type]
  const sm = STATUS_META[c.status]
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors">
      <div className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5 ${tm.bg}`}>
        <span className={tm.color}>{tm.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground leading-snug">{c.title}</p>
          <span
            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${sm.color}`}
            aria-label={`Status: ${sm.label}`}
          >
            <span aria-hidden="true">{sm.icon}</span>{sm.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] text-muted-foreground">{c.dept}</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar size={9} />{c.date}</span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">{c.id}</span>
        </div>
        {c.note && <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{c.note}</p>}
      </div>
    </div>
  )
}

function ProfilePanel({ r, onBack, demoEmail, municipalityName }: { r: Constituent; onBack: () => void; demoEmail?: string | null; municipalityName?: string }) {
  const [caseFilter, setCaseFilter] = useState<'all' | CaseStatus>('all')
  const open = openCount(r)
  const overdue = overdueCount(r)
  const pm = PROP_CLASS_META[r.propertyClass]

  const filtered = r.cases.filter(c => caseFilter === 'all' || c.status === caseFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Profile header */}
      <div className="px-6 py-5 border-b border-border bg-gradient-to-b from-card to-card/60 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors md:hidden">
          <ArrowLeft size={13} /> Back to directory
        </button>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
            <User size={24} weight="duotone" className="text-primary/70" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">{r.firstName} {r.lastName}</h2>
              {r.tags?.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium capitalize">{tag}</span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <MapPin size={12} className="shrink-0" />{r.address}
            </p>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className={`flex items-center gap-1 text-xs ${pm.color}`}>{pm.icon} {pm.label}</span>
              {r.ward && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Buildings size={11} />{r.ward}</span>}
              <span className="text-xs text-muted-foreground">{r.yearsResident}yr resident</span>
            </div>
          </div>
        </div>

        {/* Contact row */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Phone size={12} className="text-muted-foreground/60" />{r.phone}
          </a>
          <a href={`mailto:${r.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Envelope size={12} className="text-muted-foreground/60" />{r.email}
          </a>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IdentificationCard size={12} className="text-muted-foreground/60" />Parcel {r.parcel}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-border/80 bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <div className="font-medium text-foreground">Constituent status visibility</div>
          <div className="mt-1">
            Updates stay on screen here for the resident and can also be sent to{' '}
            <span className="font-medium text-foreground">{demoEmail ?? r.email}</span>.
            {' '}If the town saves a notice or summary, the file can download immediately and later auto-route with reminders from {municipalityName ?? 'Logicville'}.
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Total Cases', value: r.cases.length, color: 'text-foreground' },
            { label: 'Open / In Review', value: open, color: open > 0 ? 'text-blue-400' : 'text-muted-foreground' },
            { label: 'Overdue', value: overdue, color: overdue > 0 ? 'text-red-400 font-bold' : 'text-muted-foreground' },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-muted/50 border border-border/50 px-3 py-2.5 text-center">
              <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Case history */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-muted/[0.03]">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Case History</p>
        <div className="flex items-center gap-1.5">
          {(['all', 'open', 'in_review', 'overdue', 'closed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setCaseFilter(f)}
              className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                caseFilter === f ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {f === 'all' ? 'All' : f === 'in_review' ? 'In Review' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0
          ? <p className="px-4 py-8 text-xs text-muted-foreground text-center">No cases match this filter.</p>
          : filtered.map(c => <CaseRow key={c.id} c={c} />)
        }
      </div>

      {/* Quick actions footer */}
      <div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-2 bg-card/80">
        <Button
          size="sm"
          className="gap-1.5 h-7 text-xs"
          variant="outline"
          onClick={() => {
            const subject = encodeURIComponent(`${municipalityName ?? 'Logicville'} constituent intake: ${r.firstName} ${r.lastName}`)
            const body = encodeURIComponent(`Constituent demo intake for ${r.firstName} ${r.lastName}\nEmail on file: ${demoEmail ?? r.email}\n\nUse this draft to show the resident-facing update flow.`)
            window.location.href = `mailto:${encodeURIComponent(demoEmail ?? r.email)}?subject=${subject}&body=${body}`
            toast.success(`Drafted a constituent intake email to ${demoEmail ?? r.email}.`)
          }}
        >
          <PlusCircle size={12} />New Case
        </Button>
        <Button
          size="sm"
          className="gap-1.5 h-7 text-xs"
          variant="outline"
          onClick={() => {
            const subject = encodeURIComponent(`${municipalityName ?? 'Logicville'} status notice for ${r.firstName} ${r.lastName}`)
            const body = encodeURIComponent(`Status update for ${r.firstName} ${r.lastName}\n\nActive items: ${open}\nOverdue items: ${overdue}\n\nThis mirrors the notice flow shown on screen in the Logicville demo.`)
            window.location.href = `mailto:${encodeURIComponent(demoEmail ?? r.email)}?subject=${subject}&body=${body}`
            toast.success(`Drafted a status notice to ${demoEmail ?? r.email}.`)
          }}
        >
          <Envelope size={12} />Send Notice
        </Button>
        <Button
          size="sm"
          className="gap-1.5 h-7 text-xs"
          variant="outline"
          onClick={() => {
            const summary = [
              `${municipalityName ?? 'Logicville'} constituent summary`,
              `${r.firstName} ${r.lastName}`,
              r.address,
              `Email on file: ${demoEmail ?? r.email}`,
              `Open or in review: ${open}`,
              `Overdue: ${overdue}`,
              '',
              ...filtered.map(c => `${c.id} — ${c.title} (${STATUS_META[c.status].label})`),
            ].join('\n')
            downloadTextFile(`${r.lastName.toLowerCase()}-${r.firstName.toLowerCase()}-constituent-summary.txt`, summary)
            toast.success('Constituent summary downloaded. In live use, this can also auto-route and trigger reminders.')
          }}
        >
          <FileText size={12} />Print Summary
        </Button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

type FilterKey = 'all' | 'open' | 'overdue' | 'business'

export function ConstituentView({ demoEmail, municipalityName }: { demoEmail?: string | null; municipalityName?: string }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selected, setSelected] = useState<Constituent | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  const filtered = useMemo(() => {
    return DEMO_RESIDENTS.filter(r => {
      const q = search.toLowerCase()
      const matchSearch = !q
        || `${r.firstName} ${r.lastName}`.toLowerCase().includes(q)
        || r.address.toLowerCase().includes(q)
        || r.parcel.includes(q)
        || r.email.toLowerCase().includes(q)
        || r.cases.some(c => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      if (!matchSearch) return false
      if (filter === 'open') return openCount(r) > 0
      if (filter === 'overdue') return overdueCount(r) > 0
      if (filter === 'business') return r.propertyClass === 'commercial'
      return true
    })
  }, [search, filter])

  const handleSelect = (r: Constituent) => {
    setSelected(r)
    setShowProfile(true)
  }

  const totalOpen = DEMO_RESIDENTS.reduce((n, r) => n + openCount(r), 0)
  const totalOverdue = DEMO_RESIDENTS.reduce((n, r) => n + overdueCount(r), 0)

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* ── Left: Directory ─────────────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-border bg-card/40 ${showProfile ? 'hidden md:flex md:w-80 lg:w-96' : 'flex-1 md:flex-none md:w-80 lg:w-96'} shrink-0`}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Constituent Directory</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{DEMO_RESIDENTS.length} residents · {totalOpen} open · <span className={totalOverdue > 0 ? 'text-red-400 font-semibold' : ''}>{totalOverdue} overdue</span></p>
            </div>
          </div>
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, address, case ID…"
              className="pl-7 h-8 text-xs bg-background"
              aria-label="Search constituents"
            />
          </div>
          {/* Filter chips */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap" role="group" aria-label="Filter constituents">
            <Funnel size={11} className="text-muted-foreground/50 shrink-0" aria-hidden="true" />
            {(['all', 'open', 'overdue', 'business'] as FilterKey[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                aria-label={`Filter: ${f === 'all' ? 'All constituents' : f.charAt(0).toUpperCase() + f.slice(1)}`}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors ${
                  filter === f
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Resident list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground">
              <User size={28} weight="duotone" className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No residents found.</p>
            </div>
          ) : (
            filtered.map(r => (
              <ResidentRow
                key={r.id}
                r={r}
                selected={selected?.id === r.id}
                onClick={() => handleSelect(r)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: Profile ──────────────────────────────────────────────── */}
      <div className={`flex-1 overflow-hidden ${showProfile ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
        {selected ? (
          <ProfilePanel r={selected} onBack={() => setShowProfile(false)} demoEmail={demoEmail} municipalityName={municipalityName} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
              <IdentificationCard size={28} weight="duotone" className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/60">Select a resident</p>
              <p className="text-xs text-muted-foreground mt-1">Choose a constituent from the directory to view their profile, case history, and demo notice flow.</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-muted/30 px-4 py-3 text-center text-xs leading-5 text-muted-foreground max-w-md">
              Constituent updates can stay visible on screen here and also route to <span className="font-medium text-foreground">{demoEmail ?? 'the signed-in email'}</span>.
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1"><Badge className="text-[9px] h-4 bg-blue-500/10 text-blue-400 border-blue-500/20">{totalOpen}</Badge> open cases</span>
              <span className="flex items-center gap-1"><Badge className="text-[9px] h-4 bg-red-500/10 text-red-400 border-red-500/20">{totalOverdue}</Badge> overdue</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
