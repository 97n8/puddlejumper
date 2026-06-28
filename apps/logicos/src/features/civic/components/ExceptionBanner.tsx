import { useState } from 'react'
import type { CivicException } from '../api/civicApi'
import { civicApi } from '../api/civicApi'

interface Props {
  exceptions: CivicException[]
  onAcknowledged: (id: string) => void
}

export function ExceptionBanner({ exceptions, onAcknowledged }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [ackModal, setAckModal] = useState<CivicException | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visible = exceptions.filter(e => !dismissed.has(e.id) && e.status === 'active')
  if (visible.length === 0) return null

  const hasCritical = visible.some(e => e.severity === 'critical')

  const bannerBg = hasCritical
    ? 'bg-red-950 border-red-700'
    : 'bg-amber-900/60 border-amber-600'

  const handleDismiss = (e: CivicException) => {
    if (e.severity === 'critical') {
      setAckModal(e)
      setReason('')
      setError(null)
    } else {
      setDismissed(prev => new Set([...prev, e.id]))
    }
  }

  const handleAcknowledge = async () => {
    if (!ackModal) return
    if (reason.trim().length < 20) {
      setError('Reason must be at least 20 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await civicApi.acknowledgeException(ackModal.id, reason.trim())
      onAcknowledged(ackModal.id)
      setAckModal(null)
    } catch {
      setError('Failed to acknowledge. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const severityBadge = (sev: string) => {
    const map: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      high: 'bg-amber-500 text-white',
      medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    }
    return `inline-block text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${map[sev] ?? 'bg-muted text-muted-foreground'}`
  }

  return (
    <>
      <div className={`border rounded-lg px-4 py-3 mb-4 ${bannerBg}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-red-300 mb-2">
              ⚠ Active Exceptions — Action Required
            </p>
            <div className="space-y-1.5">
              {visible.slice(0, 3).map(exc => (
                <div key={exc.id} className="flex items-center gap-2">
                  <span className={severityBadge(exc.severity)}>{exc.severity}</span>
                  <span className="text-sm text-white/90 truncate">{exc.title}</span>
                  <button
                    onClick={() => handleDismiss(exc)}
                    className="ml-auto shrink-0 text-xs text-white/50 hover:text-white/80 underline"
                  >
                    {exc.severity === 'critical' ? 'Acknowledge →' : '✕'}
                  </button>
                </div>
              ))}
              {visible.length > 3 && (
                <p className="text-xs text-white/40 mt-1">+{visible.length - 3} more exceptions</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Acknowledgment Modal */}
      {ackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-red-700 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className={severityBadge('critical')}>CRITICAL</span>
              <h2 className="text-foreground font-bold text-sm">{ackModal.title}</h2>
            </div>
            {ackModal.description && (
              <p className="text-muted-foreground text-xs mb-4 leading-relaxed">{ackModal.description}</p>
            )}
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Acknowledgment Reason <span className="text-red-400">(minimum 20 characters)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Describe the action being taken to address this exception…"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs ${reason.length >= 20 ? 'text-green-400' : 'text-muted-foreground'}`}>
                {reason.length}/20 characters
              </span>
              {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setAckModal(null)}
                className="flex-1 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={submitting || reason.trim().length < 20}
                className="flex-1 py-2 text-sm font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg"
              >
                {submitting ? 'Acknowledging…' : 'Acknowledge Exception'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
