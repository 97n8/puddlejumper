export interface VaultModuleDefinition {
  id: string
  label: string
  description: string
  icon: string
  color: string
}

export const VAULT_MODULES: VaultModuleDefinition[] = [
  { id: 'public-records',   label: 'Public Records',   icon: 'FolderOpen',     color: '#1A3A6B', description: 'Requests, responses, and retention-governed records' },
  { id: 'permitting',       label: 'Permitting',        icon: 'Hammer',         color: '#0E5C62', description: 'Building, zoning, and licensing permits' },
  { id: 'board-compliance', label: 'Board Compliance',  icon: 'Gavel',          color: '#B87820', description: 'Meeting minutes, agendas, and open meeting obligations' },
  { id: 'appointments',     label: 'Appointments',      icon: 'UsersThree',     color: '#1A5C35', description: 'Board and committee membership tracking' },
  { id: 'fiscal',           label: 'Fiscal',            icon: 'CurrencyDollar', color: '#8B1F1F', description: 'Appropriations, transfers, and financial compliance' },
]
