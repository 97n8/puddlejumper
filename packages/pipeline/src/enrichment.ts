// @pj/pipeline — C4 deterministic API enrichment seed layer.
// Make the CaseSpace smarter. Don't connect the world yet.
//
// This is the API_ENRICHMENT stage's data source: deterministic, in-process
// mock adapters shaped like the real connectors will be (Airbnb/calendar/lock,
// HR/payroll, banking/AP). NO network, NO real connectors, NO auth. Each
// adapter turns a raw input item into a set of typed "anchors" — the facts the
// pipeline pins to the item so later stages (VAULT, output) have context.
//
// Keyed by triad pack id (e.g. 'guestops.stay'), so enrichment works whether
// or not an active rule pack is seeded. Unknown packs return empty enrichment,
// never an error.

/** A single enrichment fact pinned to the item. `value` is deterministic. */
export interface EnrichmentAnchor {
  key: string;
  value: string;
  /** Which mock source produced it (shaped like a future connector id). */
  source: string;
}

/** Result of the enrichment stage for one run. */
export interface EnrichmentResult {
  pack: string;
  anchors: EnrichmentAnchor[];
  /** Terse, proof-friendly summary: ordered anchor keys + count. */
  summary: {
    count: number;
    keys: string[];
  };
}

/** An enrichment adapter is a deterministic function of the input item. */
type EnrichmentAdapter = (item: unknown) => EnrichmentAnchor[];

/**
 * Read a string field from an opaque item, falling back to a deterministic
 * placeholder so anchors are always populated (mock data, never network).
 */
function field(item: unknown, key: string, fallback: string): string {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const v = (item as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number') return String(v);
  }
  return fallback;
}

// ── guestops.stay — reservation / calendar / lock / cleaning ─────────────────
const guestopsStay: EnrichmentAdapter = (item) => {
  const reservationId = field(item, 'id', 'res-unknown');
  return [
    { key: 'reservation_id', value: reservationId, source: 'mock.airbnb' },
    { key: 'arrival', value: field(item, 'arrival', '2026-06-01T15:00:00Z'), source: 'mock.calendar' },
    { key: 'departure', value: field(item, 'departure', '2026-06-05T11:00:00Z'), source: 'mock.calendar' },
    { key: 'cleaning_window', value: field(item, 'cleaning', '2026-06-05T11:00:00Z/13:00:00Z'), source: 'mock.cleaning' },
    { key: 'lock_code', value: field(item, 'lock_code', `LK-${reservationId}`), source: 'mock.lock' },
  ];
};

// ── timedesk.muni — employee / department / pay period / overtime ────────────
const timedeskMuni: EnrichmentAdapter = (item) => {
  const employeeId = field(item, 'employee_id', 'emp-unknown');
  return [
    { key: 'employee_id', value: employeeId, source: 'mock.hris' },
    { key: 'department', value: field(item, 'department', 'public-works'), source: 'mock.hris' },
    { key: 'pay_period', value: field(item, 'pay_period', '2026-PP11'), source: 'mock.payroll' },
    { key: 'overtime_hours', value: field(item, 'overtime_hours', '0'), source: 'mock.timeclock' },
  ];
};

// ── finance.biz — vendor / invoice / receipt / tax category ──────────────────
const financeBiz: EnrichmentAdapter = (item) => {
  const txnId = field(item, 'id', 'txn-unknown');
  return [
    { key: 'transaction_id', value: txnId, source: 'mock.bank' },
    { key: 'vendor', value: field(item, 'vendor', 'vendor-unknown'), source: 'mock.vendor-directory' },
    { key: 'invoice_ref', value: field(item, 'invoice_ref', `INV-${txnId}`), source: 'mock.ap' },
    { key: 'receipt_ref', value: field(item, 'receipt_ref', `RCPT-${txnId}`), source: 'mock.receipts' },
    { key: 'tax_category', value: field(item, 'tax_category', 'uncategorized'), source: 'mock.tax-rules' },
  ];
};

/** Registry of mock enrichment adapters, keyed by triad pack id. */
const ADAPTERS: Record<string, EnrichmentAdapter> = {
  'guestops.stay': guestopsStay,
  'timedesk.muni': timedeskMuni,
  'finance.biz': financeBiz,
};

/**
 * Enrich an input item for a pack. Deterministic and total: an unknown pack
 * returns an empty result (no anchors), never throws. Real connector calls,
 * grants, and network access are explicitly out of scope (C4).
 */
export function enrichItem(pack: string, item: unknown): EnrichmentResult {
  const adapter = ADAPTERS[pack];
  const anchors = adapter ? adapter(item) : [];
  return {
    pack,
    anchors,
    summary: {
      count: anchors.length,
      keys: anchors.map((a) => a.key),
    },
  };
}

/** The triad pack ids that have a mock enrichment adapter. */
export const ENRICHED_PACKS = Object.keys(ADAPTERS);
