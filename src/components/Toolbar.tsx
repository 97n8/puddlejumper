import { type ReactNode, memo } from 'react'
import {
  Vault, Lightning, FolderOpen,
  Gear, ShieldCheck, Wrench, Megaphone,
  FilePlus, ClipboardText, PuzzlePiece, Plus, FileText,
  Rocket, SignOut, Question, ChartBar,
  Sun, Moon, ArrowLeft, Plugs,
  Tray, CurrencyDollar, ShoppingCart,
  Robot, GitBranch, CalendarCheck,
  UserSwitch, Bell, ClockCountdown, Gavel, TreeStructure,
  IdentificationCard, Buildings, MapPin,
  Bed, CloudArrowUp,
  FirstAidKit, HardHat, HandCoins,
} from '@phosphor-icons/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useShellColor } from '@/lib/colorContext'
import { useKV } from '@/hooks/useKV'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/services/auth/AuthContext'
import { useConnectorStatus } from '@/hooks/useConnectorStatus'
import { useCloudSave } from '@/context/CloudSaveContext'
import type { ToolKey } from '@/lib/types'


export type TopSection = 'desk' | 'modules' | 'devtools'

interface ToolbarProps {
  onOpenConnections: () => void
  onBack: () => void
  onNewFile?: () => void
  onOpenQuickStart?: () => void
  currentTool: ToolKey | null
  onOpenAudit?: () => void
  onOpenSyncronate?: () => void
  onOpenFormkey?: () => void
  onSelectTool?: (tool: ToolKey) => void
  isMobile?: boolean
  topSection?: TopSection
  onSetTopSection?: (s: TopSection) => void
  isAdmin?: boolean
}

type CreateItem = { label: string; icon: ReactNode; tool: ToolKey; desc: string; color: string }

const PRIMARY_CREATE_ITEMS: CreateItem[] = [
  { label: 'Public Intake Form', icon: <FilePlus size={14} weight="duotone" />, tool: 'formkey', desc: 'Residents are submitting — make sure it\'s captured and traceable', color: 'text-rose-400' },
  { label: 'Tracked Case', icon: <FileText size={14} weight="duotone" />, tool: 'vault', desc: 'Something needs owners, a deadline, and a full audit trail', color: 'text-sky-400' },
  { label: 'Team Environment', icon: <Rocket size={14} weight="duotone" />, tool: 'casespaces', desc: 'A department or project needs its own governed workspace', color: 'text-emerald-400' },
  { label: 'Automation Rule', icon: <Lightning size={14} weight="duotone" />, tool: 'automations', desc: 'The same manual step keeps happening — set a rule to handle it', color: 'text-yellow-400' },
]

const MOBILE_CREATE_ITEMS = PRIMARY_CREATE_ITEMS.filter(item => item.tool !== 'automations')

