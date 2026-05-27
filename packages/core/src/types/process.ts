// Canon: PuddleJumper Process object.
// Source: Master Build Spec v1.1, Part 3 (Canonical Object Model).
// Every other package must import these types from @publiclogic/core,
// never redefine them locally.

export type ProcessType = 'PRR' | 'PROCUREMENT' | 'MEETING' | 'CUSTOM';

export type ProvisioningTier = 'single' | 'double' | 'teams';

export interface Process {
  process_id: string;
  process_type: ProcessType;
  canon_version: string;
  tenant_id: string;
  deployment_id: string;
  current_state: string;
  created_at: string;
  created_by_ref: string;
  assignee_ref: string | null;
  closed_at: string | null;
  fields: Record<string, unknown>;
  links: ProcessLink[];
}

export interface ProcessLink {
  type: string;
  ref: string;
  label?: string;
}

export interface ProcessTransition {
  from: string;
  to: string;
  trigger: string;
  guard?: string;
  effects: CanonicalEffect[];
}

// Closed set — extend only via canon release.
export type CanonicalEffect = 'emit_event' | 'assign' | 'notify' | 'link' | 'close';

// Closed set — Part 3, Canonical Role Types.
export type RoleType =
  | 'requestor'
  | 'intake'
  | 'assignee'
  | 'reviewer'
  | 'approver'
  | 'records_officer'
  | 'auditor'
  | 'administrator';

// Closed set — Part 3, Canonical Actions.
export type CanonicalAction =
  | 'process.create'
  | 'process.read'
  | 'process.update_fields'
  | 'process.transition'
  | 'process.close'
  | 'process.assign'
  | 'process.unassign'
  | 'audit.read'
  | 'audit.export';
