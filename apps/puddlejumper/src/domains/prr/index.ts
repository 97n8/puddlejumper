// PRR canon domain — public exports.

export {
  INITIAL_STATE,
  TERMINAL_STATES,
  PJFieldsClosed,
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
  updateFields,
  type CreatePRRInput,
  type ListPRRFilters,
  type UpdateFieldsResult,
} from './prr.store.js';

export {
  PatchFieldsSchema,
  type PatchFieldsInput,
  type ChecklistItemInput,
} from './prr.schemas.js';

export { createCanonPrrRouter, type CanonPrrRoutesOptions } from './prr.routes.js';
