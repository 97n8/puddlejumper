import { useState, useEffect } from 'react'
import { civicpulseClient, getCivicPulseFailureMessage } from '../../../api/civicpulseClient'
import { SummaryReviewCard } from './SummaryReviewCard'
import { CircleNotch, CheckCircle } from '@phosphor-icons/react'
import type { CivicSummary } from '../../../types/civicpulse.types'

export function ApprovalQueueView() {
  const [summaries, setSummaries] = useState<CivicSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    civicpulseClient.getPendingSummaries()
      .then(setSummaries)
      .catch(error => setError(getCivicPulseFailureMessage(error, 'pending summaries')))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdate = (updated: CivicSummary) => {
    setSummaries(prev => prev.filter(s => s.id !== updated.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <CircleNotch size={18} className="animate-spin" />
        <span className="text-sm">Loading approval queue…</span>
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive p-4">{error}</p>
  }

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
        <CheckCircle size={28} weight="duotone" className="text-primary" />
        <p className="text-sm">No summaries pending review.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {summaries.map(summary => (
        <SummaryReviewCard key={summary.id} summary={summary} onUpdate={handleUpdate} />
      ))}
    </div>
  )
}
