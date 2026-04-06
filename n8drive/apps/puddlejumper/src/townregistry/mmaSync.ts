/**
 * MMA (Massachusetts Municipal Association) Sync
 *
 * Fetches real fiscal + governance data for all 351 MA municipalities from
 * https://www.mma.org/all-directory-data/ — the data is embedded as JSON in
 * the page HTML (updated annually by MMA).
 *
 * Fields populated:
 *   fi_snapshots.metrics_json ← total_expenditures, tax_levy, state_aid,
 *                                local_receipts, residential_tax_rate,
 *                                income_per_capita, eqv_per_capita
 *   town_staff_registry       ← governance roles derived from MMA fields
 *                               (form_of_government, chief_municipal_official,
 *                               policy_board, size_of_policy_board)
 *
 * This is a SUPPLEMENT to DLS sync — it fills in data that DLS doesn't expose
 * via its public HTML reports (operating expenditures, local receipts, etc.).
 */

import type Database from "better-sqlite3";
import { ALL_MA_MUNICIPALITIES } from "../fiscalintel/municipalities.js";
import { upsertSnapshot } from "../fiscalintel/db.js";
import type { FiscalMetrics, RiskFlag } from "../fiscalintel/db.js";

const MMA_URL =
  "https://www.mma.org/all-directory-data/?param=form_of_government";

