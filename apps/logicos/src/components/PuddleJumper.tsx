import { useState, useEffect, useRef, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MagnifyingGlass,
  Lightning,
  Link as LinkIcon,
  X,
  GithubLogo,
  Crown,
  Play,
  Question,
  Sliders,
  Shield,
  CircleNotch,
  ArrowSquareOut,
  Buildings,
  Megaphone,
  Vault,
  Plugs,
  ChartBar,
} from '@phosphor-icons/react'
import pjLogo from '@/assets/images/logo_Background_Removed.webp'
import { Automation, ToolKey } from '@/lib/types'
import { KeyboardShortcutsPanel } from './KeyboardShortcutsPanel'
import { pjApi } from '@/services/pjApi'

const PJ_ADMIN_URL = (import.meta.env.VITE_PJ_API_URL as string | undefined ?? 'https://api.publiclogic.org').replace(/\/$/, '') + '/pj/admin'

interface RepoResult {
  id: number
  name: string
  full_name: string
  description: string | null
  language: string | null
  stargazers_count: number
  html_url: string
  private: boolean
}

interface PuddleJumperProps {
  onSelectTool: (tool: ToolKey) => void
  onOpenConnections: () => void
  currentTool?: ToolKey | null
  enabledAutomations?: Automation[]
  onRunAutomation?: (id: string) => void
  canUseTool?: (key: string) => boolean
}

const MASCOT_SIZE = 160

const POPULAR_FLOWS: {
  id: string
  name: string
  desc: string
  from: string
  to: string
  provider: 'google' | 'microsoft' | 'both'
  icon: string
}[] = [
  { id: 'email-to-doc', name: 'Email → Save Attachment', desc: 'Auto-save email attachments to Drive or OneDrive', from: 'Gmail / Outlook', to: 'Drive / OneDrive', provider: 'both', icon: '📧' },
  { id: 'calendar-notes', name: 'Meeting → Auto Notes Doc', desc: 'Create a notes doc for every new calendar event', from: 'Google Calendar', to: 'Google Docs', provider: 'google', icon: '📅' },
  { id: 'form-to-task', name: 'Form Submission → Task', desc: 'Turn form responses into tasks in Planner or Tasks', from: 'Google Forms', to: 'Microsoft Planner', provider: 'both', icon: '📋' },
  { id: 'file-notify', name: 'New File → Email Alert', desc: 'Notify the team when a new file lands in a folder', from: 'SharePoint / Drive', to: 'Outlook / Gmail', provider: 'both', icon: '🔔' },
  { id: 'sheet-row-email', name: 'Sheet Row → Send Email', desc: 'Email someone when a new row is added to a spreadsheet', from: 'Google Sheets / Excel', to: 'Gmail / Outlook', provider: 'both', icon: '📊' },
  { id: 'starred-email-task', name: 'Starred Email → Task', desc: 'Flag an email and it becomes a task automatically', from: 'Gmail / Outlook', to: 'Google Tasks / To Do', provider: 'both', icon: '⭐' },
  { id: 'daily-digest', name: 'Daily Digest', desc: 'Morning summary of your calendar events and flagged emails', from: 'Calendar + Email', to: 'Gmail / Outlook', provider: 'both', icon: '☀️' },
  { id: 'approved-archive', name: 'Approved Doc → Archive', desc: 'When a doc is approved, move it to the archive folder', from: 'Drive / SharePoint', to: 'Vault Archive', provider: 'both', icon: '✅' },
  { id: 'event-reminder', name: 'Event → Reminder Email', desc: '24h before a calendar event, send a prep email', from: 'Outlook Calendar', to: 'Outlook / Gmail', provider: 'microsoft', icon: '🗓️' },
  { id: 'new-file-tag', name: 'New File → Auto-Tag & Route', desc: 'Auto-classify and route new files to the right folder', from: 'Drive / OneDrive', to: 'Drive / OneDrive', provider: 'both', icon: '🏷️' },
]

function Cmd({
  icon,
  label,
  sub,
  onClick,
  badge,
  active,
  locked,
  kbd,
  color,
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  onClick?: () => void
  badge?: React.ReactNode
  active?: boolean
  locked?: boolean
  kbd?: string
  color?: string
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group
        ${locked ? 'opacity-30 cursor-default' : 'cursor-pointer'}
        ${active && !locked
          ? 'bg-white/10 text-primary ring-1 ring-primary/20'
          : locked ? '' : 'hover:bg-white/6'
        }`}
    >
      <span className={`shrink-0 transition-colors ${active ? 'text-primary' : color ? color + ' group-hover:opacity-90' : 'text-white/50 group-hover:text-white/80'}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`text-sm font-medium leading-none ${active ? 'text-primary' : 'text-white/90'}`}>{label}</span>
        {sub && <span className="block text-[11px] text-white/35 mt-0.5 truncate">{sub}</span>}
      </span>
      {kbd && <kbd className="text-[9px] font-mono text-white/30 bg-white/8 border border-white/10 rounded px-1.5 py-0.5 shrink-0">{kbd}</kbd>}
      {badge}
    </button>
  )
}

