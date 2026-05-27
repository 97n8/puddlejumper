// PJ Seed — personal tenant + identities, YAML-driven, idempotent.
//
// Source: SEED prompt 2026-05-27.  Adds the bootstrapping artifact that
// turns "the canon machinery exists" into "two real people can use it."
//
// Properties:
//   - Idempotent. Re-running creates nothing already present.
//   - No raw SQL. All writes go through @pj/db / @pj/org-manager.
//   - Audit-emitting. tenant.seeded / identity.seeded / role.seeded /
//     process.created events all land in audit_events.
//   - Safe in prod. No destructive operations; safe to cron.
//   - No OAuth subject IDs in YAML — those link at first login.
//   - Role changes via seed are refused with a WARN line. Use the
//     org-manager API.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import {
  appendAuditEvent,
  getDb,
  migrate,
  type DatabaseHandle,
} from '@pj/db';
import {
  CANONICAL_ROLE_TYPES,
  assign,
  createIdentity,
  createTenant,
} from '@pj/org-manager';
import type { RoleType } from '@publiclogic/core';
import { createPRR } from '../src/domains/prr/index.js';

const CANON_VERSION = '1.0.0';
const SEED_ACTOR = 'system.seed';

function deploymentId(): string {
  return process.env.PJ_DEPLOYMENT_ID ?? 'default';
}

// ── Schema ──────────────────────────────────────────────────────────────────

const SeedSchema = z
  .object({
    tenant: z.object({
      id: z.string().regex(/^[a-z0-9-]+$/, 'tenant.id must be kebab-case'),
      display_name: z.string().min(1),
      tier: z.enum(['single', 'overlay', 'network']),
    }),
    identities: z
      .array(
        z.object({
          email: z.string().email(),
          display_name: z.string().min(1),
          role: z.enum(CANONICAL_ROLE_TYPES as readonly [RoleType, ...RoleType[]]),
          seed_process: z
            .object({
              template_id: z.string().min(1),
              domain: z.string().min(1),
              title: z.string().min(1),
              notes: z.string().optional(),
            })
            .optional(),
        }),
      )
      .min(1),
  })
  .strict();

export type SeedInput = z.infer<typeof SeedSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────

interface OutcomeRow {
  kind: 'tenant' | 'identity' | 'role' | 'process';
  label: string;
  status: 'created' | 'existing' | 'warned';
  detail?: string;
}

function findIdentityByEmail(
  db: DatabaseHandle,
  tenantId: string,
  email: string,
): { identity_id: string } | null {
  const row = db
    .prepare(`SELECT identity_id FROM identities WHERE tenant_id = ? AND email = ?`)
    .get(tenantId, email) as { identity_id: string } | undefined;
  return row ?? null;
}

function findActiveAssignment(
  db: DatabaseHandle,
  identityId: string,
  tenantId: string,
): { role_type: string } | null {
  const row = db
    .prepare(
      `SELECT role_type FROM assignments
       WHERE identity_id = ? AND tenant_id = ? AND unassigned_at IS NULL
       ORDER BY assigned_at DESC LIMIT 1`,
    )
    .get(identityId, tenantId) as { role_type: string } | undefined;
  return row ?? null;
}

function findSeedProcess(
  db: DatabaseHandle,
  tenantId: string,
  createdByRef: string,
  title: string,
): { process_id: string } | null {
  const row = db
    .prepare(
      `SELECT process_id FROM processes
       WHERE tenant_id = ? AND created_by_ref = ?
         AND json_extract(fields, '$.title') = ?`,
    )
    .get(tenantId, createdByRef, title) as { process_id: string } | undefined;
  return row ?? null;
}

// ── Core ────────────────────────────────────────────────────────────────────

export interface SeedResult {
  outcomes: OutcomeRow[];
}

/**
 * Apply a seed input to the database in a single transaction.  Exported
 * for tests so they can drive seeding against in-memory DBs.
 */