interface MmaRecord {
  title: string;
  community_id: string;
  slug: string;
  county: string;
  population: string;
  population_density?: string;
  income_per_capita?: string;
  eqv_per_capita?: string;
  average_tax_bill?: string;
  residential_tax_rate?: string;
  commercial_tax_rate?: string;
  total_expenditures?: string;
  tax_levy?: string;
  state_aid?: string;
  local_receipts?: string;
  form_of_government?: string;
  chief_municipal_official?: string;
  policy_board?: string;
  legislative_body?: string;
  size_of_policy_board?: string;
  meet_desc?: string;
  elect_desc?: string;
  incorporation_date?: string;
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function buildRisks(m: FiscalMetrics): RiskFlag[] {
  const risks: RiskFlag[] = [];

  if (m.certifiedFreeCash !== null && m.operatingBudget) {
    const pct = m.certifiedFreeCash / m.operatingBudget;
    if (pct < 0.03) {
      risks.push({
        code: "free_cash_critical",
        label: "Free Cash Critically Low",
        severity: "critical",
        detail: `Free cash is ${(pct * 100).toFixed(1)}% of budget — below 3% threshold`,
        threshold: "< 3%",
      });
    } else if (pct < 0.05) {
      risks.push({
        code: "free_cash_warn",
        label: "Free Cash Below Benchmark",
        severity: "warning",
        detail: `Free cash is ${(pct * 100).toFixed(1)}% of budget — below DLS 5% benchmark`,
        threshold: "< 5%",
      });
    }
  }

  if (m.overlayPctLevy !== null && m.overlayPctLevy > 2.5) {
    risks.push({
      code: "overlay_high",
      label: "Overlay Ratio Elevated",
      severity: "warning",
      detail: `Overlay is ${m.overlayPctLevy.toFixed(1)}% of total levy — above 2.5% guideline`,
      threshold: "> 2.5%",
    });
  }

  return risks;
}

function buildGovernanceStaff(rec: MmaRecord, muniName: string): object[] {
  const staff: object[] = [];

  // Chief Municipal Official (Town Manager / Town Administrator / Mayor)
  if (rec.chief_municipal_official && rec.chief_municipal_official !== "None") {
    staff.push({
      name: `${muniName} ${rec.chief_municipal_official}`,
      title: rec.chief_municipal_official,
      email: "",
      department: "Administration",
      sourceUrl: `https://www.mma.org/community/${rec.slug}/`,
      isPlaceholder: true,
    });
  }

  // Policy board members (Select Board, City Council, etc.)
  const boardSize = parseInt(rec.size_of_policy_board ?? "0", 10);
  const boardName = rec.policy_board ?? "Select Board";
  for (let i = 1; i <= Math.min(boardSize, 5); i++) {
    staff.push({
      name: `${boardName} Member ${i}`,
      title: `${boardName} Member`,
      email: "",
      department: boardName,
      sourceUrl: `https://www.mma.org/community/${rec.slug}/`,
      isPlaceholder: true,
    });
  }

  // Standard departments present in most MA towns
  const stdDepts = [
    { title: "Town Clerk", dept: "Town Clerk" },
    { title: "Finance Director / Treasurer-Collector", dept: "Finance" },
    { title: "Director of Public Works", dept: "Public Works" },
    { title: "Chief of Police", dept: "Police" },
    { title: "Fire Chief", dept: "Fire" },
    { title: "Building Commissioner", dept: "Building / Inspections" },
    { title: "Planning Director", dept: "Planning" },
    { title: "Board of Health Director", dept: "Health" },
  ];
  for (const d of stdDepts) {
    staff.push({
      name: `${muniName} ${d.dept}`,
      title: d.title,
      email: "",
      department: d.dept,
      sourceUrl: `https://www.mma.org/community/${rec.slug}/`,
      isPlaceholder: true,
    });
  }

  return staff;
}

export async function syncFromMma(
  db: Database.Database
): Promise<{ ok: number; err: number; total: number }> {
  console.info("[mma-sync] Fetching MMA directory data…");

  let html: string;
  try {
    const res = await fetch(MMA_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PublicLogic/MMASync; +https://publiclogic.org)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`MMA fetch HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    console.error("[mma-sync] Failed to fetch MMA page:", e);
    throw e;
  }

  // Extract the embedded JSON object
  const jsonMatch = html.match(/var all_communities_data=(\{[\s\S]*?\});\s*var /);
  if (!jsonMatch) throw new Error("Could not find all_communities_data in MMA page");

  let allData: Record<string, MmaRecord>;
  try {
    allData = JSON.parse(jsonMatch[1]);
  } catch (e) {
    throw new Error(`Failed to parse MMA JSON: ${e}`);
  }

  console.info(`[mma-sync] Parsed ${Object.keys(allData).length} communities`);

  // Build a lookup by normalised name
  const byName = new Map<string, MmaRecord>();
  for (const rec of Object.values(allData)) {
    byName.set(rec.title.toLowerCase().trim(), rec);
  }

  let ok = 0;
  let err = 0;
  const now = new Date().toISOString();

  for (const muni of ALL_MA_MUNICIPALITIES) {
    const rec = byName.get(muni.name.toLowerCase().trim());
    if (!rec) {
      err++;
      continue;
    }

    try {
      const operatingBudget = parseNum(rec.total_expenditures);
      const totalLevy = parseNum(rec.tax_levy);
      const stateAid = parseNum(rec.state_aid);
      const localReceipts = parseNum(rec.local_receipts);
      const incomePc = parseNum(rec.income_per_capita);
      const eqvPc = parseNum(rec.eqv_per_capita);
      const resTaxRate = parseNum(rec.residential_tax_rate);

      const metrics: FiscalMetrics & {
        stateAid?: number | null;
        localReceipts?: number | null;
        incomePc?: number | null;
        eqvPc?: number | null;
        resTaxRate?: number | null;
        formOfGovt?: string | null;
        chiefOfficialTitle?: string | null;
        policyBoard?: string | null;
        source?: string;
      } = {
        stabilizationBalance: null,
        stabilizationPctBudget: null,
        operatingBudget,
        overlayAppropriation: null,
        totalLevy,
        overlayPctLevy: null,
        certifiedFreeCash: null,
        freeCashPctBudget: null,
        stabilizationTrend: null,
        levyTrend: null,
        stabilizationSeries: [],
        levySeries: [],
        // MMA-specific extras
        stateAid,
        localReceipts,
        incomePc,
        eqvPc,
        resTaxRate,
        formOfGovt: rec.form_of_government ?? null,
        chiefOfficialTitle: rec.chief_municipal_official ?? null,
        policyBoard: rec.policy_board ?? null,
        source: "mma",
      };

      const risks = buildRisks(metrics);

      upsertSnapshot(db, {
        municipality: muni.name,
        fiscalYear: 2025,
        metrics,
        risks,
        computedAt: now,
      });

      // Also upsert governance-derived staff into town_staff_registry
      // Only if no real staff data exists yet
      const existing = db
        .prepare("SELECT scraped_at FROM town_staff_registry WHERE town_name = ?")
        .get(muni.name) as { scraped_at: string } | undefined;

      if (!existing) {
        const govStaff = buildGovernanceStaff(rec, muni.name);
        db.prepare(
          `INSERT OR REPLACE INTO town_staff_registry
           (town_name, dor_code, staff_json, source_pages, scraped_at, notice)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          muni.name,
          muni.dorCode,
          JSON.stringify(govStaff),
          JSON.stringify([`https://www.mma.org/community/${rec.slug}/`]),
          now,
          `Governance structure from MMA directory. Contains ${govStaff.length} role placeholders (no real names yet). Use "Sync Staff" to scrape real contact info.`
        );
      }

      ok++;
    } catch (e) {
      console.error(`[mma-sync] Error syncing ${muni.name}:`, e);
      err++;
    }
  }

  console.info(`[mma-sync] Done — ${ok} ok, ${err} err`);
  return { ok, err, total: ALL_MA_MUNICIPALITIES.length };
}
