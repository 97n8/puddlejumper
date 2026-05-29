import { DEFAULT_SUTTON_ENVIRONMENT_ID, getDemoUserScope, type SuttonViewer } from '@/lib/environmentAccess'
import { defaultModuleConfig, listBuilderSessions, saveBuilderSession } from '@/lib/vault-modules'

const SUTTON_DEMO_MODULES = ['VAULTHR', 'VAULTTIME', 'VAULTFIX'] as const

export function ensureSuttonDemoSession(viewer?: SuttonViewer | null) {
  const scope = getDemoUserScope(viewer ?? null)
  const existing = listBuilderSessions(scope).find((session) => session.id === DEFAULT_SUTTON_ENVIRONMENT_ID)
  const configs = Object.fromEntries(
    SUTTON_DEMO_MODULES.map((moduleId) => {
      const config = defaultModuleConfig(moduleId)
      if (moduleId === 'VAULTHR') {
        config.primaryApprover = 'Sutton Town Manager'
        config.notes = 'Town Manager staffing approvals and policy actions.'
      }
      if (moduleId === 'VAULTTIME') {
        config.primaryApprover = 'Sutton Town Manager'
        config.notes = 'Time and attendance review for Town Manager sign-off.'
      }
      if (moduleId === 'VAULTFIX') {
        config.primaryApprover = 'Steven T. Rowell'
        config.notes = 'DPW work order queue with manager visibility.'
      }
      return [moduleId, config]
    }),
  )

  return saveBuilderSession({
    id: DEFAULT_SUTTON_ENVIRONMENT_ID,
    town: 'Town of Sutton',
    selectedModuleIds: [...SUTTON_DEMO_MODULES],
    configs,
    status: 'activated',
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: existing?.updatedAt ?? Date.now(),
    brandConfig: {
      displayName: 'Town of Sutton — Governance Demo',
      color: '#2f7c65',
      icon: '🏛️',
    },
    connectConfig: existing?.connectConfig ?? {
      connectors: [],
      folders: [],
      templates: [],
    },
    source: 'seed',
  }, scope)
}
