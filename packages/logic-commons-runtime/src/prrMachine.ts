export type PrrState =
  | 'received'
  | 'logged'
  | 'assigned'
  | 'searching'
  | 'reviewing'
  | 'responded'
  | 'closed'

export type PrrTrigger =
  | 'intake_complete'
  | 'route'
  | 'search_begin'
  | 'search_complete'
  | 'respond'
  | 'reassign'
  | 'close'

export interface Transition {
  from: PrrState
  to: PrrState
  trigger: PrrTrigger
}

const TRANSITIONS: readonly Transition[] = [
  { from: 'received', to: 'logged', trigger: 'intake_complete' },
  { from: 'logged', to: 'assigned', trigger: 'route' },
  { from: 'assigned', to: 'searching', trigger: 'search_begin' },
  { from: 'searching', to: 'reviewing', trigger: 'search_complete' },
  { from: 'reviewing', to: 'responded', trigger: 'respond' },
  { from: 'reviewing', to: 'assigned', trigger: 'reassign' },
  { from: 'responded', to: 'closed', trigger: 'close' },
] as const

export const INITIAL_STATE: PrrState = 'received'
export const TERMINAL_STATES: readonly PrrState[] = ['closed'] as const

export interface ValidationOk {
  valid: true
  to: PrrState
}

export interface ValidationFail {
  valid: false
  reason: string
}

export type ValidationResult = ValidationOk | ValidationFail

export function validateTransition(
  from: PrrState,
  trigger: PrrTrigger,
): ValidationResult {
  if (TERMINAL_STATES.includes(from)) {
    return {
      valid: false,
      reason: `cannot transition out of terminal state '${from}'`,
    }
  }
  const match = TRANSITIONS.find((t) => t.from === from && t.trigger === trigger)
  if (!match) {
    const allowed = TRANSITIONS.filter((t) => t.from === from)
      .map((t) => t.trigger)
      .sort()
    return {
      valid: false,
      reason: `trigger '${trigger}' not permitted from state '${from}' (allowed: ${allowed.length ? allowed.join(', ') : 'none'})`,
    }
  }
  return { valid: true, to: match.to }
}

export function getAvailableTransitions(from: PrrState): Transition[] {
  return TRANSITIONS.filter((t) => t.from === from)
}

export class PJInvalidTransition extends Error {
  readonly code = 'PJInvalidTransition' as const
  readonly from: PrrState
  readonly trigger: PrrTrigger

  constructor(from: PrrState, trigger: PrrTrigger, reason: string) {
    super(reason)
    this.name = 'PJInvalidTransition'
    this.from = from
    this.trigger = trigger
  }
}

export class PJFieldsClosed extends Error {
  readonly code = 'fields.closed' as const

  constructor(processId: string) {
    super(`cannot update fields on a closed PRR '${processId}'`)
    this.name = 'PJFieldsClosed'
  }
}
