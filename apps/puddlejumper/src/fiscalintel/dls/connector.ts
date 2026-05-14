/**
 * DLS (MA Division of Local Services) Connector
 * Fetches Logi Analytics report HTML by POST-ing municipality filter criteria.
 *
 * HOW IT WORKS:
 * DLS reports use a POST form (rdPage.aspx) with checkboxes:
 *   iclMuni  = municipality name (can repeat for multiple)
 *   iclYear  = fiscal year     (can repeat for multiple)
 * Posting only the towns you care about returns a filtered HTML table.
 *
 * Rate limit: 2 seconds between requests (per DLS spec requirement).
 */

const DLS_BASE = "https://dls-gw.dor.state.ma.us/reports/rdPage.aspx";
const RATE_LIMIT_MS = 2000;

let lastRequestAt = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/**
 * POST to a DLS 351-town tabular report for selected municipalities and years.
 * Returns raw HTML string.
 */
export async function fetchDlsReport(opts: {
  report: string;
  municipalities?: string[];      // e.g. ["Sutton", "Charlton"] — empty = all
  years?: number[];               // e.g. [2024, 2025, 2026] — empty = all
  retries?: number;
}): Promise<string> {
  const { report, municipalities = [], years = [], retries = 3 } = opts;

  const url = `${DLS_BASE}?rdReport=${encodeURIComponent(report)}`;

  const body = new URLSearchParams();
  for (const muni of municipalities) body.append("iclMuni", muni);
  for (const yr of years) body.append("iclYear", String(yr));

  let attempt = 0;
  while (attempt <= retries) {
    await rateLimit();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "PublicLogic/FiscalIntel-MA (+https://publiclogic.org)",
          Accept: "text/html,application/xhtml+xml",
        },
        body: body.toString(),
      });

      if (!res.ok) throw new Error(`DLS HTTP ${res.status} for report=${report}`);
      return await res.text();
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      const backoff = 5000 * attempt;
      console.warn(`[FiscalIntel] DLS fetch failed (attempt ${attempt}), retrying in ${backoff}ms:`, err);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new Error("unreachable");
}

/** DLS report identifiers confirmed to return HTML tables. */
export const DLS_REPORTS = {
  /** Stabilization Fund Balance & Operating Budget — all 351 towns, multi-year */
  STABILIZATION: "Dashboard.Cat_1_Reports.StablPerBudget351",
  /** Overlay Appropriation & Total Levy — all 351 towns, multi-year */
  OVERLAY_LEVY: "Dashboard.Cat_1_Reports.OL1PerLevy351",
  /** Free Cash Proof detail — per-town (use municipality filter) */
  FREE_CASH_PROOF: "BalanceSheet.FreecashProofComp",
} as const;
