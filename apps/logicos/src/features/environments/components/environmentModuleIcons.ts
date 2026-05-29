import type { ComponentType } from 'react'
import {
  Archive,
  CalendarBlank,
  ClipboardText,
  CurrencyDollar,
  FolderOpen,
  Gavel,
  Hammer,
  Package,
  UsersThree,
  Wrench,
} from '@phosphor-icons/react'

type IconComponent = ComponentType<{ size?: number; className?: string; weight?: 'duotone' | 'regular' | 'bold' | 'fill' | 'thin' | 'light' }>

export interface EnvironmentModuleMeta {
  id: string
  label: string
  color: string
  Icon: IconComponent
}

const MODULE_ICON_MAP: Record<string, EnvironmentModuleMeta> = {
  'public-records':   { id: 'public-records', label: 'Public Records', color: '#1A3A6B', Icon: FolderOpen },
  'board-compliance': { id: 'board-compliance', label: 'Board Compliance', color: '#B87820', Icon: Gavel },
  appointments:       { id: 'appointments', label: 'Appointments', color: '#1A5C35', Icon: UsersThree },
  permitting:         { id: 'permitting', label: 'Permitting', color: '#0E5C62', Icon: Hammer },
  fiscal:             { id: 'fiscal', label: 'Fiscal', color: '#8B1F1F', Icon: CurrencyDollar },
  VAULTPRR:           { id: 'VAULTPRR', label: 'Public Records', color: '#1A3A6B', Icon: FolderOpen },
  VAULTCLERK:         { id: 'VAULTCLERK', label: 'Clerk', color: '#B87820', Icon: ClipboardText },
  VAULTFISCAL:        { id: 'VAULTFISCAL', label: 'Fiscal', color: '#8B1F1F', Icon: CurrencyDollar },
  VAULTTIME:          { id: 'VAULTTIME', label: 'Payroll', color: '#7C3AED', Icon: CalendarBlank },
  VAULTFIX:           { id: 'VAULTFIX', label: 'Maintenance', color: '#D97706', Icon: Wrench },
  VAULTONBOARD:       { id: 'VAULTONBOARD', label: 'Onboarding', color: '#0F766E', Icon: UsersThree },
  VAULTPERMIT:        { id: 'VAULTPERMIT', label: 'Permitting', color: '#0E5C62', Icon: Hammer },
  VAULTHR:            { id: 'VAULTHR', label: 'HR', color: '#BE185D', Icon: Archive },
  VAULTPROCURE:       { id: 'VAULTPROCURE', label: 'Procurement', color: '#4F46E5', Icon: Package },
  VAULTRECS:          { id: 'VAULTRECS', label: 'Records', color: '#0891B2', Icon: Archive },
  VAULTMEET:          { id: 'VAULTMEET', label: 'Meetings', color: '#7C3AED', Icon: CalendarBlank },
  VAULTDOG:           { id: 'VAULTDOG', label: 'Animal Control', color: '#059669', Icon: ClipboardText },
}

export function resolveEnvironmentModules(moduleIds?: string[]) {
  return (moduleIds ?? [])
    .map(id => MODULE_ICON_MAP[id])
    .filter((item): item is EnvironmentModuleMeta => !!item)
    .filter((item, index, items) => items.findIndex(candidate => candidate.label === item.label) === index)
}