export function seedFromInput(db: DatabaseHandle, input: SeedInput): SeedResult {
  const outcomes: OutcomeRow[] = [];

  const tx = db.transaction(() => {
    // ── tenant ────────────────────────────────────────────────────────────
    const tenantRes = createTenant(db, {
      id: input.tenant.id,
      name: input.tenant.display_name,
      canonVersion: CANON_VERSION,
    });
    if (tenantRes.created) {
      appendAuditEvent(db, {
        event_family: 'system',
        event_subtype: 'tenant.seeded',
        canon_version: CANON_VERSION,
        deployment_id: deploymentId(),
        tenant_id: input.tenant.id,
        process_id: null,
        actor_ref: SEED_ACTOR,
        payload: {
          tenant_id: input.tenant.id,
          display_name: input.tenant.display_name,
          tier: input.tenant.tier,
        },
      });
    }
    outcomes.push({
      kind: 'tenant',
      label: input.tenant.id,
      status: tenantRes.created ? 'created' : 'existing',
    });

    // ── identities → roles → seed processes ───────────────────────────────
    for (const p of input.identities) {
      // identity
      const existingId = findIdentityByEmail(db, input.tenant.id, p.email);
      let identityId: string;

      if (existingId) {
        identityId = existingId.identity_id;
        outcomes.push({ kind: 'identity', label: p.email, status: 'existing' });
      } else {
        const idRes = createIdentity(db, {
          tenantId: input.tenant.id,
          kind: 'person',
          email: p.email,
          displayName: p.display_name,
        });
        identityId = idRes.identity.identity_id;
        appendAuditEvent(db, {
          event_family: 'role',
          event_subtype: 'identity.seeded',
          canon_version: CANON_VERSION,
          deployment_id: deploymentId(),
          tenant_id: input.tenant.id,
          process_id: null,
          actor_ref: SEED_ACTOR,
          payload: {
            identity_id: identityId,
            email: p.email,
            display_name: p.display_name,
            kind: 'person',
          },
        });
        outcomes.push({ kind: 'identity', label: p.email, status: 'created' });
      }

      // role assignment — workspace-level, not bound to any specific
      // process.  The canon assignments table requires process_id, so we
      // record a tenant-level role assignment by linking it to a sentinel
      // "tenant root" pseudo-process that's seeded on first run.
      // (Alternative would be a separate workspace_roles table, but the
      // seed prompt is explicit: no schema sprawl.)
      const rootProcessId = ensureTenantRootProcess(db, input.tenant.id);

      const currentRole = findActiveAssignment(db, identityId, input.tenant.id);
      if (currentRole?.role_type === p.role) {
        outcomes.push({
          kind: 'role',
          label: `${p.email} → ${p.role}`,
          status: 'existing',
        });
      } else if (currentRole && currentRole.role_type !== p.role) {
        // Loud refusal — do not mutate.
        // eslint-disable-next-line no-console
        console.warn(
          `WARN: identity ${p.email} has role ${currentRole.role_type} in DB, ` +
            `YAML says ${p.role} — leaving DB role unchanged; use org-manager ` +
            `API to change role`,
        );
        outcomes.push({
          kind: 'role',
          label: `${p.email} → ${p.role}`,
          status: 'warned',
          detail: `db role ${currentRole.role_type} ≠ yaml ${p.role}`,
        });
      } else {
        assign(
          db,
          rootProcessId,
          p.role,
          { strategy: 'named_default', identity_ref: identityId },
          input.tenant.id,
          SEED_ACTOR,
        );
        appendAuditEvent(db, {
          event_family: 'role',
          event_subtype: 'role.seeded',
          canon_version: CANON_VERSION,
          deployment_id: deploymentId(),
          tenant_id: input.tenant.id,
          process_id: rootProcessId,
          actor_ref: SEED_ACTOR,
          payload: {
            identity_id: identityId,
            email: p.email,
            role_type: p.role,
          },
        });
        outcomes.push({
          kind: 'role',
          label: `${p.email} → ${p.role}`,
          status: 'created',
        });
      }

      // seed process
      if (p.seed_process) {
        const existing = findSeedProcess(
          db,
          input.tenant.id,
          identityId,
          p.seed_process.title,
        );
        if (existing) {
          outcomes.push({
            kind: 'process',
            label: `"${p.seed_process.title}" for ${p.email}`,
            status: 'existing',
            detail: existing.process_id,
          });
        } else {
          const created = createPRR(db, input.tenant.id, identityId, {
            fields: {
              template_id: p.seed_process.template_id,
              domain: p.seed_process.domain,
              title: p.seed_process.title,
              notes: p.seed_process.notes ?? '',
              subject: p.seed_process.title,
            },
          });
          outcomes.push({
            kind: 'process',
            label: `"${p.seed_process.title}" for ${p.email}`,
            status: 'created',
            detail: created.process_id,
          });
        }
      }
    }
  });

  tx();
  return { outcomes };
}

