# PublicLogic Federal Funding Architecture

**A durable, multi-year, administration-resilient view of how the work gets paid for over a decade.**

Prepared for: PublicLogic LLC — Nathan R. Boudreau (MPA/MCPPO) + Dr. Allison Weiss Rothschild (PsyD/LICSW/BCBA/LABA)
Companion files: `federal_mechanism_catalog.csv`, `multiyear_funding_stack.xlsx`, `funding_volatility_register.md`
Verification date for time-sensitive findings: **2026-06-03**.

> **Not legal or accounting advice.** Every statement of allowability here is *subject to the funding source, the
> approved budget, and the governing cost principles*. Dollar figures in the model are illustrative planning
> assumptions, not quotes or commitments. Verify each program against its current Assistance Listing / NOFO before
> relying on it.

---

## 0. The one distinction that governs everything: authorization ≠ appropriation ≠ allocation ≠ obligation

This is the discipline that keeps a funding architecture honest. A program can be **authorized** (a statute permits
it to exist) and still be dead money, because the chain to a recipient has four independent links and any one can
break:

| Link | What it means | What breaks it | Example of the break |
|---|---|---|---|
| **Authorization** | A statute permits the program to exist, usually for a set number of years. | The authorization expires and Congress doesn't reauthorize. | **SLCGP**'s IIJA authorization expired 9/30/2025. |
| **Appropriation** | Congress provides actual budget authority (annual, or "advance" multi-year). | No appropriation in the bill; or a CR that extends authority but carries **no new money**. | **SLCGP**: FY2026 appropriations extended authorization to 9/30/2026 but provided **no fresh money for new grants**. |
| **Allocation** | The agency distributes the budget authority (e.g., formula amounts to states). | Executive declines or delays the distribution. | **BRIC** funds were appropriated, then the agency tried to terminate the program. |
| **Obligation** | A binding award/commitment to a specific recipient. | Deadline passes; agency refuses to obligate. | **ARPA SLFRF**: obligation deadline (12/31/2024) has **passed** — no new obligations possible. |

**Digital Equity Act, BRIC, and SLCGP each looked alive at the authorization link while failing at a later one.**
The entire architecture below is built so the model keeps paying even when the volatile, discretionary links snap.
The status tag on every mechanism in `federal_mechanism_catalog.csv` is graded against *this* chain, not against
whether the program "exists."

**Confidence legend** (used throughout and in the catalog):

- **CONFIRMED-LIVE** — 2026 status verified this session from a primary/authoritative source.
- **IN-FLUX** — exists but authorization, appropriation, or administration is unsettled.
- **CANDIDATE** — usable, but the specific 2026 figures/status were **not** independently re-verified this session;
  treat as a research lead, not a fact.
- **DEAD** — terminated; never present as live.

---

## Part 1 — Federal money, mapped to the bone

### 1.1 The Uniform Guidance (2 CFR Part 200), walked as it governs *this* model

PublicLogic does not invent a new line item the client must find. Its fee rides inside money the client already
controls, charged to a federal (or federally-derived) award as a **professional-service cost under 2 CFR §200.459**.
The Uniform Guidance is therefore the operating system of the whole revenue model. The load-bearing provisions:

**Allowability (Subpart E, §§200.402–.405).** To be allowable a cost must be necessary and reasonable, allocable to
the award, consistent with policies applied uniformly, and adequately documented. PublicLogic's deliverables (the
Map, the narrative, the operating architecture, the compliance tail) are professional services that meet this when
they are in the **approved budget** of the award and serve the award's purpose.

**§200.459 — Professional service costs (the keystone).** Costs of professional and consultant services are allowable
when reasonable in relation to the services rendered. Critically, §200.459(b) lists factors including *"whether the
service can be performed more economically by direct employment rather than contracting"* and bars **contingent
fees**. This is exactly why PublicLogic's fees are structured **fixed-fee or retainer and non-contingent on award**:
a fee contingent on winning a grant would be a problem under the cost principles; a fixed professional-service fee
for mapping, design, or compliance work is squarely allowable. *The non-contingent structure is not a marketing
choice — it is what makes the cost allowable.*

