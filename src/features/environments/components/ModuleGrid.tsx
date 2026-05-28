import { FileDoc, CloudArrowUp, Stack } from '@phosphor-icons/react'
import type { ToolKey } from '@/lib/types'
import { ModuleTile } from './ModuleTile'
import { ToolTile } from './ToolTile'
import { VAULT_MODULES } from '../constants/vault-modules'
import type { VaultModuleStats } from '../types/environment'
import type { UserRole } from '../types/environment'

interface ModuleGridProps {
  moduleStats?: VaultModuleStats[]
  enabledModuleIds?: string[]
  userRole?: UserRole
  onSelectModule: (moduleId: string) => void
  onSelectTool: (tool: ToolKey) => void
  onAddModules?: () => void
}

function isViewer(role?: UserRole): boolean {
  return role === 'viewer'
}

export function ModuleGrid({
  moduleStats,
  enabledModuleIds,
  userRole,
  onSelectModule,
  onSelectTool,
  onAddModules,
}: ModuleGridProps) {
  const locked = isViewer(userRole)
  const hasEnabledModules = !enabledModuleIds || enabledModuleIds.length > 0

  return (
    <div className="flex flex-col gap-6 p-4 overflow-y-auto h-full">
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Modules
        </p>
        {!hasEnabledModules && (
          <div className="mb-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 flex flex-col items-center gap-2 text-center">
            <p className="text-xs text-muted-foreground">No modules are enabled for this workspace yet.</p>
            {onAddModules && (
              <button
                onClick={onAddModules}
                className="text-xs text-primary hover:underline font-medium"
              >
                Browse module gallery →
              </button>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {VAULT_MODULES.map(mod => {
            const stats = moduleStats?.find(s => s.moduleId === mod.id)
            const enabled = !enabledModuleIds || enabledModuleIds.includes(mod.id)
            return (
              <ModuleTile
                key={mod.id}
                module={mod}
                recordCount={stats?.recordCount}
                pendingCount={stats?.pendingCount}
                locked={locked || !enabled}
                onClick={() => onSelectModule(mod.id)}
              />
            )
          })}
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Tools
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ToolTile
            icon={<FileDoc size={20} className="text-blue-600" />}
            label="Documents"
            description="Create and manage documents"
            onClick={() => onSelectTool('vault')}
            comingSoon={locked}
          />
          <ToolTile
            icon={<CloudArrowUp size={20} className="text-sky-600" />}
            label="File Sync"
            description="Sync files with cloud storage"
            onClick={() => onSelectTool('syncronate')}
            comingSoon={locked}
          />
          <ToolTile
            icon={<Stack size={20} className="text-purple-600" />}
            label="Automations"
            description="Automate repetitive tasks"
            onClick={() => onSelectTool('automations')}
            comingSoon={locked}
          />
        </div>
      </section>
    </div>
  )
}
