// @pj/pipeline — C3 rule pack resolver.
// Resolve the rules. Don't enforce them yet.
//
// Reads the C2 `rule_packs` table and resolves the single ACTIVE pack for a
// (tenant, module, environment) triple into a typed RulePack object. No VAULT
// verdicts, no holds, no enforcement — C3 only answers "which pack governs
// this scope?" so the pipeline can carry the rulePackId forward.
//
// Like @pj/org-manager, every function takes an injected `db` handle as the
// first argument and never opens its own connection.

import crypto from 'node:crypto';
import type { DatabaseHandle } from '@pj/db';

/** Scope that selects exactly one active rule pack (C2 unique index). */
export interface RulePackScope {
  tenant_id: string;
  module: string;
  environment: string;
}

/** Typed view of a `rule_packs` row. `content` is the parsed `content_json`. */
export interface RulePack {
  rule_pack_id: string;
  tenant_id: string;
  module: string;
  environment: string;
  pack: string;
  version: string;
  is_active: boolean;
  content: Record<string, unknown>;
  created_at: string;
}

type RulePackRow = {
  rule_pack_id: string;
  tenant_id: string;
  module: string;
  environment: string;
  pack: string;
  version: string;
  is_active: 0 | 1;
  content_json: string;
  created_at: string;
};

function rowToRulePack(row: RulePackRow): RulePack {
  let content: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(row.content_json);
    content =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    content = {};
  }
  return {
    rule_pack_id: row.rule_pack_id,
    tenant_id: row.tenant_id,
    module: row.module,
    environment: row.environment,
    pack: row.pack,
    version: row.version,
    is_active: row.is_active === 1,
    content,
    created_at: row.created_at,
  };
}

/** Raised when no active rule pack exists for the requested scope. */
export class PJRulePackNotFound extends Error {
  readonly code = 'PJRulePackNotFound' as const;
  readonly scope: RulePackScope;
  constructor(scope: RulePackScope) {
    super(
      `no active rule pack for tenant '${scope.tenant_id}' / module ` +
        `'${scope.module}' / environment '${scope.environment}'`,
    );
    this.name = 'PJRulePackNotFound';
    this.scope = scope;
  }
}

/**
 * Resolve the single ACTIVE rule pack for a scope. Inactive versions are
 * ignored. Throws {@link PJRulePackNotFound} when none is active.
 *
 * The C2 partial unique index guarantees at most one active row per scope,
 * so this is a deterministic lookup.
 */
export function resolveActiveRulePack(
  db: DatabaseHandle,
  scope: RulePackScope,
): RulePack {
  const found = findActiveRulePack(db, scope);
  if (!found) {
    throw new PJRulePackNotFound(scope);
  }
  return found;
}

/**
 * Same as {@link resolveActiveRulePack} but returns `null` instead of throwing
 * when no active pack exists. Useful for callers that treat "no governing
 * pack" as a normal branch.
 */
export function findActiveRulePack(
  db: DatabaseHandle,
  scope: RulePackScope,
): RulePack | null {
  const row = db
    .prepare(
      `SELECT * FROM rule_packs
       WHERE tenant_id = ? AND module = ? AND environment = ? AND is_active = 1`,
    )
    .get(scope.tenant_id, scope.module, scope.environment) as
    | RulePackRow
    | undefined;
  return row ? rowToRulePack(row) : null;
}

/** Input for seeding a rule pack row. */
export interface SeedRulePackInput {
  tenant_id: string;
  module: string;
  environment: string;
  pack: string;
  version: string;
  is_active?: boolean;
  content?: Record<string, unknown>;
}

/**
 * Insert one rule pack row and return the typed RulePack. Generates the
 * `rule_pack_id`. Seeding an active pack relies on the C2 unique index to
 * refuse a second active pack for the same scope.
 */
export function seedRulePack(
  db: DatabaseHandle,
  input: SeedRulePackInput,
): RulePack {
  const rule_pack_id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO rule_packs (
       rule_pack_id, tenant_id, module, environment, pack, version,
       is_active, content_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    rule_pack_id,
    input.tenant_id,
    input.module,
    input.environment,
    input.pack,
    input.version,
    input.is_active ? 1 : 0,
    JSON.stringify(input.content ?? {}),
  );

  return rowToRulePack(
    db
      .prepare('SELECT * FROM rule_packs WHERE rule_pack_id = ?')
      .get(rule_pack_id) as RulePackRow,
  );
}

/**
 * Canon scope + content for the `guestops.stay` V1 proof pack (Issue #99).
 * C3 seeds the pack metadata only — the autonomy ceiling, retention class,
 * and output template named here are descriptive, NOT enforced yet.
 */
export const GUESTOPS_STAY = {
  module: 'guestops',
  environment: 'stay',
  pack: 'guestops.stay',
  version: '1',
  content: {
    input: 'reservation',
    enrichment: ['calendar', 'lock', 'cleaning'],
    autonomy_ceiling: 'run_routine',
    output_template: 'guest_arrival_brief',
    retention_class: 'stay-operations',
  },
} as const;

/**
 * Seed the active `guestops.stay` rule pack for a tenant. Idempotent-friendly
 * for tests: if an active pack already exists for the scope, returns it
 * instead of inserting a duplicate (which the unique index would refuse).
 */
export function seedGuestopsStay(
  db: DatabaseHandle,
  tenant_id: string,
): RulePack {
  const existing = findActiveRulePack(db, {
    tenant_id,
    module: GUESTOPS_STAY.module,
    environment: GUESTOPS_STAY.environment,
  });
  if (existing) {
    return existing;
  }
  return seedRulePack(db, {
    tenant_id,
    module: GUESTOPS_STAY.module,
    environment: GUESTOPS_STAY.environment,
    pack: GUESTOPS_STAY.pack,
    version: GUESTOPS_STAY.version,
    is_active: true,
    content: { ...GUESTOPS_STAY.content },
  });
}
