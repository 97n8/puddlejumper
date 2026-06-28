import { useState } from 'react'
import type { ToolKey } from '@/lib/types'
import { Wrench, AppWindow, Robot, Folder, Money, Tree } from '@phosphor-icons/react'
import { VaultModuleMaker } from '@/features/builder/components/VaultModuleMaker'
import { AppsPanel } from './AppsPanel'
import { BotsPanel } from './BotsPanel'
import { ProjectsPanel } from './ProjectsPanel'
import { GrantsPanel } from './GrantsPanel'
import { BudgetsPanel } from './BudgetsPanel'

type Tab = 'modules' | 'apps' | 'bots' | 'projects' | 'grants' | 'budgets'

interface LogicBuilderPanelProps {
  onOpenTool: (tool: ToolKey) => void
  connectorStatus?: Record<string, boolean>
  initialTab?: Tab
  onActivated?: () => void
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'modules',  label: 'Module Builder', icon: <Wrench size={15} weight="duotone" /> },
  { id: 'apps',     label: 'Apps',           icon: <AppWindow size={15} weight="duotone" /> },
  { id: 'bots',     label: 'Bots',           icon: <Robot size={15} weight="duotone" /> },
  { id: 'projects', label: 'Projects',       icon: <Folder size={15} weight="duotone" /> },
  { id: 'grants',   label: 'Grants',         icon: <Tree size={15} weight="duotone" /> },
  { id: 'budgets',  label: 'Budgets',        icon: <Money size={15} weight="duotone" /> },
]

export function LogicBuilderPanel({ onOpenTool, initialTab, onActivated }: LogicBuilderPanelProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'modules')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 px-4 border-b border-border bg-background shrink-0 pt-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        {tab === 'modules'  && <VaultModuleMaker onActivated={onActivated} />}
        {tab === 'apps'     && <AppsPanel onOpenTool={onOpenTool} />}
        {tab === 'bots'     && <BotsPanel />}
        {tab === 'projects' && <ProjectsPanel />}
        {tab === 'grants'   && <GrantsPanel />}
        {tab === 'budgets'  && <BudgetsPanel />}
      </div>
    </div>
  )
}
