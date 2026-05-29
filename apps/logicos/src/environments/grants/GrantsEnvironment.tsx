import { useCallback } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { EnvironmentShell } from '../../framework/EnvironmentShell'
import { GRANTS_CONFIG } from './config'
import type { EnvironmentActor } from '../../framework/types'
import { HandCoins, ClipboardText, CheckSquare, Drop } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface GrantsEnvironmentProps {
  onBack: () => void
}

const MODULE_ICONS: Record<string, ReactNode> = {
  workbench: <HandCoins size={32} weight="duotone" className="text-emerald-400" />,
  tracking:  <ClipboardText size={32} weight="duotone" className="text-emerald-400" />,
  closeout:  <CheckSquare size={32} weight="duotone" className="text-emerald-400" />,
  utility:   <Drop size={32} weight="duotone" className="text-emerald-400" />,
}

function PreviewModule({ moduleId }: { moduleId: string }) {
  const mod = GRANTS_CONFIG.modules.find(m => m.id === moduleId)
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10 bg-gradient-to-br from-emerald-950/40 to-background min-h-full">
      <div className="w-20 h-20 rounded-2xl bg-emerald-900/30 border border-emerald-800/40 flex items-center justify-center">
        {MODULE_ICONS[moduleId] ?? <HandCoins size={32} weight="duotone" className="text-emerald-400" />}
      </div>
      <div className="text-center max-w-sm">
        <div className="text-lg font-semibold text-foreground mb-1">{mod?.label ?? moduleId}</div>
        <p className="text-sm text-muted-foreground">
          This module is in development. Grants V1 will include grant lifecycle tracking, federal compliance closeout, utility billing management, and reporting workflows.
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-900/30 border border-emerald-800/40">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-medium text-emerald-300">Coming Soon — Grants V1</span>
      </div>
    </div>
  )
}

export function GrantsEnvironment({ onBack }: GrantsEnvironmentProps) {
  const { user } = useAuth()

  const fetchActor = useCallback(async (): Promise<EnvironmentActor> => ({
    id: user?.sub ?? 'session',
    object_id: user?.sub ?? 'session',
    display_name: user?.name ?? user?.email ?? 'User',
    email: user?.email ?? '',
    civic_role: 'viewer',
  }), [user])

  return (
    <EnvironmentShell
      config={GRANTS_CONFIG}
      onBack={onBack}
      fetchActor={fetchActor}
      renderModule={(moduleId) => <PreviewModule moduleId={moduleId} />}
    />
  )
}
