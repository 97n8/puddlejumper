import { useState, useEffect } from 'react'
import { civicApi } from '../api/civicApi'
import type { CivicDeadline } from '../api/civicApi'

function relativeDay(dateStr: string): { label: string; cls: string } {
  const target = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.floor((target.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: 'OVERDUE', cls: 'text-red-500 font-black' }
  if (diff === 0) return { label: 'TODAY', cls: 'text-red-400 font-black' }
  if (diff === 1) return { label: 'TOMORROW', cls: 'text-amber-400 font-bold' }
  if (diff <= 3) return { label: `${diff} days`, cls: 'text-amber-300' }
  if (diff <= 7) return { label: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'text-green-400' }
  return { label: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'text-muted-foreground' }
}

const TYPE_LABELS: Record<string, string> = {
  oml: 'OML', records: 'Records', contractual: 'Contract', statutory: 'Statutory',
}

export function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<CivicDeadline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    civicApi.deadlines()
      .then(r => setDeadlines(r.deadlines))
      .catch(() => setDeadlines([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-foreground font-black text-xl">Deadlines</h2>
        <span className="text-muted-foreground text-xs">{deadlines.length} active deadline{deadlines.length !== 1 ? 's' : ''}</span>
      </div>
      {deadlines.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground/60">No active deadlines.</div>
      ) : (
        <div className="space-y-2">
          {deadlines.map(d => {
            const rel = relativeDay(d.due_at)
            return (
              <div key={d.id} className="bg-muted/50 border border-border rounded-xl px-4 py-3 flex items-center gap-4">
                <div className={`text-sm font-mono w-20 shrink-0 ${rel.cls}`}>{rel.label}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground/80 text-sm font-medium truncate">{d.label}</p>
                  {d.statute_ref && <p className="text-muted-foreground text-xs">{d.statute_ref}</p>}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                  d.type === 'oml' ? 'bg-blue-800 text-blue-200' :
                  d.type === 'records' ? 'bg-amber-800 text-amber-200' :
                  'bg-purple-800 text-purple-200'
                }`}>
                  {TYPE_LABELS[d.type] ?? d.type}
                </span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  d.severity === 'critical' ? 'bg-red-800 text-red-200' : 'bg-muted text-muted-foreground'
                }`}>
                  {d.severity}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
