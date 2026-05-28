export interface OrgPosition {
  id: string
  employeeId: string
  fullName: string
  title: string
  department: string
  supervisorId: string | null
  email: string
  employmentStatus: 'active' | 'inactive' | 'vacant' | 'acting' | 'interim'
  authorityLevel: number
  governanceRoles: string[]
  actingForPositionId: string | null
  actingStartDate: string | null
  separationDate: string | null
  createdAt: string
  updatedAt: string
}

export interface OrgDelegation {
  id: string
  delegatorId: string
  delegateeId: string
  scope: string
  startDate: string
  endDate: string | null
  revokedAt: string | null
  reason: string
  createdAt: string
}
