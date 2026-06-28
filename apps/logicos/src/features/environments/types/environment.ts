import type { CaseSpace } from '@/lib/types'

export type UserRole =
  | 'superadmin'
  | 'implementer'
  | 'tenant-admin'
  | 'tenant-operator'
  | 'viewer'

export interface EnvironmentMember {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  lastActive?: string
}

export interface VaultModuleStats {
  moduleId: string
  label: string
  icon: string
  recordCount: number
  pendingCount: number
  enabled: boolean
}

export interface EnvironmentActivity {
  id: string
  timestamp: string
  actor: string
  action: string
  moduleId?: string
  recordId?: string
  severity: 'info' | 'warn' | 'success'
}

export interface EnvironmentExtended extends CaseSpace {
  userRole?: UserRole
  moduleStats?: VaultModuleStats[]
  memberCount?: number
  activityPreview?: EnvironmentActivity[]
}
