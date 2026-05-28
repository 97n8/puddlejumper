import { useCallback } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { EnvironmentShell } from '../../framework/EnvironmentShell'
import { OPS_CONFIG } from './config'
import type { EnvironmentActor } from '../../framework/types'
import { HardHat, Wrench, Shapes, Van } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface OpsEnvironmentProps {
  onBack: () => void
}

const MODULE_ICONS: Record<string, ReactNode> = {
  workbench:  <HardHat size={32} weight="duotone" className="text-amber-400" />,
  workorders: <Wrench size={32} weight="duotone" className="text-amber-400" />,
  assets:     <Shapes size={32} weight="duotone" className="text-amber-400" />,
  fleet:      <Van size={32} weight="duotone" className="text-amber-400" />,
}

function PreviewModule({ moduleId }: { moduleId: string }) {
  const mod = OPS_CONFIG.modules.find(m => m.id === moduleId)
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10 bg-gradient-to-br from-amber-950/40 to-background min-h-full">
      <div className="w-20 h-20 rounded-2xl bg-amber-900/30 border border-amber-800/40 flex items-center justify-center">
        {MODULE_ICONS[moduleId] ?? <HardHat size={32} weight="duotone" className="text-amber-400" />}
      </div>
      <div className="text-center max-w-sm">
        <div className="text-lg font-semibold text-foreground mb-1">{mod?.label ?? moduleId}</div>
        <p className="text-sm text-muted-foreground">
          This module is in development. Operations V1 will include work order management, asset tracking, fleet scheduling, and field service workflows.
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-900/30 border border-amber-800/40">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-medium text-amber-300">Coming Soon — Operations V1</span>
      </div>
    </div>
  )
}

export function OpsEnvironment({ onBack }: OpsEnvironmentProps) {
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
      config={OPS_CONFIG}
      onBack={onBack}
      fetchActor={fetchActor}
      renderModule={(moduleId) => <PreviewModule moduleId={moduleId} />}
    />
  )
}
