import { Button } from '@/components/ui/button'
import { Buildings, Wrench, X } from '@phosphor-icons/react'
import type { CaseSpace } from '@/lib/types'
import { EnvironmentModuleIconStack } from './EnvironmentModuleIconStack'
import { resolveEnvironmentModules } from './environmentModuleIcons'

interface SidebarEnvironmentItemProps {
  environment: CaseSpace
  active?: boolean
  onClick: () => void
}

function SidebarEnvironmentItem({ environment, active, onClick }: SidebarEnvironmentItemProps) {
  const color = environment.color ?? '#627DBD'
  const hasModules = resolveEnvironmentModules(environment.vaultModuleIds).length > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors
        ${active ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted text-foreground/80'}
      `}
    >
      {hasModules ? (
        <EnvironmentModuleIconStack moduleIds={environment.vaultModuleIds} size="sm" />
      ) : (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="flex-1 truncate">{environment.name}</span>
      {environment.type === 'vault' && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" title="VAULT environment" />
      )}
    </button>
  )
}

interface EnvironmentHubSidebarProps {
  environments: CaseSpace[]
  activeId?: string | null
  onSelectEnvironment: (id: string) => void
  onNewEnvironment: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function EnvironmentHubSidebar({
  environments,
  activeId,
  onSelectEnvironment,
  onNewEnvironment,
  mobileOpen = false,
  onMobileClose,
}: EnvironmentHubSidebarProps) {
  return (
    <aside className={`w-64 flex flex-col border-r bg-muted/20 h-full shrink-0 md:flex ${mobileOpen ? 'flex absolute inset-y-0 left-0 z-30 shadow-xl' : 'hidden'}`}>
      {/* Logo area */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-2">
          <Buildings size={22} className="text-primary" />
          <span className="font-bold text-base flex-1">Environments</span>
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Close sidebar"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-4">
        {environments.length > 0 && (
          <section>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-1">
              Workspaces
            </p>
            {environments.map(env => (
              <SidebarEnvironmentItem
                key={env.id}
                environment={env}
                active={env.id === activeId}
                onClick={() => onSelectEnvironment(env.id)}
              />
            ))}
          </section>
        )}

        {environments.length === 0 && (
          <p className="text-xs text-muted-foreground px-3">No environments yet.</p>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs"
          onClick={onNewEnvironment}
        >
          <Wrench size={14} />
          + New Environment
        </Button>
      </div>
    </aside>
  )
}
