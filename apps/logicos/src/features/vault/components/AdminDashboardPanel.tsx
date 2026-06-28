import { Plus } from '@phosphor-icons/react'
import type { VaultCase } from '../types'
import { calendarDaysUntil } from '../utils/deadlines'

interface AdminDashboardPanelProps {
  town: string
  modules: string[]
  openCases: VaultCase[]
  dueThisWeek: VaultCase[]
  pendingApproval: VaultCase[]
  overdueCases: VaultCase[]
  closedThisMonth: VaultCase[]
  urgentCases: VaultCase[]
  totalCasesCount: number
  exportBusyId: string | null
  onNewCase: () => void
  onViewApprovals: () => void
  onCopyUpdate: () => void
  onDownloadForms: () => void
  onExportOps: () => void
  onExportArchive: () => void
  onCaseClick: (caseId: string, moduleId: string) => void
}

export function AdminDashboardPanel({
  town,
  modules,
  openCases,
  dueThisWeek,
  pendingApproval,
  overdueCases,
  closedThisMonth,
  urgentCases,
  totalCasesCount,
  exportBusyId,
  onNewCase,
  onViewApprovals,
  onCopyUpdate,
  onDownloadForms,
  onExportOps,
  onExportArchive,
  onCaseClick,
}: AdminDashboardPanelProps) {
  return (
    <div className="rounded-[28px] border border-slate-800/80 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#172554_100%)] p-6 sm:p-7 shadow-[0_28px_70px_rgba(15,23,42,0.3)]">
      {/* Header row */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-indigo-300">Municipal Operations Center</div>
          <h2 className="text-2xl font-bold text-white leading-tight">{town}</h2>
          <div className="mt-1 text-sm text-slate-300">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {modules.length > 0 && (
            <button
              onClick={onNewCase}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(79,70,229,0.35)] transition-colors hover:bg-indigo-400"
            >
              <Plus size={13} />
              New Case
            </button>
          )}
          <button
            onClick={onViewApprovals}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-indigo-300/50 hover:bg-white/10 hover:text-white"
          >
            Approvals
            {pendingApproval.length > 0 && (
              <span className="bg-indigo-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold leading-none">{pendingApproval.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Open Cases', value: openCases.length, color: 'text-white', labelColor: 'text-slate-300', bg: 'bg-white/8 border-white/10' },
          { label: 'Due This Week', value: dueThisWeek.length, color: dueThisWeek.length > 0 ? 'text-amber-300' : 'text-slate-200', labelColor: 'text-slate-300', bg: dueThisWeek.length > 0 ? 'bg-amber-400/10 border-amber-300/25' : 'bg-white/8 border-white/10' },
          { label: 'Pending Approval', value: pendingApproval.length, color: pendingApproval.length > 0 ? 'text-violet-300' : 'text-slate-200', labelColor: 'text-slate-300', bg: pendingApproval.length > 0 ? 'bg-violet-400/10 border-violet-300/25' : 'bg-white/8 border-white/10' },
          { label: 'Overdue', value: overdueCases.length, color: overdueCases.length > 0 ? 'text-rose-300' : 'text-emerald-300', labelColor: 'text-slate-300', bg: overdueCases.length > 0 ? 'bg-rose-400/10 border-rose-300/25' : 'bg-emerald-400/10 border-emerald-300/25' },
          { label: 'Closed (30d)', value: closedThisMonth.length, color: 'text-emerald-300', labelColor: 'text-slate-300', bg: 'bg-emerald-400/10 border-emerald-300/25' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border px-4 py-3.5 backdrop-blur-sm ${s.bg}`}>
            <div className={`text-3xl font-bold tabular-nums leading-none ${s.color}`}>{s.value}</div>
            <div className={`mt-2 text-[11px] font-medium uppercase tracking-[0.14em] leading-tight ${s.labelColor}`}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Requires attention */}
      {urgentCases.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
            Requires Attention — {urgentCases.length} case{urgentCases.length !== 1 ? 's' : ''}
          </div>
          <div className="space-y-2">
            {urgentCases.slice(0, 4).map(c => {
              const nextDl = Object.values(c.deadlines)
                .filter(d => d.status === 'OPEN' && d.dueDate)
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
              const days = nextDl ? calendarDaysUntil(nextDl.dueDate) : null
              const subjectLine = Object.values(c.subject).filter(Boolean).slice(0, 2).join(' · ') || c.caseType
              return (
                <button
                  key={c.id}
                  onClick={() => onCaseClick(c.id, c.moduleId)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-left transition-colors hover:border-amber-300/40 hover:bg-slate-950/78"
                >
                  <span className="w-28 shrink-0 truncate font-mono text-[10px] font-bold text-amber-300">{c.caseNumber}</span>
                  <span className="flex-1 truncate text-sm text-slate-100 transition-colors group-hover:text-white">{subjectLine}</span>
                  <span className="text-[10px] font-black shrink-0 tabular-nums ml-auto pl-2">
                    {days === null ? null : days <= 0
                      ? <span className="text-rose-300">OVERDUE</span>
                      : <span className="text-amber-300">{days}d left</span>
                    }
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {totalCasesCount === 0 && (
          <div className="mt-2 border-t border-white/8 py-4 text-center">
            <div className="text-sm text-slate-300">No cases yet — open a module below to create your first intake.</div>
          </div>
        )}

      {/* Production quick actions */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/8 pt-4">
        <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions:</span>
        {[
          { label: '📋 Status report', onClick: onCopyUpdate, busy: 'copy-update' },
          { label: '⬇ Intake forms', onClick: onDownloadForms, busy: 'download-forms' },
          { label: '📦 Export ops pack', onClick: onExportOps, busy: 'provision-pack' },
          { label: '🗄 Archive export', onClick: onExportArchive, busy: 'archive-packet' },
        ].map(a => (
          <button
            key={a.busy}
            onClick={a.onClick}
            disabled={exportBusyId !== null}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-slate-200 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exportBusyId === a.busy ? '…' : a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
