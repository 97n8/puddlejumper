// @pj/pipeline — C7 access gate.
// Authority before state.
//
// The ACCESS_GATE stage runs BEFORE VAULT verdicts and state/holds: if the
// actor may not act in this scope, the runner records a denied proof and
// stops — no verdicts decided, no state written, no holds created.
//
// Org Manager's can() is the canonical authority surface, but it requires a
// process_id + seeded identities/assignments, which the pipeline does not yet
// own (that wiring is a later phase). To keep C7 synchronous and testable we
// take an injected AccessEvaluator interface; the default is permissive
// (open gate), matching the C1 stub stage note "access gate open in C1".
// A real evaluator can delegate to @pj/org-manager can() once the pipeline
// carries a process + identity.

/** Scope handed to the access evaluator. */
export interface AccessRequest {
  tenant_id: string;
  actor_ref: string | null;
  pack: string;
  module?: string;
  environment?: string;
  case_space_id?: string;
}

/** Verdict of the access gate. */
export interface AccessResult {
  granted: boolean;
  reason: string;
}

/** Synchronous access evaluator. Injected so C7 stays testable. */
export type AccessEvaluator = (req: AccessRequest) => AccessResult;

/**
 * Default evaluator: open gate (matches the C1 stub). Real enforcement
 * (Org Manager can(), tenant binding) is wired in a later phase; until then
 * the gate grants and the proof records it explicitly — never a silent allow.
 */
export const openAccessEvaluator: AccessEvaluator = () => ({
  granted: true,
  reason: 'open gate (C7 default; real authority wiring is later)',
});

/** Run the access gate (default open, or an injected evaluator). */
export function checkAccess(
  req: AccessRequest,
  evaluator: AccessEvaluator = openAccessEvaluator,
): AccessResult {
  return evaluator(req);
}
