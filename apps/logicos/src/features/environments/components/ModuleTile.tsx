import { FolderOpen, Hammer, Gavel, UsersThree, CurrencyDollar, Lock } from '@phosphor-icons/react'
import type { VaultModuleDefinition } from '../constants/vault-modules'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  FolderOpen,
  Hammer,
  Gavel,
  UsersThree,
  CurrencyDollar,
}

interface ModuleTileProps {
  module: VaultModuleDefinition
  recordCount?: number
  pendingCount?: number
  locked?: boolean
  onClick: () => void
}

export function ModuleTile({ module, recordCount, pendingCount, locked, onClick }: ModuleTileProps) {
  const Icon = ICON_MAP[module.icon] ?? FolderOpen

  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`
        relative flex flex-col gap-2 p-4 rounded-lg border text-left transition-all
        ${locked
          ? 'opacity-50 cursor-not-allowed bg-muted/30 border-border'
          : 'hover:shadow-md hover:border-primary/30 bg-card border-border cursor-pointer'}
      `}
    >
      {locked && (
        <span className="absolute top-2 right-2">
          <Lock size={14} className="text-muted-foreground" />
        </span>
      )}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: module.color + '22' }}
      >
        <Icon size={20} color={module.color} />
      </div>
      <div>
        <p className="font-medium text-sm leading-tight">{module.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{module.description}</p>
      </div>
      {(recordCount !== undefined || pendingCount !== undefined) && (
        <div className="flex gap-3 mt-1">
          {recordCount !== undefined && (
            <span className="text-xs text-muted-foreground">{recordCount} records</span>
          )}
          {pendingCount !== undefined && pendingCount > 0 && (
            <span className="text-xs text-amber-600 font-medium">{pendingCount} pending</span>
          )}
        </div>
      )}
    </button>
  )
}
