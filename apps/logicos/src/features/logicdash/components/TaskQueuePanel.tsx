// ── TaskQueuePanel — Layer 8: User Guidance Surface ─────────────────────────
//
// Shows the unified "do this next" task feed aggregated from CivicPulse alerts,
// stale approvals, pending AI rules, and expiring licenses.

import { useState, useEffect } from 'react'
import { ArrowsClockwise, Warning, CheckCircle, ClockCountdown, Tag } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pjApi, type TaskItem } from '@/services/pjApi'

const PRIORITY_COLOR: Record<TaskItem['priority'], string> = {
  critical: 'bg-red-500/15 text-red-600 border-red-300',
  high:     'bg-amber-500/15 text-amber-700 border-amber-300',
  medium:   'bg-blue-500/15 text-blue-700 border-blue-300',
  low:      'bg-muted text-muted-foreground border-border',
}

const SOURCE_ICON = {
  watch_alert:       <Warning size={14} weight="fill" className="shrink-0 text-amber-500" />,
  approval:          <ClockCountdown size={14} weight="fill" className="shrink-0 text-blue-500" />,
  pending_rule:      <Tag size={14} weight="fill" className="shrink-0 text-violet-500" />,
  expiring_license:  <CheckCircle size={14} weight="fill" className="shrink-0 text-green-500" />,
}

export function TaskQueuePanel() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true)
    setRefreshing(quiet)
    setError(null)
    try {
      const res = await pjApi.tasks.list()
      setTasks(res.tasks ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 text-muted-foreground text-sm">
        <ArrowsClockwise size={16} className="animate-spin" />
        Loading action items…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const critical = tasks.filter(t => t.priority === 'critical').length
  const high     = tasks.filter(t => t.priority === 'high').length

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Action items</span>
          {critical > 0 && (
            <Badge variant="destructive" className="h-4 px-1.5 py-0 text-[9px]">
              {critical} critical
            </Badge>
          )}
          {high > 0 && (
            <Badge className="h-4 bg-amber-500 px-1.5 py-0 text-[9px] text-white hover:bg-amber-500">
              {high} high
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void load(true)} disabled={refreshing}>
          <ArrowsClockwise size={12} className={cn(refreshing && 'animate-spin')} />
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          No pending action items. Everything is current.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              className={cn(
                'rounded-md border px-3 py-2.5 text-xs',
                PRIORITY_COLOR[task.priority]
              )}
            >
              <div className="flex items-start gap-2">
                {SOURCE_ICON[task.source]}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold leading-snug">
                    <span className="truncate">{task.title}</span>
                    {task.dueBy && (
                      <span className="shrink-0 rounded bg-black/10 px-1 py-0.5 text-[9px] font-normal">
                        due {task.dueBy}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] opacity-75">{task.detail}</p>
                </div>
              </div>
              {task.actionUrl && (
                <div className="mt-1.5 text-right">
                  <a
                    href={task.actionUrl}
                    className="text-[10px] font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
                  >
                    Go →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
