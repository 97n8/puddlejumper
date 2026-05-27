// Canon: Org Manager identities + assignments.
// Source: Master Build Spec v1.1, Part 3 (Canonical Object Model).

import type { RoleType } from './process.js';

export type IdentityKind = 'person' | 'service' | 'delegation';

export interface Identity {
  identity_id: string;
  tenant_id: string;
  kind: IdentityKind;
  active: boolean;
  created_at: string;
  deactivated_at: string | null;
}

export interface Assignment {
  assignment_id: string;
  process_id: string;
  identity_id: string;
  role_type: RoleType;
  tenant_id: string;
  assigned_at: string;
  unassigned_at: string | null;
  assigned_by_ref: string | null;
}