export const Toolbar = memo(function Toolbar({ onOpenConnections, onBack, onNewFile, onOpenQuickStart, currentTool, onSelectTool, isMobile, topSection, onSetTopSection, isAdmin }: ToolbarProps) {
  const { user, logout } = useAuth()
  const { status: connStatus } = useConnectorStatus()
  const { openCloudSave } = useCloudSave()
  const [appearance, setAppearance] = useKV<{ theme: 'light' | 'dark' | 'system'; compactMode: boolean }>(
    'logicos-appearance',
    { theme: 'system', compactMode: false }
  )
  const { shellColor, setShellColor } = useShellColor()
  const currentTheme = appearance?.theme ?? 'system'
  const isDark = currentTheme === 'dark'
  const setTheme = (t: 'light' | 'dark' | 'system') => setAppearance({ ...(appearance ?? { compactMode: false }), theme: t })
  const setCompact = (v: boolean) => setAppearance({ ...(appearance ?? { theme: 'system' }), compactMode: v })

  const getToolInfo = () => {
    switch (currentTool) {
      case 'vault':            return { name: 'Vault',            icon: <Vault size={12} weight="duotone" /> }
      case 'logicbridge':      return { name: 'LogicBridge',      icon: <Plugs size={12} weight="duotone" /> }
      case 'automations':      return { name: 'Flows',            icon: <Lightning size={12} weight="duotone" /> }
      case 'casespaces':       return { name: 'Environments',     icon: <FolderOpen size={12} weight="duotone" /> }
      case 'settings':         return { name: 'Settings',         icon: <Gear size={12} weight="duotone" /> }
      case 'admin':            return { name: 'Admin',            icon: <ShieldCheck size={12} weight="duotone" /> }
      case 'builder':          return { name: 'Builder',          icon: <Wrench size={12} weight="duotone" /> }
      case 'civicpulse':       return { name: 'Transparency',     icon: <Megaphone size={12} weight="duotone" /> }
      case 'watchlayer':       return { name: 'Watch Layer',      icon: <Megaphone size={12} weight="duotone" /> }
      case 'audit':            return { name: 'Audit Trail',      icon: <ClipboardText size={12} weight="duotone" /> }
      case 'syncronate':       return { name: 'Syncronate',       icon: <Lightning size={12} weight="duotone" /> }
      case 'formkey':          return { name: 'FormKey',          icon: <FileText size={12} weight="duotone" /> }
      case 'logicdash':        return { name: 'Ops Dashboard',    icon: <ChartBar size={12} weight="duotone" /> }
      case 'quickstart':       return { name: 'QuickStart',       icon: <Question size={12} weight="duotone" /> }
      case 'intake':           return { name: 'Incoming Items',   icon: <Tray size={12} weight="duotone" /> }
      case 'records':          return { name: 'Records Requests', icon: <ClipboardText size={12} weight="duotone" /> }
      case 'budgeting':        return { name: 'Spending & Budget',icon: <CurrencyDollar size={12} weight="duotone" /> }
      case 'procurement':      return { name: 'Procurement',      icon: <ShoppingCart size={12} weight="duotone" /> }
      case 'evidence':         return { name: 'Evidence',         icon: <FolderOpen size={12} weight="duotone" /> }
      case 'govai':            return { name: 'Gov AI',           icon: <Robot size={12} weight="duotone" /> }
      case 'routingengine':    return { name: 'Routing Engine',   icon: <GitBranch size={12} weight="duotone" /> }
      case 'orgmanager':       return { name: 'Org Manager',      icon: <Buildings size={12} weight="duotone" /> }
      case 'capital':          return { name: 'Capital',          icon: <TreeStructure size={12} weight="duotone" /> }
      case 'clerk':            return { name: 'Meeting Records',  icon: <CalendarCheck size={12} weight="duotone" /> }
      case 'fix':              return { name: 'Service Requests', icon: <Wrench size={12} weight="duotone" /> }
      case 'onboard':          return { name: 'Role Continuity',  icon: <UserSwitch size={12} weight="duotone" /> }
      case 'comms':            return { name: 'Notices & Comms',  icon: <Bell size={12} weight="duotone" /> }
      case 'time':             return { name: 'Deadlines',        icon: <ClockCountdown size={12} weight="duotone" /> }
      case 'boardcompliance':  return { name: 'Board Compliance', icon: <Gavel size={12} weight="duotone" /> }
      case 'permitting':       return { name: 'Permitting',       icon: <IdentificationCard size={12} weight="duotone" /> }
      case 'staffhr':          return { name: 'Staff & HR',       icon: <IdentificationCard size={12} weight="duotone" /> }
      case 'townfinder':       return { name: 'Town Finder',      icon: <MapPin size={12} weight="duotone" /> }
      case 'puddles':          return { name: 'Puddles',          icon: <span className="text-[12px]">🦆</span> }
      case 'stay':             return { name: 'StayOS',           icon: <Bed size={12} weight="duotone" /> }
      case 'logiccommons':     return { name: 'Logic Commons',    icon: <PuzzlePiece size={12} weight="duotone" /> }
      case 'marketplace':      return { name: 'Marketplace',      icon: <ShoppingCart size={12} weight="duotone" /> }
      case 'civic':            return { name: 'CIVIC V1 — Civic Governance', icon: <Gavel size={12} weight="duotone" /> }
      case 'health':           return { name: 'Health V1 — Public Health',   icon: <FirstAidKit size={12} weight="duotone" /> }
      case 'ops':              return { name: 'Operations V1 — Facilities',  icon: <HardHat size={12} weight="duotone" /> }
      case 'grants':           return { name: 'Grants V1 — Grant Lifecycle', icon: <HandCoins size={12} weight="duotone" /> }
      default:                 return { name: '', icon: null }
    }
  }

  const toolInfo = getToolInfo()
  const visibleCreateItems = isMobile ? MOBILE_CREATE_ITEMS : PRIMARY_CREATE_ITEMS
  const initials = user?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
    || user?.email?.[0]?.toUpperCase()
    || '?'

  return (
      <div
        className={`h-12 bg-background/78 backdrop-blur-2xl border-b border-border/60 flex items-center ${isMobile ? 'px-2.5' : 'px-3 sm:px-5'} gap-2 flex-shrink-0 z-20 relative`}
        style={{ boxShadow: '0 1px 0 oklch(1 0 0 / 0.08) inset, 0 14px 34px oklch(0 0 0 / 0.08)' }}
      >
      {/* Mobile: back arrow when tool is active */}
      {isMobile && currentTool ? (
        <button onClick={onBack} className="flex items-center gap-1.5 shrink-0 group z-10" aria-label="Home">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted/70 group-hover:bg-muted group-active:scale-90 transition-all">
            <ArrowLeft size={16} className="text-foreground/70" />
          </div>
        </button>
      ) : (
        /* Wordmark */
          <button onClick={onBack} className="flex items-center shrink-0 group mr-1.5 z-10 interactive-press" aria-label="Home">
            <span className="text-[21px] font-display font-black tracking-[-0.05em] text-foreground/92 group-hover:text-foreground transition-colors select-none">
              Logic<span className="bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 bg-clip-text text-transparent">OS</span>
            </span>
          </button>
        )}

      {/* Minimal breadcrumb — desktop only */}
      {!isMobile && toolInfo.name && (
          <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-3 duration-200">
            <span className="text-foreground/18 text-sm select-none">›</span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/18 bg-primary/9 text-[11px] font-semibold text-primary tracking-[0.08em] uppercase shadow-[0_6px_14px_oklch(0_0_0_/_0.04)]">
              {toolInfo.icon}
              {toolInfo.name}
            </span>
        </div>
      )}

      {/* Mobile: tool name absolutely centered */}
      {isMobile && toolInfo.name && (
        <div className="absolute inset-y-0 left-12 right-24 flex items-center justify-center pointer-events-none">
          <span className="truncate text-center text-[14px] font-semibold text-foreground/85 select-none tracking-tight">
            {toolInfo.name}
          </span>
        </div>
      )}

      {/* Section tabs — desktop only, admin/owner only */}
      {!isMobile && isAdmin && onSetTopSection && (
          <div className="flex items-center gap-0.5 px-1 py-1 rounded-2xl bg-card/72 border border-border/50 ml-2 shadow-[0_10px_24px_oklch(0_0_0_/_0.04)]">
          {([
            { id: 'desk', label: 'Desk' },
            { id: 'modules', label: 'Modules' },
            { id: 'devtools', label: 'Platform' },
          ] as { id: TopSection; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => onSetTopSection(tab.id)}
                className={`px-3 py-1 rounded-xl text-[12px] font-semibold transition-all duration-150 ${
                  topSection === tab.id
                    ? 'bg-background text-foreground shadow-[0_8px_18px_oklch(0_0_0_/_0.08)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                }`}
              >
                {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Theme / Style popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card transition-all duration-150 active:scale-[0.95]"
            aria-label="Style settings"
            title="Style"
          >
            {isDark
              ? <Sun size={15} weight="duotone" className="text-yellow-400" />
              : <Moon size={15} weight="duotone" className="text-slate-400" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3 space-y-4">
          {/* Theme */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Theme</p>
            <div className="flex gap-1.5">
              {(['light', 'dark', 'system'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    currentTheme === t
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'Auto'}
                </button>
              ))}
            </div>
          </div>

          {/* Accent */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Accent Color</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shellColor.startsWith('#') ? shellColor : '#10b981'}
                onChange={(e) => setShellColor(e.target.value)}
                aria-label="Accent color picker"
                className="h-8 w-12 rounded border border-border cursor-pointer p-0.5 bg-background"
              />
              <span className="text-[11px] text-muted-foreground font-mono flex-1 truncate">{shellColor}</span>
              <button
                onClick={() => setShellColor('oklch(0.65 0.18 155)')}
                aria-label="Reset accent color to default"
                className="text-[11px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 hover:bg-muted/50 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Compact */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-foreground">Compact Mode</p>
            <Switch
              checked={appearance?.compactMode ?? false}
              onCheckedChange={setCompact}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* + Create */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <button
               className={`flex items-center ${isMobile ? 'justify-center px-0 w-9 h-9 rounded-xl' : 'gap-1.5 px-3.5 py-1.5 rounded-2xl text-[12px]'} font-semibold transition-all duration-150 active:scale-[0.96] bg-primary text-primary-foreground hover:bg-primary/92 hover:-translate-y-[1px] shadow-[0_12px_24px_color-mix(in_oklab,var(--color-primary)_24%,transparent)] select-none focus-visible:ring-2 focus-visible:ring-ring`}
               aria-label="Create new"
             >
              <Plus size={13} weight="bold" />
              {!isMobile && 'New'}
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[19rem] p-2">
          <div className="px-2 pb-2 pt-1">
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">What needs to happen right now?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              The most common situations your team faces — start here and the right module opens.
            </p>
          </div>
          {visibleCreateItems.map((item) => (
            <DropdownMenuItem
              key={item.tool}
              onClick={() => onSelectTool?.(item.tool)}
              className="gap-3 py-2.5 px-2.5 rounded-lg cursor-pointer mb-0.5"
            >
              <span className={`${item.color} shrink-0`}>{item.icon}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{item.desc}</span>
              </div>
            </DropdownMenuItem>
          ))}
          {onNewFile && (
            <>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuItem onClick={onNewFile} className="gap-3 py-2.5 px-2.5 rounded-lg cursor-pointer">
                <span className="text-blue-500 shrink-0"><FilePlus size={16} weight="duotone" /></span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold leading-tight">New File</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">Write, edit, and sync to GitHub, Drive, or SharePoint</span>
                </div>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem
            onClick={() => openCloudSave({ provider: 'google', filename: 'logicos-export.md', content: '' })}
            className="gap-3 py-2.5 px-2.5 rounded-lg cursor-pointer"
          >
            <span className="text-emerald-500 shrink-0"><CloudArrowUp size={16} weight="duotone" /></span>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold leading-tight">Save to Cloud</span>
              <span className="text-[11px] text-muted-foreground leading-tight">Upload a file to Google Drive, OneDrive, or GitHub</span>
            </div>
          </DropdownMenuItem>
          {onOpenQuickStart && (
            <>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuItem onClick={onOpenQuickStart} className="gap-3 py-2 px-2.5 rounded-lg cursor-pointer">
                <Question size={14} weight="duotone" className="text-emerald-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium leading-tight">Help me choose</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">Open the guide for a recommended starting point</span>
                </div>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!isMobile && <div className="w-px h-5 bg-border/50 mx-1" />}

      {/* Help / Guide button — visible in toolbar */}
      {onOpenQuickStart && !isMobile && (
        <button
          onClick={onOpenQuickStart}
          aria-label="Open help guide"
          title="Help guide"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Question size={16} weight="duotone" />
        </button>
      )}


      {/* Cloud save quick-action */}
      {user && !isMobile && (
        <button
          onClick={() => openCloudSave({ provider: 'google', filename: 'logicos-export.md', content: '' })}
          aria-label="Save to cloud"
          title="Save to cloud"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors relative"
        >
          <CloudArrowUp size={16} weight="duotone" />
          {/* Connector status dots */}
          <div className="absolute -bottom-0.5 -right-0.5 flex gap-px">
            {connStatus.google    && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ring-1 ring-background" />}
            {connStatus.microsoft && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 ring-1 ring-background" />}
            {connStatus.github    && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 ring-1 ring-background" />}
          </div>
        </button>
      )}

      {/* Avatar with dropdown */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className={`${isMobile ? 'w-9 h-9 text-[11px]' : 'w-8 h-8 text-[11px]'} rounded-full flex items-center justify-center font-black text-white shrink-0 select-none ring-1 ring-border/60 hover:ring-primary/30 transition-all interactive-press`}
              style={{ background: 'linear-gradient(135deg, oklch(0.55 0.22 270), oklch(0.48 0.24 290))' }}
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1.5">
            <div className="px-2.5 py-2 mb-1">
              <p className="text-[13px] font-semibold truncate">{user.name || 'Account'}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSelectTool?.('settings')} className="gap-2.5 py-2 cursor-pointer">
              <Gear size={14} weight="duotone" className="text-muted-foreground" />
              <span className="text-[13px]">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenConnections} className="gap-2.5 py-2 cursor-pointer">
              <PuzzlePiece size={14} weight="duotone" className="text-sky-400" />
              <span className="text-[13px]">Connections</span>
            </DropdownMenuItem>
            {onOpenQuickStart && (
              <DropdownMenuItem onClick={onOpenQuickStart} className="gap-2.5 py-2 cursor-pointer">
                <Question size={14} weight="duotone" className="text-emerald-400" />
                <span className="text-[13px]">Guide</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="gap-2.5 py-2 cursor-pointer text-destructive focus:text-destructive">
              <SignOut size={14} weight="duotone" />
              <span className="text-[13px]">Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
})
