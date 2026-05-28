import { useState, useEffect, useCallback } from 'react'
import { useCloudSave } from '@/context/CloudSaveContext'
import {
  sscb1Api,
  type SSCB1Dashboard, type StackItem, type Assumption,
  type Risk, type Decision, type OpenItem, type CadenceEvent,
  type Milestone, type StopRule, type ITCItem, type Source,
} from './sscb1Api'
import {
  ArrowLeft, ArrowClockwise, Warning, CheckCircle, Clock,
  Lightning, Files, Stack, ListChecks, Shield, Coins,
  ClipboardText, Calendar, Archive, DownloadSimple, SpinnerGap,
  Vault, Lock, FilePdf, FileXls, FileDoc, Globe,
} from '@phosphor-icons/react'

type Tab =
  | 'overview' | 'stack' | 'assumptions' | 'risks'
  | 'itc' | 'items' | 'decisions' | 'stop-rules' | 'sources' | 'cadence' | 'milestones' | 'files'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',    label: 'Overview',    icon: <Lightning size={13} /> },
  { id: 'stack',       label: 'Stack',       icon: <Stack size={13} /> },
  { id: 'assumptions', label: 'Assumptions', icon: <ListChecks size={13} /> },
  { id: 'risks',       label: 'Risks',       icon: <Warning size={13} /> },
  { id: 'itc',         label: 'Tax Credits', icon: <Coins size={13} /> },
  { id: 'items',       label: 'Open Items',  icon: <ClipboardText size={13} /> },
  { id: 'decisions',   label: 'Decisions',   icon: <CheckCircle size={13} /> },
  { id: 'stop-rules',  label: 'Stop Rules',  icon: <Shield size={13} /> },
  { id: 'sources',     label: 'Sources',     icon: <Files size={13} /> },
  { id: 'cadence',     label: 'Cadence',     icon: <Calendar size={13} /> },
  { id: 'milestones',  label: 'Milestones',  icon: <Archive size={13} /> },
  { id: 'files',       label: 'Files',       icon: <Vault size={13} /> },
]

