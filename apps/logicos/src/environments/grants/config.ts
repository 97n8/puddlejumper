import type { EnvironmentConfig } from '../../framework/types'

export const GRANTS_CONFIG: EnvironmentConfig = {
  id: 'grants', name: 'Grants V1', tagline: 'Grant lifecycle & utility management',
  color: 'emerald', apiBase: '/api/v1/grants', badge: 'Coming', defaultModule: 'workbench',
  modules: [
    { id: 'workbench', label: 'Workbench',      icon: '⚡', group: 'Grants', comingSoon: true },
    { id: 'tracking',  label: 'Grant Tracking', icon: '📋', group: 'Grants', comingSoon: true },
    { id: 'closeout',  label: 'Closeout',        icon: '✅', group: 'Grants', comingSoon: true },
    { id: 'utility',   label: 'Utility Billing', icon: '💧', group: 'Grants', comingSoon: true },
  ],
}
