import { useState } from 'react'
import { useCommonsAlerts } from '../hooks/useCommonsAlerts'
import { AlertCard } from './AlertCard'

const SEVERITY_OPTIONS = ['all', 'critical', 'high', 'warning', 'info']
const DOMAIN_OPTIONS = ['all', 'compliance', 'organizational', 'workflow', 'financial', 'data_freshness']

export function AlertsPanel() {
  const [severity, setSeverity] = useState('all')
  const [domain, setDomain] = useState('all')
  const { data: alerts, isLoading } = useCommonsAlerts({ severity, domain })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-bold flex-1">Alerts</h2>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="text-xs rounded-md border border-border bg-background px-2 py-1"
        >
          {SEVERITY_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All severities' : s}</option>
          ))}
        </select>
        <select
          value={domain}
          onChange={e => setDomain(e.target.value)}
          className="text-xs rounded-md border border-border bg-background px-2 py-1"
        >
          {DOMAIN_OPTIONS.map(d => (
            <option key={d} value={d}>{d === 'all' ? 'All domains' : d.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : alerts && alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No alerts match your filters.</p>
      )}
    </div>
  )
}
