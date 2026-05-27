// PRR canon happy-path mapping for the "Mark step done" button.
// Source: Master Build Spec v1.1, Part 4 (PRR State Machine).

export type PrrState =
  | 'received' | 'logged' | 'assigned' | 'searching'
  | 'reviewing' | 'responded' | 'closed';

export type PrrTrigger =
  | 'intake_complete' | 'route' | 'search_begin' | 'search_complete'
  | 'respond' | 'reassign' | 'close';

/** Next trigger for the linear happy path; null for terminal states. */
export const NEXT_TRIGGER: Record<PrrState, PrrTrigger | null> = {
  received:  'intake_complete',
  logged:    'route',
  assigned:  'search_begin',
  searching: 'search_complete',
  reviewing: 'respond',
  responded: 'close',
  closed:    null,
};

export const STATE_LABEL: Record<PrrState, string> = {
  received:  'Received',
  logged:    'Logged',
  assigned:  'Assigned',
  searching: 'Searching',
  reviewing: 'Reviewing',
  responded: 'Responded',
  closed:    'Closed',
};

export const TRIGGER_LABEL: Record<PrrTrigger, string> = {
  intake_complete: 'Mark intake complete',
  route:           'Route to assignee',
  search_begin:    'Begin search',
  search_complete: 'Mark search complete',
  respond:         'Submit response',
  reassign:        'Reassign',
  close:           'Close',
};

export const STATE_ORDER: PrrState[] = [
  'received', 'logged', 'assigned', 'searching', 'reviewing', 'responded', 'closed',
];

export function nextTriggerFor(state: string): PrrTrigger | null {
  return NEXT_TRIGGER[state as PrrState] ?? null;
}
