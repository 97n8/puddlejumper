# PublicLogic — Business Model & Path

How the practice makes money, why it's durable, and the sequence from here to a recurring base.
Drawn from PublicLogic's own engagements (Shrewsbury FY26 Municipal Fiber, Sutton) and the federal funding
architecture in this folder. Figures are PublicLogic's own data points and the model's planning assumptions, not
quotes. Not legal/accounting advice.

---

## 1. The business in one sentence

**PublicLogic maps, builds, and stewards the governance systems a public institution runs on — so they survive
turnover — and is paid out of money the institution already controls, never a new line item it has to find.**

Two disciplines under one roof, which is the whole point: **governance/systems** (Nathan Boudreau, MPA/MCPPO — writes
the policy *and* the code) and **behavioral/organizational systems** (Dr. Allison Weiss Rothschild, PsyD/LICSW/BCBA/
LABA — makes the system get adopted and stick). The market sells these three things separately; PublicLogic is the
only place they arrive as one engagement.

## 2. What you sell — the product ladder

| Rung | Product | What it is | Role in the model |
|---|---|---|---|
| **Entry** | **Stewardship Map** | A cheap, fast, fixed-fee diagnostic of how the institution actually operates and where knowledge is concentrated in people instead of systems | Loss-leader. Produces **both** the diagnosis **and** the grant narrative |
| **Architecture** | **VAULT** | Governance architecture — pre-built modules (e.g., 25, MA-specific) each mapped to its statutory authority, with acceptance criteria and stop rules | The reusable asset. "Not software — the structure underneath the software" |
| **Build** | **LogicOS / CivicPulse / PuddleJumper** | The deployed, town-configured systems and runtime; custom code written by the same person who knows the statute | The capital-funded deliverable |
| **Environment** | **CaseSpace** | Hosted, governed environment | Optional hosting layer |
| **Continuity** | **CFIR-structured stewardship** (Rothschild) | Adoption, turnover-reduction, sustainability protocol | What makes renewals real, not nominal |

**Critical design choice: the client owns everything at close.** All code, configurations, documentation, training —
transferred to the town. PublicLogic retains no access, no license, no recurring SaaS fee. "If PublicLogic ceased to
exist the day after close, the systems keep running." This *looks* like leaving money on the table; it is actually
the trust mechanism that makes sole-source defensible and repeat business possible.

## 3. How you make money — the mechanism that matters

PublicLogic's fee is **fixed-fee or retainer, non-contingent on award**, and it rides inside money the client already
controls via one of **three cost-treatment routes**:

1. **Grant-administration cost** (admin line of an awarded grant)
2. **Project soft cost** (planning/design/professional service on a capital budget)
3. **Compliance infrastructure** (monitoring/governance inside the program's own money)

- When the money is **federal**, the fee is an allowable **professional-service cost under 2 CFR §200.459** (fixed and
  non-contingent — a contingent "percentage-of-award" fee would be a factor *against* allowability).
- When the money is **state/own-source**, the fee is paid from **town appropriation** under a **MGL c.30B §7**
  sole-source services agreement.
- **Grant *writing*** is kept separate: it's a **proposal cost under 2 CFR §200.460** (own-source/F&A, non-contingent)
  — never charged to the award being sought.

This is why PublicLogic is never "a new line item the client has to find." The client finds the *capital* (the grant,
the SRF loan, the tax credit, the appropriation); PublicLogic's fee is a small, allowable slice of that capital.

## 4. The flywheel — with the real numbers

> Cheap **Map** → produces the **diagnosis + the grant narrative** → the narrative **opens the capital** → the
> capital funds the **Build** → the Build budget **carries the stewardship cost forward** → the **retainer** funds the
> search for the next turn. **One turn funds the opening of the next.**

Real and modeled data points:

- **Map (entry):** ~**$35K**, soft cost / own-source. Buys the diagnosis and the narrative.
- **Build (implementation):** ~**4% of capital** as compliance-infra, *or* a full implementation contract. Shrewsbury
  is the live example: **$123K** = $55K governance deployment + $42K custom code + $18K Rothschild continuity + $8K
  training, inside a **$229K** grant request.
- **Stewardship tail:** ~**$24K/yr** recurring retainer on **own-source**, plus statutory compliance tails (e.g., a
  7-year NMTC compliance period on a capital deal).

Modeled lifetime value per relationship (from `multiyear_funding_stack.xlsx`):
- **Small/rural town, full cycle:** ~**$285K of PublicLogic revenue over 7 years** (Map + narrative + capital
  compliance + retainer).
- **Capital/environmental deal (NMTC + §45Q + SRF/Brownfields):** ~**$649K over 8 years**, most of it the close-out
  compliance fee plus a multi-year compliance tail.

The entry is cheap on purpose; **the durable money is the tail.**

## 5. The moat — and why the moat *is* the pricing power

PublicLogic's sole-source justifications (Shrewsbury, Sutton) name the moat in three grounds, any one sufficient:

1. **Purpose-built, town-specific governance architecture** (VAULT modules mapped to MGL authority) — not a market
   commodity;
2. **Integrated capability not available as a single market offering** — municipal policy + custom code (same person)
   + CFIR behavioral science;
3. **Non-replicable institutional knowledge** of how the specific town actually operates.

The moat and the **procurement justification are the same fact.** Because no one else offers the integrated, town-
configured capability, the award is defensibly **sole-source** under **MGL c.30B §7** (and **2 CFR §200.320(c)(2)**
when federal money pays — see `sole_source_federal_overlay.md`). Sole-source means **no price competition**, which
means **pricing power** — earned honestly by being genuinely the only integrated source, not by lock-in (the client
owns everything).

## 6. Why it's durable — bedrock-vs-volatile, applied to *your own* revenue

The same logic that protects the client's funding protects PublicLogic's:

- **PublicLogic's bedrock** = the **recurring retainers + compliance tails** (own-source funded, multi-year, not
  dependent on any grant cycle). This is the base to grow.
