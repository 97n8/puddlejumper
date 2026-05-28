import { useState } from 'react'
import { type ToolKey } from '@/lib/types'
import {
  MagnifyingGlass, Vault, Lightning, Plugs, ShieldCheck,
  Wrench, ClipboardText, Robot, Gear,
  PuzzlePiece, ShoppingCart, ArrowSquareOut,
} from '@phosphor-icons/react'

interface DevTool {
  id: ToolKey
  label: string
  desc: string
  icon: React.ReactNode
  section: 'core' | 'build'
}

const ALL_TOOLS: DevTool[] = [
  // Core platform
  { id: 'vault',        label: 'VAULT',         desc: 'Tracked cases & governed records',            icon: <Vault size={18} weight="duotone" />,         section: 'core' },
  { id: 'admin',        label: 'Admin',         desc: 'Platform admin & workspace management',       icon: <ShieldCheck size={18} weight="duotone" />,   section: 'core' },
  { id: 'settings',     label: 'Settings',      desc: 'Account & workspace preferences',             icon: <Gear size={18} weight="duotone" />,          section: 'core' },
  { id: 'audit',        label: 'Audit Log',     desc: 'Full governance audit trail',                 icon: <ClipboardText size={18} weight="duotone" />, section: 'core' },
  // Build & integrations
  { id: 'automations',  label: 'Flows',         desc: 'Automation engine & workflow rules',          icon: <Lightning size={18} weight="duotone" />,     section: 'build' },
  { id: 'builder',      label: 'Builder',       desc: 'Low-code app & module builder',               icon: <Wrench size={18} weight="duotone" />,        section: 'build' },
  { id: 'govai',        label: 'GovAI',         desc: 'AI-assisted governance tools',                icon: <Robot size={18} weight="duotone" />,         section: 'build' },
  { id: 'puddles',      label: 'Puddles',       desc: 'Operator chat with live PuddleJumper tools',  icon: <Robot size={18} weight="duotone" />,         section: 'build' },
  { id: 'logicbridge',  label: 'LogicBridge',   desc: 'API integrations & data connectors',          icon: <Plugs size={18} weight="duotone" />,         section: 'build' },
  { id: 'logiccommons', label: 'Logic Commons', desc: 'Shared governance framework & collaboration', icon: <PuzzlePiece size={18} weight="duotone" />,   section: 'build' },
  { id: 'marketplace',  label: 'Marketplace',   desc: 'Browse & publish reusable templates',         icon: <ShoppingCart size={18} weight="duotone" />,  section: 'build' },
]

const SECTION_LABELS: Record<string, string> = {
  core: 'Core',
  build: 'Build & Integrations',
}

interface DevToolsScreenProps {
  onSelectTool: (tool: ToolKey) => void
  onOpenVaultEnv?: (id: string) => void
  canUseTool?: (toolKey: string) => boolean
}

export function DevToolsScreen({ onSelectTool, onOpenVaultEnv, canUseTool }: DevToolsScreenProps) {
  const [search, setSearch] = useState('')

  const visible = ALL_TOOLS.filter(t => {
    if (canUseTool && !canUseTool(t.id)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
  })

  const sections = (['core', 'build'] as const).map(s => ({
    id: s,
    label: SECTION_LABELS[s],
    tools: visible.filter(t => t.section === s),
  })).filter(s => s.tools.length > 0)

  return (
    <div className="h-full w-full flex flex-col bg-transparent overflow-auto">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 px-5 sm:px-8 pt-5 pb-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Platform</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Core tools & integrations</p>
          </div>
        </div>
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tools…"
            className="w-full pl-8 pr-4 py-2 text-sm rounded-xl bg-muted/50 border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 py-6 flex flex-col gap-8">

        {sections.map(section => (
          <section key={section.id}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{section.label}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {section.tools.map(tool => (
                <button key={tool.id} onClick={() => onSelectTool(tool.id)}
                  className="flex flex-col gap-2 p-3.5 rounded-xl bg-card border border-border/60 hover:border-border hover:bg-muted/30 transition-colors text-left group">
                  <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                    {tool.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{tool.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{tool.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}

        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MagnifyingGlass size={28} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No tools match "{search}"</p>
            <p className="text-xs text-muted-foreground">Try a different search term.</p>
          </div>
        )}

        {/* Dev links */}
        {!search && (
          <section className="border-t border-border/60 pt-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Dev Links</h2>
            <div className="flex flex-col gap-2">
              <button onClick={() => onOpenVaultEnv?.('vault-logicville-env')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/60 hover:bg-muted/30 transition-colors text-left group">
                <Vault size={16} weight="duotone" className="text-muted-foreground group-hover:text-foreground shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-foreground">Logicville</div>
                  <div className="text-[10px] text-muted-foreground">Development environment — Town of Logicville sandbox</div>
                </div>
                <ArrowSquareOut size={12} className="text-muted-foreground/50 ml-auto shrink-0" />
              </button>
              <a href="/dev" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/60 hover:bg-muted/30 transition-colors group">
                <ShieldCheck size={16} weight="duotone" className="text-muted-foreground group-hover:text-foreground shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-foreground">VAULT MGL-001</div>
                  <div className="text-[10px] text-muted-foreground">Dev route — governance framework reference environment</div>
                </div>
                <ArrowSquareOut size={12} className="text-muted-foreground/50 ml-auto shrink-0" />
              </a>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
