// Canon: closed sets of role types and actions, plus the default
// permission map used when no overlay is loaded.
// Source: Master Build Spec v1.1, Part 3 (Canonical Role Types + Actions)
// and Phase 3 prompt (DEFAULT_PERMISSIONS).

import type { CanonicalAction, RoleType } from '@publiclogic/core';

export const CANONICAL_ROLE_TYPES: readonly RoleType[] = [
  'requestor',
  'intake',
  'assignee',
  'reviewer',
  'approver',
  'records_officer',
  'auditor',
  'administrator',
] as const;

export const CANONICAL_ACTIONS: readonly CanonicalAction[] = [
  'process.create',
  'process.read',
  'process.update_fields',
  'process.transition',
  'process.close',
  'process.assign',
  'process.unassign',
  'audit.read',
  'audit.export',
] as const;

/**
 * Default permission map. Used when no overlay is loaded. Overlays may
 * override per `SP.ROLE.BINDING` (canon Split-Row Runtime Contract).
 */
export const DEFAULT_PERMISSIONS: Readonly<Record<RoleType, readonly CanonicalAction[]>> = {
  administrator: [
    'process.create',
    'process.read',
    'process.update_fields',
    'process.transition',
    'process.close',
    'process.assign',
    'process.unassign',
    'audit.read',
    'audit.export',
  ],
  records_officer: [
    'process.read',
    'process.update_fields',
    'process.transition',
    'process.close',
    'audit.read',
    'audit.export',
  ],
  reviewer: ['process.read', 'process.update_fields', 'process.transition'],
  approver: ['process.read', 'process.transition'],
  assignee: ['process.read', 'process.update_fields', 'process.transition'],
  intake: ['process.read', 'process.update_fields', 'process.transition', 'process.assign'],
  auditor: ['process.read', 'audit.read', 'audit.export'],
  requestor: ['process.read'],
};

export function isCanonicalRoleType(value: string): value is RoleType {
  return (CANONICAL_ROLE_TYPES as readonly string[]).includes(value);
}

export function rolePermits(roleType: RoleType, action: CanonicalAction): boolean {
  return DEFAULT_PERMISSIONS[roleType].includes(action);
}
