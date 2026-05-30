// @pj/pipeline — the synchronous runner.
// Walks the fourteen canon stages in order and writes ONE audit event
// proving the pipeline ran (Recordstream is the canon proof surface; in code
// it is `audit_events` written via the single sanctioned writer
// `appendAuditEvent` — see ops/v1/C0_DIAGNOSIS.md).
//
// C1 is a skeleton: the spine runs synchronously, every stage is stubbed,
// and the run always completes. Branching (denied/held/failed) arrives in
// later phases. The DB handle is INJECTED — never a module-level singleton —
// per the C0 "avoid audit-store singleton entanglement" guidance.

import crypto from 'node:crypto';
import { appendAuditEvent, type DatabaseHandle } from '@pj/db';
import type { AuditEvent } from '@publiclogic/core';
import {
  buildStages,
  PIPELINE_STAGES,
  type PipelineContext,
  type PipelineInput,
  type StageResult,
} from './stages.js';
import { findActiveRulePack, type RulePack } from './rulepack.js';
import { enrichItem, type EnrichmentResult } from './enrichment.js';
import { decideVault, type VaultDecision } from './vault.js';
import { persistDecision, type PersistResult } from './state.js';

/** Canon version stamped onto C1 proof events. */
const CANON_VERSION = '1.0.0';

export interface PipelineResult {
  /** Per-run process id (also the audit `process_id`). */
  process_id: string;
  /** Triad pack id this run executed. */
  pack: string;
  /**
   * Resolved active rule pack id for the run's scope (C3), or `null` when
   * no scope was supplied or no active pack governs it. Carried, not enforced.
   */
  rule_pack_id: string | null;
  /**
   * Deterministic mock enrichment facts for this run (C4). Always present;
   * an unknown pack yields an empty anchor set, never a failure. NOT sourced
   * from real connectors.
   */
  enrichment: EnrichmentResult;
  /**
   * VAULT per-action verdicts for this run (C5), capped by the pack's
   * autonomy ceiling. Decided, NOT executed — no action runs, no hold row is
   * written. Unknown/no pack yields a safe no_op set.
   */
  vault: VaultDecision;
  /**
   * Honest persisted action state for this run (C6). `allowed` →
   * attempted, `approval_required` → pending + a holds row, `denied` →
   * failed, `no_op` → recorded only. Persisted, NOT executed.
   */
  state: PersistResult;
  /** `true` when every stage was non-terminal (always true in C1). */
  ok: boolean;
  /** Ordered per-stage results. */
  stages: StageResult[];
  /** The single Recordstream proof event written for this run. */
  proof_event_id: string;
}

/**
 * Run the V1 spine for one input, synchronously, writing one proof event.
 *
 * @param db    Injected SQLite handle (already migrated). The caller owns it.
 * @param input The item entering at INPUT, plus tenant/deployment scope.
 */
export function runPipeline(
  db: DatabaseHandle,
  input: PipelineInput,
): PipelineResult {
  // Resolve the active rule pack for the scope, if one was supplied. C3
  // "resolve, don't enforce": a missing pack is a normal branch (null), not
  // an error — VAULT verdicts and holds come later. The C2 unique index
  // guarantees at most one active pack per scope.
  const resolvedPack: RulePack | null =
    input.module && input.environment
      ? findActiveRulePack(db, {
          tenant_id: input.tenant_id,
          module: input.module,
          environment: input.environment,
        })
      : null;
  const rule_pack_id = resolvedPack?.rule_pack_id ?? null;

  // API_ENRICHMENT (C4): deterministic mock enrichment by pack. Total — an
  // unknown pack returns an empty anchor set, never a failure. No real
  // connectors, no network, no auth. The result is carried, not enforced.
  const enrichment = enrichItem(input.pack, input.item);

  // VAULT_SCHEMA_RESOLVE / verdict (C5): decide per-action verdicts from the
  // pack content, capped by the autonomy ceiling. Decided, not executed.
  const vault = decideVault(resolvedPack, input.pack, input.item, enrichment);

  const ctx: PipelineContext = {
    ...input,
    canon_version: CANON_VERSION,
    process_id: crypto.randomUUID(),
    rule_pack_id,
  };

  // STATE_UPDATE_OR_HOLD (C6): persist verdicts as honest action state.
  // Pending verdicts also create holds. Persisted, not executed. Falls back
  // to the process_id as the CaseSpace key when none was supplied so the
  // NOT NULL state columns stay well-formed.
  const state = persistDecision(
    db,
    {
      tenant_id: input.tenant_id,
      deployment_id: input.deployment_id,
      case_space_id: input.case_space_id ?? ctx.process_id,
      module: input.module ?? input.pack,
      process_id: ctx.process_id,
      actor_ref: input.actor_ref ?? null,
    },
    vault,
  );

  const stages = buildStages();
  const results: StageResult[] = [];

  // Synchronous spine: each stage runs in order. In C1 no stage is terminal,
  // so the loop always completes. Later phases stop early on denied/held/failed.
  for (const stage of stages) {
    results.push(stage(ctx));
  }

  const ok = results.every(
    (r) => r.outcome !== 'denied' && r.outcome !== 'failed',
  );

  // One proof event for the whole run. Recordstream is threaded conceptually
  // through every stage, but C1 writes a single `system`-family event that
  // proves the spine executed and records each stage's outcome. The
  // overlay-style subtype `pipeline.run` resolves to a string at runtime
  // (canon allows overlay-registered subtypes).
  const proof = appendAuditEvent(db, {
    event_family: 'system',
    event_subtype: 'pipeline.run',
    canon_version: ctx.canon_version,
    deployment_id: ctx.deployment_id,
    tenant_id: ctx.tenant_id,
    process_id: ctx.process_id,
    actor_ref: ctx.actor_ref ?? null,
    payload: {
      pack: ctx.pack,
      rule_pack_id: ctx.rule_pack_id ?? null,
      enrichment: enrichment.summary,
      vault: {
        ceiling: vault.ceiling,
        summary: vault.summary,
        decisions: vault.decisions,
      },
      state: {
        summary: state.summary,
        outcomes: state.outcomes.map((o) => ({
          action: o.action,
          state: o.state,
          verdict: o.verdict,
          hold_id: o.hold_id,
        })),
      },
      ok,
      stages: PIPELINE_STAGES,
      results: results.map((r) => ({
        stage: r.stage,
        outcome: r.outcome,
        note: r.note,
      })),
    },
  }) as AuditEvent;

  return {
    process_id: ctx.process_id,
    pack: ctx.pack,
    rule_pack_id: ctx.rule_pack_id ?? null,
    enrichment,
    vault,
    state,
    ok,
    stages: results,
    proof_event_id: proof.event_id,
  };
}
