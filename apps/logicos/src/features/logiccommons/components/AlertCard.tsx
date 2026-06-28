import { useState } from 'react'
import type { CommonsAlert } from '../types'
import { useAcknowledgeAlert, useResolveAlert } from '../hooks/useCommonsAlerts'

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-4 border-l-red-700',
  high:     'border-l-4 border-l-amber-600',
  warning:  'border-l-4 border-l-yellow-500',
  info:     'border-l-4 border-l-slate-400',
}

const DOMAIN_BADGE: Record<string, string> = {
  compliance:         'bg-red-50 text-red-800',
  organizational:     'bg-purple-50 text-purple-800',
  workflow:           'bg-blue-50 text-blue-800',
  financial:          'bg-green-50 text-green-800',
  data_freshness:     'bg-orange-50 text-orange-800',
  access:             'bg-yellow-50 text-yellow-800',
  ai_activity:        'bg-teal-50 text-teal-800',
  environment_health: 'bg-slate-50 text-slate-800',
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high:     'bg-amber-100 text-amber-800',
  warning:  'bg-yellow-100 text-yellow-800',
  info:     'bg-slate-100 text-slate-600',
}

interface Props {
  alert: CommonsAlert
}

export function AlertCard({ alert }: Props) {
  const [resolveOpen, setResolveOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const acknowledge = useAcknowledgeAlert()
  const resolve = useResolveAlert()

  return (
    <div className={`rounded-lg bg-card/50 p-4 ${SEVERITY_BORDER[alert.severity] ?? ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">{alert.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{alert.detail}</p>
          <p className="text-sm text-muted-foreground mt-1 italic">{alert.suggested_action}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs font-semibold rounded-md px-2 py-0.5 ${DOMAIN_BADGE[alert.domain] ?? 'bg-slate-100 text-slate-600'}`}>
            {alert.domain.replace(/_/g, ' ')}
          </span>
          <span className={`text-xs font-semibold rounded-md px-2 py-0.5 ${SEVERITY_BADGE[alert.severity] ?? ''}`}>
            {alert.severity}
          </span>
        </div>
      </div>
      {alert.status === 'open' && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => acknowledge.mutate(alert.id)}
            disabled={acknowledge.isPending}
            className="text-xs font-medium px-3 py-1 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            Acknowledge
          </button>
          <button
            onClick={() => setResolveOpen(v => !v)}
            className="text-xs font-medium px-3 py-1 rounded-md border border-border hover:bg-muted transition-colors"
          >
            Resolve
          </button>
        </div>
      )}
      {resolveOpen && (
        <div className="mt-3 space-y-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Resolution notes..."
            className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-none"
            rows={2}
          />
          <button
            onClick={() => {
              resolve.mutate({ alertId: alert.id, notes })
              setResolveOpen(false)
              setNotes('')
            }}
            disabled={resolve.isPending}
            className="text-xs font-medium px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Confirm resolve
          </button>
        </div>
      )}
    </div>
  )
}
