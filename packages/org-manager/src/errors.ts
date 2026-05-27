// @pj/org-manager — structured errors.

import type { RoleType } from '@publiclogic/core';

export class PJIdentityNotFound extends Error {
  readonly code = 'PJIdentityNotFound' as const;
  readonly identity_id: string;
  readonly tenant_id: string;
  constructor(identityId: string, tenantId: string) {
    super(`identity '${identityId}' not found in tenant '${tenantId}'`);
    this.name = 'PJIdentityNotFound';
    this.identity_id = identityId;
    this.tenant_id = tenantId;
  }
}

export class PJInvalidRoleType extends Error {
  readonly code = 'PJInvalidRoleType' as const;
  readonly role_type: string;
  constructor(roleType: string) {
    super(`'${roleType}' is not a canonical role_type`);
    this.name = 'PJInvalidRoleType';
    this.role_type = roleType;
  }
}

export class PJNoEligibleIdentity extends Error {
  readonly code = 'PJNoEligibleIdentity' as const;
  readonly role_type: RoleType;
  readonly strategy: string;
  constructor(roleType: RoleType, strategy: string, detail: string) {
    super(`no eligible identity for role '${roleType}' via '${strategy}': ${detail}`);
    this.name = 'PJNoEligibleIdentity';
    this.role_type = roleType;
    this.strategy = strategy;
  }
}
