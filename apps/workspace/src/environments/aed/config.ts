import type { EnvironmentConfig } from '../../framework/types'

export const AED_CONFIG: EnvironmentConfig = {
  id: 'aed',
  name: 'AED × PublicLogic',
  tagline: 'Portfolio command · Seven-year compliance · Investor-grade visibility',
  color: 'amber',
  apiBase: '/api/v1/aed',
  badge: 'Live',
  defaultModule: 'workbench',
  modules: [
    // Overview
    { id: 'workbench',        label: 'Command',                icon: '⚡', group: 'Overview' },
    // NMTC Compliance Vault
    { id: 'deals',            label: 'Deals',                   icon: '🏛', group: 'Deals' },
    { id: 'obligations',      label: 'Requirements',             icon: '📋', group: 'Deals' },
    { id: 'qalicbs',          label: 'Business Certifications',  icon: '🏢', group: 'Deals' },
    { id: 'material-events',  label: 'Events & Alerts',          icon: '⚠', group: 'Deals' },
    // Governance
    { id: 'governance',       label: 'Authority & Access',       icon: '🔑', group: 'Governance' },
    // Deal Support
    { id: 'deal-support',     label: 'Deal Support',             icon: '📊', group: 'Deal Support', comingSoon: true },
    // Legislative
    { id: 'legislative',      label: 'Legislative Strategy',     icon: '⚖', group: 'Legislative', comingSoon: true },
    // Projects
    { id: 'sscb1',            label: 'SSCB1',                    icon: '🌿', group: 'Projects' },
    // System
    { id: 'audit',            label: 'Audit Trail',              icon: '🗂', group: 'System' },
  ],
}
