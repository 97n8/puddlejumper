import { describe, it, expect } from 'vitest';
import {
  INITIAL_STATE,
  TERMINAL_STATES,
  getAvailableTransitions,
  validateTransition,
  type PrrState,
  type PrrTrigger,
} from './prr.machine.js';

describe('prr.machine — canon transition table', () => {
  it('exposes statutory initial and terminal states', () => {
    expect(INITIAL_STATE).toBe('received');
    expect(TERMINAL_STATES).toEqual(['closed']);
  });

  const happyPath: Array<{ from: PrrState; trigger: PrrTrigger; to: PrrState }> = [
    { from: 'received',  trigger: 'intake_complete', to: 'logged' },
    { from: 'logged',    trigger: 'route',           to: 'assigned' },
    { from: 'assigned',  trigger: 'search_begin',    to: 'searching' },
    { from: 'searching', trigger: 'search_complete', to: 'reviewing' },
    { from: 'reviewing', trigger: 'respond',         to: 'responded' },
    { from: 'reviewing', trigger: 'reassign',        to: 'assigned' },
    { from: 'responded', trigger: 'close',           to: 'closed' },
  ];

  it.each(happyPath)(
    'allows $trigger from $from → $to',
    ({ from, trigger, to }) => {
      const result = validateTransition(from, trigger);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.to).toBe(to);
    },
  );

  it('rejects intake_complete from logged with a structured reason', () => {
    const r = validateTransition('logged', 'intake_complete');
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.reason).toMatch(/not permitted/);
      expect(r.reason).toMatch(/logged/);
    }
  });

  it('refuses any transition out of a terminal state', () => {
    const r = validateTransition('closed', 'intake_complete');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/terminal/);
  });

  it('lists exactly the canon outgoing transitions for reviewing', () => {
    const out = getAvailableTransitions('reviewing').map((t) => t.trigger);
    expect(out).toEqual(['respond', 'reassign']);
  });
});
