# Budget-Modeling Lab — Practice the NH Town Administrator Math

A hands-on companion to the workbook. You will build an operating budget, calculate a **default
budget** (RSA 40:13 IX), and translate appropriations into a **tax rate** — the three calculations a
NH administrator must be able to do in their sleep. Numbers are a **realistic mock calibrated to
Swanzey's published totals** ($8.94M operating budget, $20.18 rate, $5.62 municipal slice). The
*internal line items are invented for practice* — they are not Swanzey's actual department figures.

## Files in this lab

| File | Role |
|---|---|
| [`ms636-operating-budget.csv`](./ms636-operating-budget.csv) | The mock MS-636 line-item budget (32 purposes, 4 columns) |
| [`default-budget-worksheet.csv`](./default-budget-worksheet.csv) | The RSA 40:13 IX default-budget calculation |
| [`tax-rate-model.csv`](./tax-rate-model.csv) | Appropriations → net commitment → tax rate buildup |

## How the MS-636 columns work `[DRA]`

A real MS-636 shows, for each **purpose** (a 4-digit account in the standard NH chart):

1. **Prior-year actual** — what was actually spent last completed year.
2. **Current-year appropriated** — what the meeting voted for the year now underway.
3. **Ensuing-year department request** — what staff asked for.
4. **Ensuing-year selectmen (and budget-committee) recommended** — what goes on the warrant.

Money is appropriated **by purpose** (RSA 32:3), not by line you invent. The board can shift between
purposes within the total later (RSA 32:10), but the *warrant* sets the purposes.

---

## Exercise 1 — Read the increase

Using `ms636-operating-budget.csv`:

1a. What is the **ensuing-year recommended** operating total, and the **current-year** total?
1b. What is the **dollar** and **percent** increase, recommended over current?
1c. How much did the **board cut** from the **department request** to reach the recommendation?

*(Work it before scrolling to the key.)*

---

## Exercise 2 — Find the cost drivers

2a. Compute the **Public Safety** function-group total (accounts 4210–4290) for both current and
recommended. What's its **share** of the recommended operating budget?
2b. Which **three single purposes** grew the most in dollars (recommended − current)? What do they
have in common, and which statute governs each driver?
2c. The board is told "we have to cut $120,000." Name two *defensible* targets and two you would
**refuse** to cut, with the reason for each.

---

## Exercise 3 — Calculate the default budget (RSA 40:13 IX)

Using `default-budget-worksheet.csv` as your guide but **doing the arithmetic yourself**:

3a. Start from the **prior-year (current FY2025) appropriations**. Why do we start there and not from
the ensuing-year proposal?
3b. Subtract the **one-time** items. What's the subtotal?
3c. Add the **contractual/obligated** increases. What's the **default budget total**?
3d. Is the default **higher or lower** than the proposed budget, and by how much? In one sentence,
explain to a voter what happens to town services if the operating-budget article **fails**.
3e. **Scenario flip:** suppose instead the prior year had **$700,000** of contractual increases coming
due (a big new CBA + a debt-service balloon) and only **$120,000** of one-time items. Recompute the
default. Is it now higher or lower than the $8.94M proposal? What's the political lesson?

---

## Exercise 4 — Build the tax rate

Using `tax-rate-model.csv`:

4a. From **gross appropriations**, subtract estimated revenues and applied fund balance. What is the
**net town appropriation to be raised by taxes**?
4b. Add overlay (RSA 76:6) and war-service credits (RSA 72:28). What is the **net municipal property
tax to raise**?
4c. Divide by valuation-in-thousands. What is the **municipal tax rate**? Confirm it matches $5.62.
4d. Add the county, state-education (SWEPT), and local-education rates. What's the **total**, and what
**share is education**?

---

## Exercise 5 — The two levers every board pulls

