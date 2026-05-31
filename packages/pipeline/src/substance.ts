// @pj/pipeline — C7 substance check.
// Stop early, but never silently.
//
// The SUBSTANCE_CHECK stage's gate: decide whether an input item carries
// enough to act on. A non-substantive item is NOT silently discarded — the
// runner records a no_op proof and stops before VAULT/state. Deterministic
// and pure; the runner owns the proof write.

/** Verdict of the substance check. */
export interface SubstanceResult {
  substantive: boolean;
  reason: string;
}

/** A substance checker is a pure function of the input item. */
export type SubstanceChecker = (item: unknown) => SubstanceResult;

/**
 * Default substance rule. An item is non-substantive when it is:
 *   - null / undefined,
 *   - an empty string (or whitespace only),
 *   - an empty object (no own enumerable keys), or
 *   - an empty array.
 * Anything else is substantive. Callers may inject their own checker.
 */
export const defaultSubstanceChecker: SubstanceChecker = (item) => {
  if (item === null || item === undefined) {
    return { substantive: false, reason: 'item is null/undefined' };
  }
  if (typeof item === 'string') {
    return item.trim().length > 0
      ? { substantive: true, reason: 'non-empty string' }
      : { substantive: false, reason: 'empty string' };
  }
  if (Array.isArray(item)) {
    return item.length > 0
      ? { substantive: true, reason: 'non-empty array' }
      : { substantive: false, reason: 'empty array' };
  }
  if (typeof item === 'object') {
    return Object.keys(item as Record<string, unknown>).length > 0
      ? { substantive: true, reason: 'object with fields' }
      : { substantive: false, reason: 'empty object' };
  }
  // Numbers, booleans, etc. are substantive (a 0 amount is still a fact).
  return { substantive: true, reason: `primitive ${typeof item}` };
};

/** Run the substance check (default or injected). */
export function checkSubstance(
  item: unknown,
  checker: SubstanceChecker = defaultSubstanceChecker,
): SubstanceResult {
  return checker(item);
}
