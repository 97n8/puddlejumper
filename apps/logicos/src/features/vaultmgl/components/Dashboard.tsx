import { CheckCircle, Warning, XCircle, Lightning, Clock, CalendarBlank } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { Municipality } from '@/data/maMunicipalities'
import type { GeneratedTownData } from '../data/generator'

interface DashboardProps {
  town: Municipality
  townData: GeneratedTownData
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  return `$${(n / 1000).toFixed(0)}k`
}

function planTier(pop: number): string {
  if (pop < 3000) return 'Starter'
  if (pop < 10000) return 'Full'
  return 'Enterprise'
}

function complianceColor(score: number): string {
  if (score >= 90) return '#2C5F2D'
  if (score >= 70) return '#B8911E'
  return '#B84020'
}

function severityDot(severity: string): string {
  if (severity === 'critical') return '#B84020'
  if (severity === 'urgent') return '#B8911E'
  if (severity === 'warn') return '#B8911E'
  return '#97BC62'
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const ACTIVITY_ICON: Record<string, Icon> = {
  case_opened: Lightning,
  stage_advanced: CheckCircle,
  case_closed: CheckCircle,
  seal_generated: CheckCircle,
  case_blocked: Warning,
  note_added: CalendarBlank,
  hard_stop: XCircle,
  member_added: CheckCircle,
}

export function Dashboard({ town, townData }: DashboardProps) {
  const { fiscal, stats, riskFlags, activity, watchFlags } = townData
  const pop = town.population ?? 0
  const plan = planTier(pop)
  const compColor = complianceColor(stats.complianceScore)
  const activeWatch = watchFlags.filter(f => !f.resolvedAt).length

  const circumference = 2 * Math.PI * 40
  const strokeDash = (stats.complianceScore / 100) * circumference

  return (
    <div className="p-6 space-y-6">
      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Town hero card */}
          <div className="rounded-xl border p-5" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: '#1A1D16' }}>{town.name}</h2>
                <p className="text-sm" style={{ color: '#7A7870' }}>{town.county} County · Pop. {pop.toLocaleString()}</p>
              </div>
              <span
                className="px-2 py-1 rounded-md text-xs font-bold"
                style={{ backgroundColor: plan === 'Enterprise' ? '#2C5F2D' : plan === 'Full' ? '#97BC62' : '#B8911E', color: '#fff' }}
              >
                {plan}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#2C5F2D' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#2C5F2D' }} />
              VAULT MGL-001 ACTIVE
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Cases Open', value: stats.casesOpen, color: '#2C5F2D' },
              { label: 'Sealed', value: stats.sealedThisMonth, color: '#97BC62' },
              { label: 'Overdue', value: stats.overdueCount, color: stats.overdueCount > 0 ? '#B84020' : '#7A7870' },
              { label: 'Watch Alerts', value: activeWatch, color: activeWatch > 0 ? '#B8911E' : '#7A7870' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border p-3 text-center" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-1" style={{ color: '#7A7870' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Compliance gauge */}
          <div className="rounded-xl border p-5 flex items-center gap-6" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
            <div className="relative w-24 h-24 shrink-0">
              <svg width="96" height="96" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="40" fill="none" stroke="#E8E4DA" strokeWidth="10" />
                <circle
                  cx="48" cy="48" r="40" fill="none"
                  stroke={compColor}
                  strokeWidth="10"
                  strokeDasharray={`${strokeDash} ${circumference}`}
                  strokeLinecap="round"
                  transform="rotate(-90 48 48)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: compColor }}>{stats.complianceScore}</span>
                <span className="text-[9px]" style={{ color: '#7A7870' }}>/ 100</span>
              </div>
            </div>
            <div>
              <div className="font-semibold text-sm mb-1" style={{ color: '#1A1D16' }}>Compliance Score</div>
              <div className="text-xs mb-2" style={{ color: '#7A7870' }}>MGL process adherence across all active workflows</div>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: stats.complianceScore >= 90 ? '#E8F2EB' : stats.complianceScore >= 70 ? '#FBF5E6' : '#FDEFEA',
                  color: compColor,
                }}
              >
                {stats.complianceScore >= 90 ? 'Excellent' : stats.complianceScore >= 70 ? 'Needs Attention' : 'At Risk'}
              </span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Fiscal strip */}
          <div className="rounded-xl border p-5" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A1D16' }}>FY{fiscal.fiscalYear} Fiscal Snapshot</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Operating Budget', value: fmtMoney(fiscal.operatingBudget) },
                { label: 'Employees', value: fiscal.totalEmployees.toString() },
                { label: 'Free Cash', value: fmtMoney(fiscal.freeCash) },
                { label: 'State Aid', value: fmtMoney(fiscal.stateAid) },
                { label: 'Debt Service', value: fmtMoney(fiscal.debtService) },
                { label: 'Salaries', value: fmtMoney(fiscal.salariesWages) },
                ...(fiscal.localReceipts ? [{ label: 'Local Receipts', value: fmtMoney(fiscal.localReceipts) }] : []),
                ...(fiscal.resTaxRate != null ? [{ label: 'Res. Tax Rate', value: `$${fiscal.resTaxRate.toFixed(2)}/k` }] : []),
                ...(fiscal.incomePc != null ? [{ label: 'Income / Capita', value: fmtMoney(fiscal.incomePc) }] : []),
              ].map(item => (
                <div key={item.label} className="rounded-lg p-3" style={{ backgroundColor: '#F5F1E8' }}>
                  <div className="text-lg font-bold" style={{ color: '#1A1D16' }}>{item.value}</div>
                  <div className="text-xs" style={{ color: '#7A7870' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Governance (MMA registry) */}
          {(fiscal.formOfGovt || fiscal.chiefOfficialTitle) && (
            <div className="rounded-xl border p-5" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A1D16' }}>Governance — MMA Registry</h3>
              <div className="grid grid-cols-2 gap-3">
                {fiscal.formOfGovt && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: '#F5F1E8' }}>
                    <div className="text-sm font-bold" style={{ color: '#1A1D16' }}>{fiscal.formOfGovt}</div>
                    <div className="text-xs" style={{ color: '#7A7870' }}>Form of Government</div>
                  </div>
                )}
                {fiscal.chiefOfficialTitle && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: '#F5F1E8' }}>
                    <div className="text-sm font-bold" style={{ color: '#1A1D16' }}>{fiscal.chiefOfficialTitle}</div>
                    <div className="text-xs" style={{ color: '#7A7870' }}>Chief Official Title</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Risk flags */}
          <div className="rounded-xl border p-5" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A1D16' }}>Risk Indicators</h3>
            <div className="space-y-3">
              {riskFlags.map(flag => (
                <div key={flag.id} className="flex items-start gap-3">
                  <span
                    className="mt-1 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: severityDot(flag.severity) }}
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#1A1D16' }}>{flag.label}</div>
                    <div className="text-xs" style={{ color: '#7A7870' }}>{flag.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border p-5" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#1A1D16' }}>Recent Activity</h3>
        <div className="space-y-3">
          {activity.slice(0, 6).map(item => {
            const Icon = ACTIVITY_ICON[item.type] ?? Clock
            return (
              <div key={item.id} className="flex items-start gap-3">
                <span className="mt-0.5"><Icon size={16} color="#7A7870" /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: '#1A1D16' }}>
                    <span className="font-medium">{item.title}</span>
                    {' — '}
                    <span className="truncate">{item.description}</span>
                  </div>
                  {item.actorName && (
                    <div className="text-xs" style={{ color: '#7A7870' }}>by {item.actorName}</div>
                  )}
                </div>
                <span className="text-xs shrink-0" style={{ color: '#7A7870' }}>{timeAgo(item.timestamp)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
