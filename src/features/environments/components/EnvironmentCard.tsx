import { Badge } from '@/components/ui/badge'
import { Buildings, FolderOpen, Users, AppWindow, Robot, Cube, PencilSimple } from '@phosphor-icons/react'
import type { CaseSpace } from '@/lib/types'
import type { EnvironmentActivity } from '../types/environment'
import { EnvironmentModuleIconStack } from './EnvironmentModuleIconStack'
import { resolveEnvironmentModules } from './environmentModuleIcons'

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function countApps(envId: string): number {
  try {
    const apps: Array<{ environmentId?: string }> = JSON.parse(localStorage.getItem('appforge-apps') ?? '[]')
    return apps.filter(a => a.environmentId === envId).length
  } catch { return 0 }
}

function countBots(envId: string): number {
  try {
    const bots: Array<{ environmentId?: string }> = JSON.parse(localStorage.getItem('studio-bots') ?? '[]')
    return bots.filter(b => b.environmentId === envId).length
  } catch { return 0 }
}

interface EnvironmentCardProps {
  environment: CaseSpace
  activityPreview?: EnvironmentActivity[]
  memberCount?: number
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function EnvironmentCard({
  environment,
  activityPreview,
  memberCount,
  onClick,
  onEdit,
  onDelete,
}: EnvironmentCardProps) {
  const isVault = environment.type === 'vault'
  const color = environment.color ?? '#627DBD'
  const moduleIcons = resolveEnvironmentModules(environment.vaultModuleIds)
  const lastActivity = activityPreview?.[0]

  return (
    <div
      className="relative flex flex-col rounded-xl border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Color bar */}
      <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: color }} />

      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + '22' }}
          >
            {moduleIcons.length > 0
              ? <EnvironmentModuleIconStack moduleIds={environment.vaultModuleIds} size="md" />
              : isVault
              ? <Buildings size={22} style={{ color }} />
              : <FolderOpen size={22} style={{ color }} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm truncate">{environment.name}</span>
              {isVault && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase tracking-wide">
                  VAULT
                </Badge>
              )}
            </div>
            {environment.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{environment.description}</p>
            )}
          </div>
        </div>

        {/* VAULT module chips */}
        {moduleIcons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {moduleIcons.slice(0, 4).map(module => (
              <span
                key={module.id}
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: module.color + '22', color: module.color }}
              >
                {module.label}
              </span>
            ))}
          </div>
        )}

        {/* Activity preview */}
        {lastActivity && (
          <p className="text-xs text-muted-foreground border-l-2 border-border pl-2 leading-tight">
            <span className="font-medium">{lastActivity.actor}</span> {lastActivity.action}
          </p>
        )}
      </div>

      {/* Footer — org chart depth indicators */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t bg-muted/30 text-xs text-muted-foreground">
        {(environment.vaultModuleIds?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Cube size={11} />
            {environment.vaultModuleIds!.length} module{environment.vaultModuleIds!.length === 1 ? '' : 's'}
          </span>
        )}
        {(() => { const n = countApps(environment.id); return n > 0 ? <span className="flex items-center gap-1"><AppWindow size={11} />{n}</span> : null })()}
        {(() => { const n = countBots(environment.id); return n > 0 ? <span className="flex items-center gap-1"><Robot size={11} />{n}</span> : null })()}
        {memberCount !== undefined && memberCount > 0 && (
          <span className="flex items-center gap-1">
            <Users size={11} />
            {memberCount}
          </span>
        )}
        {environment.lastAccessed && (
          <span className="ml-auto">{formatRelative(new Date(environment.lastAccessed))}</span>
        )}
      </div>

      {onEdit && (
        <button
          type="button"
          className="absolute top-3 right-10 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={e => { e.stopPropagation(); onEdit() }}
          title="Edit workspace"
        >
          <PencilSimple size={12} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Delete environment"
        >
          <span className="text-xs leading-none">×</span>
        </button>
      )}
    </div>
  )
}
