import { useState, useEffect } from 'react'
import { pjApi } from '@/services/pjApi'
import {
  GoogleLogo, MicrosoftOutlookLogo, FolderSimple, Link, UserPlus,
  CheckCircle, Warning, ArrowRight, X, Copy, Check,
  Robot, ArrowsClockwise, ChartBar, Lightning,
  EnvelopeSimple, ArrowRight as ArrowRightIcon, ClipboardText,
} from '@phosphor-icons/react'

const ENV_TREES: Record<string, string[]> = {
  civic:   ['Records', 'Permits', 'Meetings', 'Resolutions', 'Budgets', 'Zoning'],
  health:  ['Cases', 'Inspections', 'Vitals', 'Compliance', 'Programs'],
  ops:     ['WorkOrders', 'Assets', 'Fleet', 'ServiceRequests'],
  grants:  ['Applications', 'Awards', 'Budgets', 'Reports', 'Closeout'],
  stay:    ['Licensing', 'Inspections', 'Compliance', 'Revenue'],
}

type Provider = 'google' | 'microsoft'
type ShareRole = 'reader' | 'writer' | 'commenter'
type Tab = 'setup' | 'automations' | 'turnover' | 'reports'

interface ProvisionResult {
  rootId: string
  rootLink?: string
  rootUrl?: string
  driveId?: string
  folders: { name: string; id: string; link?: string; url?: string }[]
}

interface AutomationDef {
  id: string
  name: string
  description: string
  triggerType: string
  actionType: string
  enabled: boolean
  createdAt?: string
}

interface Props {
  environment: string
  onClose: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}
      className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
    >
      {copied ? <Check size={13} weight="bold" className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {icon}{label}
    </button>
  )
}

