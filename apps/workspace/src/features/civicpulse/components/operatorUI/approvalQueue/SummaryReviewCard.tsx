import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Check, X, Gavel, Calendar, Buildings, CurrencyDollar } from '@phosphor-icons/react'
import { approvalActions } from '../../../api/approvalActions'
import { LegalHoldBanner } from './LegalHoldBanner'
import type { CivicSummary } from '../../../types/civicpulse.types'
import { toast } from 'sonner'

const ACTION_TYPE_LABELS: Record<string, string> = {
  board_vote: 'Board Vote',
  contract_award: 'Contract Award',
  budget_transfer: 'Budget Transfer',
  public_hearing: 'Public Hearing',
  capital_milestone: 'Capital Milestone',
  debt_issuance: 'Debt Issuance',
  emergency_declaration: 'Emergency Declaration',
  policy_adoption: 'Policy Adoption',
  procurement_action: 'Procurement Action',
  zba_filing: 'ZBA Filing',
}

interface SummaryReviewCardProps {
  summary: CivicSummary
  onUpdate: (updated: CivicSummary) => void
}

export function SummaryReviewCard({ summary, onUpdate }: SummaryReviewCardProps) {
  const [editedText, setEditedText] = useState(summary.summaryText)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try {
      const updated = await approvalActions.approve(summary.id, editedText !== summary.summaryText ? editedText : undefined)
      onUpdate(updated)
      toast.success('Summary approved and queued for publication.')
    } catch {
      toast.error('Failed to approve summary.')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Please enter a reason for rejection.'); return }
    setLoading(true)
    try {
      const updated = await approvalActions.reject(summary.id, rejectReason)
      onUpdate(updated)
      toast.success('Summary rejected.')
    } catch {
      toast.error('Failed to reject summary.')
    } finally {
      setLoading(false)
    }
  }

  const handleLegalHold = async () => {
    setLoading(true)
    try {
      const updated = await approvalActions.placeLegalHold(summary.id)
      onUpdate(updated)
      toast.success('Legal hold applied. Counsel review required before publication.')
    } catch {
      toast.error('Failed to apply legal hold.')
    } finally {
      setLoading(false)
    }
  }

  const determinationColor = {
    required: 'bg-red-500/20 text-red-400 border-0',
    recommended: 'bg-amber-500/20 text-amber-400 border-0',
    none: 'bg-muted text-muted-foreground border-0',
  }[summary.determination]

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {summary.legalHold && <LegalHoldBanner />}

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] px-1.5 py-0 h-4 ${determinationColor}`}>
              {summary.determination === 'required' ? 'Publication Required' : 'Publication Recommended'}
            </Badge>
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-0">
              {ACTION_TYPE_LABELS[summary.actionType] ?? summary.actionType}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Buildings size={12} />{summary.governingBody}</span>
            <span className="flex items-center gap-1"><Calendar size={12} />{summary.actionDate}</span>
            {summary.dollarAmount != null && (
              <span className="flex items-center gap-1">
                <CurrencyDollar size={12} />
                ${summary.dollarAmount.toLocaleString()}
                {summary.fundingSource && ` · ${summary.fundingSource}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <Textarea
        value={editedText}
        onChange={e => setEditedText(e.target.value)}
        rows={4}
        className="resize-none text-sm"
        disabled={summary.legalHold || loading}
      />
      <p className="text-[11px] text-muted-foreground">
        VAULT Record: <span className="font-mono text-primary/70">{summary.vaultRecordId}</span>
      </p>

      {showReject && (
        <div className="space-y-2">
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection…"
            rows={2}
            className="resize-none text-sm"
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {!summary.legalHold && (
          <>
            <Button size="sm" className="gap-1.5" onClick={handleApprove} disabled={loading}>
              <Check size={13} /> Approve
            </Button>
            {!showReject ? (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowReject(true)} disabled={loading}>
                <X size={13} /> Reject
              </Button>
            ) : (
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleReject} disabled={loading}>
                <X size={13} /> Confirm Reject
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 text-amber-500 border-amber-500/40 hover:bg-amber-500/10" onClick={handleLegalHold} disabled={loading}>
              <Gavel size={13} /> Legal Hold
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
