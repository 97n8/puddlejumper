import { useState, useEffect } from 'react'
import { civicpulseClient, getCivicPulseFailureMessage } from '../../../api/civicpulseClient'
import { approvalActions } from '../../../api/approvalActions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Warning, Clock, CircleNotch, CheckCircle } from '@phosphor-icons/react'
import type { ComplianceBackstop } from '../../../types/civicpulse.types'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

const ACTION_LABELS: Record<string, string> = {
  board_vote: 'Board Vote', contract_award: 'Contract Award',
  budget_transfer: 'Budget Transfer', public_hearing: 'Public Hearing',
  capital_milestone: 'Capital Milestone', debt_issuance: 'Debt Issuance',
  emergency_declaration: 'Emergency Declaration', policy_adoption: 'Policy Adoption',
  procurement_action: 'Procurement Action', zba_filing: 'ZBA Filing',
}

export function BackstopStatusPanel() {
  const [items, setItems] = useState<ComplianceBackstop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    civicpulseClient.getBackstopItems()
      .then(setItems)
      .catch(err => setError(getCivicPulseFailureMessage(err, 'compliance windows')))
      .finally(() => setLoading(false))
  }, [])

  const handleAcknowledge = async (id: string) => {
    try {
      await approvalActions.acknowledgeBackstop(id)
      setItems(prev => prev.filter(i => i.id !== id))
      toast.success('Backstop acknowledged.')
    } catch {
      toast.error('Failed to acknowledge.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <CircleNotch size={14} className="animate-spin" />
        <span className="text-sm">Checking compliance windows…</span>
      </div>
    )
  }

  if (error) {
    return <p className="py-4 text-sm text-destructive">{error}</p>
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <CheckCircle size={16} weight="duotone" className="text-primary" />
        <span className="text-sm">All actions within compliance windows.</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const expires = new Date(item.windowExpiresAt)
        const isExpired = expires < new Date()
        return (
          <div key={item.id} className={`flex items-start gap-3 rounded-lg border p-3 ${item.escalated ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
            <Warning size={16} className={item.escalated ? 'text-red-400 mt-0.5 shrink-0' : 'text-amber-400 mt-0.5 shrink-0'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{ACTION_LABELS[item.actionType] ?? item.actionType}</span>
                {item.escalated && (
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-red-500/20 text-red-400 border-0">Escalated</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <Clock size={11} />
                {isExpired
                  ? <span className="text-red-400">Expired {formatDistanceToNow(expires, { addSuffix: true })}</span>
                  : <span>Expires {formatDistanceToNow(expires, { addSuffix: true })}</span>
                }
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => handleAcknowledge(item.id)}>
              Acknowledge
            </Button>
          </div>
        )
      })}
    </div>
  )
}
