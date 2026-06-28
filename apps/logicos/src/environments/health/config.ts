import type { EnvironmentConfig } from '../../framework/types'

export const HEALTH_CONFIG: EnvironmentConfig = {
  id: 'health', name: 'Health V1', tagline: 'Public health & clinical operations',
  color: 'blue', apiBase: '/api/v1/health', badge: 'Coming', defaultModule: 'workbench',
  modules: [
    { id: 'workbench',   label: 'Workbench',       icon: '⚡', group: 'Health', comingSoon: true },
    { id: 'cases',       label: 'Case Management', icon: '📋', group: 'Health', comingSoon: true },
    { id: 'inspections', label: 'Inspections',      icon: '🔍', group: 'Health', comingSoon: true },
    { id: 'reporting',   label: 'Reporting',        icon: '📊', group: 'Health', comingSoon: true },
  ],
}
