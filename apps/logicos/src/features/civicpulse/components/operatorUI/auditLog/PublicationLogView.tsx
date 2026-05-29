import { useState, useEffect } from 'react'
import { civicpulseClient, getCivicPulseFailureMessage } from '../../../api/civicpulseClient'
import { AuditExportButton } from './AuditExportButton'
import { Badge } from '@/components/ui/badge'
import { CircleNotch } from '@phosphor-icons/react'
import type { PublicationLogEntry } from '../../../types/civicpulse.types'
import { formatDistanceToNow } from 'date-fns'

const CHANNEL_LABELS: Record<string, string> = {
  website_post: 'Website', activity_feed: 'Feed',
  weekly_digest: 'Digest', email_summary: 'Email',
  social_draft: 'Social', quarterly_report: 'Report',
}

export function PublicationLogView() {
  const [entries, setEntries] = useState<PublicationLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    civicpulseClient.getPublicationLog()
      .then(setEntries)
      .catch(err => setError(getCivicPulseFailureMessage(err, 'publication log')))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Publication Log</h3>
        <AuditExportButton />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <CircleNotch size={16} className="animate-spin" />
          <span className="text-sm">Loading log…</span>
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-destructive">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No publication events recorded yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3 bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                    {CHANNEL_LABELS[entry.channel] ?? entry.channel}
                  </Badge>
                  {entry.correctionOf && (
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-0">Correction v{entry.version}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{entry.sealHashRef}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(entry.publishedAt), { addSuffix: true })}</p>
                {entry.operatorId && <p className="text-[11px] text-muted-foreground/60">{entry.operatorId}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
