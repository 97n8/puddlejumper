import { FormKeyGovernanceSummaryWidget } from '@/features/formkey/components'
import { cn } from '@/lib/utils'
import { CaretRight } from '@phosphor-icons/react'
import type { Municipality } from '@/data/maMunicipalities'
import type { FiscalSnapshot } from '../types'
import { buildTownGovernanceSources, buildHealthReason } from '../utils'
import { TaskQueuePanel } from './TaskQueuePanel'

const GOVERNANCE_FRAMEWORK_LINKS = [
  {
    title: 'Open Meeting Law',
    url: 'https://www.mass.gov/the-open-meeting-law',
    helper: 'Meeting posting, executive-session, and minutes rules',
    note: 'The baseline for agenda posting, deliberation, and recordkeeping.',
  },
  {
    title: 'Public Records Law',
    url: 'https://www.mass.gov/public-records-law',
    helper: 'Response timing, exemptions, and records-handling expectations',
    note: 'Useful when board packets, emails, and minutes need a defensible records lane.',
  },
  {
    title: 'OIG Procurement Guidance',
    url: 'https://www.mass.gov/orgs/office-of-the-inspector-general',
    helper: 'Purchasing and procurement controls',
    note: 'Helpful when votes, contracts, and board approvals connect to spending authority.',
  },
  {
    title: 'Find My Legislator',
    url: 'https://malegislature.gov/Search/FindMyLegislator',
    helper: 'Legislators, districts, and statehouse follow-up',
    note: 'Keeps local questions tied to the right delegation without leaving the governance lane.',
  },
] as const

const BOARDS = [
  { name: 'Board of Selectmen',       seats: 3,  filled: 3, type: 'Elected' },
  { name: 'School Committee',          seats: 5,  filled: 5, type: 'Elected' },
  { name: 'Planning Board',            seats: 5,  filled: 5, type: 'Elected' },
  { name: 'Finance Committee',         seats: 9,  filled: 8, type: 'Appointed' },
  { name: 'Board of Health',           seats: 3,  filled: 2, type: 'Appointed' },
  { name: 'Zoning Board of Appeals',   seats: 5,  filled: 5, type: 'Appointed' },
  { name: 'Conservation Commission',   seats: 7,  filled: 7, type: 'Appointed' },
  { name: 'Historical Commission',     seats: 7,  filled: 6, type: 'Appointed' },
  { name: 'Council on Aging',          seats: 9,  filled: 9, type: 'Appointed' },
  { name: 'Cable Advisory Committee',  seats: 5,  filled: 4, type: 'Appointed' },
  { name: 'Community Preservation',    seats: 9,  filled: 9, type: 'Appointed' },
  { name: 'Agricultural Commission',   seats: 5,  filled: 5, type: 'Appointed' },
]

export function GovernancePanel({ municipality, snap, hasFormKeyAccess = true }: { municipality: Municipality; snap: FiscalSnapshot | null; hasFormKeyAccess?: boolean }) {
  const totalSeats    = BOARDS.reduce((s, b) => s + b.seats, 0)
  const totalFilled   = BOARDS.reduce((s, b) => s + b.filled, 0)
  const totalVacant   = totalSeats - totalFilled
  const townSources = buildTownGovernanceSources(municipality)
  const governanceSignals = [
    {
      label: 'Town source path',
      value: 'Official site + CivicPlus-ready trail',
      detail: `${municipality.name} meeting pages, packets, and policy pages can be brought into one governed lane.`,
    },
    {
      label: 'Meeting memory',
      value: 'Minutes + packets + recordings',
      detail: 'The goal is not more content. It is one durable record of what was posted, said, voted, and certified.',
    },
    {
      label: 'Law + policy',
      value: 'M.G.L. + town rules together',
      detail: 'State law sets the floor. Town bylaws and internal policy usually shape the real operating path.',
    },
    {
      label: 'Legislators + oversight',
      value: 'Delegation, AG, OIG, Secretary, DLS',
      detail: 'The governance lane stays calmer when staff can reach the right state actor without a side search.',
    },
  ]

  return (
    <div className="p-5 space-y-5">
      {/* ── Action items (Layer 8 — live task feed) ── */}
      <div className="rounded-xl border bg-card p-4">
        <TaskQueuePanel />
      </div>

      <FormKeyGovernanceSummaryWidget hasFormKeyAccess={hasFormKeyAccess} />

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="text-sm font-semibold">Governance framework at work</div>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          This is not an assessment and it is not a tech showcase. It is a calm governance framework: town policy, state law,
          board memory, and source systems arranged so leadership can move without losing the record.
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {governanceSignals.map(signal => (
          <div key={signal.label} className="bg-card border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">{signal.label}</div>
            <div className="text-sm font-semibold">{signal.value}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{signal.detail}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Governance source paths for {municipality.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Minutes, policies, packets, and CivicPlus-style meeting pages should be one click from the governance lane.</p>
          </div>
          <span className="text-xs text-muted-foreground">Town-facing pull paths</span>
        </div>
        <div className="divide-y">
          {townSources.map(source => (
            <div key={source.title} className="flex flex-col gap-3 px-4 py-4 text-sm lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{source.title}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">{source.helper}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{source.detail}</div>
              </div>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                {source.action}
                <CaretRight size={12} />
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Law, policy, and legislative spine</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">The town lane is strongest when local minutes and policies sit right next to the state framework.</p>
        </div>
        <div className="divide-y">
          {GOVERNANCE_FRAMEWORK_LINKS.map(link => (
            <div key={link.title} className="flex flex-col gap-3 px-4 py-4 text-sm lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{link.title}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">{link.helper}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{link.note}</div>
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                Open reference
                <CaretRight size={12} />
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Boards &amp; Commissions</h3>
          <span className="text-xs text-muted-foreground">{totalVacant} of {totalSeats} seats open</span>
        </div>
        <div className="divide-y">
          {BOARDS.map(b => {
            const vacant = b.seats - b.filled
            return (
              <div key={b.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{b.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{b.type}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: b.seats }).map((_, i) => (
                    <div key={i} className={cn('w-2.5 h-2.5 rounded-full', i < b.filled ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                  ))}
                </div>
                <span className={cn('text-xs w-14 text-right shrink-0 font-medium', vacant > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                  {vacant > 0 ? `${vacant} open` : 'Full'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {snap && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="text-sm font-semibold">Framework read for FY{snap.fiscal_year}</div>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {buildHealthReason(snap)} This is a pattern read from connected public data and governance frameworks, not legal or financial advice.
          </p>
        </div>
      )}
    </div>
  )
}