/**
 * Seed expects an `assignments` row to anchor each role.  Phase 3 binds
 * assignments to a `process_id`.  To express a workspace-level role
 * without inventing a new table, we materialize a per-tenant sentinel
 * process (`tenant root`) on first run and use it as the carrier for
 * the seed-set role assignments.  The sentinel is a real Process row so
 * tenant scoping + audit triggers all work normally on it.
 */
function ensureTenantRootProcess(db: DatabaseHandle, tenantId: string): string {
  const row = db
    .prepare(
      `SELECT process_id FROM processes
       WHERE tenant_id = ? AND json_extract(fields, '$.role') = 'tenant_root'`,
    )
    .get(tenantId) as { process_id: string } | undefined;
  if (row) return row.process_id;

  const created = createPRR(db, tenantId, SEED_ACTOR, {
    fields: { role: 'tenant_root', title: 'tenant root', subject: 'tenant root' },
  });
  return created.process_id;
}

// ── Schema validation entrypoint ────────────────────────────────────────────

export function parseSeedYaml(text: string): SeedInput {
  const raw = yaml.load(text);
  const result = SeedSchema.safeParse(raw);
  if (!result.success) {
    // Throwing here keeps tests trivially able to assert .toThrowError(/email/) etc.
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Seed YAML validation failed:\n  ${detail}`);
  }
  return result.data;
}

export function seedFromYamlFile(db: DatabaseHandle, yamlPath: string): SeedResult {
  const text = fs.readFileSync(yamlPath, 'utf8');
  const parsed = parseSeedYaml(text);
  return seedFromInput(db, parsed);
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function printSummary(outcomes: OutcomeRow[]): void {
  for (const o of outcomes) {
    const status = `[${o.status}]`.padEnd(11);
    const kind = `${o.kind}:`.padEnd(11);
    const tail = o.detail ? `  ${o.detail}` : '';
    // eslint-disable-next-line no-console
    console.log(`${kind} ${status} ${o.label}${tail}`);
  }
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const yamlPath = process.env.PJ_SEED_YAML
    ?? path.join(__dirname, 'people.yaml');

  // eslint-disable-next-line no-console
  console.log(`PJ Seed — reading ${yamlPath}`);

  const dbPath = process.env.PJ_DB_PATH
    ?? process.env.DB_PATH
    ?? path.resolve(process.cwd(), 'data', 'pj.db');
  // eslint-disable-next-line no-console
  console.log(`PJ Seed — opening ${dbPath}`);

  const db = getDb(dbPath);
  migrate(db);

  let result: SeedResult;
  try {
    result = seedFromYamlFile(db, yamlPath);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error((err as Error).message);
    process.exit(1);
  }

  printSummary(result.outcomes);
  // eslint-disable-next-line no-console
  console.log('PJ Seed — done.');
}

// Only run when invoked as the entrypoint.
const isMain = (() => {
  try {
    const here = fileURLToPath(import.meta.url);
    return process.argv[1] !== undefined && path.resolve(process.argv[1]) === here;
  } catch {
    return false;
  }
})();

if (isMain) {
  void main();
}
