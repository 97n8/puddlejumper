import { useState, useEffect } from 'react'
import { aedApi, type AuditEntry } from '../api/aedApi'
import {
  aedBodyTextClass,
  aedEmptyStateClass,
  aedMetaTextClass,
  aedPageClass,
  aedPanelClass,
  aedSectionTitleClass,
  aedSubtitleClass,
  aedTitleClass,
} from '../aedTheme'

export function AEDAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    aedApi.audit()
      .then(r => setEntries(r.entries))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-muted-foreground animate-pulse">Loading audit log…</span></div>
  if (error)   return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-red-400">{error}</span></div>

  return (
    <div className={`${aedPageClass} space-y-4`}>
      <div>
        <h1 className={aedTitleClass}>Audit Log</h1>
        <p className={aedSubtitleClass}>Append-only action record</p>
      </div>

      {entries.length === 0 ? (
        <div className={aedEmptyStateClass}>
          <div className="text-4xl mb-3">🗂</div>
          <p className="text-sm">No audit entries yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(e => (
            <div key={e.id} className={aedPanelClass('neutral', 'flex items-start gap-3 rounded-lg px-3 py-2 text-[12px]')}>
              <span className={`shrink-0 font-mono ${aedMetaTextClass}`}>{e.created_at.slice(0, 19).replace('T', ' ')}</span>
              <span className="shrink-0 font-medium text-amber-700 dark:text-amber-300">{e.actor_email}</span>
              <span className={`font-medium ${aedBodyTextClass}`}>{e.action}</span>
              <span className={aedSectionTitleClass}>{e.object_type} {e.object_id.slice(0, 8)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
