import { useState, useEffect, useCallback } from 'react'
import { aedApi, type QALICB } from '../api/aedApi'
import { ArrowLeft, Certificate, ArrowClockwise } from '@phosphor-icons/react'
import {
  aedBackLinkClass,
  aedBadgeClass,
  aedEmptyStateClass,
  aedMetaTextClass,
  aedPageClass,
  aedPanelClass,
  aedPrimaryButtonClass,
  aedSubtitleClass,
  aedTitleClass,
} from '../aedTheme'

interface QALICBPageProps {
  onNavigate: (moduleId: string) => void
}

function statusBadge(status: string) {
  switch (status) {
    case 'qualified':      return aedBadgeClass('emerald')
    case 'at_risk':        return aedBadgeClass('orange')
    case 'disqualified':   return aedBadgeClass('red')
    case 'pending_review': return aedBadgeClass('yellow')
    default:               return aedBadgeClass('neutral')
  }
}

export function QALICBPage({ onNavigate }: QALICBPageProps) {
  const [qalicbs, setQalicbs]    = useState<QALICB[]>([])
  const [loading, setLoading]    = useState(true)
  const [error, setError]        = useState<string | null>(null)
  const [certifying, setCertifying] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    aedApi.qalicbs.list()
      .then(r => setQalicbs(r.qalicbs))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleCertify = async (id: string) => {
    const certDate = new Date().toISOString().slice(0, 10)
    setCertifying(id)
    try {
      const updated = await aedApi.qalicbs.certify(id, certDate)
      setQalicbs(prev => prev.map(q => q.id === id ? updated : q))
    } catch (e: any) {
      alert(e.message ?? 'Failed to record certification')
    } finally {
      setCertifying(null)
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-muted-foreground animate-pulse">Loading QALICBs…</span></div>
  if (error)   return <div className="flex-1 flex items-center justify-center flex-col gap-2"><span className="text-sm text-red-400">{error}</span><button onClick={load} className={aedPrimaryButtonClass}><ArrowClockwise size={12} />Retry</button></div>

  const certDue = qalicbs.filter(q => {
    if (!q.next_cert_due || q.status !== 'qualified') return false
    return Math.round((new Date(q.next_cert_due).getTime() - Date.now()) / 86_400_000) <= 90
  })

  return (
    <div className={`${aedPageClass} space-y-4`}>

      {/* Header */}
      <div>
        <button onClick={() => onNavigate('workbench')} className={aedBackLinkClass}>
          <ArrowLeft size={11} /> Back to Workbench
        </button>
        <h1 className={aedTitleClass}>Business Certifications</h1>
        <p className={aedSubtitleClass}>
          Every business receiving tax credit investment must be re-certified each year.
          They need to pass location, income, and active-business tests. Missing a cert puts the deal at risk.
        </p>
      </div>

      {/* Cert alert banner */}
      {certDue.length > 0 && (
        <div className={aedPanelClass('yellow', 'p-4')}>
          <p className="mb-0.5 text-sm font-semibold text-yellow-800 dark:text-yellow-200">
            {certDue.length} business{certDue.length > 1 ? 'es' : ''} need certification within 90 days
          </p>
          <p className="text-[11px] text-yellow-700/80 dark:text-yellow-300/70">
            Record each certification after completing the annual location, income, and active-business review.
          </p>
        </div>
      )}

      {qalicbs.length === 0 ? (
        <div className={aedEmptyStateClass}>
          <div className="text-4xl mb-3">🏢</div>
          <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-white/50">No businesses yet</p>
          <p className="text-xs">Businesses are linked when deals are added. Admins can also add them directly.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {qalicbs.map(q => {
            const certDate = q.next_cert_due ? new Date(q.next_cert_due) : null
            const daysUntilCert = certDate ? Math.round((certDate.getTime() - Date.now()) / 86_400_000) : null
            const certAlert = daysUntilCert !== null && daysUntilCert <= 90
            const certOverdue = daysUntilCert !== null && daysUntilCert < 0

            return (
              <div
                key={q.id}
                className={
                  certOverdue
                    ? aedPanelClass('red', 'p-5')
                    : certAlert
                      ? aedPanelClass('yellow', 'p-5')
                      : aedPanelClass('neutral', 'p-5')
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-zinc-950 dark:text-white/95">{q.business_name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(q.status)}`}>
                        {q.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] mt-2">
                      <div>
                        <span className="text-zinc-500 dark:text-white/30">Census Tract</span>
                        <div className="font-mono text-zinc-700 dark:text-white/70">{q.census_tract}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-white/30">Location</span>
                        <div className="text-zinc-700 dark:text-white/70">{q.county}, {q.state}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-white/30">QLICI Amount</span>
                        <div className="font-semibold text-amber-700 dark:text-amber-300">${(q.qlici_amount / 1_000_000).toFixed(2)}M</div>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-white/30">Qualified</span>
                        <div className="text-zinc-700 dark:text-white/70">{q.qualification_date.slice(0, 10)}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-white/30">Last Certified</span>
                        <div className={q.last_certified_at ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                          {q.last_certified_at?.slice(0, 10) ?? 'Never'}
                        </div>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-white/30">Next Due</span>
                        <div className={certOverdue ? 'font-semibold text-red-700 dark:text-red-400' : certAlert ? 'font-semibold text-yellow-700 dark:text-yellow-400' : 'text-zinc-700 dark:text-white/70'}>
                          {certDate?.toISOString().slice(0, 10) ?? '—'}
                          {daysUntilCert !== null && (
                            <span className="ml-1">({daysUntilCert >= 0 ? `${daysUntilCert}d` : `${Math.abs(daysUntilCert)}d overdue`})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`mt-2 text-[11px] ${aedMetaTextClass}`}>
                      Contact: {q.contact_name} — <a href={`mailto:${q.contact_email}`} className="font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300">{q.contact_email}</a>
                    </div>
                  </div>

                  {/* Certify button */}
                  {q.status === 'qualified' && (
                    <button
                      onClick={() => handleCertify(q.id)}
                      disabled={certifying === q.id}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                        certAlert
                          ? 'border border-yellow-300 bg-yellow-100 text-yellow-900 hover:bg-yellow-200 dark:border-yellow-600/50 dark:bg-yellow-800/40 dark:text-yellow-200 dark:hover:bg-yellow-800/60'
                          : 'border border-stone-300 bg-stone-100 text-stone-800 hover:bg-stone-200 dark:border-zinc-600/40 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                       }`}
                    >
                      <Certificate size={13} weight="bold" />
                      {certifying === q.id ? 'Saving…' : 'Record Cert'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
