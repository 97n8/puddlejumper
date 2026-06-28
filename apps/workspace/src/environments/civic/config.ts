import type { EnvironmentConfig } from '../../framework/types'

export const CIVIC_CONFIG: EnvironmentConfig = {
  id: 'civic',
  name: 'Civic',
  tagline: 'MGL-compliant municipal governance',
  color: 'red',
  apiBase: '/api/v1/civic',
  badge: 'Live',
  defaultModule: 'workbench',
  modules: [
    // Town
    { id: 'workbench',   label: 'Workbench',            icon: '⚡', group: 'Town' },
    { id: 'org',         label: 'Org & Staff',           icon: '🏛', group: 'Town' },
    { id: 'setup',       label: 'Environment Setup',     icon: '⚙', group: 'Town' },
    // Governing
    { id: 'meetings',    label: 'Meetings & OML',        icon: '📋', group: 'Governing',  comingSoon: true },
    { id: 'minutes',     label: 'Minutes & Votes',       icon: '🗳', group: 'Governing',  comingSoon: true },
    // Compliance
    { id: 'records',     label: 'Records Requests',      icon: '📁', group: 'Compliance' },
    { id: 'procurement', label: 'Procurement',            icon: '🛒', group: 'Compliance' },
    { id: 'contracts',   label: 'Contracts',              icon: '📜', group: 'Compliance', comingSoon: true },
    // Finance
    { id: 'finance',     label: 'Budget & Finance',      icon: '💰', group: 'Finance' },
    { id: 'grants',      label: 'Grants',                 icon: '🌿', group: 'Finance',    comingSoon: true },
    // Documents
    { id: 'documents',   label: 'Documents & Templates', icon: '📄', group: 'Documents' },
    // Community
    { id: 'permits',     label: 'Permits',                icon: '🪪', group: 'Community',  comingSoon: true },
    // System
    { id: 'exceptions',  label: 'Exceptions',             icon: '⚠', group: 'System' },
    { id: 'deadlines',   label: 'Deadlines',              icon: '⏱', group: 'System' },
    { id: 'objects',     label: 'All Objects',            icon: '🗂', group: 'System' },
  ],
}
