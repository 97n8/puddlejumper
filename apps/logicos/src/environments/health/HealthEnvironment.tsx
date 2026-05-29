import { useCallback } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { EnvironmentShell } from '../../framework/EnvironmentShell'
import { HEALTH_CONFIG } from './config'
import type { EnvironmentActor } from '../../framework/types'
import { FirstAidKit, ClipboardText, MagnifyingGlass, ChartBar } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface HealthEnvironmentProps {
  onBack: () => void
}

const MODULE_ICONS: Record<string, ReactNode> = {
  workbench:   <FirstAidKit size={32} weight="duotone" className="text-blue-400" />,
  cases:       <ClipboardText size={32} weight="duotone" className="text-blue-400" />,
  inspections: <MagnifyingGlass size={32} weight="duotone" className="text-blue-400" />,
  reporting:   <ChartBar size={32} weight="duotone" className="text-blue-400" />,
}

function PreviewModule({ moduleId }: { moduleId: string }) {
  const mod = HEALTH_CONFIG.modules.find(m => m.id === moduleId)
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10 bg-gradient-to-br from-blue-950/40 to-background min-h-full">
      <div className="w-20 h-20 rounded-2xl bg-blue-900/30 border border-blue-800/40 flex items-center justify-center">
        {MODULE_ICONS[moduleId] ?? <FirstAidKit size={32} weight="duotone" className="text-blue-400" />}
      </div>
      <div className="text-center max-w-sm">
        <div className="text-lg font-semibold text-foreground mb-1">{mod?.label ?? moduleId}</div>
        <p className="text-sm text-muted-foreground">
          This module is in development. Health V1 will include public health case management, inspection workflows, and compliance reporting.
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/30 border border-blue-800/40">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-xs font-medium text-blue-300">Coming Soon — Health V1</span>
      </div>
    </div>
  )
}

export function HealthEnvironment({ onBack }: HealthEnvironmentProps) {
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
      config={HEALTH_CONFIG}
      onBack={onBack}
      fetchActor={fetchActor}
      renderModule={(moduleId) => <PreviewModule moduleId={moduleId} />}
    />
  )
}