5a. **The appropriation lever.** The board wants to add a **$250,000** tax-funded highway position +
equipment. By how much does the **municipal rate** rise? What's the impact on a **$300,000** home?
5b. **The fund-balance lever.** Instead, the board applies an **additional $250,000** of unassigned
fund balance to reduce taxes. What happens to this year's rate — and what's the risk you must put in
front of them for *next* year?
5c. If unassigned fund balance is currently **$1,050,000** and the operating budget is **$8,940,000**,
what's the fund-balance **percentage**? Is it inside DRA's ~5–17% guidance? After applying the extra
$250k (total $650k applied), what percentage remains, and what do you advise?

---

## Exercise 6 — Capital: reserve vs. bond

The failed **$1.2M public-works facility** is back. The board asks you to compare two paths:

6a. **Bond** (RSA 33): 15-year, 4.0% level-principal. Roughly what's **year-one debt service**
(principal + interest), and what vote threshold does it need?
6b. **Capital reserve** (RSA 35): deposit **$240,000/year for 5 years**. What's the **annual tax-rate
impact** of that deposit, and what's the tradeoff vs. bonding?
6c. Which do you recommend for *this* town given a failed 3/5 vote, and how do you sequence it through
the **CIP** (RSA 674:5–8)? Write the three-sentence board recommendation.

---
---

# ANSWER KEY

> Round to whole dollars; rates to the cent. Small rounding differences are fine.

## Exercise 1
- **1a.** Recommended = **$8,940,000**; current = **$8,370,000**.
- **1b.** Increase = $8,940,000 − $8,370,000 = **$570,000**, = 570,000 / 8,370,000 = **6.81%** (the
  "+6.8%" headline).
- **1c.** Department request = **$9,140,000**; board cut = 9,140,000 − 8,940,000 = **$200,000**.

## Exercise 2
- **2a.** Public Safety **current** = 1,560 + 491 + 855 + 94 + 30 = **$3,030,000**; **recommended** =
  1,720 + 565 + 900 + 98 + 32 = **$3,315,000**. Share = 3,315,000 / 8,940,000 = **37.1%**. *(Public
  safety is always the biggest function group — know this cold.)*
- **2b.** Largest dollar growth: **Highways & Streets (4312)** +$90,000 (1,470→1,560), **Police (4210)**
  +$160,000 (1,560→1,720), **Ambulance/EMS (4215)** +$74,000 (491→565). Common thread: **wages/
  contracts** — police CBA (RSA 273-A), the EMS **contract** escalation, and highway labor/materials.
  *(These mirror Swanzey officials' stated FY26 drivers: wages, health insurance, insurance, ambulance
  contract.)*
