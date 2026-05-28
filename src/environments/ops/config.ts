import type { EnvironmentConfig } from '../../framework/types'

export const OPS_CONFIG: EnvironmentConfig = {
  id: 'ops', name: 'Operations V1', tagline: 'Infrastructure, facilities & field services',
  color: 'amber', apiBase: '/api/v1/ops', badge: 'Coming', defaultModule: 'workbench',
  modules: [
    { id: 'workbench',  label: 'Workbench',   icon: '⚡', group: 'Ops', comingSoon: true },
    { id: 'workorders', label: 'Work Orders', icon: '🔧', group: 'Ops', comingSoon: true },
    { id: 'assets',     label: 'Assets',       icon: '🏗', group: 'Ops', comingSoon: true },
    { id: 'fleet',      label: 'Fleet',        icon: '🚛', group: 'Ops', comingSoon: true },
  ],
}
