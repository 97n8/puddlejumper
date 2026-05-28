import { memo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Plus, X } from '@phosphor-icons/react'
import type { InstalledFlow, Recipe } from '../types'
import { RECIPES } from '../data/recipes'
import { RecipeIcon } from './RecipeIcon'
import { ConfigForm } from './ConfigForm'
import { RepoSelect } from './pickers/RepoSelect'

const CONN_LABELS: Record<string, { label: string; cls: string }> = {
  microsoft:  { label: 'Microsoft 365', cls: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-900' },
  google:     { label: 'Google',        cls: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-900' },
  github:     { label: 'GitHub',        cls: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-900' },
  logicsuite: { label: 'LogicSuite',   cls: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-900' },
}

function ConnBadge({ conn }: { conn?: string }) {
  const c = conn ? CONN_LABELS[conn] : null
  if (!c) return null
  return <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${c.cls}`}>{c.label}</span>
}

export const CatalogPage = memo(function CatalogPage({ installed, onAdd, onInstall: _onInstall }: {
  installed: InstalledFlow[]
  onAdd: (flow: InstalledFlow) => void
  onInstall: (recipe: Recipe) => void
}) {
  const [search, setSearch] = useState('')
  const [connFilter, setConnFilter] = useState<string>('all')
  const [running, setRunning] = useState<string | null>(null)
  const [goRecipe, setGoRecipe] = useState<Recipe | null>(null)
  const [goCfg, setGoCfg] = useState<Record<string, string>>({})
  const [rowRepo, setRowRepo] = useState<Record<string, string>>({})
  const installedIds = new Set(installed.map(f => f.recipeId))

  const filtered = RECIPES.filter(r => {
    if (connFilter !== 'all' && r.connection !== connFilter) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.action.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function runNow(recipe: Recipe, cfg: Record<string, string>) {
    if (!recipe.run) return
    setRunning(recipe.id)
    try {
      const msg = await recipe.run(cfg)
      toast.success(msg)
      setGoRecipe(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally { setRunning(null) }
  }

  function installFlow(recipe: Recipe) {
    const flow: InstalledFlow = {
      id: crypto.randomUUID(),
      recipeId: recipe.id,
      name: recipe.name,
      trigger: recipe.trigger,
      triggerType: recipe.triggerType,
      action: recipe.action,
      config: {},
      enabled: true,
      installedAt: Date.now(),
      runCount: 0,
      canRunNow: recipe.canRunNow,
    }
    onAdd(flow)
    toast.success(`${recipe.name} added to Flows`)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="font-semibold text-sm">Catalog</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{RECIPES.length} automations · pick one and go</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 flex-1 bg-muted border border-border rounded-lg px-3 py-1.5">
          <span className="text-muted-foreground text-xs">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search automations…"
            className="bg-none border-none outline-none text-sm flex-1 bg-transparent" />
        </div>
        {['all', 'microsoft', 'google', 'github', 'logicsuite'].map(f => (
          <button key={f} onClick={() => setConnFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${connFilter === f ? 'bg-primary/10 text-primary border-primary/20' : 'border-border text-muted-foreground hover:border-border hover:text-foreground'}`}>
            {f === 'all' ? 'All' : f === 'microsoft' ? 'Microsoft 365' : f === 'google' ? 'Google' : f === 'github' ? 'GitHub' : 'LogicSuite'}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="grid gap-0 shrink-0 border-b border-border" style={{ gridTemplateColumns: '1fr 130px 1fr 80px' }}>
        {['Action', 'Connection', 'Repo / Config', 'Go'].map(h => (
          <div key={h} className="px-4 py-2 text-[10px] font-mono tracking-widest text-muted-foreground uppercase">{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.map(recipe => {
          const isInstalled = installedIds.has(recipe.id)
          const repoField = recipe.configFields.find(f => f.type === 'repo')
          const hasOnlyRepo = repoField && recipe.configFields.length === 1
          const nonRepoFields = recipe.configFields.filter(f => f.type !== 'repo')
          return (
            <div key={recipe.id} className="grid border-b border-border hover:bg-muted/30 transition-colors items-center"
              style={{ gridTemplateColumns: '1fr 130px 1fr 80px' }}>
              {/* Action */}
              <div className="px-4 py-2.5 flex items-center gap-2.5 min-w-0">
                <RecipeIcon connection={recipe.connection} id={recipe.id} size={16} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{recipe.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{recipe.trigger} → {recipe.action}</div>
                </div>
              </div>
              {/* Connection */}
              <div className="px-3 py-2.5">
                <ConnBadge conn={recipe.connection} />
              </div>
              {/* Inline repo picker or config indicator */}
              <div className="px-3 py-1.5">
                {repoField ? (
                  <RepoSelect
                    value={rowRepo[recipe.id] ?? ''}
                    onChange={v => setRowRepo(prev => ({ ...prev, [recipe.id]: v }))}
                  />
                ) : recipe.configFields.length > 0 ? (
                  <span className="text-[10px] font-mono text-muted-foreground">{recipe.configFields.length} field{recipe.configFields.length !== 1 ? 's' : ''}</span>
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground/40">—</span>
                )}
              </div>
              {/* Go */}
              <div className="px-3 py-2.5 flex items-center gap-1.5">
                <Button size="sm" className="h-7 text-xs px-3"
                  disabled={running === recipe.id}
                  onClick={() => {
                    const preselectedRepo = rowRepo[recipe.id] ?? ''
                    const initCfg = preselectedRepo ? { repo: preselectedRepo } : {}
                    if (hasOnlyRepo && preselectedRepo && recipe.run) {
                      runNow(recipe, { repo: preselectedRepo })
                    } else if (nonRepoFields.length === 0 && recipe.configFields.length === 0 && recipe.run) {
                      runNow(recipe, {})
                    } else {
                      setGoRecipe(recipe); setGoCfg(initCfg as Record<string, string>)
                    }
                  }}>
                  {running === recipe.id ? '…' : 'Go'}
                </Button>
                {!isInstalled && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground" onClick={() => installFlow(recipe)}>
                    <Plus size={11} />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">No automations match your search.</div>
        )}
      </div>

      {/* Quick-run modal */}
      {goRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setGoRecipe(null)}>
          <div className="bg-background border border-border rounded-xl w-[440px] max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <RecipeIcon connection={goRecipe.connection} id={goRecipe.id} size={16} />
                <span className="font-semibold text-sm">{goRecipe.name}</span>
                <ConnBadge conn={goRecipe.connection} />
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setGoRecipe(null)} aria-label="Close"><X size={13} /></Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              <ConfigForm fields={goRecipe.configFields} values={goCfg} onChange={(k, v) => setGoCfg(prev => ({ ...prev, [k]: v }))} />
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <Button variant="outline" className="flex-1 text-sm" onClick={() => setGoRecipe(null)}>Cancel</Button>
              <Button className="flex-1 text-sm" disabled={running === goRecipe.id}
                onClick={() => runNow(goRecipe, goCfg)}>
                {running === goRecipe.id ? 'Running…' : '▶ Go'}
              </Button>
              <Button variant="ghost" className="text-sm gap-1.5 text-muted-foreground" onClick={() => { installFlow(goRecipe); setGoRecipe(null) }}>
                <Plus size={12} /> Save to Flows
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
