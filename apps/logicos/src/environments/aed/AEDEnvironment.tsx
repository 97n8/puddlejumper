import { useCallback, useEffect } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { EnvironmentShell } from '../../framework/EnvironmentShell'
import { AED_CONFIG } from './config'
import type { EnvironmentActor } from '../../framework/types'
import { aedApi } from '../../features/aed/api/aedApi'
import { AEDWorkbench } from '../../features/aed/pages/AEDWorkbench'
import { VaultDealsPage } from '../../features/aed/pages/VaultDealsPage'
import { ObligationsPage } from '../../features/aed/pages/ObligationsPage'
import { QALICBPage } from '../../features/aed/pages/QALICBPage'
import { MaterialEventsPage } from '../../features/aed/pages/MaterialEventsPage'
import { GovernancePage } from '../../features/aed/pages/GovernancePage'
import { AEDAuditPage } from '../../features/aed/pages/AEDAuditPage'
import { SSCB1CaseSpace } from '../../features/aed/projects/sscb1/SSCB1CaseSpace'
import { Building, Gavel, ListChecks, Buildings, Warning, Key, Clipboard } from '@phosphor-icons/react'
import {
  aedPanelClass,
  aedPageClass,
  aedSectionStackClass,
  aedSubtitleClass,
  aedTitleClass,
} from '../../features/aed/aedTheme'

interface AEDEnvironmentProps {
  onBack: () => void
  initialModule?: string
}

function ComingSoonModule({ label }: { label: string }) {
  return (
    <div className={`${aedPageClass} min-h-full`}>
      <div className={`mx-auto flex max-w-xl flex-col items-center justify-center gap-6 p-10 text-center ${aedSectionStackClass}`}>
        <div className={`flex h-20 w-20 items-center justify-center ${aedPanelClass('amber')}`}>
          <Building size={32} weight="duotone" className="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="max-w-sm">
          <div className={aedTitleClass}>{label}</div>
          <p className={aedSubtitleClass}>
            This module is coming in the next AED × PublicLogic release.
          </p>
        </div>
        <div className={aedPanelClass('amber', 'inline-flex items-center gap-2 rounded-full px-4 py-2')}>
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Coming Soon — AED V2</span>
        </div>
      </div>
    </div>
  )
}

export function AEDEnvironment({ onBack, initialModule }: AEDEnvironmentProps) {
  const { user, logout } = useAuth()

  useEffect(() => {
    const handler = () => { logout(); onBack() }
    window.addEventListener('aed:session-expired', handler)
    return () => window.removeEventListener('aed:session-expired', handler)
  }, [logout, onBack])

  const fetchActor = useCallback(async (): Promise<EnvironmentActor> => {
    const { actor } = await aedApi.me()
    return {
      id: actor.id,
      object_id: actor.object_id,
      display_name: actor.display_name,
      email: actor.email,
      civic_role: actor.role,
    }
  }, [])

  const renderModule = useCallback((moduleId: string, _actor: EnvironmentActor, onNavigate: (id: string) => void) => {
    const mod = AED_CONFIG.modules.find(m => m.id === moduleId)
    if (mod?.comingSoon) return <ComingSoonModule label={mod.label} />

    switch (moduleId) {
      case 'workbench':       return <AEDWorkbench actorRole={user?.role ?? 'staff'} onNavigate={onNavigate} />
      case 'deals':           return <VaultDealsPage onNavigate={onNavigate} />
      case 'obligations':     return <ObligationsPage onNavigate={onNavigate} />
      case 'qalicbs':         return <QALICBPage onNavigate={onNavigate} />
      case 'material-events': return <MaterialEventsPage onNavigate={onNavigate} />
      case 'governance':      return <GovernancePage />
      case 'audit':           return <AEDAuditPage />
      case 'sscb1':           return <SSCB1CaseSpace onNavigate={onNavigate} />
      default:                return <ComingSoonModule label={moduleId} />
    }
  }, [user])

  return (
    <EnvironmentShell
      config={AED_CONFIG}
      onBack={onBack}
      fetchActor={fetchActor}
      renderModule={renderModule}
      initialModule={initialModule}
    />
  )
}
