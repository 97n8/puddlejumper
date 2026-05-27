// PRR canon state machine — pure functions.
// Source: Master Build Spec v1.1, Part 4 (State Machines).
//
// State names are statutory (M.G.L. c.66 §10). Do not rename.
// No DB, no I/O. Effects happen in prr.store.ts after validateTransition().

export type PrrState =
  | 'received'
  | 'logged'
  | 'assigned'
  | 'searching'
  | 'reviewing'
  | 'responded'
  | 'closed';

export type PrrTrigger =
  | 'intake_complete'
  | 'route'
  | 'search_begin'
  | 'search_complete'
  | 'respond'
  | 'reassign'
  | 'close';

export interface Transition {
  from: PrrState;
  to: PrrState;
  trigger: PrrTrigger;
}

// Closed transition table — canon (Part 4).
const TRANSITIONS: readonly Transition[] = [
  { from: 'received',  to: 'logged',     trigger: 'intake_complete' },
  { from: 'logged',    to: 'assigned',   trigger: 'route' },
  { from: 'assigned',  to: 'searching',  trigger: 'search_begin' },
  { from: 'searching', to: 'reviewing',  trigger: 'search_complete' },
  { from: 'reviewing', to: 'responded',  trigger: 'respond' },
  { from: 'reviewing', to: 'assigned',   trigger: 'reassign' },
  { from: 'responded', to: 'closed',     trigger: 'close' },
] as const;

export const INITIAL_STATE: PrrState = 'received';
export const TERMINAL_STATES: readonly PrrState[] = ['closed'] as const;

export interface ValidationOk {
  valid: true;
  to: PrrState;
}

export interface ValidationFail {
  valid: false;
  reason: string;
}

export type ValidationResult = ValidationOk | ValidationFail;

/**
 * Pure check: is `trigger` allowed from `from`? Returns the target state on
 * success, a structured reason on failure. Never throws.
 */
export function validateTransition(
  from: PrrState,
  trigger: PrrTrigger,
): ValidationResult {
  if (TERMINAL_STATES.includes(from)) {
    return {
      valid: false,
      reason: `cannot transition out of terminal state '${from}'`,
    };
  }
  const match = TRANSITIONS.find((t) => t.from === from && t.trigger === trigger);
  if (!match) {
    const allowed = TRANSITIONS.filter((t) => t.from === from)
      .map((t) => t.trigger)
      .sort();
    return {
      valid: false,
      reason: `trigger '${trigger}' not permitted from state '${from}' (allowed: ${allowed.length ? allowed.join(', ') : 'none'})`,
    };
  }
  return { valid: true, to: match.to };
}

/** All transitions available from `from`, in declaration order. */
export function getAvailableTransitions(from: PrrState): Transition[] {
  return TRANSITIONS.filter((t) => t.from === from);
}

/**
 * Thrown by prr.store when a caller asks for an invalid transition.
 * Routes catch this and translate to HTTP 400.
 */
export class PJInvalidTransition extends Error {
  readonly code = 'PJInvalidTransition' as const;
  readonly from: PrrState;
  readonly trigger: PrrTrigger;
  constructor(from: PrrState, trigger: PrrTrigger, reason: string) {
    super(reason);
    this.name = 'PJInvalidTransition';
    this.from = from;
    this.trigger = trigger;
  }
}
