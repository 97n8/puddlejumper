# Grant-Writing Hours — an org working with PublicLogic (the route, shown)

Companion to the `GrantWriting_Hours` sheet in `multiyear_funding_stack.xlsx`, which itemizes every task as
**Hours × Rate = Line cost** (live formulas). This note explains the one thing that makes the route compliant rather
than just plausible. Verification date: **2026-06-03**. Not legal/accounting advice.

## The rule that governs grant-writing hours: 2 CFR §200.460

Grant-writing — *preparing the bid, proposal, or application* — is a **proposal cost** under **2 CFR §200.460**.
Proposal costs (of **both successful and unsuccessful** applications) are normally treated as **indirect (F&A)
costs** and **cannot be charged directly to the federal award being sought.**
([2 CFR §200.460, eCFR](https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200/subpart-E/subject-group-ECFRed1f39f9b3d4e72/section-200.460), verified 2026-06-03.)

So when an org buys grant-writing hours from PublicLogic, those hours ride on the **org's own-source / unrestricted
funds or its F&A pool** — never on the prospective grant. Two more guardrails:

- **§200.459(b) — non-contingent.** PublicLogic's writing fee is **fixed and owed regardless of award**. A
  "percentage-of-award" contingent fee is a factor *against* allowability; the fixed, non-contingent structure is
  what keeps the hours an allowable professional service.
- **§200.458 — pre-award costs.** Allowable only with **prior written approval** and only if necessary for the award
  (a ~90-day pre-award window is typical). This is a narrow door, not the main route.

## The route flip: writing vs. administration

| Activity | What it is | Where it rides |
|---|---|---|
| **Grant *writing*** (need statement, narrative, budget build, forms, submission) | Proposal cost, §200.460 | **Org own-source / F&A — non-contingent.** *Not* the sought award. |
| **Grant *administration*** (award setup, drawdown, subrecipient monitoring, reporting) | Allowable admin on the *won* award | **The won federal award's admin line** (§200.413; e.g., CDBG's planning+admin) |

The `GrantWriting_Hours` sheet shows this split explicitly: a **62-hour writing block** (own-source / F&A,
non-contingent) and an **18-hour post-award block** (allowable on the won award) — 80 hours total, with a
fixed-fee reconciliation against the time-and-materials value.

## How it connects to the rest of the architecture

- The writing block is the paid version of the **Discover/Understand** entry move — it produces the diagnosis *and*
  the narrative that opens the capital (the flywheel).
- When the org then **procures PublicLogic's implementation services with the won federal money**, that procurement
  runs through the sole-source pathway in **`sole_source_federal_overlay.md`** (MGL c.30B §7 + 2 CFR §200.320(c)(2)),
  with the §200.319(b) conflict mitigation for the fact that PublicLogic also wrote the application.
- The recurring **stewardship retainer** lands on **own-source** (the sustainability handoff).

*Hours and rates in the sheet are illustrative planning assumptions, not quotes. Subject to the funding source, the
approved budget, and the governing cost principles. Not legal/accounting advice.*
