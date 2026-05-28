import { useState, useEffect } from 'react'
import { civicApi } from '../api/civicApi'
import type { CivicException } from '../api/civicApi'

const SEV_STYLE: Record<string, { border: string; badge: string }> = {
  critical: { border: 'border-red-700', badge: 'bg-red-700 text-white' },
  high: { border: 'border-amber-600', badge: 'bg-amber-600 text-white' },
  medium: { border: 'border-border', badge: 'bg-muted text-foreground' },
}

export function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<CivicException[]>([])
  const [loading, setLoading] = useState(true)
  const [ackId, setAckId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ackError, setAckError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    civicApi.exceptions()
      .then(r => setExceptions(r.exceptions))
      .catch(() => setExceptions([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAck = async () => {
    if (!ackId) return
    if (reason.trim().length < 20) { setAckError('Must be at least 20 characters.'); return }
    setSubmitting(true)
    setAckError(null)
    try {
      await civicApi.acknowledgeException(ackId, reason.trim())
      load()
      setAckId(null)
    } catch {
      setAckError('Failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const active = exceptions.filter(e => e.status === 'active')
  const acknowledged = exceptions.filter(e => e.status === 'acknowledged')

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-foreground font-black text-xl">Exceptions</h2>
        <span className="text-muted-foreground text-xs">{active.length} active · {acknowledged.length} acknowledged</span>
      </div>

      {active.length === 0 ? (
        <div className="bg-muted/50 border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
          No active exceptions. ✓ System is within governance parameters.
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {active.map(exc => {
            const style = SEV_STYLE[exc.severity] ?? SEV_STYLE.medium
            return (
              <div key={exc.id} className={`bg-muted/50 border ${style.border} rounded-xl p-4`}>
                <div className="flex items-start gap-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 mt-0.5 ${style.badge}`}>{exc.severity}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground/80 font-semibold text-sm">{exc.title}</p>
                    {exc.description && <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{exc.description}</p>}
                    <p className="text-muted-foreground/60 text-[10px] mt-2">
                      Type: {exc.exception_type} · Created {new Date(exc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => { setAckId(exc.id); setReason(''); setAckError(null) }}
                    className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                      exc.severity === 'critical'
                        ? 'bg-red-700 hover:bg-red-600 text-white'
                        : 'bg-muted hover:bg-muted/80 text-foreground/80'
                    }`}
                  >
                    {exc.severity === 'critical' ? 'Acknowledge →' : 'Dismiss'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {acknowledged.length > 0 && (
        <div>
          <p className="text-muted-foreground/60 text-xs uppercase tracking-widest font-bold mb-3">Acknowledged</p>
          <div className="space-y-2">
            {acknowledged.map(exc => (
              <div key={exc.id} className="bg-card border border-border rounded-lg px-4 py-2.5 flex items-center gap-3">
                <span className="text-muted-foreground/60 text-[10px] font-bold uppercase">{exc.severity}</span>
                <span className="text-muted-foreground text-xs flex-1 truncate">{exc.title}</span>
                <span className="text-muted-foreground/40 text-[10px]">by {exc.acknowledged_by}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledge Modal */}
      {ackId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-red-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-foreground font-bold mb-1">Acknowledge Exception</h3>
            <p className="text-muted-foreground text-xs mb-4">Provide a reason (≥20 characters) explaining the action being taken.</p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Describe corrective action being taken…"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${reason.length >= 20 ? 'text-green-400' : 'text-muted-foreground/60'}`}>{reason.length}/20</span>
              {ackError && <span className="text-xs text-red-400">{ackError}</span>}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setAckId(null)} className="flex-1 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:text-foreground">Cancel</button>
              <button
                onClick={handleAck}
                disabled={submitting || reason.trim().length < 20}
                className="flex-1 py-2 text-sm font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg"
              >
                {submitting ? 'Saving…' : 'Acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
