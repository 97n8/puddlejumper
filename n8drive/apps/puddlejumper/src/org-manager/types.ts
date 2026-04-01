export interface OrgPosition {
  id: string
  tenantId: string
  employeeId: string
  fullName: string
  title: string
  department: string
  supervisorId: string | null
  email: string
  employmentStatus: 'active' | 'inactive' | 'vacant' | 'acting' | 'interim'
  authorityLevel: number // 1-5, drives approval routing thresholds
  actingForPositionId: string | null
  separationDate: string | null
  createdAt: string
  updatedAt: string
}

export interface OrgDelegation {
  id: string
  tenantId: string
  delegatorId: string   // positionId granting authority
  delegateeId: string   // positionId receiving authority
  scope: string         // e.g. 'procurement', 'approvals', 'all'
  startDate: string
  endDate: string | null // null = until revoked
  revokedAt: string | null
  reason: string
  createdBy: string
  createdAt: string
}

export interface OrgImportJob {
  id: string
  tenantId: string
  status: 'pending' | 'processing' | 'validated' | 'failed' | 'published'
  rowCount: number
  validCount: number
  errorCount: number
  errors: Array<{ row: number; field: string; message: string }>
  createdBy: string
  createdAt: string
  publishedAt: string | null
}
