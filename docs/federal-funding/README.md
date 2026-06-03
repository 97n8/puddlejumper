# PublicLogic Federal Funding Architecture

A citation-grade, multi-year, administration-resilient view of how PublicLogic's stewardship model gets paid for
across a decade — built **on** (not duplicating) the existing 16-sheet Stewardship Workbook and 8-sheet Cyclical
Services Model. Verification date for time-sensitive findings: **2026-06-03**. Not legal/accounting advice.

## Deliverables

| File | What it is |
|---|---|
| [`federal_funding_architecture.md`](./federal_funding_architecture.md) | The narrative (Parts 1–3): Uniform Guidance walked end-to-end, the program catalog by domain, tax credits as federal funding, the bedrock-vs-volatile thesis, braiding/blending, the multi-year stack, administration-proofing, PublicLogic's own revenue architecture, and the cycle at federal scale with two worked examples. |
| [`federal_mechanism_catalog.csv`](./federal_mechanism_catalog.csv) | 39 mechanisms, each with Assistance Listing #, statute, controlling CFR/IRC, formula/competitive, entitlement/discretionary, pass-through path, eligible uses, match, period of performance, cost-treatment route, 2026 status, confidence tag, source URL, and date verified. |
| [`multiyear_funding_stack.xlsx`](./multiyear_funding_stack.xlsx) | The 5–10 year stack model with two worked examples. **All totals are live formulas**; assumptions live in the `Inputs` sheet; zero formula errors. |
| [`funding_volatility_register.md`](./funding_volatility_register.md) | The volatile (competitive-discretionary) programs: what could kill each, early-warning signals, and the bedrock source that absorbs the loss. |

## Reproducing the generated artifacts

The CSV and XLSX are generated (and re-generatable) from scripts in this folder:

```bash
pip install openpyxl
python3 build_catalog.py   # -> federal_mechanism_catalog.csv
python3 build_stack.py     # -> multiyear_funding_stack.xlsx
# optional formula-error check:
pip install formulas && python3 -c "import formulas; \
  s=formulas.ExcelModel().loads('multiyear_funding_stack.xlsx').finish().calculate(); print('loaded OK')"
```

## Headline currency corrections (vs. prior assumptions, verified 2026-06-03)

- **BRIC is back** — FEMA issued a joint FY2024–2025 NOFO (~$1B) on 3/25/2026 after a permanent injunction; treat as
  reopening-but-fragile, not "court-ordered, FEMA slow to comply."
- **NMTC is now permanent** under OBBBA (was expiring 12/31/2025) — promoted from sunsetting credit to **bedrock**.
- **LIHTC 4% deals got easier** — bond-financing test permanently cut 50%→25%.
- **§45Q strengthened to $85/ton** but newly fenced by **FEOC** limits from 2026.
- **De minimis indirect rate is 15%** (not 10%) and the **Single Audit threshold is $1,000,000** (not $750K), both
  effective for the period beginning on/after 10/1/2024.
- **Digital Equity Act remains DEAD** (terminated 5/9/2025) — not an absorber for anything.
