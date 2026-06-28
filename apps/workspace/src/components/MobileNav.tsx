import { useState, memo } from 'react'
import { cn } from '@/lib/utils'
import type { Icon } from '@phosphor-icons/react'
import {
  House, ChartBar, Tray, DotsThree,
  Vault, Gear, FolderOpen, Desktop,
  ShieldCheck,
  Megaphone,
  FolderSimple, Wrench,
  CurrencyDollar, ClockCountdown, MapPin,
  CalendarCheck, ArrowsOut, CaretRight, ArrowSquareOut,
  Lightning, ShoppingCart, PuzzlePiece,
  ClipboardText, Robot, Plugs, TerminalWindow,
} from '@phosphor-icons/react'
import type { ViewMode } from '@/hooks/useMobileMode'
import type { ToolKey } from '@/lib/types'

interface MobileNavProps {
  activeTool: ToolKey | null
  onSelectTool: (tool: ToolKey) => void
  onHome: () => void
  viewOverride: ViewMode
  onSetViewOverride: (m: ViewMode) => void
  canUseTool: (key: string) => boolean
}

// Primary tools — clear purpose, work great on a phone
const PRIMARY_TOOLS: { key: ToolKey; label: string; Icon: Icon; color: string }[] = [
  { key: 'intake',      label: 'Intake',       Icon: Tray,          color: 'text-sky-500' },
  { key: 'records',     label: 'Records',      Icon: FolderSimple,  color: 'text-amber-500' },
  { key: 'clerk',       label: 'Meetings',     Icon: CalendarCheck, color: 'text-blue-500' },
  { key: 'fix',         label: 'Service Req.', Icon: Wrench,        color: 'text-orange-500' },
  { key: 'budgeting',   label: 'Budget',       Icon: CurrencyDollar,color: 'text-emerald-500' },
  { key: 'time',        label: 'Deadlines',    Icon: ClockCountdown,color: 'text-red-500' },
  { key: 'puddles',     label: 'Puddles',      Icon: Robot,         color: 'text-emerald-500' },
  { key: 'townfinder',  label: 'Town Finder',  Icon: MapPin,        color: 'text-sky-600' },
  { key: 'settings',    label: 'Settings',     Icon: Gear,          color: 'text-muted-foreground' },
]

// Complex tools — accessible on mobile but work best on a computer
const DESKTOP_BEST_TOOLS: { key: ToolKey; label: string; Icon: Icon }[] = [
  { key: 'vault',      label: 'Vault',         Icon: Vault },
  { key: 'casespaces', label: 'Environments',  Icon: FolderOpen },
  { key: 'watchlayer', label: 'Watch Layer',   Icon: Megaphone },
]

// Build tools — Modules section (admin/owner only on mobile)
const MODULES_TOOLS_MOBILE: { key: ToolKey; label: string; Icon: Icon }[] = [
  { key: 'builder',      label: 'Module Builder',    Icon: Wrench },
  { key: 'automations',  label: 'Automation Flows',  Icon: Lightning },
  { key: 'marketplace',  label: 'Marketplace',       Icon: ShoppingCart },
  { key: 'logiccommons', label: 'Logic Commons',     Icon: PuzzlePiece },
]

// System controls — Platform section (admin/owner only)
const DEVTOOLS_TOOLS_MOBILE: { key: ToolKey; label: string; Icon: Icon }[] = [
  { key: 'admin',        label: 'Admin Panel',   Icon: ShieldCheck },
  { key: 'audit',        label: 'Audit Trail',   Icon: ClipboardText },
  { key: 'logicbridge',  label: 'LogicBridge',   Icon: Plugs },
  { key: 'govai',        label: 'Gov AI',        Icon: Robot },
]