export function ProvisionDialog({ environment, onClose }: Props) {
  const folders = ENV_TREES[environment] ?? ['Documents']
  const envLabel = environment.charAt(0).toUpperCase() + environment.slice(1)
  const [tab, setTab] = useState<Tab>('setup')

  // ── Provider state ────────────────────────────────────────────────────────
  const [googleConnected, setGoogleConnected] = useState(false)
  const [microsoftConnected, setMicrosoftConnected] = useState(false)
  const [selectedProviders, setSelectedProviders] = useState<Set<Provider>>(new Set())
  const [loadingProviders, setLoadingProviders] = useState(true)

  // ── Setup state ───────────────────────────────────────────────────────────
  const [provisioning, setProvisioning] = useState(false)
  const [googleResult, setGoogleResult] = useState<ProvisionResult | null>(null)
  const [microsoftResult, setMicrosoftResult] = useState<ProvisionResult | null>(null)
  const [provisionErrors, setProvisionErrors] = useState<string[]>([])
  const [provisionDone, setProvisionDone] = useState(false)

  // ── Share state ───────────────────────────────────────────────────────────
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<ShareRole>('reader')
  const [shareProviders, setShareProviders] = useState<Set<Provider>>(new Set())
  const [sharing, setSharing] = useState(false)
  const [shareResult, setShareResult] = useState<string | null>(null)

  // ── Automations state ─────────────────────────────────────────────────────
  const [automationDefs, setAutomationDefs] = useState<AutomationDef[]>([])
  const [selectedAutos, setSelectedAutos] = useState<Set<string>>(new Set())
  const [activatingAutos, setActivatingAutos] = useState(false)
  const [autosDone, setAutosDone] = useState(false)
  const [autosError, setAutosError] = useState<string | null>(null)

  // ── Turnover state ────────────────────────────────────────────────────────
  const [departingEmail, setDepartingEmail] = useState('')
  const [successorEmail, setSuccessorEmail] = useState('')
  const [turnoverProviders, setTurnoverProviders] = useState<Set<Provider>>(new Set())
  const [transferring, setTransferring] = useState(false)
  const [turnoverResult, setTurnoverResult] = useState<{
    results: Record<string, { ok?: boolean; error?: string }>
    checklist: { items: string[] }
  } | null>(null)

  // ── Reports state ─────────────────────────────────────────────────────────
  const [generatingReport, setGeneratingReport] = useState(false)
  const [report, setReport] = useState<{
    generatedAt: string; summary: string; period: { start: string; end: string }
    prr?: { total: number; open: number; overdue: number; statute: string }
    deadlines?: { overdue: number; upcoming: number }
    automations?: { total: number; enabled: number }
  } | null>(null)

  useEffect(() => {
    pjApi.connectors.status().then(data => {
      const c = (data as { connectors: Record<string, { connected: boolean }> }).connectors ?? {}
      const gConn = c['google']?.connected ?? false
      const mConn = c['microsoft']?.connected ?? false
      setGoogleConnected(gConn)
      setMicrosoftConnected(mConn)
      const defaults = new Set<Provider>()
      if (gConn) defaults.add('google')
      if (mConn) defaults.add('microsoft')
      setSelectedProviders(defaults)
      setTurnoverProviders(defaults)
      setLoadingProviders(false)
    }).catch(() => setLoadingProviders(false))
  }, [])

  // Pre-load automation definitions when automations tab is opened
  useEffect(() => {
    if (tab === 'automations' && automationDefs.length === 0) {
      // Seed preview from backend (returns canned defs even without activating)
      pjApi.provision.automations({ environment, selected: [] })
        .then(res => {
          setAutomationDefs(res.automations)
          setSelectedAutos(new Set(res.automations.map(a => a.id)))
        })
        .catch(() => { /* show empty */ })
    }
  }, [tab, environment, automationDefs.length])

  const toggleProvider = (p: Provider, set: Set<Provider>, setter: (s: Set<Provider>) => void) => {
    const next = new Set(set)
    if (next.has(p)) { next.delete(p) } else { next.add(p) }
    setter(next)
  }

  // ── Setup: provision folders ───────────────────────────────────────────────
  const provision = async () => {
    if (selectedProviders.size === 0) return
    setProvisioning(true)
    setProvisionErrors([])
    try {
      const res = await pjApi.provision.create({ environment, providers: Array.from(selectedProviders) })
      const errors: string[] = [...(res.errors ?? [])]
      const isSuccess = (r: unknown): r is ProvisionResult =>
        !!r && typeof r === 'object' && 'rootId' in r && !('error' in r)
      if (isSuccess(res.google)) setGoogleResult(res.google)
      else if (res.google && 'error' in (res.google as object)) errors.push(`Google: ${(res.google as { error: string }).error}`)
      if (isSuccess(res.microsoft)) setMicrosoftResult(res.microsoft)
      else if (res.microsoft && 'error' in (res.microsoft as object)) errors.push(`Microsoft: ${(res.microsoft as { error: string }).error}`)
      if (errors.length) setProvisionErrors(errors)
      setProvisionDone(true)
      const sp = new Set<Provider>()
      if (isSuccess(res.google)) sp.add('google')
      if (isSuccess(res.microsoft)) sp.add('microsoft')
      setShareProviders(sp)
    } catch {
      setProvisionErrors(['Provisioning failed. Check your connection and try again.'])
    }
    setProvisioning(false)
  }

  const share = async () => {
    if (!shareEmail.trim() || shareProviders.size === 0) return
    setSharing(true)
    setShareResult(null)
    const results: string[] = []
    for (const provider of shareProviders) {
      const result = provider === 'google' ? googleResult : microsoftResult
      if (!result) continue
      const res = await pjApi.provision.share({
        provider, folderId: result.rootId, driveId: result.driveId,
        email: shareEmail.trim(), role: shareRole,
      })
      results.push(res.ok ? `✓ ${provider === 'google' ? 'Google Drive' : 'OneDrive'}` : `✗ ${provider === 'google' ? 'Google Drive' : 'OneDrive'}: ${res.error ?? 'failed'}`)
    }
    setShareResult(results.join('  '))
    setSharing(false)
    setShareEmail('')
  }

  // ── Automations: activate selected ────────────────────────────────────────
  const activateAutomations = async () => {
    if (selectedAutos.size === 0) return
    setActivatingAutos(true)
    setAutosError(null)
    try {
      await pjApi.provision.automations({ environment, selected: Array.from(selectedAutos) })
      setAutosDone(true)
    } catch {
      setAutosError('Failed to activate automations. Try again.')
    }
    setActivatingAutos(false)
  }

  // ── Turnover: transfer access ──────────────────────────────────────────────
  const doTurnover = async () => {
    if (!departingEmail.trim() || !successorEmail.trim() || turnoverProviders.size === 0) return
    setTransferring(true)
    setTurnoverResult(null)
    try {
      const res = await pjApi.provision.turnover({
        departing: departingEmail.trim(),
        successor: successorEmail.trim(),
        providers: Array.from(turnoverProviders),
        environment,
        googleFolderId: googleResult?.rootId,
        microsoftFolderId: microsoftResult?.rootId,
        microsoftDriveId: microsoftResult?.driveId,
      })
      setTurnoverResult(res)
    } catch {
      setTurnoverResult({ results: { error: { error: 'Transfer failed. Check connection.' } }, checklist: { items: [] } })
    }
    setTransferring(false)
  }

  // ── Reports: generate snapshot ─────────────────────────────────────────────
  const generateReport = async () => {
    setGeneratingReport(true)
    try {
      const res = await pjApi.provision.report(environment)
      setReport(res)
    } catch {
      setReport(null)
    }
    setGeneratingReport(false)
  }

  const providerAvailable = (p: Provider) => p === 'google' ? googleConnected : microsoftConnected
  const folderLink = (r: ProvisionResult) => r.rootLink ?? r.rootUrl ?? ''
  const subLink = (f: { link?: string; url?: string }) => f.link ?? f.url ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-white">Provision {envLabel}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Set up your cloud environment, automations, and compliance</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-zinc-800/60">
          <TabBtn active={tab === 'setup'} onClick={() => setTab('setup')} icon={<FolderSimple size={12} />} label="Setup" />
          <TabBtn active={tab === 'automations'} onClick={() => setTab('automations')} icon={<Robot size={12} />} label="Automations" />
          <TabBtn active={tab === 'turnover'} onClick={() => setTab('turnover')} icon={<ArrowsClockwise size={12} />} label="Turnover" />
          <TabBtn active={tab === 'reports'} onClick={() => setTab('reports')} icon={<ChartBar size={12} />} label="Reports" />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── SETUP TAB ─────────────────────────────────────────────────── */}
          {tab === 'setup' && (
            <>
              {/* Folder preview */}
              <div>
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2">Folders to create</p>
                <div className="flex flex-wrap gap-1.5">
                  {folders.map(f => (
                    <span key={f} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-300">
                      <FolderSimple size={11} className="text-zinc-500" />{f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Provider selection */}
              <div>
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2">Where to create</p>
                {loadingProviders ? (
                  <p className="text-xs text-zinc-500">Checking connections…</p>
                ) : (
                  <div className="flex gap-3 flex-wrap">
                    {(['google', 'microsoft'] as Provider[]).map(p => {
                      const available = providerAvailable(p)
                      const selected = selectedProviders.has(p)
                      return (
                        <button key={p} disabled={!available || provisionDone}
                          onClick={() => toggleProvider(p, selectedProviders, setSelectedProviders)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            !available ? 'opacity-30 cursor-not-allowed border-zinc-700 text-zinc-500'
                            : selected ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                          }`}
                        >
                          {p === 'google' ? <GoogleLogo size={16} weight="fill" className="text-[#4285F4]" /> : <MicrosoftOutlookLogo size={16} weight="fill" className="text-[#0078d4]" />}
                          {p === 'google' ? 'Google Drive' : 'OneDrive'}
                          {!available && <span className="text-[10px] text-zinc-600 ml-1">not connected</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                {!loadingProviders && !googleConnected && !microsoftConnected && (
                  <p className="text-xs text-zinc-500 mt-2">
                    <button className="text-blue-400 underline" onClick={() => pjApi.connectors.connect('google')}>Connect Google Drive</button>
                    {' or '}
                    <button className="text-blue-400 underline" onClick={() => pjApi.connectors.connect('microsoft')}>Connect OneDrive</button>
                  </p>
                )}
              </div>

              {/* Results */}
              {provisionDone && (
                <div className="space-y-3">
                  {provisionErrors.length > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-900/30 border border-red-700/50">
                      <Warning size={15} className="text-red-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-red-300 space-y-0.5">{provisionErrors.map((e, i) => <div key={i}>{e}</div>)}</div>
                    </div>
                  )}
                  {([['google', googleResult], ['microsoft', microsoftResult]] as [Provider, ProvisionResult | null][])
                    .filter(([, r]) => r)
                    .map(([p, r]) => (
                      <div key={p} className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle size={14} weight="fill" className="text-emerald-400" />
                            <span className="text-xs font-medium text-zinc-200">{p === 'google' ? 'Google Drive' : 'OneDrive'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={folderLink(r!)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300">
                              <Link size={11} /> Open root
                            </a>
                            <CopyButton text={folderLink(r!)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {(r!.folders ?? []).map(f => (
                            <div key={f.id} className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-900/60 text-[11px]">
                              <span className="text-zinc-400 flex items-center gap-1"><FolderSimple size={10} className="text-zinc-600" />{f.name}</span>
                              <div className="flex items-center gap-1">
                                <a href={subLink(f)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400"><ArrowRight size={10} weight="bold" /></a>
                                <CopyButton text={subLink(f)} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* Share after provisioning */}
              {provisionDone && (googleResult || microsoftResult) && (
                <div>
                  <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <UserPlus size={12} /> Add people
                  </p>
                  <div className="space-y-2">
                    <input type="email" placeholder="email@example.com" value={shareEmail}
                      onChange={e => setShareEmail(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                    <div className="flex items-center gap-2">
                      <select value={shareRole} onChange={e => setShareRole(e.target.value as ShareRole)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
                        <option value="reader">Can view</option>
                        <option value="commenter">Can comment</option>
                        <option value="writer">Can edit</option>
                      </select>
                      <div className="flex gap-1.5">
                        {(['google', 'microsoft'] as Provider[]).map(p => {
                          const result = p === 'google' ? googleResult : microsoftResult
                          if (!result) return null
                          const on = shareProviders.has(p)
                          return (
                            <button key={p} onClick={() => toggleProvider(p, shareProviders, setShareProviders)}
                              className={`p-2 rounded-lg border transition-colors ${on ? 'border-blue-500 bg-blue-500/15 text-blue-300' : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'}`}>
                              {p === 'google' ? <GoogleLogo size={14} weight="fill" /> : <MicrosoftOutlookLogo size={14} weight="fill" />}
                            </button>
                          )
                        })}
                      </div>
                      <button onClick={share} disabled={sharing || !shareEmail.trim() || shareProviders.size === 0}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-medium text-white transition-colors">
                        {sharing ? 'Adding…' : 'Share'}
                      </button>
                    </div>
                    {shareResult && <p className="text-[11px] text-zinc-400">{shareResult}</p>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── AUTOMATIONS TAB ───────────────────────────────────────────── */}
          {tab === 'automations' && (
            <>
              <div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Standard automations for {envLabel} — deadline monitors, reminders, and compliance reports. Select which ones to activate.
                </p>
              </div>

              {automationDefs.length === 0 ? (
                <div className="py-6 text-center text-zinc-600 text-xs">Loading automation definitions…</div>
              ) : (
                <div className="space-y-2">
                  {automationDefs.map(a => {
                    const on = selectedAutos.has(a.id)
                    const actionColors: Record<string, string> = {
                      flag: 'text-amber-400 bg-amber-500/10',
                      notify: 'text-blue-400 bg-blue-500/10',
                      report: 'text-purple-400 bg-purple-500/10',
                      checklist: 'text-emerald-400 bg-emerald-500/10',
                    }
                    return (
                      <button key={a.id} onClick={() => {
                        if (autosDone) return
                        const next = new Set(selectedAutos)
                        if (next.has(a.id)) { next.delete(a.id) } else { next.add(a.id) }
                        setSelectedAutos(next)
                      }}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          on ? 'border-zinc-600 bg-zinc-800/70' : 'border-zinc-800 bg-zinc-800/30 opacity-50'
                        } ${autosDone ? 'cursor-default' : 'hover:border-zinc-500 cursor-pointer'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'}`}>
                            {on && <Check size={10} weight="bold" className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-zinc-200">{a.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${actionColors[a.actionType] ?? 'text-zinc-400 bg-zinc-700'}`}>
                                {a.actionType}
                              </span>
                              <span className="text-[10px] text-zinc-600">{a.triggerType}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{a.description}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {autosError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/30 border border-red-700/50 text-xs text-red-300">
                  <Warning size={13} className="shrink-0" />{autosError}
                </div>
              )}

              {autosDone && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-xs text-emerald-300">
                  <CheckCircle size={14} weight="fill" className="shrink-0" />
                  {selectedAutos.size} automation{selectedAutos.size !== 1 ? 's' : ''} activated for {envLabel}
                </div>
              )}
            </>
          )}

          {/* ── TURNOVER TAB ──────────────────────────────────────────────── */}
          {tab === 'turnover' && (
            <>
              <div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Staff transition tool — revokes the departing employee's folder access and transfers it to their successor across all connected providers.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Departing employee email</label>
                  <div className="relative">
                    <EnvelopeSimple size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input type="email" placeholder="leaving@town.gov" value={departingEmail}
                      onChange={e => setDepartingEmail(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRightIcon size={16} className="text-zinc-600" weight="bold" />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Successor email</label>
                  <div className="relative">
                    <EnvelopeSimple size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input type="email" placeholder="successor@town.gov" value={successorEmail}
                      onChange={e => setSuccessorEmail(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Providers to transfer</label>
                  <div className="flex gap-2">
                    {(['google', 'microsoft'] as Provider[]).map(p => {
                      const available = providerAvailable(p)
                      const on = turnoverProviders.has(p)
                      return (
                        <button key={p} disabled={!available || !!turnoverResult}
                          onClick={() => toggleProvider(p, turnoverProviders, setTurnoverProviders)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            !available ? 'opacity-30 cursor-not-allowed border-zinc-800 text-zinc-600'
                            : on ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          }`}
                        >
                          {p === 'google' ? <GoogleLogo size={14} weight="fill" className="text-[#4285F4]" /> : <MicrosoftOutlookLogo size={14} weight="fill" className="text-[#0078d4]" />}
                          {p === 'google' ? 'Google Drive' : 'OneDrive'}
                        </button>
                      )
                    })}
                  </div>
                  {!provisionDone && (
                    <p className="text-[11px] text-zinc-600 mt-1.5">Provision folders first to enable folder-level transfer, or this will log the transition only.</p>
                  )}
                </div>
              </div>

              {turnoverResult && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    {Object.entries(turnoverResult.results).map(([key, val]) => (
                      <div key={key} className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${val.ok ? 'bg-emerald-900/20 border border-emerald-700/40 text-emerald-300' : 'bg-red-900/20 border border-red-700/40 text-red-300'}`}>
                        {val.ok ? <CheckCircle size={13} weight="fill" /> : <Warning size={13} />}
                        {key === 'google' ? 'Google Drive' : key === 'microsoft' ? 'OneDrive' : key}: {val.ok ? 'Transfer complete' : val.error ?? 'Failed'}
                      </div>
                    ))}
                  </div>

                  {turnoverResult.checklist.items.length > 0 && (
                    <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ClipboardText size={13} className="text-zinc-400" />
                        <span className="text-xs font-medium text-zinc-300">Transition Checklist</span>
                      </div>
                      <div className="space-y-1">
                        {turnoverResult.checklist.items.map((item, i) => (
                          <p key={i} className="text-[11px] text-zinc-500 font-mono leading-relaxed">{item}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── REPORTS TAB ───────────────────────────────────────────────── */}
          {tab === 'reports' && (
            <>
              <div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Compliance snapshot for {envLabel} — live counts of open records, overdue deadlines, and active automations.
                </p>
              </div>

              {!report && !generatingReport && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <ChartBar size={32} className="text-zinc-700" weight="duotone" />
                  <p className="text-xs text-zinc-500">Generate a real-time compliance snapshot for this environment.</p>
                </div>
              )}

              {report && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
                    <p className="text-xs font-medium text-zinc-200 mb-1">{report.summary}</p>
                    <p className="text-[11px] text-zinc-600">
                      Period: {report.period.start} – {report.period.end}
                    </p>
                  </div>

                  {report.prr && !('error' in report.prr) && (
                    <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 space-y-2">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Public Records Requests</p>
                      <div className="grid grid-cols-3 gap-2">
                        <StatCell label="Total" value={report.prr.total} />
                        <StatCell label="Open" value={report.prr.open} />
                        <StatCell label="Overdue" value={report.prr.overdue} urgent={report.prr.overdue > 0} />
                      </div>
                      <p className="text-[10px] text-zinc-600">{report.prr.statute}</p>
                    </div>
                  )}

                  {report.deadlines && !('error' in report.deadlines) && (
                    <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 space-y-2">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Deadlines</p>
                      <div className="grid grid-cols-2 gap-2">
                        <StatCell label="Overdue" value={report.deadlines.overdue} urgent={report.deadlines.overdue > 0} />
                        <StatCell label="Next 14 days" value={report.deadlines.upcoming} />
                      </div>
                    </div>
                  )}

                  {report.automations && (
                    <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 space-y-2">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Automations</p>
                      <div className="grid grid-cols-2 gap-2">
                        <StatCell label="Total" value={report.automations.total} />
                        <StatCell label="Enabled" value={report.automations.enabled} />
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-zinc-700">Generated {new Date(report.generatedAt).toLocaleString()}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            {provisionDone ? 'Close' : 'Cancel'}
          </button>

          {tab === 'setup' && !provisionDone && (
            <button onClick={provision} disabled={provisioning || selectedProviders.size === 0 || loadingProviders}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors">
              {provisioning
                ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Creating…</>
                : <><FolderSimple size={15} weight="bold" />Create Folders</>
              }
            </button>
          )}

          {tab === 'automations' && !autosDone && (
            <button onClick={activateAutomations} disabled={activatingAutos || selectedAutos.size === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors">
              {activatingAutos
                ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Activating…</>
                : <><Lightning size={15} weight="bold" />Activate {selectedAutos.size} Automation{selectedAutos.size !== 1 ? 's' : ''}</>
              }
            </button>
          )}

          {tab === 'turnover' && !turnoverResult && (
            <button onClick={doTurnover} disabled={transferring || !departingEmail.trim() || !successorEmail.trim() || turnoverProviders.size === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors">
              {transferring
                ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Transferring…</>
                : <><ArrowsClockwise size={15} weight="bold" />Transfer Access</>
              }
            </button>
          )}

          {tab === 'reports' && (
            <button onClick={generateReport} disabled={generatingReport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors">
              {generatingReport
                ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Generating…</>
                : <><ChartBar size={15} weight="bold" />{report ? 'Refresh Report' : 'Generate Report'}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value, urgent }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div className="flex flex-col items-center py-2 px-3 rounded-lg bg-zinc-900/60">
      <span className={`text-xl font-bold ${urgent ? 'text-red-400' : 'text-zinc-200'}`}>{value}</span>
      <span className="text-[10px] text-zinc-600 mt-0.5">{label}</span>
    </div>
  )
}
