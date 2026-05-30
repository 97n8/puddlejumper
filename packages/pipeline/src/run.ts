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
import {
  checkSubstance,
  type SubstanceChecker,
  type SubstanceResult,
} from './substance.js';
import {
  checkAccess,
  type AccessEvaluator,
  type AccessResult,
} from './access.js';

/** Canon version stamped onto C1 proof events. */
const CANON_VERSION = '1.0.0';

/** Optional injected gates for a run (C7). Defaults are pure + permissive. */
export interface RunOptions {
  /** SUBSTANCE_CHECK evaluator. Default: {@link defaultSubstanceChecker}. */
  substanceChecker?: SubstanceChecker;
  /** ACCESS_GATE evaluator. Default: open gate. */
  accessEvaluator?: AccessEvaluator;
}

/** Where the run stopped, if it stopped early (C7). `null` = ran to completion. */
export type StopStage = 'SUBSTANCE_CHECK' | 'ACCESS_GATE' | null;

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
   * SUBSTANCE_CHECK verdict (C7). A non-substantive item stops the run early
   * with a recorded no_op — never a silent discard.
   */
  substance: SubstanceResult;
  /**
   * ACCESS_GATE verdict (C7). Evaluated before VAULT/state; a denied actor
   * stops the run early with a recorded denial — before any state/hold write.
   */
  access: AccessResult;
  /**
   * Where the run stopped early, or `null` when it ran to completion. When
   * set, `vault`/`state` are `null` (those stages never ran).
   */
  stopped_at: StopStage;
  /**
   * Terminal outcome of the run: `no_op` (non-substantive), `denied` (access
   * refused), or `completed` (reached the end of the spine).
   */
  outcome: 'no_op' | 'denied' | 'completed';
  /**
   * Deterministic mock enrichment facts for this run (C4). `null` when the
   * run stopped before enrichment (non-substantive input).
   */
  enrichment: EnrichmentResult | null;
  /**
   * VAULT per-action verdicts (C5), capped by the pack's autonomy ceiling.
   * `null` when the run stopped early (substance/access). Decided, NOT executed.
   */
  vault: VaultDecision | null;
  /**
   * Honest persisted action state (C6). `null` when the run stopped early —
   * no state row or hold is written before the access gate passes.
   */
  state: PersistResult | null;
  /** `true` when every stage was non-terminal. `false` on early stop. */
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
  options: RunOptions = {},
): PipelineResult {
  const process_id = crypto.randomUUID();

  // Resolve the active rule pack for the scope, if one was supplied. C3
  // "resolve, don't enforce": a missing pack is a normal branch (null), not
  // an error. The C2 unique index guarantees at most one active pack per scope.
  const resolvedPack: RulePack | null =
    input.module && input.environment
      ? findActiveRulePack(db, {
          tenant_id: input.tenant_id,
          module: input.module,
          environment: input.environment,
        })
      : null;
  const rule_pack_id = resolvedPack?.rule_pack_id ?? null;

  // ── SUBSTANCE_CHECK (C7): no silent discard ────────────────────────────────
  // A non-substantive input stops the run early with a recorded no_op proof —
  // before enrichment, VAULT, or any state/hold write.
  const substance = checkSubstance(input.item, options.substanceChecker);
  if (!substance.substantive) {
    const proof = appendAuditEvent(db, {
      event_family: 'system',
      event_subtype: 'pipeline.no_op',
      canon_version: CANON_VERSION,
      deployment_id: input.deployment_id,
      tenant_id: input.tenant_id,
      process_id,
      actor_ref: input.actor_ref ?? null,
      payload: {
        pack: input.pack,
        rule_pack_id,
        outcome: 'no_op',
        stopped_at: 'SUBSTANCE_CHECK',
        substance,
      },
    }) as AuditEvent;
    return {
      process_id,
      pack: input.pack,
      rule_pack_id,
      substance,
      access: { granted: false, reason: 'not evaluated: stopped at substance check' },
      stopped_at: 'SUBSTANCE_CHECK',
      outcome: 'no_op',
      enrichment: null,
      vault: null,
      state: null,
      ok: false,
      stages: [],
      proof_event_id: proof.event_id,
    };
  }

  // ── ACCESS_GATE (C7): authority before state ───────────────────────────────
  // Evaluated BEFORE VAULT verdicts and state/holds. A denied actor stops the
  // run with a recorded denial — nothing is decided or persisted.
  const access = checkAccess(
    {
      tenant_id: input.tenant_id,
      actor_ref: input.actor_ref ?? null,
      pack: input.pack,
      module: input.module,
      environment: input.environment,
      case_space_id: input.case_space_id,
    },
    options.accessEvaluator,
  );
  if (!access.granted) {
    const proof = appendAuditEvent(db, {
      event_family: 'auth',
      event_subtype: 'auth.refused',
      canon_version: CANON_VERSION,
      deployment_id: input.deployment_id,
      tenant_id: input.tenant_id,
      process_id,
      actor_ref: input.actor_ref ?? null,
      payload: {
        pack: input.pack,
        rule_pack_id,
        outcome: 'denied',
        stopped_at: 'ACCESS_GATE',
        access,
      },
    }) as AuditEvent;
    return {
      process_id,
      pack: input.pack,
      rule_pack_id,
      substance,
      access,
      stopped_at: 'ACCESS_GATE',
      outcome: 'denied',
      enrichment: null,
      vault: null,
      state: null,
      ok: false,
      stages: [],
      proof_event_id: proof.event_id,
    };
  }

  // ── Access granted: continue through C4 → C5 → C6 (existing behavior) ──────

  // API_ENRICHMENT (C4): deterministic mock enrichment by pack.
  const enrichment = enrichItem(input.pack, input.item);

  // VAULT verdict (C5): per-action verdicts capped by the autonomy ceiling.
  const vault = decideVault(resolvedPack, input.pack, input.item, enrichment);

  const ctx: PipelineContext = {
    ...input,
    canon_version: CANON_VERSION,
    process_id,
    rule_pack_id,
  };

  // STATE_UPDATE_OR_HOLD (C6): persist verdicts as honest action state.
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
  for (const stage of stages) {
    results.push(stage(ctx));
  }

  const ok = results.every(
    (r) => r.outcome !== 'denied' && r.outcome !== 'failed',
  );

  // One proof event for the completed run.
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
      outcome: 'completed',
      substance,
      access,
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
    substance,
    access,
    stopped_at: null,
    outcome: 'completed',
    enrichment,
    vault,
    state,
    ok,
    stages: results,
    proof_event_id: proof.event_id,
  };
}
