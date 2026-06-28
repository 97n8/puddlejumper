// LogicDASH-MA — Massachusetts DLS Fiscal Intelligence
// Connects to MA Division of Local Services datasets (Schedule A, Cherry Sheets,
// Free Cash, Levy Limits, Debt Analysis) via PuddleJumper backend.

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  Buildings, ArrowsClockwise,
  ChartBar, CurrencyDollar,
  CalendarBlank, CloudArrowDown,
  GraduationCap, Umbrella, Signpost, Tree, Gavel, Heartbeat,
  Sparkle, Star, Clock, CheckCircle, MapPin,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'
import type { Municipality } from '@/data/maMunicipalities'
import { pjApi } from '@/services/pjApi'

import type { FiscalSnapshot, ApiSnapshot, HealthStatus, DomainId } from '../types'
import {
  getSavedMuniCode, saveMuniCode, clearSavedMuniCode,
  fiscalFetch, buildPreviewSnapshot, apiToSnapshot,
  buildHistoricalSnapshot, fmtDate, DEMO_SNAPSHOT,
} from '../utils'
import { SnapshotTab } from './SnapshotTab'
import { RiskFlagsTab } from './RiskFlagsTab'
import { PeersTab } from './PeersTab'
import { TrendsTab } from './TrendsTab'
import { ForecastTab } from './ForecastTab'
import { SyncTab } from './SyncTab'
import { EducationPanel } from './EducationPanel'
import { RetirementPanel } from './RetirementPanel'
import { InfraPanel } from './InfraPanel'
import { EnvPanel } from './EnvPanel'
import { ParcelsPanel } from './ParcelsPanel'
import { GovernancePanel } from './GovernancePanel'
import { HealthPanel } from './HealthPanel'
import { IntelligencePanel } from './IntelligencePanel'


const MUNICIPALITIES = MA_MUNICIPALITIES