**Indirect cost recovery — de minimis vs. NICRA.** A non-federal entity without a negotiated rate (NICRA) may elect
the **de minimis indirect rate of up to 15% of Modified Total Direct Cost (MTDC)** under §200.414(f). This rate was
**raised from 10% to 15%** in the 2024 Uniform Guidance revision, **effective for awards issued on or after
10/1/2024**; the same revision raised the per-subaward amount included in MTDC from $25,000 to $50,000.
([Schneider Downs summary of the 2024 revision](https://schneiderdowns.com/our-thoughts-on/uniform-guidance-increase-indirect-costs/), verified 2026-06-03.)
*Implication for PublicLogic:* most of its fee rides as a **direct** professional-service cost (§200.459), not as
indirect, so the de minimis rate mainly affects the *client's* overhead recovery, not PublicLogic's fee allowability.

**Procurement standards (§§200.317–.327).** When a pass-through entity (the client) buys PublicLogic's services with
federal money, it must follow the federal procurement standards: documented procurement, competition, cost/price
analysis for larger buys, and the §200.318 conflict-of-interest rules. PublicLogic should expect and welcome a
documented, competitive procurement — it is the client's compliance, and PublicLogic's compliance work can help
build it.

**Subrecipient vs. contractor (§200.331) — which one is PublicLogic?** This is determinative for how PublicLogic is
treated. A **subrecipient** carries out a part of the federal program (makes eligibility/programmatic decisions, is
measured against program objectives, is subject to the program's compliance requirements). A **contractor** provides
goods/services within its normal business operations, to many purchasers, in a competitive market, and is **not**
subject to the program's compliance requirements in its own right. **PublicLogic is a contractor.** It sells
mapping, architecture, and compliance services to many clients; it does not determine grantee eligibility or carry
programmatic decision-making. Consequences: PublicLogic is **procured** under §§200.317–.327, it is **not itself
Single-Audited**, and the client carries the program-compliance responsibility (which PublicLogic's work supports).

**Period of performance (§200.309), cost-share/match (§200.306), program income (§200.307).** Costs are allowable
only within the award's period of performance. Where a program requires **match**, PublicLogic's fee can sometimes
*count toward* the non-federal share when paid from non-federal funds (subject to the program's rules). **Program
income** (e.g., revenue a project generates) is governed by §200.307 and can extend the money available for
stewardship — a lever in the multi-year stack.

**Single Audit threshold (§200.501).** A non-federal entity that **expends ≥ $1,000,000** in federal awards in its
fiscal year must have a Single Audit. This was **raised from $750,000 to $1,000,000** in the 2024 revision,
**effective for fiscal years beginning on or after 10/1/2024**
([Schneider Downs](https://schneiderdowns.com/our-thoughts-on/uniform-guidance-increase-indirect-costs/), verified 2026-06-03).
*Implication:* a small town braiding several sub-$1M awards may stay under the threshold; a town running a large
braided capital stack crosses it and needs the audit infrastructure — a concrete PublicLogic compliance-tail product.

### 1.2 The federal program catalog (by domain)

The full machine-readable catalog is `federal_mechanism_catalog.csv` (39 mechanisms, each with Assistance Listing #,
statute, controlling CFR/IRC, formula-vs-competitive, entitlement-vs-discretionary, pass-through path, eligible uses,
match, period of performance, the PublicLogic cost-treatment route, 2026 status, confidence tag, source URL, and
verification date). The domains and the headline 2026 findings:

- **Water (bedrock).** **CWSRF (AL 66.458, CWA Title VI)** and **DWSRF (AL 66.468, SDWA §1452)** — formula
  capitalization grants to state revolving funds, then loans to locals. **FUNDED FY2026:** P.L. 119-74 provides
  ~$3.04B for EPA water infrastructure (= FY2025), and EPA announced ~$7.2B in combined CWSRF/DWSRF allotments
  (annual appropriation + IIJA). **EPA Brownfields (AL 66.818, CERCLA §104(k))** pairs with CWSRF for the
  water-quality portion of site cleanup. ([CRS IF13177](https://www.congress.gov/crs-product/IF13177), [EPA DWSRF](https://www.epa.gov/dwsrf), verified 2026-06-03.)
- **Resilience (volatile + statutory).** **BRIC (AL 97.047, Stafford §203)** — **RESTORED:** terminated 4/4/2025,
  permanently enjoined 12/11/2025, enforcement order 3/6/2026, and FEMA issued a **joint FY2024–2025 BRIC NOFO on
  3/25/2026 with ~$1B available** ([Coastal Review](https://coastalreview.org/2026/03/federal-judge-orders-fema-to-restore-bric-program/), verified 2026-06-03). Treat as *reopening but politically fragile* (IN-FLUX). The durable sibling is
  **HMGP (AL 97.039, Stafford §404)** — **statutory and recurring**, funded automatically as a percentage of
  declared-disaster costs, so it survives where BRIC wobbles.
- **Cyber (volatile).** **SLCGP (AL 97.137, 6 U.S.C. 665g)** — **IN-FLUX:** authorization extended to 9/30/2026 but
  **no new money** appropriated; **PILLAR Act (H.R.5078) passed the House 11/17/2025**, Senate companion S.3251 in
  committee, **not signed into law as of 6/3/2026** ([StateTech](https://statetechmagazine.com/article/2025/11/congress-revives-state-and-local-cyber-grants-funding-remains-unclear), verified 2026-06-03). Prior-year/IIJA carryover NOFOs still flow at the state level.
- **Broadband (one DEAD, one IN-FLUX).** **Digital Equity Act (AL 11.032/11.033)** — **DEAD** ($2.75B, terminated
  5/9/2025); do not resurrect it. **BEAD (AL 11.041, IIJA §60102)** — IN-FLUX after the 2025 "Benefit of the
  Bargain" restructure; funds obligated to state offices but local subgrant timing shifted.
- **Economic development / capital.** **EDA Public Works & EAA (AL 11.300/11.307, PWEDA)**; **CDBG State/Small Cities
  (AL 14.228, HCDA Title I)** with its allowable planning+admin line; **USDA Community Facilities (AL 10.766)** and
  **Rural Water/Waste (AL 10.760)** for rural clients; **USDOT RAISE (AL 20.933)** and **SS4A (AL 20.939)**.
- **Energy.** **EECBG (AL 81.128, EISA 2007)** — IIJA-refunded block grant for local efficiency work.
- **Records / digital government.** **NHPRC (AL 89.003)** archives/records grants; **IMLS Grants to States
  (AL 45.310)** — **IN-FLUX** after 2025 executive action and litigation; verify FY2026 status before relying on it.
- **Behavioral health / human services / workforce (Rothschild-side).** **SAMHSA MHBG (AL 93.958)** and
  **SUBG/SABG (AL 93.959)** formula block grants; **CCBHC (AL 93.829/93.696)** Medicaid demonstration + grants;
  **WIOA Adult/DW/Youth (AL 17.258/.278/.259)**; and the bedrock of bedrocks, **Medicaid Title XIX (AL 93.778)** —
  an **open-ended entitlement** whose 50% administrative match can fund eligible systems and compliance work.
- **Fiscal recovery (closing).** **ARPA SLFRF (AL 21.027)** — obligation deadline **passed** (12/31/2024); must be
  **fully expended by 12/31/2026** (closeout report 4/30/2027) or returned to Treasury
  ([UNC Coates' Canons](https://canons.sog.unc.edu/2026/01/2026-the-final-countdown-has-begun-for-arp-slfrf/), verified 2026-06-03). Use it to fund Steward work that *finishes* before 12/31/2026 — not to start anything new.
- **State / own-source layer (MA bedrock for MA clients).** **Community Compact IT** (CONFIRMED-LIVE: FY2026 round,
  $200K cap, **no match**, applications 1/5/2026–2/5/2026, regional joint applications encouraged
  ([Mass.gov](https://www.mass.gov/community-compact-it-grant-program), verified 2026-06-03)); **Community One Stop
  for Growth** (MassWorks, Community Planning Grant, Brownfields); **MVP**; **Efficiency & Regionalization**; and
  **municipal own-source revenue** — the sustainability backstop.

> **Honesty flags carried from the catalog:** several federal programs above are tagged **CANDIDATE** because their
> *specific* FY2026 appropriation level or NOFO cycle was not re-verified in this session (EDA, CDBG, USDA RD, RAISE,
> SS4A, EECBG, the SAMHSA/WIOA block grants, NHPRC). They are real, standing programs, but **confirm the current
> Assistance Listing and NOFO before budgeting against them.** The client-provided MA anchors **MTTA/TARPA** are
> carried as CANDIDATE with their specifics unverified — confirm exact program names and terms before use. This is
> deliberate: the architecture's durability does not depend on any CANDIDATE line (see Part 2).

### 1.3 Tax credits *are* federal funding

For a tax-exempt municipal or nonprofit client, the credits below are monetized as cash via **elective (direct) pay
(IRC §6417)** or **transferability (IRC §6418)**, and they are the most administration-proof federal money in the
stack because they are **statutory entitlements, not annual appropriations** — no appropriator can zero them out in
a CR. Post-OBBBA status (OBBBA = One Big Beautiful Bill Act, P.L. 119-21, **signed 7/4/2025**):

| Credit | Statute | 2026 status (verified 2026-06-03) | How a tax-exempt client monetizes |
|---|---|---|---|
| **§45Q carbon oxide sequestration** | IRC §45Q | **Preserved & strengthened:** EOR/utilization rate raised to **$85/ton** (parity with storage) for equipment placed in service after 7/4/2025; **FEOC limits** — Specified Foreign Entities ineligible for tax years beginning after enactment, Foreign-Influenced Entities +2 yrs; transfers barred to SFEs ([Payne Institute](https://payneinstitute.mines.edu/keeping-up-with-carbon-key-changes-for-45q-tax-credits-under-one-big-beautiful-bill-act-and-possible-impacts/)) | Elective pay (§6417) for cash; 12-yr credit period |
| **NMTC** | IRC §45D | **Made PERMANENT by OBBBA** (was expiring 12/31/2025); ~$5B/yr allocation authority ([Novogradac](https://www.novoco.com/notes-from-novogradac/final-reconciliation-bill-permanently-expands-lihtc-nmtc-and-oz-incentive-but-does-not-include-htc-provisions)) | Below-market leverage loan into the project; investor takes the 39%/7-yr credit |
| **LIHTC** | IRC §42 | **Expanded by OBBBA:** 9% ceiling permanently **+12%**; 4% bond-financing test permanently lowered **50%→25%** (more 4% deals viable) ([Nixon Peabody](https://www.nixonpeabody.com/insights/alerts/2025/07/16/low-income-housing-and-community-development-tax-credits-in-the-big-beautiful-bill)) | Equity from credit sale to investor; layered with soft debt |
| **HTC** | IRC §47 | **Unchanged** at federal level (HTC bill provisions not included in OBBBA); 20% / 5-yr | Credit to owner, ratable over 5 yrs |
| **Elective/Direct Pay** | IRC §6417 | **Retained** for tax-exempt/governmental entities; **domestic-content** phase-downs and **FEOC** limits tighten from 2026 | The monetization mechanism itself |
| **48E/45Y clean electricity** | IRC §48E/§45Y | **CLOSING WINDOW:** OBBBA terminates wind/solar for facilities placed in service after 12/31/2027; **full credit only if construction begins before 7/4/2026**; FEOC material-assistance (MACR) thresholds from 2026 (IRS Notice 2026-15, 2/12/2026) ([Novogradac](https://www.novoco.com/periodicals/articles/obbba-and-the-clean-energy-race-against-the-clock)) | Elective pay; **but the clock is running — begin construction before 7/4/2026** |

**The headline currency corrections vs. prior assumptions:** (1) **BRIC is back** with a live $1B NOFO as of
3/25/2026 — do not describe it as merely "court-ordered, FEMA slow to comply." (2) **NMTC is now permanent**, which
*promotes it from a sunsetting credit into bedrock.* (3) **LIHTC 4% deals got materially easier** (bond test 50%→25%).
(4) **45Q is stronger ($85/ton) but newly fenced by FEOC** from 2026. These four corrections change where the program
sits in the bedrock-vs-volatile split below.

---

## Part 2 — The long-term funding architecture (the core)

### 2.1 Thesis: bedrock vs. volatile — and the model must stand on bedrock alone

Separate the stack into two layers and weight everything toward the first:

**BEDROCK (durable across administrations):**
- **Statutory entitlements** — Medicaid Title XIX (incl. 50% admin match); the **tax credits** (§45Q, NMTC, LIHTC,
  HTC, §6417/§6418) which are statutory and not annually appropriated.
- **Formula programs** — CWSRF/DWSRF capitalization, CDBG, the SAMHSA and WIOA block grants, HMGP (auto-funded off
  disaster declarations).
- **Own-source revenue** — municipal tax levy, enterprise funds, capital plans. The most durable money of all.

**VOLATILE (competitive discretionary — the failure mode):**
- BRIC, SLCGP, BEAD subgrants, EDA/RAISE/SS4A competitive rounds, NHPRC, IMLS. These are where DEA, BRIC, and SLCGP
  taught the lesson: an administration or a CR can make them vanish between the diagnosis and the build.

**The stress test (and the design rule):** *Does the architecture still stand if the entire competitive-discretionary
layer is removed?* **Yes — by construction.** Both worked examples in Part 3 are engineered so that:
1. the **entry move** (Discover/Map) is funded by a bedrock or no-match state source (Community Compact IT, MVP/CPG
   planning, or own-source) — never by a volatile grant;
2. the **capital** is anchored on **formula/loan bedrock** (CWSRF/DWSRF, MassWorks) and **permanent tax credits**
   (NMTC, §45Q), with any competitive grant (BRIC, EDA, Brownfields) treated as *upside, not foundation*; and
3. the **stewardship tail** lands on **own-source** revenue and statutory compliance periods (NMTC's 7 years, §45Q's
   12 years), which do not depend on next year's appropriation.

If every volatile line in the catalog disappeared tomorrow, Example A still runs on Community Compact IT (no match) →
Community Planning Grant → MassWorks → CWSRF → own-source, and Example B still runs on Brownfields-or-own-source →
CWSRF → **NMTC (permanent)** → **§45Q (statutory)** → own-source tail. The volatile layer accelerates the flywheel;
it never holds it up.

### 2.2 Braiding and blending — combining sources legally

PublicLogic's value at the architecture level is making multiple federal sources work together without tripping the
cost principles. Two patterns, and the rule that separates them:

- **Braiding (separate accounting).** Each funding source pays for a **distinct, separately-tracked** cost. The Map
  is charged to Community Compact IT; the cleanup to Brownfields; the water work to CWSRF; the compliance tail to
  own-source. Each award sees only its own costs; each is auditable on its own. This is the default and the safest.
- **Blending (pooled accounting).** Sources are pooled to pay for shared costs. Far more compliance-intensive and
  only viable where every contributing program's rules permit it. PublicLogic generally **braids**, reserving
  blending for cases with explicit authority.
- **Supplement-not-supplant.** Many federal programs (CDBG, the block grants, education/workforce money) require that
  federal funds *add to*, not *replace*, funds the client would have spent anyway. The architecture respects this by
  having federal money buy *new* capacity (the Map, the new system, the new capital) and own-source money carry the
  *baseline* operations and the stewardship tail.
- **Layering across the project life:** **planning → capital → O&M** mapped to **different sources and years.**
  Planning rides cheap, no-match, fast money (Community Compact IT, MVP/CPG planning, SS4A action plans). Capital
  rides formula loans + tax credits (CWSRF, MassWorks, NMTC, §45Q). O&M/stewardship rides own-source. *One award's
  deliverable becomes the next award's eligibility* — the Map is both the diagnosis and the grant narrative; the
  narrative opens the capital; the capital budget carries the compliance tail. That sequencing **is** the flywheel.

### 2.3 The multi-year stack (5–10 year period-of-performance view)

Modeled live in `multiyear_funding_stack.xlsx` (every total is a formula; assumptions live in the `Inputs` sheet).
The shape of a decade for a client running Discover→Continue:

| Years | Cycle stage(s) | Source layer | PublicLogic cost route |
|---|---|---|---|
| **Y1** | Discover / Honor | No-match state + own-source (Community Compact IT, MVP) | **SOFT** (Map as soft cost) |
| **Y1–2** | Understand / Improve | State planning (Community Planning Grant), closing ARPA SLFRF | **SOFT / ADMIN** |
| **Y2–4** | Build (capital) | Formula loan + state capital + permanent tax credits (CWSRF, MassWorks, NMTC, §45Q) | **SOFT / COMPLIANCE** |
| **Y4–7** | Steward | **Own-source handoff** begins (retainer in operating budget) | **ADMIN** |
| **Y5–10+** | Continue | Own-source + statutory compliance periods (NMTC 7-yr, §45Q 12-yr) | **COMPLIANCE / ADMIN** |

**The own-source handoff is the sustainability test.** Federal capital money is one-time; the system it builds needs
stewardship forever. The architecture is only sound if, by the time federal money ends, the **stewardship cost has
been moved into a recurring own-source operating line** (and, for capital deals, financed by the statutory compliance
periods the deal itself created). In the model, Example A's retainer moves to own-source in Y4 and runs indefinitely;
Example B's tail is carried by the 7-year NMTC compliance period and 12-year §45Q period before, again, landing on
own-source. *If a client cannot eventually carry stewardship on own-source, the model has not succeeded — it has
created dependency.* That honesty is the point.

### 2.4 Administration-proofing — explicit weighting

| Mechanism class | Depends on | Resilience | Architectural weight |
|---|---|---|---|
| Tax credits (§45Q, NMTC, LIHTC, §6417/18) | Statute only | **Highest** — survives CRs and shutdowns | **Anchor capital deals here** |
| Entitlements (Medicaid Title XIX) | Statute (open-ended) | **Highest** | Behavioral/human-services backbone |
| Formula loans/grants (CWSRF/DWSRF, CDBG, block grants, HMGP) | Annual/advance appropriation, but formula-distributed | **High** | Primary capital + program bedrock |
| Own-source revenue | Local authority | **Highest (local)** | The stewardship tail; the backstop |
| Competitive discretionary (BRIC, SLCGP, EDA, RAISE, SS4A, IMLS) | Annual appropriation **and** executive discretion | **Low — the failure mode** | **Upside only; never the foundation** |

Rule of thumb baked into the model: **no cycle stage's *critical path* may depend on a competitive-discretionary
line.** Volatile money funds acceleration and scope, not survival. When Washington changes, the bedrock layer absorbs
the loss (see `funding_volatility_register.md` for the program-by-program mitigation map).

### 2.5 PublicLogic's own revenue architecture inside the stack

PublicLogic's fee structure maps cleanly onto allowable cost lines (`PublicLogic_Revenue` sheet):

| Revenue line | Cost route | Allowability basis (subject to source/budget/cost principles) | Recurring? |
|---|---|---|---|
| Stewardship Map (entry) | **SOFT** | Professional-service soft cost, 2 CFR §200.459 | No (per turn) |
| Grant narrative / Understand | **SOFT** | Soft cost in a planning grant, §200.459 | No (per turn) |
| Compliance-infra on capital | **COMPLIANCE** | Soft cost on the approved capital budget, §200.459 | Per project |
| Stewardship retainer | **ADMIN** | Own-source operating line (post-federal), §200.459 | **Yes (annual)** |
| NMTC 7-yr compliance tail | **COMPLIANCE** | CDE compliance-period monitoring, §200.459 | **Yes (7 yrs)** |

**Indirect-rate implications.** Because PublicLogic's fees ride as **direct** professional-service costs, the de
minimis indirect rate (15% MTDC, §200.414(f)) mostly affects the *client's* overhead recovery, not PublicLogic's fee
allowability. If PublicLogic ever needed to recover its own indirect costs on a federal subaward, it could elect the
15% de minimis without a NICRA — but the cleaner posture is direct-cost professional services.

**The recurring stewardship revenue the architecture generates.** The fixed-fee entry (Map) is deliberately cheap —
it is the loss-leader that produces both the diagnosis and the grant narrative. The *durable* revenue is the
**compliance tail and the retainer**: in the two worked examples, PublicLogic earns **~$285K over 7 years from the
small town** (most of it the retainer and the capital compliance line) and **~$649K over 8 years from the capital
deal** (the close-out compliance-infra fee plus a 7-year NMTC compliance tail). One Map opens the capital; the capital
budget carries the compliance cost; the compliance period and the own-source handoff carry the retainer forward. **One
turn funds the opening of the next.**

---

## Part 3 — The cycle at federal scale

### 3.1 Each stage → federal source, cost treatment, entry move

| Cycle stage | Federal/derived source | Cost treatment | The entry move |
|---|---|---|---|
| **Discover** | Community Compact IT (state, no match); MVP/CPG planning; own-source | **SOFT** | The cheap Map — diagnosis *and* grant narrative |
| **Honor** | Same planning money; records (NHPRC) | **SOFT** | Inventory what exists before changing it |
| **Understand** | Community Planning Grant; SS4A action plan; block-grant planning lines | **SOFT** | Model the system; write the narrative that opens capital |
| **Improve** | CDBG, EDA planning, MVP Action | **SOFT** | Design the intervention against the diagnosis |
| **Build** | CWSRF/DWSRF, MassWorks, NMTC, §45Q, Brownfields, BRIC (upside) | **SOFT / COMPLIANCE** | The narrative opens the capital; compliance-infra rides the budget |
| **Steward** | Own-source handoff; ARPA SLFRF (if before 12/31/2026); statutory compliance periods | **ADMIN / COMPLIANCE** | Move stewardship into a recurring own-source line |
| **Continue** | Own-source + the next Discover (new domain) | **ADMIN** | The retainer funds the search for the next turn |

### 3.2 Worked Example A — small/rural MA town, full cycle on a multi-year stack

*(Live in `multiyear_funding_stack.xlsx`, sheet `ExampleA_RuralTown`; figures below are the model's computed results.)*

A ~4,200-person MA town. Assumptions in the `Inputs` sheet; all totals are formulas.

1. **Y1 — Discover.** Town wins a **Community Compact IT grant of $150,000** (state, $200K cap, **no match**). The
   **PublicLogic Stewardship Map ($35,000)** rides as a **soft cost** inside that grant (planning/design/training are
   eligible one-time costs). The Map produces the diagnosis *and* the grant narrative for the next step. Closing
   **ARPA SLFRF** remainder (~$40K/yr, Y1–2) funds interim stewardship that *finishes before 12/31/2026*.
2. **Y2 — Honor/Understand.** Town wins a **Community Planning Grant ($50,000)** via the One Stop. PublicLogic's
   **narrative/Understand engagement (~$20,600)** rides as a soft cost and opens the capital case.
3. **Y3 — Build.** Town assembles **$1,000,000 MassWorks** (state) + **$2,000,000 CWSRF** loan (federal bedrock, with
   ~20% principal forgiveness for a disadvantaged community → ~$1.6M net). PublicLogic's **compliance-infrastructure
   fee (~$120,000 = 4% of the $3.0M capital)** rides as a soft cost on the approved budget.
4. **Y4–Y7 — Steward/Continue.** Federal capital is spent; stewardship moves to a **recurring own-source retainer
   (~$24K/yr, escalating)** in the operating budget. This is the **own-source handoff** — the sustainability test —
   and it funds the search for the next Discover (a new domain), restarting the flywheel.

**Model results:** the town pulls a **cumulative ~$2.59M** across the stack over 7 years (net of PublicLogic's fees
and the small required shares), and **PublicLogic earns ~$285,317 over the 7 years** — Map $35K, narrative ~$20.6K,
capital compliance $120K, and ~$108K of recurring retainer. No line on the critical path is competitive-discretionary;
the town never *needs* a volatile grant to complete the cycle.

### 3.3 Worked Example B — capital/environmental deal (NMTC + §45Q + SRF/Brownfields) with the compliance tail

*(Live in `multiyear_funding_stack.xlsx`, sheet `ExampleB_CapitalDeal`.)*

A tax-exempt sponsor redevelops a brownfield with a carbon-capture/clean-energy component.

1. **Y1 — Site cleanup.** **EPA Brownfields cleanup grant ($500,000, AL 66.818)**, with the **20% non-federal share
   (~$100K)** from own-source (hardship-waivable). Placed-in-service of the capture equipment is set for end of Y1.
2. **Y2 — Capital close.** **NMTC $10,000,000 Qualified Equity Investment** (permanent under OBBBA) delivers a **net
   subsidy to the project of ~$2,000,000** (after CDE fees/leverage); **CWSRF $1,500,000** funds the water-quality
   remediation. PublicLogic's **compliance-infrastructure fee at close (~$460,000 = 4% of the $11.5M NMTC+CWSRF
   stack)** rides the budget.
3. **Y2–Y8+ — §45Q runs.** Carbon capture of **8,000 t/yr × $85/ton = ~$680,000/yr**, monetized as cash by the
   tax-exempt sponsor via **elective pay (§6417)**, for the **12-year** §45Q period (Y2 onward; first ~7 years shown).
4. **Y2–Y8 — the compliance tail.** PublicLogic carries the **7-year NMTC compliance period** (CDE reporting,
   recapture-risk monitoring) as a recurring **~$24–30K/yr** retainer, after which stewardship lands on own-source.

**Model results:** the deal nets a **cumulative ~$8.01M** to the sponsor across 8 years (driven by the NMTC subsidy
and the §45Q stream), and **PublicLogic earns ~$649,416 over 8 years** — the $460K close-out compliance-infra fee plus
a ~$189K seven-year NMTC compliance tail. The deal stands entirely on **bedrock**: a permanent credit (NMTC), a
statutory credit (§45Q), a formula loan (CWSRF), and a recurring competitive-but-standing cleanup grant (Brownfields)
that could be swapped for own-source if it disappeared. **The compliance tail is the durable, recurring revenue the
architecture was built to generate.**

---

## Self-check (per the working method)

- **Is every federal program's status verified and dated?** The load-bearing, time-sensitive items (de minimis rate,
  Single Audit threshold, SLCGP, BRIC, ARPA SLFRF, §45Q, NMTC, LIHTC, HTC, 48E/45Y, CWSRF/DWSRF FY2026, Community
  Compact IT) are verified from primary/authoritative sources and **dated 2026-06-03**. Standing programs whose exact
  FY2026 appropriation/NOFO was not re-verified are **explicitly tagged CANDIDATE** in the catalog and flagged in
  §1.2 — not presented as confirmed.
- **Is authorization distinguished from appropriation everywhere?** Yes — §0 sets the four-link chain and every
  status tag is graded against it (SLCGP is the worked illustration: authorized, not appropriated for new awards).
- **Does the architecture still stand if the entire competitive-discretionary layer is removed?** Yes — both worked
  examples keep their critical path on bedrock (no-match state entry, formula loans, permanent/statutory tax credits,
  own-source tail); the volatile layer is upside only. That is the design rule, not an afterthought.
- **No fabrication.** Where currency could not be confirmed this session, the item is marked CANDIDATE and dollar
  figures are labeled illustrative planning assumptions, not quotes.

*All allowability statements are subject to the funding source, the approved budget, and the governing cost
principles. Not legal or accounting advice.*