interface Props {
  onNavigate: (moduleId: string) => void
  standalone?: boolean
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

function severityBand(s: string) {
  switch (s) {
    case 'critical': return 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
    case 'high':     return 'text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20'
    case 'watch':    return 'text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20'
    default:         return 'text-muted-foreground border-border bg-muted/30'
  }
}

function pill(status: string, extra = '') {
  const map: Record<string, string> = {
    conceptual:           'bg-muted text-muted-foreground',
    assembling:           'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    structured:           'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    pending_agreement:    'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    pending_counsel:      'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
    pending_verification: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
    accepted:             'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    blocked:              'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    closed:               'bg-muted text-muted-foreground',
    open:                 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    in_progress:          'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    resolved:             'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    accepted_risk:        'bg-muted text-muted-foreground',
    pending:              'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    decided:              'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    deferred:             'bg-muted text-muted-foreground',
    firm:                 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    working:              'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    estimate:             'bg-muted text-muted-foreground',
    validated:            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    unvalidated:          'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    in_review:            'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    invalidated:          'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    critical:             'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    high:                 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    watch:                'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
    active:               'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    cleared:              'bg-muted text-muted-foreground',
    at_risk:              'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    complete:             'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  }
  return `${map[status] ?? 'bg-muted text-muted-foreground'} text-[10px] font-bold px-2 py-0.5 rounded-full ${extra}`
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl ${className}`}>{children}</div>
  )
}

function Empty({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>}
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">{children}</h3>
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = 'default', onClick,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'default' | 'green' | 'red' | 'amber' | 'blue' | 'purple'
  onClick?: () => void
}) {
  const accentCls = {
    default: 'text-foreground',
    green:   'text-emerald-600 dark:text-emerald-400',
    red:     'text-red-600 dark:text-red-400',
    amber:   'text-amber-600 dark:text-amber-400',
    blue:    'text-blue-600 dark:text-blue-400',
    purple:  'text-purple-600 dark:text-purple-400',
  }[accent]
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className={`text-2xl font-black tabular-nums ${accentCls}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
    </button>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

const SPEC_STATS = {
  capital_stack: 4_500_000,
  yr2_revenue: 3_285_281,
  ebitda: 2_214_517,
  biochar_ton: 3184,
  fixed_carbon_pct: 94.8,
  itc_rate: 30,
}

function OverviewTab({ dash, onTabChange }: { dash: SSCB1Dashboard | null; onTabChange: (t: Tab) => void }) {
  const s = dash?.summary
  const cs = dash?.case
  return (
    <div className="space-y-5">
      {/* Active stop rules banner */}
      {(dash?.stop_rules_active ?? []).filter(r => r.active).length > 0 && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} weight="fill" className="text-red-600 dark:text-red-400" />
            <span className="text-sm font-bold text-red-700 dark:text-red-300">
              {dash!.stop_rules_active.filter(r => r.active).length} Active Stop Rule
              {dash!.stop_rules_active.filter(r => r.active).length > 1 ? 's' : ''}
            </span>
          </div>
          {dash!.stop_rules_active.filter(r => r.active).map(r => (
            <p key={r.id} className="text-xs text-red-700 dark:text-red-300 mb-1">
              <span className="font-mono font-bold mr-2">{r.rule_id_label}</span>
              {r.rule_statement}
            </p>
          ))}
          <button onClick={() => onTabChange('stop-rules')} className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline mt-1">
            View stop rules →
          </button>
        </div>
      )}

      {/* Project info */}
      {cs && (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-base font-bold text-foreground">{cs.case_name}</span>
                <span className={pill(cs.state)}>{cs.state.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{cs.control_version}</span>
              </div>
              <p className="text-xs text-muted-foreground">{cs.description}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">{cs.primary_party_pl} + {cs.primary_party_aed}</p>
            </div>
          </div>
        </Card>
      )}
      {!cs && (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-foreground">Swansea, SC Biochar 1</span>
                <span className={pill('active')}>Active</span>
                <span className="text-[10px] text-muted-foreground font-mono">v1.0</span>
              </div>
              <p className="text-xs text-muted-foreground">Pre-NTP project control — 90-day window from discovery through Notice to Proceed.</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">PublicLogic LLC + Associated Energy Developers, LLC</p>
            </div>
          </div>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          label="Capital Stack"
          value={s ? `$${(s.stack_layers_total * 0).toFixed(0)}` : '$4.5M'}
          sub={`${s?.stack_layers_total ?? 7} layers total`}
          accent="blue"
          onClick={() => onTabChange('stack')}
        />
        <StatCard
          label="Yr 2+ Revenue"
          value="$3.3M"
          sub="$2.2M EBITDA"
          accent="green"
        />
        <StatCard
          label="ITC Exposure"
          value={s?.itc_exposure_estimate ? `$${(s.itc_exposure_estimate / 1_000_000).toFixed(2)}M` : 'TBD'}
          sub="IRC §48 · 30% rate"
          accent="purple"
          onClick={() => onTabChange('itc')}
        />
        <StatCard
          label="Critical Risks"
          value={s?.critical_risks ?? 3}
          sub={`${s?.high_risks ?? 2} high`}
          accent={( s?.critical_risks ?? 3) > 0 ? 'red' : 'green'}
          onClick={() => onTabChange('risks')}
        />
        <StatCard
          label="Assumptions"
          value={`${s?.firm_assumptions ?? 14}/${s?.total_assumptions ?? 22}`}
          sub="firm / total"
          accent="amber"
          onClick={() => onTabChange('assumptions')}
        />
        <StatCard
          label="Open Items"
          value={s?.total_open_items ?? 3}
          sub={`${s?.open_items_critical ?? 1} critical`}
          accent={(s?.open_items_critical ?? 1) > 0 ? 'amber' : 'green'}
          onClick={() => onTabChange('items')}
        />
        <StatCard
          label="Biochar Output"
          value="3,184 ST"
          sub="94.8% fixed carbon"
          accent="green"
        />
        <StatCard
          label="Stack Blocked"
          value={s?.stack_layers_blocked ?? 0}
          sub="layers need action"
          accent={(s?.stack_layers_blocked ?? 0) > 0 ? 'red' : 'default'}
          onClick={() => onTabChange('stack')}
        />
      </div>

      {/* Next decision + milestone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dash?.next_decision ? (
          <button onClick={() => onTabChange('decisions')} className="text-left">
            <Card className="p-4 hover:border-amber-400/60 transition-colors">
              <SectionLabel>Decision Due</SectionLabel>
              <p className="text-sm font-bold text-foreground line-clamp-2">{dash.next_decision.decision_statement}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Due {dash.next_decision.due_date?.slice(0, 10)} · {dash.next_decision.decision_owner}
              </p>
            </Card>
          </button>
        ) : (
          <button onClick={() => onTabChange('decisions')} className="text-left">
            <Card className="p-4 hover:border-amber-400/60 transition-colors">
              <SectionLabel>Decision Due</SectionLabel>
              <p className="text-sm font-bold text-foreground">ChipMax-first vs. full-stack sequencing</p>
              <p className="text-xs text-muted-foreground mt-1">Week 3 target · AED + PL</p>
            </Card>
          </button>
        )}
        {dash?.next_milestone ? (
          <button onClick={() => onTabChange('milestones')} className="text-left">
            <Card className="p-4 hover:border-emerald-400/60 transition-colors">
              <SectionLabel>Next Milestone</SectionLabel>
              <p className="text-sm font-bold text-foreground">{dash.next_milestone.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{dash.next_milestone.target_date?.slice(0, 10)}</p>
            </Card>
          </button>
        ) : (
          <button onClick={() => onTabChange('milestones')} className="text-left">
            <Card className="p-4 hover:border-emerald-400/60 transition-colors">
              <SectionLabel>Next Milestone</SectionLabel>
              <p className="text-sm font-bold text-foreground">Week 1 Discovery Session</p>
              <p className="text-xs text-muted-foreground mt-1">AED + PL kick-off</p>
            </Card>
          </button>
        )}
      </div>

      {/* Top risks */}
      {(dash?.top_risks ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Top Risks</SectionLabel>
            <button onClick={() => onTabChange('risks')} className="text-[11px] text-primary hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {(dash!.top_risks).slice(0, 4).map(r => (
              <div key={r.id} className={`rounded-xl border p-3 flex items-start gap-3 ${severityBand(r.severity)}`}>
                <span className="text-[10px] font-bold uppercase shrink-0 w-14 mt-0.5">{r.severity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{r.description}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{r.owner}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {(dash?.top_risks ?? []).length === 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Known Risks</SectionLabel>
            <button onClick={() => onTabChange('risks')} className="text-[11px] text-primary hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {[
              { id: 'r1', severity: 'critical', title: 'Carbon presale timing', desc: 'Registry and methodology not confirmed — presale blocked per STOP-SSCB-001', owner: 'AED' },
              { id: 'r2', severity: 'critical', title: 'ITC recapture clock', desc: '5-year recapture risk without tax counsel engaged', owner: 'PL' },
              { id: 'r3', severity: 'critical', title: 'Registry selection', desc: 'Methodology must validate 2.1 MT CO₂/MT claim before carbon revenue projection firms', owner: 'AED' },
            ].map(r => (
              <div key={r.id} className={`rounded-xl border p-3 flex items-start gap-3 ${severityBand(r.severity)}`}>
                <span className="text-[10px] font-bold uppercase shrink-0 w-14 mt-0.5">{r.severity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{r.desc}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{r.owner}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next cadence */}
      {dash?.cadence_next && (
        <div>
          <SectionLabel>Next Meeting</SectionLabel>
          <Card className="p-3">
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{dash.cadence_next.meeting_type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">{dash.cadence_next.scheduled_date?.slice(0, 10)} · {dash.cadence_next.required_attendees}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Open items due soon */}
      {(dash?.open_items_due_soon ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Due Soon</SectionLabel>
            <button onClick={() => onTabChange('items')} className="text-[11px] text-primary hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {dash!.open_items_due_soon.map(item => (
              <Card key={item.id} className="p-3 flex items-center gap-3">
                <Clock size={14} className="text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.owner} · Due {item.target_resolution_date?.slice(0, 10)}</p>
                </div>
                <span className={pill(item.blocker_severity)}>{item.blocker_severity}</span>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stack tab ────────────────────────────────────────────────────────────────

function StackTab({ items }: { items: StackItem[] }) {
  const statusOrder = ['blocked', 'pending_agreement', 'pending_counsel', 'assembling', 'conceptual', 'pending_verification', 'structured', 'accepted', 'closed']
  const sorted = [...items].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        All capital and commercial layers. Every layer must have an owner and a next action — blocked layers are flagged automatically.
      </p>
      {sorted.length === 0 ? <Empty label="No stack items loaded." sub="Connect to backend to view the full stack." /> : sorted.map(item => (
        <Card key={item.id} className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-bold text-foreground">{item.layer_name}</span>
                <span className={pill(item.status)}>{item.status.replace(/_/g, ' ')}</span>
                {item.gate_linked && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded px-1">Gate</span>}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/60">{item.stack_item_id_label}</p>
            </div>
            {item.amount > 0 && (
              <span className="text-sm font-bold text-foreground tabular-nums shrink-0">${(item.amount / 1_000_000).toFixed(2)}M</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div><span className="text-muted-foreground">Owner </span><span className="text-foreground font-medium">{item.owner || '—'}</span></div>
            <div><span className="text-muted-foreground">Timing </span><span className="text-foreground">{item.expected_timing || '—'}</span></div>
            {item.next_action && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Next action </span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">{item.next_action}</span>
              </div>
            )}
            {item.current_blocker && (
              <div className="col-span-2">
                <span className="text-red-600 dark:text-red-400 font-semibold">Blocked: </span>
                <span className="text-foreground">{item.current_blocker}</span>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Assumptions tab ──────────────────────────────────────────────────────────

function AssumptionsTab({ items }: { items: Assumption[] }) {
  const [filter, setFilter] = useState<'all' | 'unvalidated' | 'validated' | 'firm'>('all')
  const filtered = items.filter(a =>
    filter === 'all' || a.validation_status === filter || a.confidence === filter
  )
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'unvalidated', 'firm', 'validated'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40 bg-card'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({items.filter(a => f === 'all' || a.validation_status === f || a.confidence === f).length})
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <Empty label="No assumptions match this filter." />
        : filtered.map(a => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{a.assumption_id_label}</span>
                  <span className={pill(a.confidence)}>{a.confidence}</span>
                  <span className={pill(a.validation_status)}>{a.validation_status.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-muted-foreground/70 capitalize">{a.category}</span>
                </div>
                <p className="text-sm text-foreground">{a.statement}</p>
                {a.status_notes && <p className="text-[11px] text-muted-foreground mt-1">{a.status_notes}</p>}
                <div className="flex gap-4 text-[10px] text-muted-foreground/70 mt-1.5">
                  <span>Owner: {a.owner}</span>
                  {a.validation_due && <span>Due: {a.validation_due.slice(0, 10)}</span>}
                </div>
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  )
}

// ─── Risks tab ────────────────────────────────────────────────────────────────

function RisksTab({ items }: { items: Risk[] }) {
  return (
    <div className="space-y-3">
      {items.length === 0
        ? <Empty label="No risks recorded." />
        : items.map(r => (
          <div key={r.id} className={`rounded-xl border p-4 ${severityBand(r.severity)}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-muted-foreground">{r.risk_id_label}</span>
                <span className="text-sm font-bold text-foreground">{r.title}</span>
                <span className={pill(r.severity)}>{r.severity}</span>
                <span className={pill(r.status)}>{r.status}</span>
              </div>
            </div>
            <p className="text-xs text-foreground/80 mb-2">{r.description}</p>
            {r.trigger_condition && (
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold">Trigger: </span>{r.trigger_condition}
              </p>
            )}
            {r.mitigation_plan && (
              <p className="text-[11px] text-muted-foreground mt-1">
                <span className="font-semibold">Mitigation: </span>{r.mitigation_plan}
              </p>
            )}
            <div className="flex gap-4 text-[10px] text-muted-foreground/70 mt-2">
              <span>Owner: {r.owner}</span>
              {r.date_opened && <span>Opened: {r.date_opened.slice(0, 10)}</span>}
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ─── ITC tab ──────────────────────────────────────────────────────────────────

function ITCTab({ items }: { items: ITCItem[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-3">
        <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">IRC §48 Investment Tax Credit — 30% rate with 5-year graduated recapture schedule. Final basis requires counsel-linked documentation.</p>
        <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">Year 1: 100% · Year 2: 80% · Year 3: 60% · Year 4: 40% · Year 5: 20%</p>
      </div>
      {items.length === 0
        ? <Empty label="No ITC records loaded." sub="Connect to backend to view the full tracker." />
        : items.map(itc => {
          const exposure = (itc.estimated_basis || 0) * (itc.itc_rate || 0.3)
          return (
            <Card key={itc.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground mb-0.5">{itc.itc_item_id_label}</p>
                  <p className="text-sm font-bold text-foreground">{itc.eligible_equipment}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{itc.ownership_entity}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
                    {exposure > 0 ? `$${(exposure / 1_000_000).toFixed(2)}M` : 'TBD'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">estimated exposure</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div><span className="text-muted-foreground">Est. Basis </span><span className="text-foreground font-medium">{itc.estimated_basis > 0 ? `$${(itc.estimated_basis / 1_000_000).toFixed(2)}M` : 'TBD'}</span></div>
                <div><span className="text-muted-foreground">ITC Rate </span><span className="text-foreground font-medium">{((itc.itc_rate || 0) * 100).toFixed(0)}%</span></div>
                <div>
                  <span className="text-muted-foreground">Counsel </span>
                  <span className={itc.counsel_engaged ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                    {itc.counsel_engaged ? 'Engaged' : 'Not engaged'}
                  </span>
                </div>
                <div><span className="text-muted-foreground">Tax Opinion </span><span className="text-foreground">{itc.tax_opinion_status?.replace(/_/g, ' ') || '—'}</span></div>
              </div>
              {itc.recapture_risk_flag && (
                <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-2 text-[11px] text-red-700 dark:text-red-300">
                  ⚠ Recapture risk flagged — 5-year recapture schedule applies after placement in service
                </div>
              )}
            </Card>
          )
        })
      }
    </div>
  )
}

// ─── Open Items tab ───────────────────────────────────────────────────────────

function OpenItemsTab({ items }: { items: OpenItem[] }) {
  const open   = items.filter(i => i.status === 'open' || i.status === 'in_progress')
  const closed = items.filter(i => i.status === 'resolved' || i.status === 'accepted_risk')
  return (
    <div className="space-y-4">
      {open.map(item => (
        <Card
          key={item.id}
          className={`p-4 ${item.blocker_severity === 'critical' ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/10' : ''}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-[10px] font-mono text-muted-foreground">{item.open_item_id_label}</span>
                <span className={pill(item.blocker_severity)}>{item.blocker_severity}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{item.item_type.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              {item.close_condition && <p className="text-[11px] text-muted-foreground mt-1">Close when: {item.close_condition}</p>}
              {item.current_note && <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{item.current_note}</p>}
              <div className="flex gap-4 text-[10px] text-muted-foreground/70 mt-1.5">
                <span>Owner: {item.owner}</span>
                {item.target_resolution_date && <span>Due: {item.target_resolution_date.slice(0, 10)}</span>}
              </div>
            </div>
          </div>
        </Card>
      ))}
      {closed.length > 0 && (
        <div>
          <SectionLabel>Resolved</SectionLabel>
          <div className="space-y-2 opacity-70">
            {closed.map(item => (
              <Card key={item.id} className="p-3 flex items-center gap-3">
                <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                <span className="text-xs text-foreground flex-1">{item.title}</span>
                <span className={pill(item.status)}>{item.status.replace(/_/g, ' ')}</span>
              </Card>
            ))}
          </div>
        </div>
      )}
      {items.length === 0 && <Empty label="No open items." sub="All clear — nothing waiting for resolution." />}
    </div>
  )
}

// ─── Decisions tab ────────────────────────────────────────────────────────────

function DecisionsTab({ items }: { items: Decision[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        No material decision lives only in email. Every decision that affects the project is recorded here with options, rationale, and downstream actions.
      </p>
      {items.length === 0
        ? <Empty label="No decisions recorded yet." sub="Check back when backend data is available." />
        : items.map(d => {
          const options = (() => { try { return JSON.parse(d.option_set) } catch { return [] } })()
          return (
            <Card
              key={d.id}
              className={`p-4 ${d.status === 'pending' ? 'border-amber-300 dark:border-amber-700' : ''}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-mono text-muted-foreground">{d.decision_id_label}</span>
                    <span className={pill(d.status)}>{d.status}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{d.decision_statement}</p>
                </div>
              </div>
              {options.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {options.map((opt: string, i: number) => (
                    <div
                      key={i}
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        d.chosen_option === opt
                          ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {d.chosen_option === opt && <span className="mr-1">✓</span>}
                      {opt}
                    </div>
                  ))}
                </div>
              )}
              {d.rationale && <p className="text-[11px] text-muted-foreground mt-2 italic">Rationale: {d.rationale}</p>}
              <div className="flex gap-4 text-[10px] text-muted-foreground/70 mt-2">
                <span>Owner: {d.decision_owner}</span>
                {d.due_date && !d.decision_date && <span className="text-amber-600 dark:text-amber-400 font-medium">Due: {d.due_date.slice(0, 10)}</span>}
                {d.decision_date && <span>Decided: {d.decision_date.slice(0, 10)}</span>}
              </div>
            </Card>
          )
        })
      }
    </div>
  )
}

// ─── Stop Rules tab ───────────────────────────────────────────────────────────

function StopRulesTab({ items }: { items: StopRule[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Stop rules prevent actions that could damage the project before conditions are met.
        Clearing a stop rule requires attached evidence and explicit sign-off from both PL and AED.
      </p>
      {items.length === 0
        ? <Empty label="No stop rules." />
        : items.map(r => (
          <div
            key={r.id}
            className={`rounded-xl border-2 p-4 ${
              r.active
                ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                : 'border-border bg-muted/20 opacity-70'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} weight="fill" className={r.active ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'} />
              <span className={`text-xs font-mono font-bold ${r.active ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{r.rule_id_label}</span>
              <span className={pill(r.active ? 'active' : 'cleared')}>{r.active ? 'ACTIVE' : 'CLEARED'}</span>
            </div>
            <p className="text-sm font-bold text-foreground mb-2">{r.rule_statement}</p>
            {r.prohibited_actions && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-2 text-[11px] text-red-700 dark:text-red-300 mb-2">
                🚫 {r.prohibited_actions}
              </div>
            )}
            {r.evidence_required && (
              <p className="text-[11px] text-muted-foreground"><span className="font-semibold">Evidence required: </span>{r.evidence_required}</p>
            )}
            {r.trigger_condition && (
              <p className="text-[11px] text-muted-foreground mt-1"><span className="font-semibold">Trigger: </span>{r.trigger_condition}</p>
            )}
            <p className="text-[11px] text-muted-foreground/70 mt-2">Owner: {r.owner}</p>
            {r.cleared_date && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">✓ Cleared {r.cleared_date.slice(0, 10)} by {r.cleared_by}</p>
            )}
          </div>
        ))
      }
    </div>
  )
}

// ─── Sources tab ──────────────────────────────────────────────────────────────

function SourcesTab({ items }: { items: Source[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        All raw project materials. Nothing enters control state without first being logged here and normalized into a controlled record.
      </p>
      {items.length === 0
        ? <Empty label="No sources logged yet." sub="Connect to backend to view the source log." />
        : items.map(s => (
          <Card key={s.id} className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{s.source_id_label}</span>
                  <span className={pill(s.normalization_status)}>{s.normalization_status}</span>
                  <span className={pill(s.confidence_level)}>{s.confidence_level}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.originating_party} · {s.date_received?.slice(0, 10)}</p>
                {s.citation_note && <p className="text-[11px] text-muted-foreground/60 mt-1 italic">{s.citation_note}</p>}
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  )
}

// ─── Cadence tab ──────────────────────────────────────────────────────────────

const meetingLabel: Record<string, string> = {
  weekly_stack:       'Weekly Stack Check',
  biweekly_aed:       'Bi-Weekly AED Review',
  monthly_alignment:  'Monthly Alignment',
  exception:          'Exception Review',
  gate_review:        'Gate Review: At Close?',
  handoff_review:     'Handoff Review',
}

function CadenceTab({ items }: { items: CadenceEvent[] }) {
  const upcoming  = items.filter(e => e.status === 'scheduled').sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  const completed = items.filter(e => e.status === 'completed')
  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Upcoming</SectionLabel>
        {upcoming.length === 0
          ? <Empty label="No meetings scheduled." />
          : (
            <div className="space-y-2">
              {upcoming.map(ev => (
                <Card key={ev.id} className="p-3 flex items-center gap-3">
                  <Calendar size={16} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{meetingLabel[ev.meeting_type] ?? ev.meeting_type}</p>
                    <p className="text-[11px] text-muted-foreground">{ev.scheduled_date?.slice(0, 10)} · {ev.required_attendees}</p>
                  </div>
                </Card>
              ))}
            </div>
          )
        }
      </div>
      {completed.length > 0 && (
        <div>
          <SectionLabel>Completed</SectionLabel>
          <div className="space-y-2 opacity-70">
            {completed.map(ev => (
              <Card key={ev.id} className="p-3 flex items-center gap-3">
                <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">{meetingLabel[ev.meeting_type] ?? ev.meeting_type}</p>
                  <p className="text-[10px] text-muted-foreground">{ev.completed_date?.slice(0, 10)}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Milestones tab ───────────────────────────────────────────────────────────

function MilestonesTab({ items }: { items: Milestone[] }) {
  const statusIcon: Record<string, string> = {
    pending: '○', in_progress: '◑', complete: '●', blocked: '✕', at_risk: '⚠',
  }
  const statusColor: Record<string, string> = {
    pending:     'text-muted-foreground',
    in_progress: 'text-blue-600 dark:text-blue-400',
    complete:    'text-emerald-600 dark:text-emerald-400',
    blocked:     'text-red-600 dark:text-red-400',
    at_risk:     'text-orange-600 dark:text-orange-400',
  }
  return (
    <div className="space-y-2">
      {items.length === 0
        ? <Empty label="No milestones yet." />
        : items.sort((a, b) => (a.target_date || '').localeCompare(b.target_date || '')).map(m => (
          <Card key={m.id} className="p-3 flex items-start gap-3">
            <span className={`text-lg shrink-0 mt-0.5 ${statusColor[m.status] ?? 'text-muted-foreground'}`}>
              {statusIcon[m.status] ?? '○'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{m.title}</p>
                <span className={pill(m.status)}>{m.status.replace(/_/g, ' ')}</span>
              </div>
              {m.description && <p className="text-[11px] text-muted-foreground mt-0.5">{m.description}</p>}
              <div className="flex gap-3 text-[10px] text-muted-foreground/70 mt-1">
                <span>{m.owner}</span>
                {m.target_date && <span>Target: {m.target_date.slice(0, 10)}</span>}
                {m.completed_date && <span className="text-emerald-600 dark:text-emerald-400">Done: {m.completed_date.slice(0, 10)}</span>}
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  )
}

// ─── Files / Vault tab ────────────────────────────────────────────────────────

const VAULT_FILES = [
  {
    id: 'V01',
    name: 'SSCB1 Cover Letter',
    type: 'DOCX',
    icon: FileDoc,
    desc: 'Project framing, capital stack overview, operating cadence. The primary stakeholder brief.',
    party: 'PublicLogic LLC',
    date: 'April 2026',
    seal: 'SEALED',
    size: '~18 KB',
  },
  {
    id: 'V02',
    name: 'Control Loop Reference',
    type: 'DOCX',
    icon: FileDoc,
    desc: 'Governing process logic — the eight-stage operating loop: Receive → Normalize → Review → Close.',
    party: 'PublicLogic LLC',
    date: 'April 2026',
    seal: 'SEALED',
    size: '~22 KB',
  },
  {
    id: 'V03',
    name: 'Governance & Technical Specification',
    type: 'DOCX',
    icon: FileDoc,
    desc: 'Full system architecture, role model, data schema, automation rules, and audit posture.',
    party: 'PublicLogic LLC',
    date: 'April 2026',
    seal: 'SEALED',
    size: '~45 KB',
  },
  {
    id: 'V04',
    name: 'Project Control Workbook',
    type: 'XLSX',
    icon: FileXls,
    desc: 'Live assumptions register, capital stack model, risk register, ITC tracker, revenue projections.',
    party: 'AED + PL',
    date: 'April 2026',
    seal: 'SEALED',
    size: '~85 KB',
  },
  {
    id: 'V05',
    name: 'Workspace Interface Reference',
    type: 'HTML',
    icon: Globe,
    desc: 'Approved stakeholder view design and layout specification for this casespace.',
    party: 'PublicLogic LLC',
    date: 'April 2026',
    seal: 'REFERENCE',
    size: '~29 KB',
  },
]

function FilesTab() {
  const typeColors: Record<string, string> = {
    DOCX: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30',
    XLSX: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30',
    HTML: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30',
    PDF:  'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30',
  }
  return (
    <div className="space-y-4">
      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Vault size={15} className="text-primary" />
          <span className="text-sm font-bold text-foreground">Project Vault</span>
          <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{VAULT_FILES.length} sealed documents</span>
        </div>
        <p className="text-xs text-muted-foreground">
          All governing documents for SSCB1. Every record carries an integrity seal. Superseded versions are retained, not destroyed.
          Contact PublicLogic to request access to restricted files.
        </p>
      </div>

      <div className="space-y-2">
        {VAULT_FILES.map(f => {
          const IconComp = f.icon
          const tc = typeColors[f.type] ?? 'text-muted-foreground bg-muted'
          return (
            <Card key={f.id} className="p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tc}`}>
                  <IconComp size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-foreground">{f.name}</span>
                    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${tc}`}>{f.type}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-foreground text-background">
                      <Lock size={8} weight="fill" /> {f.seal}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{f.desc}</p>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70 font-mono">
                    <span>{f.id}</span>
                    <span>{f.party}</span>
                    <span>{f.date}</span>
                    <span>{f.size}</span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2 items-end">
                  <button
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                    onClick={() => {
                      const msg = `Request access to ${f.name} via your PL administrator or contact nate@publiclogic.org`
                      alert(msg)
                    }}
                  >
                    <DownloadSimple size={12} /> Request
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Governance note:</span> These documents are governed under the SSCB1 casespace seal policy.
          All materials are confidential to PublicLogic LLC and Associated Energy Developers, LLC.
          Unauthorized distribution is prohibited.
        </p>
      </div>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export function SSCB1CaseSpace({ onNavigate, standalone = false }: Props) {
  const { openCloudSave } = useCloudSave()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [dash, setDash] = useState<SSCB1Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sources, setSources]       = useState<Source[] | null>(null)
  const [assumptions, setAssumptions] = useState<Assumption[] | null>(null)
  const [risks, setRisks]           = useState<Risk[] | null>(null)
  const [itcItems, setItcItems]     = useState<ITCItem[] | null>(null)
  const [openItems, setOpenItems]   = useState<OpenItem[] | null>(null)
  const [decisions, setDecisions]   = useState<Decision[] | null>(null)
  const [stopRules, setStopRules]   = useState<StopRule[] | null>(null)
  const [cadence, setCadence]       = useState<CadenceEvent[] | null>(null)
  const [milestones, setMilestones] = useState<Milestone[] | null>(null)

  const loadDash = useCallback(() => {
    setLoading(true)
    sscb1Api.dashboard()
      .then(d => { setDash(d); setStopRules(d.stop_rules_active) })
      .catch(e => setError(e.message ?? 'Could not load case data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDash() }, [loadDash])

  useEffect(() => {
    if (activeTab === 'sources'     && !sources)     sscb1Api.sources.list().then(r => setSources(r.sources)).catch(() => setSources([]))
    if (activeTab === 'assumptions' && !assumptions) sscb1Api.assumptions.list().then(r => setAssumptions(r.assumptions)).catch(() => setAssumptions([]))
    if (activeTab === 'risks'       && !risks)       sscb1Api.risks.list().then(r => setRisks(r.risks)).catch(() => setRisks([]))
    if (activeTab === 'itc'         && !itcItems)    sscb1Api.itc.list().then(r => setItcItems(r.items)).catch(() => setItcItems([]))
    if (activeTab === 'items'       && !openItems)   sscb1Api.openItems.list().then(r => setOpenItems(r.items)).catch(() => setOpenItems([]))
    if (activeTab === 'decisions'   && !decisions)   sscb1Api.decisions.list().then(r => setDecisions(r.decisions)).catch(() => setDecisions([]))
    if (activeTab === 'stop-rules'  && !stopRules)   sscb1Api.stopRules.list().then(r => setStopRules(r.rules)).catch(() => setStopRules([]))
    if (activeTab === 'cadence'     && !cadence)     sscb1Api.cadence.list().then(r => setCadence(r.events)).catch(() => setCadence([]))
    if (activeTab === 'milestones'  && !milestones)  sscb1Api.milestones.list().then(r => setMilestones(r.milestones)).catch(() => setMilestones([]))
  }, [activeTab, sources, assumptions, risks, itcItems, openItems, decisions, stopRules, cadence, milestones])

  const handleExport = useCallback(async () => {
    const exportData = await sscb1Api.exportDashboard().catch(() => null)
    const content = exportData
      ? JSON.stringify(exportData, null, 2)
      : `SSCB1 Case Export\n${new Date().toISOString()}\n\nCapital Stack: $4.5M\nYr 2+ Revenue: $3.3M\nEBITDA: $2.2M`
    openCloudSave({
      provider: 'microsoft',
      filename: `SSCB1_Export_${new Date().toISOString().slice(0, 10)}.json`,
      content,
    })
  }, [openCloudSave])

  const activeStopRuleCount = (dash?.stop_rules_active ?? []).filter(r => r.active).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background text-foreground">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-card border-b border-border">
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {!standalone && (
              <>
                <button
                  onClick={() => onNavigate('workbench')}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 transition-colors"
                >
                  <ArrowLeft size={11} /> AED
                </button>
                <span className="text-muted-foreground/40 shrink-0">/</span>
              </>
            )}
            <span className="text-sm font-bold text-foreground truncate">SSCB1 — Swansea, SC Biochar 1</span>
            {activeStopRuleCount > 0 && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300">
                <Shield size={10} weight="fill" /> {activeStopRuleCount} stop rule{activeStopRuleCount > 1 ? 's' : ''}
              </span>
            )}
            {loading && (
              <SpinnerGap size={13} className="text-muted-foreground/50 animate-spin shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {error && (
              <button onClick={loadDash} className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
                <ArrowClockwise size={11} /> Retry
              </button>
            )}
            {!error && (
              <button onClick={loadDash} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="Refresh">
                <ArrowClockwise size={14} />
              </button>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <DownloadSimple size={13} weight="bold" />
              CloudSync
            </button>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-0 overflow-x-auto scrollbar-hide px-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="shrink-0 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 px-5 py-2.5 flex items-center gap-2">
          <Warning size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">Backend not connected — showing spec data. <span className="font-medium">{error}</span></p>
          <button onClick={loadDash} className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'overview' && (
          <OverviewTab dash={dash} onTabChange={setActiveTab} />
        )}
        {activeTab === 'stack' && (
          dash
            ? <StackTab items={dash.stack_preview} />
            : <Empty label="Loading stack data…" sub={error ? 'Backend connection required.' : undefined} />
        )}
        {activeTab === 'assumptions' && (
          assumptions !== null ? <AssumptionsTab items={assumptions} /> : <Empty label="Loading assumptions…" />
        )}
        {activeTab === 'risks' && (
          risks !== null
            ? <RisksTab items={risks} />
            : dash
              ? <RisksTab items={dash.top_risks} />
              : <Empty label="Loading risks…" />
        )}
        {activeTab === 'itc' && (
          itcItems !== null ? <ITCTab items={itcItems} /> : <Empty label="Loading ITC records…" />
        )}
        {activeTab === 'items' && (
          openItems !== null ? <OpenItemsTab items={openItems} /> : <Empty label="Loading open items…" />
        )}
        {activeTab === 'decisions' && (
          decisions !== null ? <DecisionsTab items={decisions} /> : <Empty label="Loading decisions…" />
        )}
        {activeTab === 'stop-rules' && (
          stopRules !== null ? <StopRulesTab items={stopRules} /> : <Empty label="Loading stop rules…" />
        )}
        {activeTab === 'sources' && (
          sources !== null ? <SourcesTab items={sources} /> : <Empty label="Loading sources…" />
        )}
        {activeTab === 'cadence' && (
          cadence !== null ? <CadenceTab items={cadence} /> : <Empty label="Loading cadence…" />
        )}
        {activeTab === 'milestones' && (
          milestones !== null ? <MilestonesTab items={milestones} /> : <Empty label="Loading milestones…" />
        )}
        {activeTab === 'files' && <FilesTab />}
      </div>
    </div>
  )
}
