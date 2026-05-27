// PRR canon domain — public exports.

export {
  INITIAL_STATE,
  TERMINAL_STATES,
  PJInvalidTransition,
  validateTransition,
  getAvailableTransitions,
  type PrrState,
  type PrrTrigger,
  type Transition,
  type ValidationResult,
} from './prr.machine.js';

export {
  createPRR,
  getPRR,
  listPRR,
  transitionPRR,
  closePRR,
  type CreatePRRInput,
  type ListPRRFilters,
} from './prr.store.js';

export { createCanonPrrRouter, type CanonPrrRoutesOptions } from './prr.routes.js';