- **PublicLogic's volatile layer** = **project wins** that depend on competitive grants (BRIC/SLCGP-class). These are
  **upside, not foundation.**

If the entire competitive-discretionary grant layer vanished, the entry move still runs on **no-match state money**
(Community Compact IT, $200K cap) and **own-source**, and the tail still runs on **own-source retainers**. The
practice does not collapse with a change in Washington — by design.

## 7. The honest constraints (what the path has to solve)

1. **Founder-bound delivery.** The moat — "Boudreau writes the policy *and* the code" — is also the bottleneck.
   Revenue today scales with Boudreau-hours. Scaling means turning bespoke delivery into a **reusable module library**
   so each new town consumes configuration, not invention.
2. **Dual-role conflict.** Boudreau writes the application *and* is the vendor. Defensible (non-contingent fee,
   independent Town Manager determination, Town Counsel sign-off, single-source = no competition) — but it must be
   **clean every time**, or one bad file taints the model. Standardize the `sole_source_federal_overlay.md` checklist.
3. **Market concentration.** MA municipalities under the Town Manager form. Deep, but one market and one statute set.
4. **Trust-paced sales.** Sole-source requires a Town Manager who already trusts you; the funnel is relationship-led,
   not volume-led. The Map is the cheap trust-builder that widens the top.

## 8. How you get there — the path

**Phase 0 — Proof (now).** A handful of sole-source engagements (Shrewsbury, Sutton), the products built (VAULT,
PuddleJumper, CivicPulse), the artifacts (Stewardship Workbook, funding architecture, c.30B §7 + federal overlay
templates). *Status: substantially done.* **Milestone met when:** 2–3 reference towns can be cited by name.

**Phase 1 — Productize the entry & the paperwork.** Make the **Map** a fixed-price, ~2–4 week product any town can buy
from own-source or **Community Compact IT (no match)**. Standardize the **sole-source packet** (c.30B §7 + federal
overlay + cost/price + COI mitigation) so every engagement is procurement-ready on day one.
**Metric:** Maps sold per quarter; days-to-procurement-ready.

**Phase 2 — Prove the flywheel conversion.** Track **Map → grant narrative → won award → sole-source Build →
retainer**. Each completed town becomes a reference, a case study, *and* a set of reusable VAULT modules.
**Metric:** Map→Build conversion %; average revenue per relationship (target the ~$285K/7-yr small-town curve).

**Phase 3 — Stack the recurring base.** Convert every Build into a **retainer + compliance tail** so PublicLogic
carries a predictable recurring base (its own bedrock) that de-risks it from any single grant cycle.
**Metric:** # towns on retainer; **% of revenue that is recurring** (the number that turns a project shop into a
durable practice); ARR.

**Phase 4 — Break the founder bottleneck (the scale unlock).** Mature the **VAULT module library** so delivery is
mostly **configuration of existing, statute-mapped modules**, not net-new code. Use **CaseSpace/PuddleJumper** to host
many towns on shared infrastructure. Let **Rothschild's CFIR layer** drive adoption/renewal so the tail compounds.
*Then* the founder-hours-per-town curve bends down and a second practitioner (or a licensed "PublicLogic-inside" model)
becomes possible without diluting the moat.
**Metric:** delivery-hours per new town (must fall); towns-served per principal; renewal rate.

**The throughline:** every phase moves revenue from **one-time and founder-bound** toward **recurring and asset-
leveraged** — while the entry stays cheap (to widen the funnel) and the deliverable stays owned-by-the-client (to keep
sole-source defensible and trust intact).

## 9. The model on one line

**Sell a cheap diagnostic that pays for itself by opening capital → ride a small, allowable, non-contingent fee inside
that capital → convert every build into an own-source stewardship retainer → reuse the module library so the next town
costs less to serve than the last.** The retainers are the business; everything upstream exists to create them.

---

*Subject to the funding source, the approved budget, and the governing cost principles. Procurement framing is for
Town Counsel review. Not legal/accounting advice.*
