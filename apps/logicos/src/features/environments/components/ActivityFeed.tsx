import type { EnvironmentActivity } from '../types/environment'

const SEVERITY_DOT: Record<EnvironmentActivity['severity'], string> = {
  warn: 'bg-amber-400',
  success: 'bg-green-500',
  info: 'bg-blue-500',
}

interface ActivityFeedProps {
  activities: EnvironmentActivity[]
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="flex flex-col h-full" style={{ maxHeight: '55%' }}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Recent Activity
      </p>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No recent activity</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
          {activities.map(a => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[a.severity]}`} />
              <span className="flex-1 min-w-0">
                <span className="font-medium">{a.actor}</span>{' '}
                <span className="text-muted-foreground">{a.action}</span>
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
