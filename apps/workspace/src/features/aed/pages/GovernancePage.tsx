import { useState, useEffect } from 'react'
import { aedApi, type AuthorityEntry, type AccessEntry } from '../api/aedApi'
import {
  aedBadgeClass,
  aedEmptyStateClass,
  aedMetaTextClass,
  aedPageClass,
  aedPanelClass,
  aedSubtitleClass,
  aedTitleClass,
} from '../aedTheme'

function accessStatusBadge(status: string) {
  switch (status) {
    case 'active':        return aedBadgeClass('emerald')
    case 'needs_update':  return aedBadgeClass('yellow')
    case 'expired':       return aedBadgeClass('red')
    case 'pending_setup': return aedBadgeClass('neutral')
    default:              return aedBadgeClass('neutral')
  }
}

export function GovernancePage() {
  const [authorities, setAuthorities] = useState<AuthorityEntry[]>([])
  const [accesses, setAccesses]       = useState<AccessEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [tab, setTab]                 = useState<'authority' | 'access'>('authority')

  useEffect(() => {
    Promise.all([
      aedApi.governance.authority.list(),
      aedApi.governance.access.list(),
    ])
      .then(([a, ac]) => { setAuthorities(a.entries); setAccesses(ac.entries) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="text-sm text-muted-foreground animate-pulse">Loading governance data…</span>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="text-sm text-red-400">{error}</span>
    </div>
  )

  return (
    <div className={`${aedPageClass} space-y-6`}>
      <div>
        <h1 className={aedTitleClass}>Team & Permissions</h1>
        <p className={aedSubtitleClass}>Who has access and what they can do · Portal accounts and credentials</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['authority', 'access'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'border border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-600/40 dark:bg-amber-800/40 dark:text-amber-200'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-white/50 dark:hover:text-white/70'
            }`}
          >
            {t === 'authority' ? '🔑 Authority Register' : '🌐 Access Register'}
          </button>
        ))}
      </div>

      {tab === 'authority' && (
        <div className="space-y-2">
          {authorities.length === 0 ? (
            <p className={`${aedEmptyStateClass} py-8 text-sm`}>No authority entries yet.</p>
          ) : (
            authorities.map((a: AuthorityEntry) => (
              <div key={a.id} className={aedPanelClass('amber', 'p-4')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white/90">{a.role}</span>
                    <span className="ml-2 text-[11px] text-amber-700 dark:text-amber-400">{a.authority_type}</span>
                    <p className={`mt-0.5 text-[11px] ${aedMetaTextClass}`}>{a.scope}</p>
                  </div>
                  {a.threshold_amount && (
                    <span className="shrink-0 text-sm font-bold text-amber-700 dark:text-amber-300">
                      ${(a.threshold_amount / 1_000).toFixed(0)}K
                    </span>
                  )}
                </div>
                <div className={`mt-2 flex gap-4 text-[11px] ${aedMetaTextClass}`}>
                  <span>Holder: {a.current_holder ?? '—'}</span>
                  <span>Backup: {a.backup_holder ?? '—'}</span>
                  {a.statute_ref && <span className="font-mono">{a.statute_ref}</span>}
                </div>
                {a.notes && <p className={`mt-1 text-[11px] italic ${aedMetaTextClass}`}>{a.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'access' && (
        <div className="space-y-2">
          {accesses.length === 0 ? (
            <p className={`${aedEmptyStateClass} py-8 text-sm`}>No access entries yet.</p>
          ) : (
            accesses.map((a: AccessEntry) => (
              <div key={a.id} className={aedPanelClass('neutral', 'p-4')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white/90">{a.portal_name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-2 ${accessStatusBadge(a.status)}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                    <p className={`mt-0.5 text-[11px] ${aedMetaTextClass}`}>{a.access_type}</p>
                  </div>
                  <a
                    href={a.portal_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                    onClick={e => e.stopPropagation()}
                  >
                    Open ↗
                  </a>
                </div>
                <div className={`mt-2 flex gap-4 text-[11px] ${aedMetaTextClass}`}>
                  <span>Primary: {a.primary_holder ?? '—'}</span>
                  <span>Backup: {a.backup_holder ?? '—'}</span>
                  {a.last_verified_at && (
                    <span>Verified: {a.last_verified_at.slice(0, 10)} by {a.verified_by}</span>
                  )}
                </div>
                {a.notes && <p className={`mt-1 text-[11px] italic ${aedMetaTextClass}`}>{a.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
