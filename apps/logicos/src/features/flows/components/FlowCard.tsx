import { memo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Play, ArrowRight, CaretDown, Check, X, Trash } from '@phosphor-icons/react'
import type { InstalledFlow, Recipe } from '../types'
import { fmtRelative } from '../utils'
import { RecipeIcon } from './RecipeIcon'
import { ConfigForm } from './ConfigForm'

export const RiskBadge = memo(function RiskBadge({ level }: { level: 'low' | 'med' | 'high' }) {
  const cfg = {
    low:  { label: 'Low',    cls: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-900' },
    med:  { label: 'Medium', cls: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-900' },
    high: { label: 'High',   cls: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-900' },
  }[level]
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cfg.cls}`}>{cfg.label}</span>
  )
})

const CONNECTION_BADGES: Record<string, string> = {
  microsoft: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-900',
  google: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-900',
  github: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-900',
  logicsuite: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-900',
  civicplus: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-900',
}

function ConnectionBadge({ connection }: { connection?: string }) {
  if (!connection) return null
  const cls = CONNECTION_BADGES[connection]
  if (!cls) return null
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono ${cls}`}>{connection}</span>
}

export const FlowCard = memo(function FlowCard({ flow, recipe, onDelete, onToggle, onUpdate, onRunNow, onOpenRuns }: {
  flow: InstalledFlow; recipe: Recipe | undefined
  onDelete: () => void; onToggle: () => void; onUpdate: (cfg: Record<string, string>) => void
  onRunNow?: () => Promise<void> | void
  onOpenRuns?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [running, setRunning] = useState(false)
  const [cfg, setCfg] = useState<Record<string, string>>(flow.config ?? {})

  const risk: 'low' | 'med' | 'high' =
    (recipe?.configFields?.length ?? 0) > 3 ? 'high' : flow.canRunNow ? 'low' : 'med'

  async function run() {
    if (onRunNow) {
      setRunning(true)
      try {
        await onRunNow()
      } finally {
        setRunning(false)
      }
      return
    }
    if (!recipe?.run) return
    setRunning(true)
    try {
      const msg = await recipe.run(cfg)
      toast.success(msg || 'Done')
      onUpdate(cfg)
    } catch (e: unknown) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setRunning(false) }
  }

  return (
    <div className={`rounded-2xl border border-border bg-background p-4 shadow-sm transition-colors ${!flow.enabled ? 'opacity-60' : 'hover:bg-muted/20'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60">
          <RecipeIcon id={flow.recipeId} size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{flow.name}</span>
            <RiskBadge level={risk} />
            <ConnectionBadge connection={flow.connection} />
             {flow.frameworkLabel && (
               <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-300">
                 {flow.frameworkLabel}
               </span>
             )}
             {flow.frameworkChapter && (
               <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-300">
                 {flow.frameworkChapter}
               </span>
             )}
             <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono border ${
               (flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'active'
                 ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'
                 : (flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'draft'
                   ? 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400'
                   : (flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'archived'
                     ? 'border-border bg-muted text-muted-foreground'
                     : 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400'
             }`}>
               {flow.status ?? (flow.enabled ? 'active' : 'paused')}
             </span>
             {(flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'active' && (
               <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                 run now
               </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            <span>{flow.trigger}</span>
            <ArrowRight size={9} />
            <span>{flow.action}</span>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[1.5fr,1fr]">
            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Trigger path</div>
              <div className="mt-1 text-sm text-foreground">{flow.trigger}</div>
              <div className="mt-1 text-xs text-muted-foreground">Routes into <span className="font-medium text-foreground">{flow.action}</span></div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Run status</div>
              <div className="mt-1 text-sm text-foreground">
                 {flow.lastRun ? new Date(flow.lastRun).toLocaleString() : 'Never run'}
               </div>
              <div className={`mt-1 text-xs ${flow.lastStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {flow.lastRun
                  ? <>
                      {flow.lastStatus === 'error'
                        ? <X size={9} className="mr-1 inline text-destructive" />
                        : <Check size={9} className="mr-1 inline text-emerald-500" />}
                      {fmtRelative(flow.lastRun)} · {flow.runCount} run{flow.runCount !== 1 ? 's' : ''}
                    </>
                  : `${flow.runCount} run${flow.runCount !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>

          {flow.logicSteps && flow.logicSteps.length > 0 && (
            <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Scenario logic</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {flow.logicSteps.map(step => (
                  <span key={step.id} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground">
                    {step.kind === 'if' ? 'What if' : 'Then'} {step.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

         <div className="flex items-center gap-1.5 shrink-0">
           {(flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'active' && (flow.canRunNow || onRunNow) && (
             <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 px-2.5" disabled={running} onClick={run}>
               <Play size={11} weight="fill" />{running ? '…' : 'Run'}
             </Button>
           )}
           {onOpenRuns && (
             <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 px-2.5" onClick={onOpenRuns}>
               Runs
             </Button>
           )}
           <button onClick={onToggle} className={`w-8 h-4.5 rounded-full relative transition-colors ${flow.enabled ? 'bg-primary' : 'bg-muted'}`}
             style={{ width: 30, height: 18, borderRadius: 9, position: 'relative', cursor: 'pointer', border: 'none', flexShrink: 0 }}
             disabled={flow.status === 'archived'}>
             <span style={{
               position: 'absolute', top: 2, left: flow.enabled ? 12 : 2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#fff', transition: 'left .15s', display: 'block',
            }} />
          </button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setExpanded(x => !x)} aria-label={expanded ? 'Collapse flow' : 'Expand flow'}>
            <CaretDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : '', transition: 'transform .15s' }} />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete} aria-label="Delete flow">
            <Trash size={12} />
          </Button>
        </div>
      </div>

      {expanded && recipe?.configFields && recipe.configFields.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="mb-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Configuration</div>
              <div className="mt-1 text-xs text-muted-foreground">Update the recipe inputs, then save or run immediately.</div>
            </div>
            <ConfigForm
              fields={recipe.configFields}
              values={cfg}
              onChange={(k, v) => setCfg(prev => ({ ...prev, [k]: v }))}
            />
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { onUpdate(cfg); toast.success('Saved') }}>Save</Button>
              {((flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'active') && (flow.canRunNow || onRunNow) && (
                <Button size="sm" variant="ghost" className="text-xs h-8 gap-1" disabled={running} onClick={run}>
                  <Play size={10} weight="fill" />{running ? 'Running…' : 'Run now'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
