/**
 * OrgPosition data — matches puddlejumper/src/org-manager/types.ts
 * 
 * Real API: GET /org/chart returns flat list with authority chain.
 * POST /org/positions upserts. GET /org/chain/:id returns supervisory chain.
 * Import via POST /org/import with CSV rows → validate → publish.
 * Delegations via GET/POST /org/delegations.
 */

export interface OrgPosition {
  id: string;
  tenantId: string;
  employeeId: string;
  fullName: string;
  title: string;
  department: string;
  supervisorId: string | null;
  email: string;
  employmentStatus: 'active' | 'inactive' | 'vacant' | 'acting' | 'interim';
  authorityLevel: number;  // 1-5, drives approval routing thresholds
  actingForPositionId: string | null;
  separationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgDelegation {
  id: string;
  tenantId: string;
  delegatorId: string;
  delegateeId: string;
  scope: string;
  startDate: string;
  endDate: string | null;
  revokedAt: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
}

// Staff rosters per town (matches townregistry/routes.ts shape)
export const ORG_POSITIONS: Record<string, OrgPosition[]> = {
  phillipston: [
    { id: 'pos_p1', tenantId: 'org_phillipston', employeeId: 'E001', fullName: 'Nate Sullivan', title: 'Town Administrator', department: 'Administration', supervisorId: null, email: 'nate@publiclogic.org', employmentStatus: 'active', authorityLevel: 5, actingForPositionId: null, separationDate: null, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_p2', tenantId: 'org_phillipston', employeeId: 'E002', fullName: 'Sarah Mitchell', title: 'Town Clerk', department: "Clerk's Office", supervisorId: 'pos_p1', email: 'smitchell@phillipston.gov', employmentStatus: 'active', authorityLevel: 4, actingForPositionId: null, separationDate: null, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_p3', tenantId: 'org_phillipston', employeeId: 'E003', fullName: 'Mike Torres', title: 'DPW Director', department: 'DPW', supervisorId: 'pos_p1', email: 'mtorres@phillipston.gov', employmentStatus: 'active', authorityLevel: 4, actingForPositionId: null, separationDate: null, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_p4', tenantId: 'org_phillipston', employeeId: 'E004', fullName: 'Janet Chen', title: 'Town Accountant', department: 'Finance', supervisorId: 'pos_p1', email: 'jchen@phillipston.gov', employmentStatus: 'active', authorityLevel: 4, actingForPositionId: null, separationDate: null, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_p5', tenantId: 'org_phillipston', employeeId: 'E005', fullName: 'Tom Briggs', title: 'Procurement Officer', department: 'Finance', supervisorId: 'pos_p4', email: 'tbriggs@phillipston.gov', employmentStatus: 'active', authorityLevel: 3, actingForPositionId: null, separationDate: null, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_p6', tenantId: 'org_phillipston', employeeId: 'E006', fullName: 'Lisa Novak', title: 'Executive Assistant', department: 'Administration', supervisorId: 'pos_p1', email: 'lnovak@phillipston.gov', employmentStatus: 'active', authorityLevel: 2, actingForPositionId: null, separationDate: null, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_p7', tenantId: 'org_phillipston', employeeId: 'E007', fullName: 'Dan Kowalski', title: 'DPW Foreman', department: 'DPW', supervisorId: 'pos_p3', email: 'dkowalski@phillipston.gov', employmentStatus: 'inactive', authorityLevel: 2, actingForPositionId: null, separationDate: '2026-03-15T00:00:00Z', createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-03-15T10:00:00Z' },
    { id: 'pos_p8', tenantId: 'org_phillipston', employeeId: 'E008', fullName: 'Maria Santos', title: 'DPW Crew Lead', department: 'DPW', supervisorId: 'pos_p3', email: 'msantos@phillipston.gov', employmentStatus: 'active', authorityLevel: 2, actingForPositionId: 'pos_p7', separationDate: null, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-03-16T10:00:00Z' },
    { id: 'pos_p9', tenantId: 'org_phillipston', employeeId: 'E009', fullName: "Kevin O'Brien", title: 'Police Chief', department: 'Police', supervisorId: 'pos_p1', email: 'kobrien@phillipston.gov', employmentStatus: 'active', authorityLevel: 4, actingForPositionId: null, separationDate: null, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
  ],
  westminster: [
    { id: 'pos_w1', tenantId: 'org_westminster', employeeId: 'W001', fullName: 'Robert Hayes', title: 'Town Administrator', department: 'Administration', supervisorId: null, email: 'rhayes@westminster.gov', employmentStatus: 'active', authorityLevel: 5, actingForPositionId: null, separationDate: null, createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_w2', tenantId: 'org_westminster', employeeId: 'W002', fullName: 'Patricia Walsh', title: 'Town Clerk', department: "Clerk's Office", supervisorId: 'pos_w1', email: 'pwalsh@westminster.gov', employmentStatus: 'active', authorityLevel: 4, actingForPositionId: null, separationDate: null, createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_w3', tenantId: 'org_westminster', employeeId: 'W003', fullName: 'James Rivera', title: 'Finance Director', department: 'Finance', supervisorId: 'pos_w1', email: 'jrivera@westminster.gov', employmentStatus: 'active', authorityLevel: 4, actingForPositionId: null, separationDate: null, createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_w4', tenantId: 'org_westminster', employeeId: 'W004', fullName: 'Linda Park', title: 'Building Inspector', department: 'Inspections', supervisorId: 'pos_w1', email: 'lpark@westminster.gov', employmentStatus: 'active', authorityLevel: 3, actingForPositionId: null, separationDate: null, createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
  ],
  sutton: [
    { id: 'pos_s1', tenantId: 'org_sutton', employeeId: 'S001', fullName: 'Mark Devlin', title: 'Town Manager', department: 'Administration', supervisorId: null, email: 'mdevlin@sutton.gov', employmentStatus: 'active', authorityLevel: 5, actingForPositionId: null, separationDate: null, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_s2', tenantId: 'org_sutton', employeeId: 'S002', fullName: 'Claire Dunham', title: 'Town Clerk', department: "Clerk's Office", supervisorId: 'pos_s1', email: 'cdunham@sutton.gov', employmentStatus: 'active', authorityLevel: 4, actingForPositionId: null, separationDate: null, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
  ],
  arlington: [
    { id: 'pos_a1', tenantId: 'org_arlington', employeeId: 'A001', fullName: 'Adam Chapdelaine', title: 'Town Manager', department: 'Administration', supervisorId: null, email: 'achapdelaine@town.arlington.ma.us', employmentStatus: 'active', authorityLevel: 5, actingForPositionId: null, separationDate: null, createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'pos_a2', tenantId: 'org_arlington', employeeId: 'A002', fullName: 'Juliana Brazile', title: 'Town Clerk', department: "Clerk's Office", supervisorId: 'pos_a1', email: 'jbrazile@town.arlington.ma.us', employmentStatus: 'active', authorityLevel: 4, actingForPositionId: null, separationDate: null, createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
  ],
  templeton: [
    { id: 'pos_t1', tenantId: 'org_templeton', employeeId: 'T001', fullName: 'Carol Skelton', title: 'Town Administrator', department: 'Administration', supervisorId: null, email: 'cskelton@templeton.gov', employmentStatus: 'active', authorityLevel: 5, actingForPositionId: null, separationDate: null, createdAt: '2026-03-20T09:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
  ],
  royalston: [],
};

export const DELEGATIONS: Record<string, OrgDelegation[]> = {
  phillipston: [
    { id: 'del_1', tenantId: 'org_phillipston', delegatorId: 'pos_p3', delegateeId: 'pos_p8', scope: 'dpw_approvals', startDate: '2026-03-16T00:00:00Z', endDate: null, revokedAt: null, reason: 'Dan Kowalski separation — Maria Santos acting as DPW Foreman', createdBy: 'user_nate', createdAt: '2026-03-16T10:00:00Z' },
  ],
};

export interface FiscalYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'proposed' | 'adopted' | 'closed';
  createdAt: string;
}

export const FISCAL_YEARS: Record<string, FiscalYear[]> = {
  phillipston: [
    { id: 'fy_p1', label: 'FY2027', startDate: '2026-07-01', endDate: '2027-06-30', status: 'draft', createdAt: '2026-03-01T09:00:00Z' },
    { id: 'fy_p2', label: 'FY2026', startDate: '2025-07-01', endDate: '2026-06-30', status: 'adopted', createdAt: '2025-05-15T09:00:00Z' },
    { id: 'fy_p3', label: 'FY2025', startDate: '2024-07-01', endDate: '2025-06-30', status: 'closed', createdAt: '2024-05-15T09:00:00Z' },
  ],
  westminster: [
    { id: 'fy_w1', label: 'FY2027', startDate: '2026-07-01', endDate: '2027-06-30', status: 'proposed', createdAt: '2026-02-15T09:00:00Z' },
    { id: 'fy_w2', label: 'FY2026', startDate: '2025-07-01', endDate: '2026-06-30', status: 'adopted', createdAt: '2025-05-15T09:00:00Z' },
  ],
  sutton: [
    { id: 'fy_s1', label: 'FY2027', startDate: '2026-07-01', endDate: '2027-06-30', status: 'proposed', createdAt: '2026-02-01T09:00:00Z' },
    { id: 'fy_s2', label: 'FY2026', startDate: '2025-07-01', endDate: '2026-06-30', status: 'adopted', createdAt: '2025-05-15T09:00:00Z' },
  ],
};
