import { useState, useMemo, useCallback, useEffect } from 'react'
import { MA_MUNICIPALITIES, type Municipality } from '@/data/maMunicipalities'
import { useKV } from '@/hooks/useKV'
import { pjApi } from '@/services/pjApi'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, ArrowSquareOut, Buildings, Globe, Star } from '@phosphor-icons/react'
import {
  type StaffRow, type BudgetLine, type FiscalSnapshot, type TownFinderPanelProps, type DocType,
  estimateFiscal, townWebsiteUrl, fmtNum,
  POPULATION_LIMIT, REGISTRY_TIMEOUT_MS, FISCAL_CACHE_TTL_MS,
} from './townfinderTypes'
import { DOC_TEMPLATES, DocPreviewModal, generateDocument } from './DocPreviewModal'
import { TownListPanel } from './TownListPanel'
import { TownDetailTabs } from './TownDetailTabs'

// ── Main panel ────────────────────────────────────────────────────────────────

export function TownFinderPanel({ onBack }: TownFinderPanelProps) {
  // Global active town (shared across all panels)
  const [activeTownCode, setActiveTownCode] = useKV<number | null>('logicworkspace-active-town', null)

  // Local UI state
  const [search, setSearch] = useState('')
  const [countyFilter, setCountyFilter] = useState<string>('all')
  const [tab, setTab] = useState<'overview' | 'staff' | 'budget' | 'docs' | 'connect'>('overview')
  const [showDetail, setShowDetail] = useState(false)

  // Data state
  const [fiscal, setFiscal] = useState<Record<number, FiscalSnapshot>>({})
  const [govInfo, setGovInfo] = useState<Record<number, { formOfGovt?: string; chiefOfficialTitle?: string; resTaxRate?: number; localReceipts?: number }>>({})
  const [staffRows, setStaffRows] = useState<StaffRow[]>([])
  const [staffSourcePages, setStaffSourcePages] = useState<string[]>([])
  const [staffScrapedAt, setStaffScrapedAt] = useState<string | null>(null)
  const [registryLoading, setRegistryLoading] = useState(false)
  const [dlsLoading, setDlsLoading] = useState(false)
  const [staffLoading, setStaffLoading] = useState(false)
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([])
  const [docPreview, setDocPreview] = useState<{ type: DocType; label: string; content: string } | null>(null)
  const [connectors, setConnectors] = useState<Record<string, boolean>>({})
  const [connectorsLoaded, setConnectorsLoaded] = useState(false)

  // Filtered towns list
  const towns = useMemo(
    () => MA_MUNICIPALITIES
      .filter(m => (m.population ?? 0) < POPULATION_LIMIT)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )

  const filtered = useMemo(() => {
    let list = towns
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.county.toLowerCase().includes(q))
    }
    if (countyFilter !== 'all') list = list.filter(t => t.county === countyFilter)
    return list
  }, [towns, search, countyFilter])

  const selectedTown = useMemo(
    () => (activeTownCode != null ? towns.find(t => t.dor_code === activeTownCode) ?? null : null),
    [towns, activeTownCode],
  )

  const selectedFiscal = useMemo(
    () => selectedTown ? (fiscal[selectedTown.dor_code] ?? estimateFiscal(selectedTown.population ?? 5000)) : null,
    [selectedTown, fiscal],
  )

  // ── Handlers ────────────────────────────────────────────────────────────────

  const applyFiscalMetrics = useCallback((
    town: Municipality,
    metrics: Record<string, unknown>,
    fiscalYear: number,
    computedAt?: string,
  ) => {
    const est = estimateFiscal(town.population ?? 5000)
    const m = metrics
    setFiscal(prev => ({
      ...prev,
      [town.dor_code]: {
        operatingBudget: (m.operatingBudget as number) ?? est.operatingBudget,
        totalEmployees:  (m.totalEmployees  as number) ?? est.totalEmployees,
        freeCash:        (m.certifiedFreeCash as number) ?? est.freeCash,
        stateAid:        (m.totalStateAid    as number) ?? (m.stateAid as number) ?? est.stateAid,
        debtService:     (m.debtService      as number) ?? est.debtService,
        fiscalYear,
        synced: true,
        computedAt,
      },
    }))
    // Store MMA governance extras
    if (m.formOfGovt || m.chiefOfficialTitle || m.resTaxRate || m.localReceipts) {
      setGovInfo(prev => ({
        ...prev,
        [town.dor_code]: {
          formOfGovt: m.formOfGovt as string | undefined,
          chiefOfficialTitle: m.chiefOfficialTitle as string | undefined,
          resTaxRate: m.resTaxRate as number | undefined,
          localReceipts: m.localReceipts as number | undefined,
        },
      }))
    }
  }, [])

  const syncFiscalDirect = useCallback(async (town: Municipality) => {
    // Check sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(`fiscal:${town.name}`)
      if (cached) {
        const { data, ts } = JSON.parse(cached) as { data: { metrics: Record<string, unknown>; fiscalYear: number; computedAt: string }; ts: number }
        if (Date.now() - ts < FISCAL_CACHE_TTL_MS && data.metrics) {
          applyFiscalMetrics(town, data.metrics, data.fiscalYear, data.computedAt)
          return
        }
      }
    } catch { /* sessionStorage unavailable */ }

    setDlsLoading(true)
    try {
      const data = await pjApi.fiscal.sync(town.name)
      if (data.metrics) {
        applyFiscalMetrics(town, data.metrics, data.fiscalYear, data.computedAt)
        try {
          sessionStorage.setItem(`fiscal:${town.name}`, JSON.stringify({ data, ts: Date.now() }))
        } catch { /* quota exceeded */ }
      }
    } catch {
      // DLS unavailable — estimates stay shown
    } finally {
      setDlsLoading(false)
    }
  }, [applyFiscalMetrics])

  const selectTown = useCallback((town: Municipality) => {
    setActiveTownCode(town.dor_code)
    setTab('overview')
    setStaffRows([])
    setStaffSourcePages([])
    setStaffScrapedAt(null)
    setBudgetLines([])
    setShowDetail(true)

    // Try PJ registry (with 3s timeout); fall through to direct DLS on any failure
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('registry timeout')), REGISTRY_TIMEOUT_MS)
    )

    setRegistryLoading(true)
    Promise.race([pjApi.registry.town(town.name), timeout])
      .then((data: Record<string, unknown>) => {
        const reg = data.fiscal as { metrics: Record<string, unknown>; fiscalYear: number; computedAt: string } | undefined
        if (reg?.metrics) {
          applyFiscalMetrics(town, reg.metrics, reg.fiscalYear, reg.computedAt)
          setRegistryLoading(false)
        } else {
          setRegistryLoading(false)
          void syncFiscalDirect(town)
        }
        const staff = data.staff as { employees: Array<{ name: string; title: string; email: string; phone?: string }>; sourcePages: string[]; scrapedAt?: string } | undefined
        if (staff?.employees?.length) {
          setStaffRows(staff.employees.map(e => ({
            name: e.name, title: e.title, department: '', email: e.email, phone: e.phone ?? '',
          })))
          setStaffSourcePages(staff.sourcePages)
          setStaffScrapedAt(staff.scrapedAt ?? null)
        }
      })
      .catch((err) => {
        console.error('[TownFinder] registry fetch failed:', err)
        setRegistryLoading(false)
        void syncFiscalDirect(town)
      })
  }, [setActiveTownCode, applyFiscalMetrics, syncFiscalDirect])

  const loadConnectors = useCallback(() => {
    pjApi.connectors.status()
      .then((d: unknown) => {
        const c = ((d as Record<string, unknown>)?.connectors as Record<string, { connected: boolean }>) ?? {}
        setConnectors(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.connected])))
        setConnectorsLoaded(true)
      })
      .catch(() => setConnectorsLoaded(true))
  }, [])

  const handleConnect = useCallback((provider: string) => {
    pjApi.connectors.connect(provider as 'microsoft' | 'google' | 'github')
      .then((d: unknown) => {
        const url = (d as Record<string, string>)?.authUrl
        if (url) window.location.href = url
      })
      .catch(() => toast.error(`Could not connect ${provider}`))
  }, [])

  const handleSaveToVault = useCallback(async (content: string, label: string) => {
    if (!selectedTown) return
    try {
      await pjApi.docs.create({
        name: `${label} — ${selectedTown.name}`,
        html: content,
      })
      toast.success('Saved to Vault')
      setDocPreview(null)
    } catch {
      toast.error('Failed to save to Vault')
    }
  }, [selectedTown])

  const openDoc = useCallback((type: DocType, town: Municipality, f: FiscalSnapshot) => {
    const template = DOC_TEMPLATES.find(t => t.type === type)!
    const content = generateDocument(type, town, f)
    setDocPreview({ type, label: template.label, content })
  }, [])

  const pullStaff = useCallback(async (town: Municipality) => {
    setStaffLoading(true)
    try {
      const data = await pjApi.civic.staff(town.name)
      if (data.employees?.length) {
        setStaffRows(data.employees.map(e => ({
          name: e.name, title: e.title, department: e.department ?? '', email: e.email, phone: e.phone ?? '',
        })))
        setStaffSourcePages(data.sourcePages ?? [])
        setStaffScrapedAt(new Date().toISOString())
        toast.success(`Found ${data.employees.length} staff contacts`)
      } else {
        toast.error(`No staff contacts found for ${town.name} — try importing a CSV`)
      }
    } catch {
      toast.error('Staff lookup failed — check your connection')
    } finally {
      setStaffLoading(false)
    }
  }, [])

  // Load connectors when Connect tab opens
  const handleTabChange = useCallback((t: typeof tab) => {
    setTab(t)
    if (t === 'connect' && !connectorsLoaded) loadConnectors()
  }, [connectorsLoaded, loadConnectors])

  // Auto-fetch fiscal data if a town is pre-selected on mount but has no data
  useEffect(() => {
    if (selectedTown && !fiscal[selectedTown.dor_code]) {
      void syncFiscalDirect(selectedTown)
    }
  }, [selectedTown?.dor_code]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render helpers ───────────────────────────────────────────────────────────

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'staff',    label: 'Staff' },
    { key: 'budget',   label: 'Budget' },
    { key: 'docs',     label: 'Documents' },
    { key: 'connect',  label: 'Connect' },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold">Town Finder</h1>
          <p className="text-[12px] text-muted-foreground hidden sm:block">
            {towns.length} Massachusetts towns · data updated daily from DLS and public websites
          </p>
        </div>
        {activeTownCode != null && selectedTown && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[12px] font-medium">
            <Star size={12} weight="fill" />
            Working in: {selectedTown.name}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* ── Town list (left col) ── */}
        <TownListPanel
          towns={towns}
          filtered={filtered}
          activeTownCode={activeTownCode}
          search={search}
          countyFilter={countyFilter}
          showDetail={showDetail}
          onSearch={setSearch}
          onCountyFilter={setCountyFilter}
          onSelectTown={selectTown}
        />

        {/* ── Town detail (right col on desktop, full on mobile) ── */}
        <div className={cn(
          'flex-1 flex flex-col overflow-hidden',
          !showDetail && 'hidden sm:flex',
        )}>
          {!selectedTown ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Buildings size={28} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">Select a town</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose any Massachusetts town to view its profile, staff, budget, and generate pre-filled documents.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Town header */}
              <div className="px-4 pt-3 pb-0 border-b flex-shrink-0">
                <div className="flex items-start gap-3 mb-3">
                  {/* Mobile back button */}
                  <button
                    className="sm:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground mt-0.5"
                    onClick={() => setShowDetail(false)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold">Town of {selectedTown.name}</h2>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        DOR #{selectedTown.dor_code}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {selectedTown.county} County · Pop. {fmtNum(selectedTown.population ?? 0)}
                    </p>
                  </div>
                  <a
                    href={townWebsiteUrl(selectedTown.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] text-primary hover:underline flex-shrink-0"
                  >
                    <Globe size={13} /> Website <ArrowSquareOut size={11} />
                  </a>
                </div>

                {/* Tabs */}
                <div className="flex gap-0 overflow-x-auto">
                  {tabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => handleTabChange(t.key)}
                      className={cn(
                        'px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap',
                        tab === t.key
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <TownDetailTabs
                tab={tab}
                selectedTown={selectedTown}
                selectedFiscal={selectedFiscal!}
                govInfo={govInfo}
                registryLoading={registryLoading}
                dlsLoading={dlsLoading}
                staffRows={staffRows}
                staffSourcePages={staffSourcePages}
                staffScrapedAt={staffScrapedAt}
                staffLoading={staffLoading}
                budgetLines={budgetLines}
                connectors={connectors}
                connectorsLoaded={connectorsLoaded}
                onSetStaffRows={setStaffRows}
                onSetStaffSourcePages={setStaffSourcePages}
                onSetBudgetLines={setBudgetLines}
                onOpenDoc={openDoc}
                onPullStaff={pullStaff}
                onSyncFiscal={syncFiscalDirect}
                onConnect={handleConnect}
                onLoadConnectors={loadConnectors}
                onTabChange={handleTabChange}
              />
            </>
          )}
        </div>
      </div>

      {/* Document preview modal */}
      <DocPreviewModal
        doc={docPreview}
        onClose={() => setDocPreview(null)}
        onSaveToVault={handleSaveToVault}
      />
    </div>
  )
}

