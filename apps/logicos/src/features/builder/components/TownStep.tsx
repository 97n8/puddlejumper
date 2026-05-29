import { useState, useMemo } from 'react'
import { Buildings, CheckCircle, Rocket, Link } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VAULT_MODULES, type VaultModule } from '@/lib/vault-modules'
import type { Municipality } from '@/data/maMunicipalities'
import type { MakerState, MunicipalContext } from '../types'
import {
  MA_TOWNS,
  DOMAIN_ACCENT, DOMAIN_BADGE, MODULE_EMOJI,
  WORKFLOW_TEAM_OPTIONS,
  buildCivicSourceLinks, recommendedMunicipalModuleIds,
  withToggledModule, withRecommendedModules, formatMoney,
} from '../utils/makerUtils'
import { toast } from 'sonner'

export function TownStep({
  state,
  onUpdate,
  municipality,
  municipalContext,
  loadingMunicipalContext,
}: {
  state: MakerState
  onUpdate: (s: MakerState) => void
  municipality: Municipality | null
  municipalContext: MunicipalContext | null
  loadingMunicipalContext: boolean
}) {
  const [q, setQ] = useState(state.town)
  const suggestions = useMemo(() => {
    const trimmed = q.trim()
    if (!trimmed || trimmed.length < 2) return []
    const low = trimmed.toLowerCase()
    const matches = MA_TOWNS.filter(t => t.toLowerCase().startsWith(low)).slice(0, 8)
    return matches.length === 1 && matches[0].toLowerCase() === low ? [] : matches
  }, [q])

  const commit = (name: string) => {
    setQ(name)
    onUpdate({ ...state, town: name })
  }
  const civicSourceLinks = state.town ? buildCivicSourceLinks(state.town) : []
  const recommendedIds = useMemo(
    () => recommendedMunicipalModuleIds(municipalContext, municipality),
    [municipalContext, municipality],
  )
  const selectedModules = state.selectedIds
    .map(id => VAULT_MODULES.find(item => item.id === id))
    .filter((module): module is VaultModule => Boolean(module))

  function toggleModule(id: string) {
    onUpdate(withToggledModule(state, id))
  }

  function applyMunicipalQuickStart() {
    onUpdate(withRecommendedModules(state, recommendedIds))
    toast.success('Municipal quick-start modules added.')
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.06),transparent_26%)]">
      <div className="mx-auto w-full max-w-[1480px] px-6 py-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-border bg-card/95 p-6 shadow-sm">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                    <Rocket size={13} weight="fill" />
                    Simple municipal build flow
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Build a module stack in one calm pass.</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Pick the town, pull the public context, then choose the modules that match how the municipality actually runs.
                    </p>
                  </div>
                  <div className="relative">
                    <Input
                      value={q}
                      onChange={e => { setQ(e.target.value); onUpdate({ ...state, town: e.target.value }) }}
                      placeholder="Start with a Massachusetts town..."
                      className="h-12 rounded-2xl border-border/70 bg-background text-base shadow-sm"
                      autoFocus
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
                        {suggestions.map(s => (
                          <button
                            key={s}
                            onClick={() => commit(s)}
                            className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={applyMunicipalQuickStart} className="rounded-2xl">
                      Use municipal quick start
                    </Button>
                    {selectedModules.length > 0 && (
                      <div className="inline-flex items-center gap-2 rounded-2xl border bg-muted/20 px-4 py-2 text-sm font-medium text-foreground">
                        <CheckCircle size={15} weight="fill" className="text-emerald-500" />
                        {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Recommended stack</div>
                  <p className="mt-2 text-sm text-emerald-950">
                    Start with the core modules most towns need, then add the department-specific layers.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recommendedIds.map(id => {
                      const module = VAULT_MODULES.find(item => item.id === id)
                      return (
                        <span key={id} className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-900">
                          {module?.name ?? id}
                        </span>
                      )
                    })}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {WORKFLOW_TEAM_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onUpdate({ ...state, workflowTeamSize: option.value })}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          state.workflowTeamSize === option.value
                            ? 'border-emerald-400 bg-white text-emerald-900'
                            : 'border-emerald-200 bg-white/70 text-emerald-900 hover:bg-white'
                        }`}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className="mt-1 text-[11px] text-emerald-800">{option.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">Choose your module stack</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Tap the modules you want. The rest of the flow stays focused on the ones you select.
                  </p>
                </div>
                {selectedModules.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedModules.map(module => (
                      <span key={module.id} className="rounded-full border bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                        {module.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                {VAULT_MODULES.map(m => {
                  const selected = state.selectedIds.includes(m.id)
                  const accent = DOMAIN_ACCENT[m.domain] ?? '#6b7280'
                  const badge = DOMAIN_BADGE[m.domain] ?? 'bg-muted text-muted-foreground border-muted'
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleModule(m.id)}
                      className={`group relative overflow-hidden rounded-[22px] border p-4 text-left transition-all ${
                        selected
                          ? 'border-primary bg-primary/[0.07] shadow-sm'
                          : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                      }`}
                    >
                      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl"
                            style={{ background: `${accent}18` }}
                          >
                            {MODULE_EMOJI[m.id] ?? '⚙️'}
                          </div>
                          <div>
                            <div className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge}`}>{m.domain}</div>
                            <h3 className="mt-2 text-sm font-semibold text-foreground">{m.name}</h3>
                          </div>
                        </div>
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold transition ${
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/25 text-transparent group-hover:border-primary/40'
                        }`}>
                          ✓
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{m.description}</p>
                      <div className="mt-3 text-[10px] font-mono text-muted-foreground/70">{m.mglCitation}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Buildings size={14} />
                Live municipal context
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Town</div>
                  <div className="mt-2 text-sm font-semibold">{municipality?.name ?? (state.town || 'Choose a Massachusetts municipality')}</div>
                <div className="mt-1 text-xs text-muted-foreground">{municipality ? `${municipality.county} County · DOR ${municipality.dor_code}` : 'State data appears as soon as a recognized town is selected.'}</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">State spine</div>
                <div className="mt-2 text-sm font-semibold">{loadingMunicipalContext ? 'Pulling live state context…' : municipalContext ? `FY${municipalContext.fiscalYear} loaded` : 'Waiting for a town selection'}</div>
                <div className="mt-1 text-xs text-muted-foreground">DLS budget, free cash, employee count, and salary totals seed the build.</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Operating budget</div>
                <div className="mt-2 text-sm font-semibold">{formatMoney(municipalContext?.operatingBudget ?? null)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Public state data gives the module a grounded operating scale.</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Workforce context</div>
                <div className="mt-2 text-sm font-semibold">
                  {municipalContext?.totalEmployees?.toLocaleString() ?? '—'} employees · {formatMoney(municipalContext?.totalSalariesWages ?? null)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {municipalContext?.salariesPctBudget !== null && municipalContext?.salariesPctBudget !== undefined
                    ? `${municipalContext.salariesPctBudget.toFixed(1)}% of budget in public salary totals.`
                    : 'Salary share appears when the town has public personnel totals.'}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="font-semibold">Live centralized feed path</div>
                <p className="mt-1 leading-6">
                  The state pull seeds the module now. CivicPlus minutes, agendas, policies, and notices are the obvious live next layer —
                  once connected, that becomes real-time centralized governance data instead of a static setup form.
                </p>
              </div>

              {municipalContext && (
                <div className="mt-4 rounded-2xl border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Current pressure</div>
                  <div className="mt-2 text-sm font-medium">{municipalContext.pressure}</div>
                </div>
              )}

              {civicSourceLinks.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source paths</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {civicSourceLinks.map(link => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Link size={12} />
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected blueprint</div>
              {selectedModules.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                  Start with the quick stack or tap modules to build the blueprint.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {selectedModules.map(module => (
                    <div key={module.id} className="flex items-center gap-3 rounded-2xl border bg-muted/20 px-4 py-3">
                      <span className="text-lg">{MODULE_EMOJI[module.id] ?? '⚙️'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{module.name}</div>
                        <div className="text-xs text-muted-foreground">{module.domain}</div>
                      </div>
                      <CheckCircle size={16} className="text-emerald-500" weight="fill" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
