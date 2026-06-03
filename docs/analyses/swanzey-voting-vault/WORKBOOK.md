# VAULT Workbook — Swanzey's Voting Record, Patterns & Forecast

### 11 years of Select Board era ballots and elections (2015–2026) — what they've done, the patterns, and where it's heading

**Subject:** Town of Swanzey, NH · **Method:** PublicLogic VAULT (auditable claims, every figure
traceable) · **Built:** 2026-06

> **Provenance tags.** `[R-AR]` real, extracted directly from the Town's official **annual reports**
> (2015–2025 PDFs, official-ballot results & deliberative minutes) · `[R-news]` real, from local news
> (2026 results not yet in an annual report) · `[D]` derived/calculated · `[M]` modeled (forecast).
> Source data ships beside this file as five CSVs. Where a figure is uncertain it is flagged; this
> workbook holds itself to the standard it measures the town against.

---

## Tab 0 — Executive Verdict

Across 11 years of official-ballot town meetings, Swanzey's electorate is **consistent, legible, and
increasingly stressed.** The data says four things plainly:

1. **They will fund operations but not borrow.** Operating budgets pass every year; **bonds die at the
   3/5 wall.** Capital reserves and tax credits pass by landslides (72–90% `[R-AR]`); the public works
   facility failed at 3/5 **twice** (54.7% in 2024, 58.4% in 2026 `[R-AR/news]`).
2. **Support is eroding.** Operating-budget approval slid from **76.6% (2015) → 57.3% (2025)** `[D]` —
   a 19-point drift toward the 50% cliff.
3. **The "vote no to save money" lever is gone.** The default budget now nearly equals the proposed
   budget (a **$47K gap in 2025**, vs **$560K in 2022** `[R-AR]`) — and in **2016 and 2017 the default
   actually *exceeded* the proposal** `[R-AR]`.
4. **They are restless about governance and government itself.** In 2025 voters **expanded the Select
   Board from 3 to 5** (740–653), **rejected** a second polling place (673–727), and in 2026 **kept
   SB2** by a 2.3-to-1 margin (repeal 345–809) — all while the **Town Administrator's office turned
   over three times in two years** `[R-news]`.

**The one-sentence verdict:** *Swanzey voters say "maintain, don't borrow; show us the plan, and stop
the churn" — and the town's structure (3/5 bonds, a vanishing default-budget lever, administrative
turnover) keeps colliding with exactly that.*

---

## Tab 1 — Methodology & Provenance

