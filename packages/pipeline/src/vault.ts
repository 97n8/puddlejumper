// @pj/pipeline — C5 VAULT verdict layer.
// Decide what may happen. Do not make it happen yet.
//
// Given a resolved RulePack and the enriched item, produce one verdict per
// candidate action. Verdicts are CAPPED by the pack's autonomy ceiling and
// gated by pack rules (e.g. finance.biz no_auto_money_movement +
// approval_threshold). NOTHING is executed here, no holds row is written, no
// connector is called — C5 only decides.

import type { RulePack } from './rulepack.js';
import type { EnrichmentResult } from './enrichment.js';

/**
 * Autonomy ceiling, lowest → highest. A pack's ceiling caps how far any
 * single action may be auto-authorized. Mirrors the spec ladder
 * (suggest < help_manage < run_routine).
 */
export const AUTONOMY_LADDER = ['suggest', 'help_manage', 'run_routine'] as const;
export type AutonomyLevel = (typeof AUTONOMY_LADDER)[number];

/** Per-action verdict vocabulary. */
export type ActionVerdict = 'allowed' | 'approval_required' | 'denied' | 'no_op';

/** The autonomy each action needs to run unattended (its natural level). */
export interface ActionSpec {
  action: string;
  /** Minimum autonomy required to run this action without approval. */
  needs: AutonomyLevel;
  /** When true, this action moves money — finance.biz forbids it outright. */
  moves_money?: boolean;
  /** When true, the action's amount is checked against approval_threshold. */
  amount_gated?: boolean;
}

/** A single decided action. */
export interface ActionDecision {
  action: string;
  verdict: ActionVerdict;
  /** Short reason — feeds the proof payload. */
  reason: string;
}

/** Full VAULT decision for a run. */
export interface VaultDecision {
  /** Effective ceiling used (pack ceiling, or 'suggest' when no pack). */
  ceiling: AutonomyLevel;
  decisions: ActionDecision[];
  summary: {
    allowed: number;
    approval_required: number;
    denied: number;
    no_op: number;
  };
}

function ladderIndex(level: string): number {
  const i = AUTONOMY_LADDER.indexOf(level as AutonomyLevel);
  return i; // -1 when unrecognized
}

/** Candidate actions per triad pack. Descriptive — the V1 action surface. */
const PACK_ACTIONS: Record<string, ActionSpec[]> = {
  'guestops.stay': [
    { action: 'send_guest_arrival_brief', needs: 'run_routine' },
    { action: 'set_lock_code', needs: 'run_routine' },
    { action: 'schedule_cleaning', needs: 'run_routine' },
  ],
  'timedesk.muni': [
    { action: 'summarize_timesheet', needs: 'suggest' },
    { action: 'flag_overtime', needs: 'suggest' },
    { action: 'export_to_payroll', needs: 'run_routine' },
    { action: 'approve_payroll', needs: 'run_routine' },
  ],
  'finance.biz': [
    { action: 'categorize_expense', needs: 'help_manage' },
    { action: 'build_review_packet', needs: 'help_manage' },
    { action: 'post_payment', needs: 'run_routine', moves_money: true },
    { action: 'reimburse_over_threshold', needs: 'help_manage', amount_gated: true },
  ],
};

function readCeiling(pack: RulePack | null): AutonomyLevel {
  const raw = pack?.content?.autonomy_ceiling;
  if (typeof raw === 'string' && ladderIndex(raw) >= 0) {
    return raw as AutonomyLevel;
  }
  // No pack, or an unrecognized ceiling → safest floor.
  return 'suggest';
}

function readThreshold(pack: RulePack | null): number | null {
  const raw = pack?.content?.approval_threshold;
  return typeof raw === 'number' ? raw : null;
}

function noMoneyMovement(pack: RulePack | null): boolean {
  return pack?.content?.no_auto_money_movement === true;
}

/** Pull a numeric amount from the enriched item / anchors, if present. */
function readAmount(item: unknown, enrichment: EnrichmentResult): number | null {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const v = (item as Record<string, unknown>).amount;
    if (typeof v === 'number') return v;
  }
  const anchor = enrichment.anchors.find((a) => a.key === 'amount');
  if (anchor && !Number.isNaN(Number(anchor.value))) return Number(anchor.value);
  return null;
}

/**
 * Decide verdicts for every candidate action of the run's pack.
 *
 * Rules (in order):
 *   1. money-moving action under `no_auto_money_movement` → denied.
 *   2. action whose `needs` exceeds the ceiling → approval_required (capped).
 *   3. amount-gated action at/over `approval_threshold` → approval_required.
 *   4. otherwise → allowed.
 *
 * Pack handling:
 *   - Unknown `packId` (no known action surface) → a single safe no_op
 *     (nothing to decide).
 *   - Known `packId` but `pack` is null (no active rule pack resolved) → the
 *     action surface is still evaluated, but with the safest-floor ceiling
 *     ('suggest') and no pack rules, so anything above that floor becomes
 *     approval_required rather than allowed. Never a silent allow.
 */
export function decideVault(
  pack: RulePack | null,
  packId: string,
  item: unknown,
  enrichment: EnrichmentResult,
): VaultDecision {
  const ceiling = readCeiling(pack);
  const ceilingIdx = ladderIndex(ceiling);
  const threshold = readThreshold(pack);
  const blockMoney = noMoneyMovement(pack);
  const amount = readAmount(item, enrichment);

  const specs = PACK_ACTIONS[packId];

  // No known action surface (unknown pack) → safe no-op set.
  if (!specs) {
    const decision: ActionDecision = {
      action: 'unknown',
      verdict: 'no_op',
      reason: 'no rule pack action surface for this scope',
    };
    return {
      ceiling,
      decisions: [decision],
      summary: { allowed: 0, approval_required: 0, denied: 0, no_op: 1 },
    };
  }

  const decisions: ActionDecision[] = specs.map((spec) => {
    if (spec.moves_money && blockMoney) {
      return {
        action: spec.action,
        verdict: 'denied',
        reason: 'no_auto_money_movement: money-moving actions are denied',
      };
    }
    if (ladderIndex(spec.needs) > ceilingIdx) {
      return {
        action: spec.action,
        verdict: 'approval_required',
        reason: `needs '${spec.needs}' above ceiling '${ceiling}'`,
      };
    }
    if (spec.amount_gated && threshold !== null && amount !== null && amount >= threshold) {
      return {
        action: spec.action,
        verdict: 'approval_required',
        reason: `amount ${amount} at/over approval_threshold ${threshold}`,
      };
    }
    return {
      action: spec.action,
      verdict: 'allowed',
      reason: `within ceiling '${ceiling}'`,
    };
  });

  const summary = {
    allowed: decisions.filter((d) => d.verdict === 'allowed').length,
    approval_required: decisions.filter((d) => d.verdict === 'approval_required').length,
    denied: decisions.filter((d) => d.verdict === 'denied').length,
    no_op: decisions.filter((d) => d.verdict === 'no_op').length,
  };

  return { ceiling, decisions, summary };
}