function Section({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em]">{label}</span>
    </div>
  )
}

export const PuddleJumper = memo(function PuddleJumper({
  onSelectTool,
  onOpenConnections,
  currentTool,
  enabledAutomations = [],
  onRunAutomation,
  canUseTool = () => true,
}: PuddleJumperProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'tools' | 'flows' | 'system'>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  // Position state
  const [pos, setPos] = useState({ x: 24, y: 240 })
  const [isDragging, setIsDragging] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const didDrag = useRef(false)
  const lastPos = useRef({ x: 24, y: 240 })

  const [connectedProviders, setConnectedProviders] = useState<Record<string, boolean>>({})
  const [repoResults, setRepoResults] = useState<RepoResult[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const repoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pj_pos_v2')
      if (saved) {
        const p = JSON.parse(saved)
        setPos(p)
        lastPos.current = p
      }
    } catch { /* intentional */ }
  }, [])

  // Fetch connector status on open
  useEffect(() => {
    if (!isOpen) return
    pjApi.connectors.status()
      .then((data: unknown) => {
        const status: Record<string, boolean> = {}
        for (const [k, v] of Object.entries((data as Record<string,unknown>)?.connectors as Record<string,unknown> ?? {})) {
          status[k] = Boolean((v as Record<string,unknown>)?.connected)
        }
        setConnectedProviders(status)
      })
      .catch(() => {})
    setTimeout(() => searchRef.current?.focus(), 80)
  }, [isOpen])

  // Repo search
  useEffect(() => {
    if (!isOpen) return
    if (repoDebounceRef.current) clearTimeout(repoDebounceRef.current)
    const q = search.trim()
    if (!q) { setRepoResults([]); return }
    repoDebounceRef.current = setTimeout(() => {
      setRepoLoading(true)
      pjApi.github.get(`search/repositories?q=${encodeURIComponent(q)}&per_page=5`)
        .then((data: unknown) => setRepoResults(((data as Record<string,unknown>).items as RepoResult[]) ?? []))
        .catch(() => setRepoResults([]))
        .finally(() => setRepoLoading(false))
    }, 320)
    return () => { if (repoDebounceRef.current) clearTimeout(repoDebounceRef.current) }
  }, [search, isOpen])

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    didDrag.current = false
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    setIsDragging(true)
    fabRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.current.mx
    const dy = e.clientY - dragStart.current.my
    if (Math.sqrt(dx * dx + dy * dy) > 5) didDrag.current = true
    const nx = Math.max(0, Math.min(window.innerWidth - MASCOT_SIZE, dragStart.current.px + dx))
    const ny = Math.max(0, Math.min(window.innerHeight - MASCOT_SIZE, dragStart.current.py + dy))
    setPos({ x: nx, y: ny })
    lastPos.current = { x: nx, y: ny }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    fabRef.current?.releasePointerCapture(e.pointerId)

    // Snap to nearest edge
    const cx = lastPos.current.x + MASCOT_SIZE / 2
    const cy = lastPos.current.y + MASCOT_SIZE / 2
    const distLeft   = cx
    const distRight  = window.innerWidth - cx
    const distTop    = cy
    const distBottom = window.innerHeight - cy
    const minDist    = Math.min(distLeft, distRight, distTop, distBottom)

    const snapped = { ...lastPos.current }
    if (minDist === distLeft)        snapped.x = 16
    else if (minDist === distRight)  snapped.x = window.innerWidth - MASCOT_SIZE - 16
    else if (minDist === distTop)    snapped.y = 16
    else                             snapped.y = window.innerHeight - MASCOT_SIZE - 16

    setPos(snapped)
    lastPos.current = snapped
    localStorage.setItem('pj_pos_v2', JSON.stringify(snapped))

    if (!didDrag.current) setIsOpen(p => !p)
  }

  const handleClose = () => { setIsOpen(false); setSearch('') }
  const go = (tool: Parameters<typeof onSelectTool>[0]) => { onSelectTool(tool); handleClose() }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showShortcuts) setShowShortcuts(false)
        else if (isOpen) handleClose()
      }
      if (e.key === '?' && !isOpen && !showShortcuts) { e.preventDefault(); setShowShortcuts(true) }
      const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setIsOpen(p => !p) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, showShortcuts])

  const manualAutomations = enabledAutomations.filter(a => a.trigger === 'manual')
  const PROVIDERS = [
    { key: 'github',    label: 'GH',   fullName: 'GitHub' },
    { key: 'microsoft', label: 'M365', fullName: 'Microsoft 365' },
    { key: 'google',    label: 'Goog', fullName: 'Google Workspace' },
  ]
  const modKey = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
  const showRepos = search.trim().length > 0
  const isLive = Object.values(connectedProviders).some(Boolean)

  // Panel placement — prefer right of mascot, flip left if near edge
  const panelWidth = 340
  const panelLeft = pos.x + MASCOT_SIZE + 12 + panelWidth > window.innerWidth
    ? pos.x - panelWidth - 12
    : pos.x + MASCOT_SIZE + 12
  const panelTop = Math.max(8, Math.min(window.innerHeight - 600, pos.y - 8))

  const FlowsSection = () => (
    <>
      {manualAutomations.length > 0 && activeTab === 'flows' && (
        <>
          <Section label="Your Flows" />
          <div className="mx-2 rounded-xl bg-white/4 border border-white/6 p-1.5 space-y-0.5">
            {manualAutomations.slice(0, 4).map(auto => (
              <button key={auto.id}
                onClick={() => { setRunningId(auto.id); onRunAutomation?.(auto.id); setTimeout(() => setRunningId(null), 2500); handleClose() }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left
                  ${runningId === auto.id ? 'bg-primary/20' : 'hover:bg-white/6'}`}>
                {runningId === auto.id
                  ? <CircleNotch size={12} weight="bold" className="text-primary animate-spin shrink-0" />
                  : <Play size={12} weight="fill" className="text-primary/50 shrink-0" />}
                <span className="text-sm text-white/80 flex-1 truncate">{auto.name}</span>
                {auto.isPremium && <Crown size={10} weight="fill" className="text-amber-400 shrink-0" />}
              </button>
            ))}
            {manualAutomations.length > 4 && (
              <button onClick={() => go('automations')} className="w-full text-[11px] text-white/25 hover:text-white/50 text-center py-1">
                +{manualAutomations.length - 4} more →
              </button>
            )}
          </div>
        </>
      )}
      <Section label="Popular Flows" />
      <div className="mx-1 space-y-0.5 pb-1">
        {POPULAR_FLOWS.map(flow => {
          const isLocked = (flow.provider === 'google' && !connectedProviders.google) ||
                           (flow.provider === 'microsoft' && !connectedProviders.microsoft)
          return (
            <button key={flow.id}
              onClick={() => { onSelectTool('automations'); handleClose() }}
              className="relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/6 transition-colors text-left group overflow-hidden">
              {isLocked && (
                <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-end pr-3 z-10 pointer-events-none">
                  <span className="text-[11px]">🔒</span>
                </div>
              )}
              <span className="text-base shrink-0 leading-none">{flow.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white/90 truncate">{flow.name}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                    flow.provider === 'google'    ? 'bg-blue-500/20 text-blue-400' :
                    flow.provider === 'microsoft' ? 'bg-violet-500/20 text-violet-400' :
                                                    'bg-white/8 text-white/35'
                  }`}>
                    {flow.provider === 'google' ? 'Goog' : flow.provider === 'microsoft' ? 'M365' : 'Both'}
                  </span>
                </div>
                <div className="text-[11px] text-white/35 truncate">{flow.desc}</div>
                <div className="text-[10px] text-white/20 mt-0.5 truncate">{flow.from} → {flow.to}</div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <>
      {/* ── Mascot FAB ──────────────────────────────────────── */}
      <button
        ref={fabRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-[9000] touch-none outline-none select-none"
        style={{
          left: pos.x,
          top: pos.y,
          width: MASCOT_SIZE,
          height: MASCOT_SIZE,
          cursor: isDragging ? 'grabbing' : 'pointer',
          transition: isDragging ? 'none' : 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), top 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        aria-label="Open PuddleJumper"
        title={`PuddleJumper (${modKey}K)`}
      >
        <img
          src={pjLogo}
          alt="PJ"
          draggable={false}
          className="w-full h-full object-contain"
          style={{
            filter: isDragging
              ? 'drop-shadow(0 10px 28px rgba(99,102,241,0.28))'
              : isOpen
              ? 'drop-shadow(0 8px 22px rgba(99,102,241,0.24))'
              : 'drop-shadow(0 4px 14px rgba(99,102,241,0.16))',
            transition: isDragging ? 'none' : 'filter 0.3s ease',
            animation: !isDragging && !isOpen ? 'pj-float 3.2s ease-in-out infinite' : 'none',
          }}
        />
      </button>

      {/* Float + panel-in keyframes injected once */}
      <style>{`
        @keyframes pj-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes pj-panel-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>

      {/* ── Panel ───────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-[8800]" onClick={handleClose}>
          <div
            className="absolute flex flex-col overflow-hidden rounded-2xl"
            style={{
              left: panelLeft,
              top: panelTop,
              width: panelWidth,
              maxHeight: 'calc(100vh - 32px)',
              background: 'rgba(12, 14, 22, 0.88)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 28px 72px rgba(0,0,0,0.42), 0 1px 0 rgba(255,255,255,0.05) inset',
              animation: 'pj-panel-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8 shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(28,31,44,0.94) 0%, rgba(17,19,29,0.88) 100%)' }}
            >
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />
                <img src={pjLogo} alt="PJ" className="w-10 h-10 object-contain relative z-10"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(99,102,241,0.65))' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white leading-none">PuddleJumper</div>
                <div className="text-[10px] text-white/40 mt-0.5">Your command hub</div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close PuddleJumper" className="h-6 w-6 text-white/40 hover:text-white hover:bg-white/8 shrink-0" onClick={handleClose}>
                <X size={12} />
              </Button>
            </div>

            {/* Search bar */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <div className="relative">
                <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search repos or jump to…"
                  className="w-full h-9 pl-8 pr-8 text-sm bg-white/6 rounded-xl border border-white/8 outline-none focus:border-primary/50 focus:bg-white/8 text-white placeholder:text-white/25 transition-all"
                />
                {repoLoading
                  ? <CircleNotch size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
                  : search && <button aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50"><X size={11} /></button>
                }
              </div>
            </div>

            {/* Provider pills strip */}
            <div className="flex items-center gap-1.5 px-3 pb-2 shrink-0">
              {PROVIDERS.map(({ key, label, fullName }) => (
                <span key={key} title={fullName}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-semibold tracking-wide cursor-default select-none transition-colors
                    ${connectedProviders[key]
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/28'
                      : 'bg-white/5 text-white/20 hover:bg-white/8'}`}>
                  {label}
                </span>
              ))}
            </div>

            {/* Tab navigation */}
            {!showRepos && (
              <div className="flex gap-1 px-3 pb-2 shrink-0">
                {(['all', 'tools', 'flows', 'system'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`text-xs px-2.5 py-1 rounded-full capitalize transition-all
                      ${activeTab === tab
                        ? 'bg-white/12 text-white'
                        : 'text-white/35 hover:text-white/60'}`}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2">

              {/* Repo results */}
              {showRepos && (
                <>
                  {repoResults.length > 0 ? (
                    <>
                      <Section label="GitHub Repos" />
                      {repoResults.map(repo => (
                        <button key={repo.id} onClick={() => window.open(repo.html_url, '_blank')}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/6 transition-colors text-left group">
                          <GithubLogo size={14} className="text-white/40 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white/90 truncate">{repo.full_name || repo.name}</div>
                            {repo.description && <div className="text-[11px] text-white/30 truncate">{repo.description}</div>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {repo.language && <span className="text-[9px] px-1.5 py-0.5 bg-white/8 rounded text-white/40">{repo.language}</span>}
                            <ArrowSquareOut size={11} className="opacity-0 group-hover:opacity-40 text-white" />
                          </div>
                        </button>
                      ))}
                    </>
                  ) : !repoLoading && (
                    <p className="text-center text-xs text-white/25 py-6">No repos found for "{search}"</p>
                  )}
                </>
              )}

              {!showRepos && (
                <>
                  {/* Tools section */}
                  {(activeTab === 'all' || activeTab === 'tools') && (
                    <>
                      <Section label="Tools" />
                      <Cmd icon={<Vault size={15} weight="duotone" />} label="Vault" sub="Governed docs · audit trails" onClick={() => go('vault')} active={currentTool === 'vault'} locked={!canUseTool('vault')} color="text-sky-400" />
                      <Cmd icon={<Buildings size={15} weight="duotone" />} label="Environments" sub="Orgs · apps · bots · modules · forum" onClick={() => go('casespaces')} active={currentTool === 'casespaces' || currentTool === 'builder'} color="text-violet-400" />
                      <Cmd icon={<Plugs size={15} weight="duotone" />} label="LogicBridge" sub="CEMSCRM · Munis · legacy system connectors" onClick={() => go('logicbridge')} active={currentTool === 'logicbridge'} locked={!canUseTool('logicbridge')} color="text-indigo-400" />
                      <Cmd icon={<Lightning size={15} weight="duotone" />} label="Flows" sub="Automations · workflows" onClick={() => go('automations')} active={currentTool === 'automations'} locked={!canUseTool('automations')} color="text-amber-400"
                        badge={enabledAutomations.length > 0
                          ? <Badge className="text-[10px] px-1.5 py-0 h-4 ml-auto bg-orange-500/20 text-orange-400 border-0">{enabledAutomations.length} on</Badge>
                          : undefined}
                      />
                      <Cmd icon={<Megaphone size={15} weight="duotone" />} label="CivicPulse™" sub="Approval queue · audit chain" onClick={() => go('civicpulse')} active={currentTool === 'civicpulse'} locked={!canUseTool('civicpulse')} color="text-emerald-400" />
                      <Cmd icon={<ChartBar size={15} weight="duotone" />} label="LogicDash" sub="Financial intelligence · trends · benchmarks" onClick={() => go('logicdash')} active={currentTool === 'logicdash'} locked={!canUseTool('logicdash')} color="text-cyan-400" />
                      <Cmd icon={<span className="text-sm">🦆</span>} label="Puddles" sub="Operator chat · live PJ tools" onClick={() => go('puddles')} active={currentTool === 'puddles'} locked={!canUseTool('puddles')} color="text-emerald-300" />
                    </>
                  )}

                  {/* Quick Run in all tab */}
                  {activeTab === 'all' && manualAutomations.length > 0 && (
                    <>
                      <Section label="Quick Run" />
                      <div className="mx-2 rounded-xl bg-white/4 border border-white/6 p-1.5 space-y-0.5">
                        {manualAutomations.slice(0, 4).map(auto => (
                          <button key={auto.id}
                            onClick={() => { setRunningId(auto.id); onRunAutomation?.(auto.id); setTimeout(() => setRunningId(null), 2500); handleClose() }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left
                              ${runningId === auto.id ? 'bg-primary/20' : 'hover:bg-white/6'}`}>
                            {runningId === auto.id
                              ? <CircleNotch size={12} weight="bold" className="text-primary animate-spin shrink-0" />
                              : <Play size={12} weight="fill" className="text-primary/50 shrink-0" />}
                            <span className="text-sm text-white/80 flex-1 truncate">{auto.name}</span>
                            {auto.isPremium && <Crown size={10} weight="fill" className="text-amber-400 shrink-0" />}
                          </button>
                        ))}
                        {manualAutomations.length > 4 && (
                          <button onClick={() => go('automations')} className="w-full text-[11px] text-white/25 hover:text-white/50 text-center py-1">
                            +{manualAutomations.length - 4} more →
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Popular Flows */}
                  {(activeTab === 'all' || activeTab === 'flows') && <FlowsSection />}

                  {/* System section */}
                  {(activeTab === 'all' || activeTab === 'system') && (
                    <>
                      <Section label="System" />
                      <Cmd icon={<LinkIcon size={15} weight="duotone" />} label="Connections" onClick={onOpenConnections} />
                      <Cmd icon={<Sliders size={15} weight="duotone" />} label="Settings" onClick={() => go('settings')} active={currentTool === 'settings'} />
                      <Cmd icon={<Shield size={15} weight="duotone" />} label="Admin" onClick={() => go('admin')} active={currentTool === 'admin'} />
                      <Cmd icon={<ArrowSquareOut size={15} weight="duotone" />} label="PJ Admin Portal" sub="Governance · approvals · audit" onClick={() => { window.open(PJ_ADMIN_URL, '_blank', 'noopener'); handleClose() }} />
                      <Cmd icon={<Question size={15} weight="duotone" />} label="Keyboard Shortcuts" onClick={() => { setShowShortcuts(true); setIsOpen(false) }} kbd="?" />
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/6 shrink-0">
              <kbd className="text-[9px] font-mono text-white/20 bg-white/5 border border-white/8 rounded px-1.5 py-0.5">{modKey}K</kbd>
              <span className="text-[9px] text-white/15 font-mono">publiclogic.org</span>
              <div className={`flex items-center gap-1.5 text-[10px] ${isLive ? 'text-emerald-400/70' : 'text-orange-400/70'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'}`} />
                {isLive ? 'Live' : 'Degraded'}
              </div>
            </div>
          </div>
        </div>
      )}

      <KeyboardShortcutsPanel isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </>
  )
})