- **Sources.** Eleven official **annual report** PDFs (2015–2025) pulled from the Town's document
  center and parsed for the *Results of Official Ballot Voting* and *Deliberative Session Minutes*
  sections; 2026 results from Keene Sentinel / My Keene Now (the 2026 report isn't published yet).
- **What's a "vote" here.** The authoritative record is the **official ballot** (every warrant article,
  YES/NO) plus **deliberative-session standing votes** (amendments) and **officer elections** — the
  Select Board era's full democratic trail. Weekly administrative board roll-calls are not individually
  catalogued (10 years of them isn't a public dataset), but their *consequences* surface in what
  reaches the warrant and how it fares.
- **Honesty notes.** A few years' inline budget tallies weren't machine-readable in the PDF layout and
  are left blank rather than guessed. The 2016/2017 operating figure repeats ($6,210,799) in the source
  text and is flagged as possibly level-funded or a parsing artifact. Forecast figures are scenarios,
  not predictions.

---

## Tab 2 — The Budget Trajectory (the spine)

Real operating budgets, every year, from the annual reports (`budget-series.csv`):

| Year | Operating budget | YoY | Default budget | Default − Proposed | Budget vote |
|---|---|---|---|---|---|
| 2015 | $6,262,426 | — | $6,067,144 | −$195K | 673–206 (76.6%) |
| 2016 | $6,210,799 | −0.8% | $6,222,738 | **+$12K** | 670–311 (68.3%) |
| 2017 | $6,210,799 | 0.0% | $6,302,525 | **+$92K** | — |
| 2018 | $6,452,435 | +3.9% | $6,122,397 | −$330K | — |
| 2019 | $6,303,000 | −2.3% | $6,072,735 | −$230K | — |
| 2020 | $6,716,500 | +6.6% | $6,439,109 | −$277K | — |
| 2021 | $6,902,500 | +2.8% | $6,680,348 | −$222K | — |
| 2022 | $7,425,000 | +7.6% | $6,864,706 | −$560K | — |
| 2023 | $7,961,500 | +7.2% | $7,468,834 | −$493K | 388–236 (62.2%) |
| 2024 | $8,370,000 | +5.1% | $7,935,699 | −$434K | 738–530 (58.3%) |
| 2025 | $8,939,036 | +6.8% | $8,891,785 | **−$47K** | 800–596 (57.3%) |

**Patterns `[D]`:**
- **Two regimes.** A flat mid-2010s (~+1%/yr, 2015–2019) flips to a **+6–7%/yr** escalation (2020–2025).
  Decade growth **+42.7%**; recent 4-year CAGR **~6.7%**.
- **The default-budget trap.** The gap between default and proposed has **collapsed to ~0.5%**. A "no"
  vote on the budget now changes almost nothing — and twice (2016, 2017) it would have *raised*
  spending. The classic SB2 pressure valve is effectively closed.
- **Drivers** (per officials): wages, health insurance, insurance premiums, and the **ambulance
  contract** `[R-news]` — non-discretionary, so the climb continues regardless of service choices.

---

## Tab 3 — The Ballot Record (what they've actually done)

Significant articles with margins (`ballot-record.csv`). The story is in the **contrast**:

### What passes easily (the "maintain" mandate)
| Year | Article | Margin | % yes |
|---|---|---|---|
| 2023 | All-Veterans tax credit | 569–67 | **89.5%** |
| 2023 | Capital reserve deposit ($261,976) | 528–112 | 82.5% |
| 2023 | Capital reserve deposit ($590,000) | 494–141 | 77.8% |
| 2025 | Ambulance Expendable Trust ($100K) | 1060–350 | 75.2% |
| 2025 | DWSRF study, "100% principal forgiveness" ($100K) | 998–406 | 71.1% |

### What struggles or dies (the "don't borrow / don't overreach" mandate)
| Year | Article | Margin | % yes | Outcome |
|---|---|---|---|---|
| 2026 | **Public Works Facility** ($1.2M, 3/5) | 681–485 | 58.4% | **FAIL** (3/5) |
| 2024 | Bond/revolving (3/5) | 702–582 | 54.7% | **FAIL** (3/5) |
| 2023 | **Fire Stations** Capital Reserve ($300K) | 365–268 | 57.7% | pass, narrow |
| 2025 | Second polling location (petition) | 673–727 | 48.1% | **FAIL** |
| 2026 | Repeal SB2 | 345–809 | 29.9% | **FAIL** |

**The pattern is unmistakable `[D]`:** the same voters who give tax credits 90% and reserves 78% give
*facility bonds* 55–58% — enough for a majority, never enough for 3/5. **Swanzey doesn't have an
opposition problem; it has a supermajority-threshold problem.** (This is the empirical proof behind the
companion *Capital Forecast Book*: stop bonding, use majority-vote reserves.)

### The 2025 inflection — a town reorganizing itself
2025 was the busiest ballot in the record: voters **acquired the West Swanzey water system** (822–553,
RSA 38:4), created a **West Swanzey TIF district**, appropriated **$3.5M and $6.4M** for water
infrastructure (passing 3/5 — note: water capital *can* clear 3/5 when paired with principal
forgiveness/rates), funded a study **explicitly expecting "100% principal forgiveness"** `[R-AR]`, and
**expanded the Select Board to five members.** The town is simultaneously taking on a utility and
re-wiring its own governance.

---

## Tab 4 — Elections & Turnover

From officer results (`elections.csv`):

- **2022:** Karasinski retained (672) — quiet.
- **2023:** Hutwelker (394) over York (216); a second seat decided by **24 votes** (Reck Ames 442, Self
  418) — new faces arriving.
- **2024:** crowded six-name field; Tempesta (461) and Ward (294) win narrowly.
- **2026:** **incumbents challenged and unseated**; Ward (545), Tatro (481), York (414) in a bruising
  field; **Alan Gross wins the first-ever 5th seat** (678–408) after the 3→5 expansion `[R-news]`.

**Pattern `[D]`:** rising **electoral volatility** — crowded fields, sub-30-vote margins, ousted
incumbents — layered on top of **administrative churn** (three Town Administrators in ~2 years: Branley
→ Torpey interim → Rautiola → open). Continuity is the scarcest resource in Swanzey government.

---

## Tab 5 — Governance Votes (the identity question)

Swanzey keeps **voting on how it governs itself**, and the answers are consistent:

| Question | Year | Result | Reading |
|---|---|---|---|
| Expand Select Board 3 → 5 | 2025 | **PASS** 740–653 | Want *more* oversight/representation |
| Second polling location | 2025 | **FAIL** 673–727 | Don't want to change *access* mechanics |
| Repeal SB2 (return to floor meeting) | 2026 | **FAIL** 345–809 | Keep the all-day ballot, decisively |

**Reading `[D]`:** voters want **more checks** (a bigger board) but are **conservative about process**
(keep SB2, keep one polling place). They're tuning the *who*, not the *how*. The Select Board had
**recommended** the SB2 repeal — and the voters overruled them 2.3-to-1, a notable board-vs-electorate
divergence.

---

## Tab 6 — Their Exact Pains (the synthesis)

Ten documented pains, ranked by how much they constrain everything else (`pains-register.csv`):

1. **P1 — Administrative instability.** 3 administrators in ~2 years. *Every* other fix restarts each
   time the office turns over. **The master pain.** `[R-news]`
2. **P2 — Capital paralysis at the 3/5 wall.** Facilities fail with majorities; the town can't build.
   `[R-AR/news]`
3. **P3 — Eroding budget support** (76.6% → 57.3%) heading for the 50% cliff. `[D]`
4. **P4 — The dead default-budget lever** (gap ~$47K) — no fiscal pressure valve left. `[R-AR]`
5. **P5 — Development/land-use conflict + litigation** (Avanru senior-housing federal suit; Base Hill
   storage). Chills housing and invites legal exposure. `[R-news]`
6. **P6 — Utility takeover** (West Swanzey water acquisition + multi-million capital). Big new
   obligation and ratepayer-governance burden. `[R-AR]`
7. **P7 — Bridge/heritage disputes** (Christian Hill Road petitions). Recurring, emotional. `[R]`
8. **P8 — Governance-structure churn** (board 3→5; polling; SB2). Unsettled identity. `[R-AR/news]`
9. **P9 — Cost-driver escalation** (wages/health/EMS) forcing ~6–7%/yr. `[R]`
10. **P10 — Electoral volatility** (ousted incumbents, recounts). Compounds P1. `[R]`

**The throughline:** Swanzey is a town whose **costs and ambitions are rising** (water utility, fire,
EMS) while its **capacity to execute is thinning** (administrator churn, capital it can't pass, eroding
budget margins). The gap between *what it's taking on* and *what it can reliably deliver* is the real
pain — and it's widening.

---

## Tab 7 — FORECAST

> Modeled `[M]`. Budget projection compounds the **real** 2025 base ($8,939,036) at the observed recent
> growth band. Scenarios, not predictions (`forecast.csv`).

### 7.1 Operating budget
| Year | Low (4.5%) | Base (6.0%) | High (7.5%) |
|---|---|---|---|
| 2025 (actual) | $8.94M | $8.94M | $8.94M |
| 2026 | $9.34M | $9.48M | $9.61M |
| 2027 | $9.76M | $10.04M | $10.33M |
| 2028 | $10.20M | **$10.65M** | $11.10M |
| 2030 | $11.14M | **$11.96M** | $12.83M |

Base case **crosses $10M in 2027–28** and nears **$12M by 2030** — roughly **+34% over 2025** with no
new services, purely on the wage/health/EMS escalators.

### 7.2 Budget-approval margin
Trend points toward **~53% by 2028** and the **50% line around 2030** `[M]`. A budget *failure* becomes
plausible within ~3 cycles — but because the **default ≈ the proposal**, the fiscal consequence is
minor. **The real fight migrates to special/capital articles**, where margins are already tighter.

### 7.3 Capital (high confidence)
- **Any 3/5 bond keeps failing.** The public works facility will not pass as a bond — it has now lost
  twice with majorities. **The only path that fits this electorate is the reserve + state-aid + SRF
  strategy** (which they've *already started*: 2025's principal-forgiveness study and water acquisition).
  This is the empirical mandate for the companion **Capital Forecast Book**.
- **Water dominates the next 5 years.** Having voted to acquire West Swanzey's system and a TIF, expect
  multi-million SRF-funded water capital and a **rate study** — kept off the property tax if structured
  through rates.

### 7.4 Governance & administration (the swing factors)
- **The 5-member board takes hold** → expect more split votes and slower decisions before it stabilizes.
- **SB2 stays** (repeal lost 2.3-to-1); don't expect another repeal run to succeed.
- **Administrator stability is the wildcard.** Until the TA office is stabilized (multi-year contract,
  clear board-vs-administrator lanes), **every forecast above carries execution risk.** Fixing P1 is the
  highest-leverage move available — it's the precondition for solving P2–P10.

### 7.5 What would change this forecast
- A **recession or state-aid cut** → sharper budget-margin erosion, possible budget failure.
- **Stabilizing the administrator** → capital and water programs actually get delivered.
- **The Avanru litigation outcome** → could reset the development/land-use posture either way.

---

## Tab 8 — Sources & Caveats

- **Primary:** Town of Swanzey Annual Reports 2015–2025 (official-ballot results & deliberative minutes),
  parsed from the Town document center.
- **2026:** Keene Sentinel; My Keene Now (2026 annual report not yet published).
- **Context:** NH RSA framework (40:13 SB2, 33 bonding, 35 reserves, 38 municipal utilities, 162-K TIF);
  prior PublicLogic Swanzey workbooks.
- **Caveats:** some single-year budget tallies weren't machine-readable and are left blank; 2016/2017
  operating figure repeats in source (flagged); officer-vote figures with `~` are approximate from news;
  forecasts are scenarios. Verify any figure against the source report before relying on it.

*Data files: `budget-series.csv`, `ballot-record.csv`, `elections.csv`, `pains-register.csv`,
`forecast.csv`. Built PublicLogic-style: every claim tagged, every number traceable to a report.*