- **2c.** Defensible: trim **Library (4550)** or **Parks & Rec (4520)** discretionary lines; defer
  **Capital Outlay (4902)** equipment a year. Refuse: **Direct Assistance (4445)** — a *statutory
  duty* under RSA 165, not discretionary; **Debt Service (4711/4721)** — a *legal obligation* you
  cannot skip. *(The skill being tested: knowing what's discretionary vs. mandated.)*

## Exercise 3
- **3a.** You start from **last year's appropriations** because the default budget is, by definition
  (RSA 40:13 IX), what the town already authorized — adjusted only for obligations and one-time items.
  Starting from the *proposal* would let the governing body smuggle new spending into the "default."
- **3b.** 8,370,000 − (32,000 + 40,000 + 85,000 + 25,000 + 23,000) = 8,370,000 − **205,000** =
  **$8,165,000**.
- **3c.** + (48,000 + 36,000 + 52,000 + 14,000 + 9,000) = + **159,000** → default = **$8,324,000**.
- **3d.** Default ($8,324,000) is **lower** than proposed ($8,940,000) by **$616,000**. To a voter:
  *"If the budget article fails, the town runs on $8.32M — we keep the lights on and meet our
  contracts, but we lose the $616K of new and expanded services in the proposal."*
- **3e. Scenario flip:** 8,370,000 − 120,000 + 700,000 = **$8,950,000** — now **$10,000 higher** than
  the $8.94M proposal. **Political lesson:** a "no" vote does **not** guarantee lower spending. When
  obligations dominate, the default can *exceed* the proposal, so "vote it down to save money" can
  backfire — and your job is to disclose **both** numbers honestly at the public hearing (RSA 40:13
  II-a) so no one is ambushed.

## Exercise 4
- **4a.** 9,290,000 − 3,600,000 − 400,000 = **$5,290,000**.
- **4b.** 5,290,000 + 90,000 + 120,000 = **$5,500,000**.
- **4c.** 5,500,000 / (978,600,000 / 1,000) = 5,500,000 / 978,600 = **$5.62** per $1,000. ✔
- **4d.** 5.62 + 2.28 + 1.25 + 11.03 = **$20.18**. Education = (1.25 + 11.03) / 20.18 = 12.28 / 20.18 =
  **60.9%**. *(Say it out loud in the interview: "~61% of the bill is school, outside municipal
  control — the municipal lever I manage is only the $5.62.")*

## Exercise 5
- **5a.** Rate rise = 250,000 / 978,600 = **$0.2555 ≈ $0.26** per $1,000. On a $300,000 home: 300 ×
  0.2555 = **+$76.65/year**.
- **5b.** Applying an extra $250,000 of fund balance lowers this year's *net to raise* by $250,000,
  cutting the rate by the same **~$0.26** (−$76.65 on the median home). **The risk:** fund balance is
  one-time money. You've lowered the *base* of revenue for next year, so unless spending falls, next
  year's rate jumps to backfill — a "structural" gap. Put the **multi-year** picture in front of the
  board, not just this year's relief.
- **5c.** 1,050,000 / 8,940,000 = **11.7%** — inside the ~5–17% guidance (healthy). After applying
  $650,000 total: remaining = 1,050,000 − 650,000 = 400,000 → 400,000 / 8,940,000 = **4.5%** — now
  **below** the prudent floor. **Advice:** applying that much erodes the cushion below DRA's comfort
  range, risks cash-flow/TAN reliance and bond-rating questions; recommend a smaller application
  (e.g., keep ≥ 8–10%) and smooth the rest over multiple years.

## Exercise 6
- **6a. Bond:** level-principal $1.2M / 15 = **$80,000/yr principal**; year-one interest = 4.0% ×
  1,200,000 = **$48,000**; **year-one debt service ≈ $128,000** (declines each year as principal
  amortizes). Threshold: **3/5 supermajority** (RSA 33). Rate impact year one ≈ 128,000 / 978,600 =
  **$0.13** per $1,000 (~+$39 on a $300k home), falling over time.
- **6b. Capital reserve:** $240,000/yr deposit → annual rate impact = 240,000 / 978,600 = **$0.245 ≈
  $0.25** per $1,000 (~+$74/yr on a $300k home) for five years. Tradeoff: **pay-as-you-go avoids
  interest** (~$0.3–0.4M saved over a bond's life) and needs only a **majority** vote each year, **but**
  delays the facility ~5 years and exposes the plan to annual re-voting risk.
- **6c. Recommendation (model):** *"Given the failed 3/5 bond, I recommend we seat this in the CIP and
  build a capital reserve at ~$240K/year, pairing it with a smaller bond in year 3 once ~$700K is
  banked — cutting the borrow to roughly $500K and the 3/5 hurdle with it. We hold public information
  sessions before the deliberative session and bring voters a smaller, well-understood number."*
  *(This is the exact "win on preparation, not persuasion" move from WORKBOOK Module 3.5.)*

---

## Use it as a drill

1. Blank the four numeric columns of `ms636-operating-budget.csv` and rebuild a budget to a target
   increase (say +4.5%). Which purposes do you hold flat, and why?
2. Re-run the default budget with **your own** one-time and contractual assumptions.
3. Change valuation by ±5% (a revaluation year) and watch the rate move even with flat appropriations
   — then practice explaining *that* to an angry taxpayer.

**The reflex you're building:** appropriations → revenues & fund balance → overlay & credits → divide
by valuation → rate. If you can run that buildup on a whiteboard from memory, you can sit at the DRA
table and the budget-hearing podium with confidence.
