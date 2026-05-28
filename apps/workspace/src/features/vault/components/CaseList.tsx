import { useState, useMemo, memo } from 'react'
import { ArrowLeft, FolderOpen, Plus } from '@phosphor-icons/react'
import type { VaultCase } from '../types'
import { getVaultModule } from '@/lib/vault-modules'
import { fmtTs, deadlineBadge } from '../utils/vaultHelpers'

export const CaseList = memo(function CaseList({ moduleId, cases, onNewCase, onOpenCase, onBack }: {
  moduleId: string
  cases: VaultCase[]
  onNewCase: () => void
  onOpenCase: (id: string) => void
  onBack: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open')
  const meta = getVaultModule(moduleId)
  const filtered = useMemo(() => cases.filter(c =>
    filter === 'all' ? true : filter === 'open' ? c.currentStage !== 'CLOSED' : c.currentStage === 'CLOSED'
  ), [cases, filter])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <button aria-label="Go back" onClick={onBack} className="text-muted-foreground hover:text-foreground/80 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="text-xs text-indigo-500 font-bold uppercase tracking-wider">{moduleId.replace('VAULT', '')}</div>
            <div className="font-semibold text-foreground">{meta?.name ?? moduleId}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted rounded-lg p-0.5 border border-border">
            {(['open', 'closed', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-card text-indigo-600 shadow-sm' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={onNewCase}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} /> New Case
          </button>
        </div>
      </div>
      {/* Case list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
            <FolderOpen size={48} weight="thin" className="text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-foreground mb-1">
                {filter === 'closed' ? 'No closed cases' : 'No open cases'}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                A <strong>case</strong> is one item of work — a records request, a permit application, a contract review, or any trackable task with a deadline and a paper trail.
              </p>
            </div>
            <button
              onClick={onNewCase}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} weight="bold" /> Open the first case
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left bg-card sticky top-0 z-10">
                <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case #</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stage</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Records Officer</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deadline</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opened</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-slate-100">
              {filtered.map(c => {
                const nextDeadline = Object.values(c.deadlines)
                  .filter(d => d.status === 'OPEN' && d.dueDate)
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
                const badge = nextDeadline ? deadlineBadge(nextDeadline.dueDate, nextDeadline.status) : null
                const isClosed = c.currentStage === 'CLOSED'
                const subjectSummary = Object.values(c.subject).filter(Boolean).slice(0, 2).join(' · ') || c.caseNumber

                return (
                  <tr
                    key={c.id}
                    onClick={() => onOpenCase(c.id)}
                    className="hover:bg-indigo-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 font-mono text-sm text-indigo-600 font-semibold">{c.caseNumber}</td>
                    <td className="px-4 py-3 text-sm text-foreground/80 max-w-xs truncate">{subjectSummary}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isClosed ? 'bg-muted text-muted-foreground' : 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200'}`}>
                        {c.currentStage}
                      </span>
                      {c.closureReason && (
                        <span className="ml-2 text-xs text-muted-foreground">{c.closureReason}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.assignedRAO || <span className="text-muted-foreground italic">Unassigned</span>}</td>
                    <td className="px-4 py-3">
                      {badge && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ color: badge.color, borderColor: badge.color + '40', background: badge.bg + '22' }}>
                          {badge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtTs(c.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
)  // end memo