const HEALTH_CFG: Record<HealthStatus, { label: string; dot: string; badge: string }> = {
  HEALTHY: { label: 'Steady',           dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  CAUTION: { label: 'On Watch',         dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  AT_RISK: { label: 'Needs Attention',  dot: 'bg-red-500',     badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
}

const DOMAINS: { id: DomainId; label: string; helper: string; Icon: React.ElementType; badge?: string }[] = [
  { id: 'fiscal',       label: 'Fiscal',         helper: 'Reserve strength, levy room, debt, and peer context without digging through state reports.', Icon: CurrencyDollar },
  { id: 'education',    label: 'Education',      helper: 'School finance and enrollment pressure in the same municipal frame.', Icon: GraduationCap },
  { id: 'retirement',   label: 'Retirement',     helper: 'Retirement obligations and long-tail workforce cost pressure.', Icon: Umbrella },
  { id: 'infra',        label: 'Infrastructure', helper: 'Roads, utilities, and capital readiness signals in one place.', Icon: Signpost },
  { id: 'env',          label: 'Environment',    helper: 'Stormwater, environmental compliance, and permit-sensitive conditions.', Icon: Tree },
  { id: 'parcels',      label: 'Parcels',        helper: 'Parcel, zoning, and geography context tied back to town operations.', Icon: MapPin },
  { id: 'governance',   label: 'Governance',     helper: 'Boards, bylaws, appointments, packets, and meeting-law context.', Icon: Gavel },
  { id: 'health',       label: 'Health',         helper: 'Community health indicators that affect public service pressure.', Icon: Heartbeat },
  { id: 'intelligence', label: 'PJ',             helper: 'Your workspace copilot — drives, quick actions, and cross-domain signals in one place.', Icon: Sparkle, badge: '4' },
]

// ── Main Panel ────────────────────────────────────────────────────────────────

type Tab = 'snapshot' | 'risk' | 'peers' | 'trends' | 'forecast' | 'sync'

function getRequestedTownCode() {
  const params = new URLSearchParams(window.location.search)
  const requestedTown = params.get('town')
  if (!requestedTown) return null
  const townCode = Number(requestedTown)
  return Number.isFinite(townCode) ? townCode : null
}

function getRequestedDomain(): DomainId | null {
  const params = new URLSearchParams(window.location.search)
  const domain = params.get('domain')
  if (!domain) return null
  return DOMAINS.some(candidate => candidate.id === domain) ? domain as DomainId : null
}

function getRequestedTab(): Tab | null {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  if (!tab) return null
  return ['snapshot', 'risk', 'peers', 'trends', 'forecast', 'sync'].includes(tab) ? tab as Tab : null
}

function getRequestedAutoSync() {
  const params = new URLSearchParams(window.location.search)
  return params.get('autosync') === '1' || params.get('sync') === '1'
}

export function LogicDASHPanel({
  initialSelectedCode,
  initialActiveDomain,
  initialTab,
  autoSync = false,
  onSelectedCodeChange,
  allowedDomains,
  hasFormKeyAccess = true,
}: {
  initialSelectedCode?: number
  initialActiveDomain?: DomainId
  initialTab?: Tab
  autoSync?: boolean
  onSelectedCodeChange?: (code: number | null) => void
  allowedDomains?: DomainId[]
  hasFormKeyAccess?: boolean
} = {}) {
  const savedOnMount = getSavedMuniCode()
  const requestedTownCode = getRequestedTownCode()
  const requestedDomain = getRequestedDomain()
  const requestedTab = getRequestedTab()
  const requestedAutoSync = getRequestedAutoSync()
  const availableDomains = useMemo(
    () => (allowedDomains?.length ? DOMAINS.filter((domain) => allowedDomains.includes(domain.id)) : DOMAINS),
    [allowedDomains]
  )
  const defaultDomain = availableDomains[0]?.id ?? 'fiscal'
  const requestedInitialDomain = initialActiveDomain ?? requestedDomain ?? 'fiscal'
  const [selectedCode, setSelectedCode] = useState<number | null>(initialSelectedCode ?? requestedTownCode ?? savedOnMount ?? null)
  const [isSaved, setIsSaved] = useState<boolean>(savedOnMount !== null)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? requestedTab ?? 'snapshot')
  const [activeDomain, setActiveDomain] = useState<DomainId>(
    availableDomains.some((domain) => domain.id === requestedInitialDomain) ? requestedInitialDomain : defaultDomain
  )
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(DEMO_SNAPSHOT.fiscal_year)
  const [syncing, setSyncing] = useState(false)
  const [snap, setSnap] = useState<FiscalSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [noData, setNoData] = useState(false)
  const [isPreview, setIsPreview] = useState(true)
  const [townPickerOpen, setTownPickerOpen] = useState(false)
  const [townQuery, setTownQuery] = useState('')
  const autoSyncedCodeRef = useRef<number | null>(null)

  const selectedMuni = MUNICIPALITIES.find(m => m.dor_code === selectedCode) ?? null

  const loadSnapshot = useCallback(async (muni: Municipality) => {
    setSnap(buildPreviewSnapshot(muni))
    setIsPreview(true)
    setNoData(false)
    setLoading(false)

    // Try PJ registry to immediately replace preview with real MMA data
    try {
      const pjData = await Promise.race([
        pjApi.registry.town(muni.name),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8_000)),
      ]) as Record<string, unknown>
      const regFiscal = pjData?.fiscal as { metrics: Record<string, unknown>; fiscalYear: number } | null
      if (regFiscal?.metrics) {
        const m = regFiscal.metrics
        const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null)
        setSnap(prev => {
          if (!prev) return prev
          return {
            ...prev,
            fiscal_year: num(m.fiscalYear) ?? num(regFiscal.fiscalYear) ?? prev.fiscal_year,
            operating_budget: num(m.operatingBudget) ?? prev.operating_budget,
            total_employees: num(m.totalEmployees) ?? prev.total_employees,
            total_state_aid: num(m.totalStateAid) ?? num(m.stateAid) ?? prev.total_state_aid,
            actual_levy: num(m.totalLevy) ?? prev.actual_levy,
            excess_levy_capacity: num(m.excessLevyCapacity) ?? prev.excess_levy_capacity,
            free_cash: num(m.certifiedFreeCash) ?? prev.free_cash,
            total_salaries_wages: num(m.totalSalariesWages) ?? prev.total_salaries_wages,
            source_tier: 3,
            sync_log: [{
              id: `mma-${muni.dor_code}`,
              timestamp: new Date().toISOString(),
              status: 'NEW' as const,
              datasets: ['mma-registry'],
              source_tier: 3,
              message: 'MMA Registry — real fiscal data loaded',
            }, ...prev.sync_log],
          }
        })
        setIsPreview(false)
      }
    } catch {
      // Registry miss or timeout — preview stays, user can click Sync for DLS data
    }
  }, [])

  // Load snapshot when selected municipality changes
  useEffect(() => {
    if (selectedMuni) loadSnapshot(selectedMuni)
    else setSnap(null)
  }, [selectedCode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialSelectedCode !== undefined) setSelectedCode(initialSelectedCode)
  }, [initialSelectedCode])

  useEffect(() => {
    onSelectedCodeChange?.(selectedCode)
  }, [onSelectedCodeChange, selectedCode])

  useEffect(() => {
    if (snap) {
      setSelectedFiscalYear(snap.fiscal_year)
    }
  }, [snap])

  const availableFiscalYears = useMemo(() => (
    snap
      ? Array.from(new Set([snap.fiscal_year, ...snap.trends.map(entry => entry.fy)])).sort((a, b) => b - a)
      : []
  ), [snap])

  const displaySnap = useMemo(() => (
    snap ? buildHistoricalSnapshot(snap, selectedFiscalYear) : null
  ), [snap, selectedFiscalYear])
  const activeDomainConfig = availableDomains.find((domain) => domain.id === activeDomain) ?? availableDomains[0]

  useEffect(() => {
    if (!availableDomains.some((domain) => domain.id === activeDomain)) {
      setActiveDomain(defaultDomain)
      setActiveTab('snapshot')
    }
  }, [activeDomain, availableDomains, defaultDomain])

  const health = displaySnap ? HEALTH_CFG[displaySnap.overall_health] : HEALTH_CFG['HEALTHY']
  const criticalCount = displaySnap?.risk_flags.filter(f => f.severity === 'critical').length ?? 0
  const warningCount  = displaySnap?.risk_flags.filter(f => f.severity === 'warning').length ?? 0

  const handleSync = useCallback(async () => {
    if (!selectedMuni) return
    setSyncing(true)
    toast.loading(`Fetching DLS data for ${selectedMuni.name}…`, { id: 'dls-sync' })
    try {
      const res = await fiscalFetch('/api/fiscal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedMuni.name }),
      })
      if (res.status === 404) {
        toast.error(`${selectedMuni.name} not found in DLS — check the municipality name.`, { id: 'dls-sync' })
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; detail?: string }
        throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as ApiSnapshot
      setSnap(apiToSnapshot(data, selectedMuni))
      setIsPreview(false)
      setNoData(false)
      toast.success(`${selectedMuni.name} synced from DLS — FY${data.fiscalYear} data loaded`, { id: 'dls-sync' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Sync failed: ${msg}`, { id: 'dls-sync' })
    } finally {
      setSyncing(false)
    }
  }, [selectedMuni])

  useEffect(() => {
    if (!(autoSync || requestedAutoSync) || syncing || autoSyncedCodeRef.current === selectedCode) return
    autoSyncedCodeRef.current = selectedCode
    void handleSync()
  }, [autoSync, requestedAutoSync, selectedCode, syncing, handleSync])

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'snapshot', label: 'Snapshot' },
    { id: 'risk',     label: 'Risk', badge: criticalCount + warningCount || undefined },
    { id: 'peers',    label: 'Peers' },
    { id: 'trends',   label: 'Trends' },
    { id: 'forecast', label: 'Scenarios' },
    { id: 'sync',     label: 'Source trail' },
  ]

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">

      {/* ── Empty state — no town selected ─────────────────────────────────── */}
      {!selectedMuni && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="rounded-full bg-primary/10 p-5">
            <Buildings size={40} className="text-primary" weight="duotone" />
          </div>
          <div className="max-w-sm space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Pick a municipality</h2>
            <p className="text-sm text-muted-foreground">
              LogicDASH shows fiscal health, risk flags, peer benchmarks, and trends for any Massachusetts town. Choose one to get started.
            </p>
          </div>
          <Popover open={townPickerOpen} onOpenChange={setTownPickerOpen}>
            <PopoverTrigger asChild>
              <Button className="h-10 min-w-[260px] justify-between rounded-full px-4 text-sm font-semibold" variant="outline">
                <span>Search Massachusetts towns…</span>
                <Buildings size={16} className="shrink-0 text-primary" weight="duotone" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-[340px] p-0">
              <Command shouldFilter>
                <CommandInput placeholder="Search towns or DOR code..." value={townQuery} onValueChange={setTownQuery} />
                <CommandList className="max-h-[320px]">
                  <CommandEmpty>No municipalities found.</CommandEmpty>
                  <CommandGroup heading="Massachusetts municipalities">
                    {MUNICIPALITIES.map(m => (
                      <CommandItem key={m.dor_code} value={`${m.name} ${m.county} ${m.dor_code}`}
                        onSelect={() => { setSelectedCode(m.dor_code); setTownPickerOpen(false); setTownQuery('') }}
                        className="items-start gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{m.name}</span>
                            {m.is_client && <span className="rounded bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground">CLIENT</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{m.county} County · DOR {m.dor_code}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground/60">Your choice won't be saved unless you click "Save as default"</p>
        </div>
      )}

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      {selectedMuni && (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="border-b bg-muted/10 px-4 py-4 shrink-0">
          <div className="rounded-[24px] border bg-card/95 p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0 space-y-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  <ChartBar size={12} weight="duotone" />
                  LogicDASH
                </span>

                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                    {selectedMuni.name} {activeDomain === 'fiscal' ? 'fiscal overview' : `${activeDomainConfig.label.toLowerCase()} overview`}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {activeDomainConfig.helper}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {displaySnap && (
                    <span className={cn('flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold', health.badge)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', health.dot)} />
                      {health.label}
                    </span>
                  )}
                  {displaySnap && !loading && (
                    <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {isPreview ? 'Demo data' : 'Live data'}
                    </span>
                  )}
                  {displaySnap && (
                    <div className="flex items-center gap-1.5 rounded-full border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                      <Clock size={12} />
                      {displaySnap.fiscal_year === snap?.fiscal_year ? `Synced ${fmtDate(displaySnap.ingested_at)}` : `Historical FY${displaySnap.fiscal_year}`}
                    </div>
                  )}
                  {loading && <span className="text-xs text-muted-foreground">Loading current town…</span>}
                  {noData && !loading && <span className="text-xs font-medium text-amber-600">No live file yet — sync to load</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Popover open={townPickerOpen} onOpenChange={setTownPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 min-w-[240px] justify-between rounded-full px-3 text-left">
                      <span className="min-w-0 truncate text-sm font-semibold">{selectedMuni.name}</span>
                      <Buildings size={15} className="shrink-0 text-primary" weight="duotone" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[340px] p-0">
                    <Command shouldFilter>
                      <CommandInput
                        placeholder="Search towns or DOR code..."
                        value={townQuery}
                        onValueChange={setTownQuery}
                      />
                      <CommandList className="max-h-[320px]">
                        <CommandEmpty>No municipalities found.</CommandEmpty>
                        <CommandGroup heading="Massachusetts municipalities">
                          {MUNICIPALITIES.map(m => (
                            <CommandItem
                              key={m.dor_code}
                              value={`${m.name} ${m.county} ${m.dor_code}`}
                              onSelect={() => {
                                setSelectedCode(m.dor_code)
                                setTownPickerOpen(false)
                                setTownQuery('')
                              }}
                              className="items-start gap-3 py-2"
                            >
                              <div className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', selectedCode === m.dor_code ? 'bg-primary' : 'bg-muted-foreground/30')} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">{m.name}</span>
                                  {m.is_client && <span className="rounded bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground">CLIENT</span>}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {m.county} County · DOR {m.dor_code}
                                </div>
                              </div>
                              {selectedCode === m.dor_code && <CheckCircle size={14} className="mt-0.5 shrink-0 text-primary" weight="fill" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {activeDomain === 'fiscal' && displaySnap && (
                  <Select value={String(selectedFiscalYear)} onValueChange={(value) => setSelectedFiscalYear(Number(value))}>
                    <SelectTrigger size="sm" className="h-8 rounded-full border bg-muted/20 text-xs">
                      <CalendarBlank size={12} className="text-primary" />
                      <SelectValue placeholder="Fiscal year" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFiscalYears.map(year => (
                        <SelectItem key={year} value={String(year)}>
                          FY{year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button size="sm" variant="outline" className="h-8 rounded-full gap-1.5 text-xs" onClick={handleSync} disabled={syncing}>
                  <ArrowsClockwise size={13} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing…' : isPreview ? 'Sync live' : 'Refresh'}
                </Button>

                {/* Save / Clear persistent municipality */}
                {!isSaved ? (
                  <Button size="sm" variant="ghost" className="h-8 rounded-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { saveMuniCode(selectedCode!); setIsSaved(true); toast.success(`${selectedMuni.name} saved as your default`) }}>
                    <Star size={13} />
                    Save as default
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-8 rounded-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { clearSavedMuniCode(); setIsSaved(false); toast('Default cleared — starts fresh next time') }}>
                    <Star size={13} weight="fill" className="text-primary" />
                    Saved · clear
                  </Button>
                )}

                <Button size="sm" variant="ghost" className="h-8 rounded-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { clearSavedMuniCode(); setIsSaved(false); setSelectedCode(null) }}>
                  Change town
                </Button>
              </div>
            </div>

            {/* Domain nav — compact single row, no section labels */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
               {availableDomains.map(d => (
                 <button
                   key={d.id}
                   onClick={() => { setActiveDomain(d.id); setActiveTab('snapshot') }}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    activeDomain === d.id
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-transparent bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <d.Icon size={11} />
                  {d.label}
                  {d.badge && <span className="rounded-full bg-amber-500 px-1 py-0.5 text-[8px] font-bold text-white leading-none">{d.badge}</span>}
                </button>
              ))}
              {activeDomain === 'fiscal' && (
                <>
                  <div className="h-4 w-px bg-border mx-1" />
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        activeTab === tab.id
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-transparent bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      {tab.label}
                      {tab.badge !== undefined && (
                        <span className={cn('rounded-full px-1 py-0.5 text-[8px] font-bold leading-none', activeTab === tab.id ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground')}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            {loading && (
              <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
                <ArrowsClockwise size={28} className="animate-spin text-primary" />
                <span className="text-sm">Loading fiscal data…</span>
              </div>
            )}
            {!loading && noData && (
              <div className="flex h-64 flex-col items-center justify-center gap-4 px-8 text-center">
                <CloudArrowDown size={36} className="text-muted-foreground/50" />
                <div>
                  <div className="mb-1 text-sm font-semibold">No data for {selectedMuni.name}</div>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Pull Massachusetts state finance data to view this town’s live dashboard.
                  </p>
                </div>
                <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
                  <ArrowsClockwise size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing from DLS…' : 'Sync from DLS'}
                </Button>
              </div>
            )}
            {activeDomain === 'fiscal' && !loading && displaySnap && activeTab === 'snapshot' && <SnapshotTab snap={displaySnap} />}
            {activeDomain === 'fiscal' && !loading && displaySnap && activeTab === 'risk'     && <RiskFlagsTab flags={displaySnap.risk_flags} />}
            {activeDomain === 'fiscal' && !loading && displaySnap && activeTab === 'peers'    && <PeersTab snap={displaySnap} />}
            {activeDomain === 'fiscal' && !loading && displaySnap && activeTab === 'trends'   && <TrendsTab snap={displaySnap} />}
            {activeDomain === 'fiscal' && !loading && displaySnap && activeTab === 'forecast' && <ForecastTab snap={displaySnap} />}
            {activeDomain === 'fiscal' && !loading && displaySnap && activeTab === 'sync'     && <SyncTab snap={displaySnap} onSync={handleSync} />}
            {activeDomain === 'education'    && <EducationPanel />}
            {activeDomain === 'retirement'   && <RetirementPanel />}
            {activeDomain === 'infra'        && <InfraPanel />}
            {activeDomain === 'env'          && <EnvPanel />}
            {activeDomain === 'parcels'      && <ParcelsPanel />}
            {activeDomain === 'governance'   && <GovernancePanel municipality={selectedMuni} snap={displaySnap} hasFormKeyAccess={hasFormKeyAccess} />}
            {activeDomain === 'health'       && <HealthPanel />}
            {activeDomain === 'intelligence' && <IntelligencePanel />}
          </ScrollArea>
        </div>
      </div>
      )}
    </div>
  )
}
