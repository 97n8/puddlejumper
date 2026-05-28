import { useState, memo } from 'react'
import type { VaultCase } from '../types'

export const ApprovalsQueue = memo(function ApprovalsQueue({ allCases, town, onOpenCase }: {
  allCases: VaultCase[]
  town: string
  onOpenCase: (caseId: string) => void
}) {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const openCases = allCases.filter(c => c.currentStage !== 'CLOSED')
  const casesWithApprovals = allCases.filter(c => (c.approvals ?? []).length > 0)
  const pendingCases = openCases.filter(c =>
    c.currentStage === 'REVIEW' || c.currentStage === 'RESPONSE' ||
    (c.approvals ?? []).some(a => a.isLocked !== true)
  )

  const displayCases = filter === 'pending' ? pendingCases : casesWithApprovals

  const DECISION_COLORS: Record<string, string> = {
    FULL_DISCLOSURE: 'text-emerald-400',
    PARTIAL_DISCLOSURE: 'text-yellow-400',
    FULL_DENIAL: 'text-red-400',
    EXTENSION_GRANTED: 'text-blue-400',
    FEE_ASSESSED: 'text-orange-400',
    AWAITING_CLARIFICATION: 'text-muted-foreground',
  }
  const DECISION_LABELS: Record<string, string> = {
    FULL_DISCLOSURE: 'Full Disclosure',
    PARTIAL_DISCLOSURE: 'Partial Disclosure',
    FULL_DENIAL: 'Full Denial',
    EXTENSION_GRANTED: 'Extension Granted',
    FEE_ASSESSED: 'Fee Assessed',
    AWAITING_CLARIFICATION: 'Awaiting Clarification',
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Approvals Queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Town of {town} — all modules</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter('pending')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === 'pending' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-border text-muted-foreground hover:text-foreground/80'}`}>
            Needs Decision ({pendingCases.length})
          </button>
          <button onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === 'all' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-border text-muted-foreground hover:text-foreground/80'}`}>
            All Approvals ({casesWithApprovals.length})
          </button>
        </div>
      </div>

      {displayCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">✅</div>
          <div className="text-muted-foreground font-medium">
            {filter === 'pending' ? 'No cases awaiting approval decisions' : 'No approval records yet'}
          </div>
          <div className="text-muted-foreground text-sm mt-1">
            {filter === 'pending' ? 'Cases in REVIEW stage will appear here' : 'Issue decisions from inside a case'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayCases.map(c => {
            const approvals = c.approvals ?? []
            const lastApproval = approvals.slice(-1)[0]
            const needsDecision = c.currentStage === 'REVIEW' || c.currentStage === 'RESPONSE'
            const daysSinceCreated = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000)
            return (
              <div key={c.id}
                onClick={() => onOpenCase(c.id)}
                className="bg-card border border-border hover:border-indigo-400 hover:shadow-md rounded-xl p-4 cursor-pointer transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-indigo-400">{c.caseNumber}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${needsDecision ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800/50' : 'bg-slate-800 text-muted-foreground border border-border'}`}>
                        {needsDecision ? '⏳ Needs Decision' : c.currentStage}
                      </span>
                      {c.enforcementFlags?.feesAllowed === false && (
                        <span className="text-xs text-red-400 border border-red-800/40 rounded px-1.5 py-0.5 bg-red-950/30">Fees Waived</span>
                      )}
                    </div>
                    <div className="text-sm text-foreground truncate">
                      {c.subject['requesterName'] || c.subject['applicantName'] || 'Anonymous'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {(c as unknown as Record<string,unknown>).scope as string || c.subject['requestText']?.slice(0, 80) || 'No description'}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">{daysSinceCreated}d old</div>
                    {approvals.length > 0 && (
                      <div className={`text-xs mt-1 font-medium ${DECISION_COLORS[lastApproval?.decision] ?? 'text-muted-foreground'}`}>
                        {DECISION_LABELS[lastApproval?.decision] ?? lastApproval?.decision}
                      </div>
                    )}
                    <div className="text-xs text-indigo-500 group-hover:text-indigo-400 mt-1">Open →</div>
                  </div>
                </div>

                {/* Approval history pills */}
                {approvals.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {approvals.map((a, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${
                        a.decision === 'FULL_DISCLOSURE' ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' :
                        a.decision === 'PARTIAL_DISCLOSURE' ? 'bg-yellow-950/40 border-yellow-800/50 text-yellow-400' :
                        a.decision === 'FULL_DENIAL' ? 'bg-red-950/40 border-red-800/50 text-red-400' :
                        a.decision === 'EXTENSION_GRANTED' ? 'bg-blue-950/40 border-blue-800/50 text-blue-400' :
                        'bg-slate-800 border-border text-muted-foreground'
                      }`}>
                        {DECISION_LABELS[a.decision] ?? a.decision}
                        {a.exemptionsCited?.length ? ` (${a.exemptionsCited.join(',')})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
)  // end memo
