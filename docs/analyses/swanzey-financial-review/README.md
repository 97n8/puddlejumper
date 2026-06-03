# Swanzey Financial & Governance Review (2011–2026)

A full deliverable package in **business-office formats** — narrative as DOCX, calculations as XLSX,
presentation as PPTX, published records as PDF, images as PNG — following the format standard:
*source of truth in the format the audience can open.*

## Structure

```
Swanzey Financial & Governance Review/
├── 00 Case Brief.docx            ← matter, question, method, disposition
├── 01 Executive Summary.docx     ← the verdict + headline figures
├── 02 Findings.docx              ← 10 findings with embedded charts
├── 03 Recommendations.docx       ← 7 sequenced recommendations
├── Models/
│   └── Swanzey Financial Model.xlsx   ← 6 tabs, live formulas (Budget, Forecast,
│                                         Ballot Record, Elections, Pains, Tax Rates)
├── Visuals/
│   ├── 01_budget-trajectory.png       ← 15-yr budget + forecast
│   ├── 02_budget-support-erosion.png  ← 81% → 57%
│   ├── 03_reserves-vs-bonds.png       ← the 3/5 wall
│   ├── 04_default-gap-collapse.png    ← the dead lever
│   └── 05_tax-rate-components.png     ← the 2024 revaluation
├── Deliverables/
│   ├── Board Presentation.pptx        ← 11-slide select-board deck
│   ├── Final Report.pdf  (+ .docx source)   ← cover + summary + findings + recs
│   └── Public Handout.pdf (+ .docx source)  ← one-page plain-language summary
└── Archive/
    └── Sources & Provenance.docx      ← every source + provenance legend + caveats
```

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
