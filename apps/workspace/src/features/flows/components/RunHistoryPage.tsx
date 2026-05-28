import { memo } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react'
import type { InstalledFlow } from '../types'
import { RecipeIcon } from './RecipeIcon'
import { fmtRelative } from '../utils'

export const RunHistoryPage = memo(function RunHistoryPage({ flows }: { flows: InstalledFlow[] }) {
  const runs = [...flows]
    .filter(f => f.lastRun)
    .sort((a, b) => (b.lastRun ?? 0) - (a.lastRun ?? 0))
  const successCount = runs.filter(run => run.lastStatus === 'success').length
  const errorCount = runs.filter(run => run.lastStatus === 'error').length
  const totalRunCount = runs.reduce((sum, run) => sum + run.runCount, 0)

  if (runs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
        <ArrowsClockwise size={28} weight="duotone" className="text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No runs yet</p>
        <p className="text-xs text-muted-foreground/70">Run a flow from the Catalog or your installed Flows to see history here.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-background/80">
        <div>
          <h2 className="font-semibold text-sm">Run History</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{runs.length} flows with run records</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            { label: 'Recorded flows', value: runs.length, tone: 'text-foreground' },
            { label: 'Successful', value: successCount, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Total runs', value: totalRunCount, tone: 'text-blue-600 dark:text-blue-300' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className={`text-base font-semibold ${card.tone}`}>{card.value}</div>
              <div className="mt-0.5 text-sm font-medium text-foreground">{card.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {card.label === 'Successful'
                  ? `${errorCount} flow${errorCount !== 1 ? 's' : ''} ended in error.`
                  : 'Latest-first execution summary.'}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-3xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-3 px-2">
            <div className="text-sm font-semibold text-foreground">Recent runs</div>
            <div className="text-xs text-muted-foreground">A compact timeline of the latest flow executions in this workspace.</div>
          </div>

          <div className="flex flex-col gap-3">
            {runs.map(f => (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 transition-colors hover:bg-muted/20">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                  <RecipeIcon id={f.recipeId} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {f.lastRun ? new Date(f.lastRun).toLocaleString() : '—'} · {f.runCount} run{f.runCount !== 1 ? 's' : ''} · {f.lastRun ? fmtRelative(f.lastRun) : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {f.lastStatus === 'success' && <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900 px-1.5 py-0.5 rounded">success</span>}
                  {f.lastStatus === 'error' && <span className="text-[10px] font-mono text-red-600 bg-red-50 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900 px-1.5 py-0.5 rounded">error</span>}
                  {!f.lastStatus && <span className="text-[10px] font-mono text-muted-foreground/60">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
