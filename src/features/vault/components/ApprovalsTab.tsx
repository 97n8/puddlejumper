import { useState, memo } from 'react'
import { Lock, Shield, X } from '@phosphor-icons/react'
import type { VaultCase, VaultModuleSettings, ApprovalRecord } from '../types'
import { MGL_EXEMPTIONS_LIST, uuid, appendAudit, fmtTs } from '../utils/vaultHelpers'
import { fireVaultEmailTrigger, type VaultEmailVars } from '../utils/sendVaultEmail'

export const ApprovalsTab = memo(function ApprovalsTab({ vaultCase, actor, isClosed, onUpdate, settings }: {
  vaultCase: VaultCase
  actor: string
  isClosed: boolean
  onUpdate: (c: VaultCase) => void
  settings: VaultModuleSettings
}) {
  const [showForm, setShowForm] = useState(false)
  const [decision, setDecision] = useState<ApprovalRecord['decision']>('FULL_DISCLOSURE')
  const [exemptions, setExemptions] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [extensionDays, setExtensionDays] = useState('')

  const DECISION_LABELS: Record<ApprovalRecord['decision'], string> = {
    FULL_DISCLOSURE: '✅ Full Disclosure',
    PARTIAL_DISCLOSURE: '🟡 Partial Disclosure (with exemptions)',
    FULL_DENIAL: '🔴 Full Denial',
    EXTENSION_GRANTED: '⏳ Extension Granted',
    FEE_ASSESSED: '💵 Fee Assessed',
    AWAITING_CLARIFICATION: '❓ Awaiting Clarification from Requester',
  }

  const toggleExemption = (code: string) =>
    setExemptions(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])

  const issueDecision = () => {
    if (!notes.trim() && decision !== 'FULL_DISCLOSURE') return
    const now = Date.now()
    const record: ApprovalRecord = {
      id: uuid(),
      timestamp: now,
      actor,
      decision,
      exemptionsCited: exemptions,
      feeAmount: feeAmount ? parseFloat(feeAmount) : undefined,
      extensionDays: extensionDays ? parseInt(extensionDays) : undefined,
      notes,
      isLocked: true,
      lockedAt: now,
    }
    const updated = appendAudit(
      { ...vaultCase, approvals: [...(vaultCase.approvals ?? []), record] },
      actor,
      'APPROVAL',
      `Decision issued: ${DECISION_LABELS[decision]}. ${exemptions.length > 0 ? `Exemptions: M.G.L. c.4 §7(26)(${exemptions.join(',')})` : ''}${notes ? ` Notes: ${notes}` : ''}`,
      { ruleApplied: decision === 'FULL_DENIAL' || decision === 'PARTIAL_DISCLOSURE' ? 'M.G.L. c. 4, §7(26) — exemptions cited' : undefined }
    )
    onUpdate(updated)
    // Fire approval email
    const _approvalVars: VaultEmailVars = {
      requesterName: vaultCase.subject.requesterName ?? vaultCase.subject.name ?? 'Requester',
      caseNumber: vaultCase.caseNumber,
      town: settings.municipalityName ?? vaultCase.moduleId,
      raoName: settings.raos?.[0]?.name ?? 'Records Access Officer',
      stage: vaultCase.currentStage,
    }
    fireVaultEmailTrigger('APPROVAL_ISSUED', settings, _approvalVars, {
      requesterEmail: vaultCase.subject.requesterEmail ?? vaultCase.subject.email,
    }).catch(() => {})
    setShowForm(false)
    setDecision('FULL_DISCLOSURE')
    setExemptions([])
    setNotes('')
    setFeeAmount('')
    setExtensionDays('')
  }

  const approvals = vaultCase.approvals ?? []

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Approval Decisions ({approvals.length})</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Decisions are final once issued and cannot be edited. To make a correction, issue a new decision.</p>
        </div>
        {!isClosed && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-sm bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors font-medium">
            <Shield size={14} /> Issue Decision
          </button>
        )}
      </div>

      {/* Issue decision form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white text-sm">Issue Approval Decision</h4>
            <button aria-label="Close form" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground/80 transition-colors"><X size={16} /></button>
          </div>

          {/* Decision type */}
          <div>
            <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Decision</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(DECISION_LABELS) as [ApprovalRecord['decision'], string][]).map(([val, label]) => (
                <button key={val} onClick={() => setDecision(val)}
                  className={`px-3 py-2 rounded-lg text-xs border text-left transition-all ${decision === val ? 'border-indigo-500 bg-indigo-900/40 text-foreground font-semibold' : 'border-border text-muted-foreground hover:border-slate-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Exemptions (for partial/full denial) */}
          {(decision === 'PARTIAL_DISCLOSURE' || decision === 'FULL_DENIAL') && (
            <div>
              <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">M.G.L. c. 4, §7(26) Exemptions</label>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {MGL_EXEMPTIONS_LIST.map(ex => (
                  <label key={ex.code} className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" checked={exemptions.includes(ex.code)} onChange={() => toggleExemption(ex.code)}
                      className="mt-0.5 rounded flex-shrink-0" />
                    <span className="text-xs text-muted-foreground group-hover:text-white transition-colors">
                      <span className="font-bold text-indigo-400">({ex.code})</span> {ex.label}
                    </span>
                  </label>
                ))}
              </div>
              {(decision === 'PARTIAL_DISCLOSURE' || decision === 'FULL_DENIAL') && exemptions.length === 0 && (
                <p className="text-xs text-amber-400 mt-2">⚠ At least one exemption must be cited for denial or partial disclosure.</p>
              )}
            </div>
          )}

          {/* Fee amount */}
          {decision === 'FEE_ASSESSED' && (
            <div>
              <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Fee Amount ($)</label>
              <input type="number" step="0.01" min="0" value={feeAmount} onChange={e => setFeeAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
              {vaultCase.enforcementFlags.feesAllowed === false && (
                <p className="text-xs text-red-400 mt-1">⚠ The 10-day response deadline was missed — fees may not be charged for this case per M.G.L. c. 66, §10.</p>
              )}
            </div>
          )}

          {/* Extension days */}
          {decision === 'EXTENSION_GRANTED' && (
            <div>
              <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Extension (business days)</label>
              <input type="number" min="1" max="30" value={extensionDays} onChange={e => setExtensionDays(e.target.value)}
                placeholder="Number of additional business days"
                className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Decision Notes {decision !== 'FULL_DISCLOSURE' ? <span className="text-red-400">*</span> : ''}
            </label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Document the basis for this decision, exemption analysis, or instructions to the requester…"
              className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={issueDecision}
              disabled={(decision === 'PARTIAL_DISCLOSURE' || decision === 'FULL_DENIAL') && exemptions.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-foreground py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2">
              <Lock size={13} /> Issue &amp; Lock Decision
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 text-muted-foreground hover:text-foreground/80 text-sm transition-colors">Cancel</button>
          </div>
          <p className="text-xs text-muted-foreground">Once issued, this decision is locked and cannot be modified. Issue a new decision to correct errors.</p>
        </div>
      )}

      {/* Approval records */}
      {approvals.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Shield size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No decisions issued yet.</p>
          {!isClosed && <p className="text-xs mt-1">Use "Issue Decision" to record an approval, denial, or extension.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {[...approvals].reverse().map(a => (
            <div key={a.id} className={`bg-slate-800 border rounded-xl p-4 ${
              a.decision === 'FULL_DENIAL' ? 'border-red-800/50' :
              a.decision === 'PARTIAL_DISCLOSURE' ? 'border-amber-800/50' :
              a.decision === 'FULL_DISCLOSURE' ? 'border-green-800/50' :
              'border-border'
            }`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className={`text-sm font-bold ${
                    a.decision === 'FULL_DENIAL' ? 'text-red-400' :
                    a.decision === 'PARTIAL_DISCLOSURE' ? 'text-amber-400' :
                    a.decision === 'FULL_DISCLOSURE' ? 'text-green-400' :
                    'text-indigo-400'
                  }`}>{DECISION_LABELS[a.decision]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{fmtTs(a.timestamp)} · {a.actor}</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-500/70">
                  <Lock size={10} /> LOCKED
                </div>
              </div>
              {a.exemptionsCited.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-semibold">Exemptions:</span> M.G.L. c. 4, §7(26)({a.exemptionsCited.map(c => `(${c})`).join(', ')})
                  <div className="mt-1 space-y-0.5">
                    {a.exemptionsCited.map(code => {
                      const ex = MGL_EXEMPTIONS_LIST.find(e => e.code === code)
                      return ex ? <div key={code} className="text-muted-foreground">({code}) {ex.label}</div> : null
                    })}
                  </div>
                </div>
              )}
              {a.feeAmount !== undefined && (
                <div className="mt-2 text-xs text-muted-foreground"><span className="font-semibold">Fee:</span> ${a.feeAmount.toFixed(2)}</div>
              )}
              {a.extensionDays !== undefined && (
                <div className="mt-2 text-xs text-muted-foreground"><span className="font-semibold">Extension:</span> {a.extensionDays} business days</div>
              )}
              {a.notes && <p className="mt-2 text-sm text-foreground/80">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
)  // end memo