export const MobileNav = memo(function MobileNav({
  activeTool, onSelectTool, onHome, viewOverride, onSetViewOverride, canUseTool,
}: MobileNavProps) {
  const [showAll, setShowAll] = useState(false)

  const isHome = !activeTool && !showAll
  const isDash = activeTool === 'logicdash' && !showAll
  const isIntake = activeTool === 'intake' && !showAll
  const isMore = showAll

  const handleTab = (action: () => void) => {
    setShowAll(false)
    action()
  }

  return (
    <>
      {/* Full-screen tools list — shown when "More" tab is active */}
      {showAll && (
        <div className="absolute inset-0 bottom-[calc(49px+env(safe-area-inset-bottom,0px))] bg-background overflow-y-auto z-30">
          <div className="px-4 pt-6 pb-2">
            <h1 className="text-2xl font-bold text-foreground">Tools</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Tap to open</p>
          </div>

          {/* Primary tools */}
          <div className="mt-2">
            {PRIMARY_TOOLS.filter(t => canUseTool(t.key)).map(({ key, label, Icon, color }, i, arr) => (
              <button
                key={key}
                onClick={() => { setShowAll(false); onSelectTool(key) }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 bg-background active:bg-muted/60 transition-colors',
                  i < arr.length - 1 && 'border-b border-border/50',
                )}
              >
                <div className={cn('w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0', color)}>
                  <Icon size={20} weight="duotone" />
                </div>
                <span className="flex-1 text-left text-[15px] text-foreground">{label}</span>
                <CaretRight size={14} className="text-muted-foreground/40 shrink-0" />
              </button>
            ))}
          </div>

          {/* Desktop-best tools section */}
          {DESKTOP_BEST_TOOLS.some(t => canUseTool(t.key)) && (
            <>
              <div className="px-4 pt-6 pb-2">
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                  More — best on a computer
                </p>
              </div>
              <div className="border-t border-border/40">
                {DESKTOP_BEST_TOOLS.filter(t => canUseTool(t.key)).map(({ key, label, Icon }, i, arr) => (
                  <button
                    key={key}
                    onClick={() => { setShowAll(false); onSelectTool(key) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 bg-background active:bg-muted/60 transition-colors',
                      i < arr.length - 1 && 'border-b border-border/50',
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center shrink-0 text-muted-foreground">
                      <Icon size={20} weight="duotone" />
                    </div>
                    <span className="flex-1 text-left text-[15px] text-foreground/80">{label}</span>
                    <ArrowSquareOut size={13} className="text-muted-foreground/40 shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Modules section — admin/owner only */}
          {MODULES_TOOLS_MOBILE.some(t => canUseTool(t.key)) && (
            <>
              <div className="px-4 pt-6 pb-2">
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Modules — build layer
                </p>
              </div>
              <div className="border-t border-border/40">
                {MODULES_TOOLS_MOBILE.filter(t => canUseTool(t.key)).map(({ key, label, Icon }, i, arr) => (
                  <button
                    key={key}
                    onClick={() => { setShowAll(false); onSelectTool(key) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 bg-background active:bg-muted/60 transition-colors',
                      i < arr.length - 1 && 'border-b border-border/50',
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 text-violet-400">
                      <Icon size={20} weight="duotone" />
                    </div>
                    <span className="flex-1 text-left text-[15px] text-foreground/80">{label}</span>
                    <CaretRight size={14} className="text-muted-foreground/40 shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Dev Tools section — admin/owner only */}
          {canUseTool('admin') && DEVTOOLS_TOOLS_MOBILE.some(t => canUseTool(t.key)) && (
            <>
              <div className="px-4 pt-6 pb-2">
                <div className="flex items-center gap-1.5">
                  <TerminalWindow size={11} weight="duotone" className="text-amber-500" />
                  <p className="text-[12px] font-semibold text-amber-500/80 uppercase tracking-wide">
                    Platform — admin only
                  </p>
                </div>
              </div>
              <div className="border-t border-border/40">
                {DEVTOOLS_TOOLS_MOBILE.filter(t => canUseTool(t.key)).map(({ key, label, Icon }, i, arr) => (
                  <button
                    key={key}
                    onClick={() => { setShowAll(false); onSelectTool(key) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 bg-background active:bg-muted/60 transition-colors',
                      i < arr.length - 1 && 'border-b border-border/50',
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-400">
                      <Icon size={20} weight="duotone" />
                    </div>
                    <span className="flex-1 text-left text-[15px] text-foreground/80">{label}</span>
                    <CaretRight size={14} className="text-muted-foreground/40 shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Open on desktop */}
          <div className="px-4 pt-6 pb-8">
            <button
              onClick={() => { onSetViewOverride(viewOverride === 'desktop' ? 'auto' : 'desktop'); setShowAll(false) }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-muted/50 active:bg-muted transition-colors border border-border/40"
            >
              <Desktop size={18} weight="duotone" className="text-muted-foreground" />
              <div className="flex-1 text-left">
                <div className="text-[15px] text-foreground">Open on Desktop</div>
                <div className="text-[12px] text-muted-foreground">Full layout — all tools and panels</div>
              </div>
              <ArrowsOut size={14} className="text-muted-foreground/40" />
            </button>
          </div>
        </div>
      )}

      {/* Tab bar — iOS style: flat, full-width */}
      <div
        className="shrink-0 border-t border-border bg-background/95 z-40"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-stretch h-[49px]">
          {[
            { id: 'home',   label: 'Home',   Icon: House,      active: isHome,   action: () => handleTab(onHome) },
            { id: 'intake', label: 'Intake', Icon: Tray,       active: isIntake, action: () => handleTab(() => onSelectTool('intake')) },
            { id: 'dash',   label: 'Dash',   Icon: ChartBar,   active: isDash,   action: () => handleTab(() => onSelectTool('logicdash')) },
            { id: 'more',   label: 'More',   Icon: DotsThree,  active: isMore,   action: () => setShowAll(v => !v) },
          ].map(({ id, label, Icon, active, action }) => (
            <button
              key={id}
              onClick={action}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] min-w-0 active:opacity-60 transition-opacity"
            >
              <Icon
                size={24}
                weight={active ? 'fill' : 'regular'}
                className={active ? 'text-primary' : 'text-muted-foreground'}
              />
              <span className={cn(
                'text-[10px] font-medium leading-none',
                active ? 'text-primary' : 'text-muted-foreground',
              )}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
})
