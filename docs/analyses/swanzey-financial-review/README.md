# Swanzey Financial & Governance Review (2011–2026)

A full deliverable package in **business-office formats** — narrative as DOCX, calculations as XLSX,
presentation as PPTX, published records as PDF, images as PNG — following the format standard:
*source of truth in the format the audience can open.*

## Structure

```
Swanzey Financial & Governance Review/
├── 00 Case Brief.docx            ← matter, question, method, disposition
├── 01 Executive Summary.docx     ← the verdict + headline figures
├── 02 Findings.docx              ← 10 findings with embedded charts (the diagnosis)
├── 03 Recommendations.docx       ← 7 sequenced recommendations
├── 04 Capital Plan.docx          ← the fix: fund every project without a failed bond
├── Models/
│   └── Swanzey Financial Model.xlsx   ← 8 tabs, live formulas (Budget, Forecast,
│                                         Ballot Record, Elections, Pains, Tax Rates,
│                                         Capital Projects, Capital 10-Year Plan)
├── Visuals/
│   ├── 01_budget-trajectory.png       ← 15-yr budget + forecast
│   ├── 02_budget-support-erosion.png  ← 81% → 57% (13 of 15 yrs of tallies)
│   ├── 03_reserves-vs-bonds.png       ← the 3/5 wall
│   ├── 04_default-gap-collapse.png    ← the dead lever
│   ├── 05_tax-rate-components.png     ← the 2024 revaluation
│   ├── 06_capital-funding-stack.png   ← 62% other people's money
│   └── 07_capital-tax-glide.png       ← peak +$75, then below today
├── Deliverables/
│   ├── Board Presentation.pptx        ← 14-slide deck: findings + the fix
│   ├── Final Report.pdf  (+ .docx source)        ← diagnosis: summary + findings + recs
│   ├── Capital Plan.pdf  (+ 04 .docx source)     ← the fix report
│   ├── Capital Warrant Articles.pdf              ← DRA-compliant model articles
│   └── Public Handout.pdf (+ .docx source)       ← one-page plain-language summary
└── Archive/
    └── Sources & Provenance.docx      ← every source + provenance legend + caveats
```

Two reports, one folder: **Final Report** (the diagnosis) and **Capital Plan** (the fix).

## Format rule applied

| Artifact | Format |
|---|---|
| Case Brief, Summary, Findings, Recommendations | **DOCX** |
| Financial model & forecast | **XLSX** (live formulas) |
| Board presentation | **PPTX** |
| Final report, public handout | **PDF** |
| Charts | **PNG** |

## What's underneath (data spine)

Built from **15 of the Town's own annual reports (2011–2025)**, parsed for official-ballot results and
budget figures, plus NH DRA tax rates and 2026 local news. Provenance is tagged throughout:
`[R-AR]` annual report · `[R-news]` news · `[D]` derived · `[M]` modeled.

> The `.md`/`.csv` working files for this analysis live in `../swanzey-voting-vault/` (the authoring
> layer); **this** folder is the business-ready output.
