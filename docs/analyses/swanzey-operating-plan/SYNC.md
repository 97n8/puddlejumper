# How the Operating Plan stays in sync with the workbooks

The Operating Plan (**v0.2+**) is **auto-built** from two source-of-truth workbooks — no hand-editing of
the document's numbers.

## Sources of truth (edit these)
- **Capital Workbook** (`../swanzey-capital-forecast/Swanzey Capital Workbook.xlsx`)
  - `Assumptions` → valuation, median home, existing-capital base, bridge-aid share
  - `Projects` → costs and funding split (aid / SRF / grants)
  - `Reserve Ladder` → annual deposits
  - `10-Year Plan` → per-fund deposit schedule
- **Financial Model** (`../swanzey-financial-review/Models/Swanzey Financial Model.xlsx`)
  - `Forecast` → base budget + growth rates

## Refresh in two commands
```
python3 build_from_workbook.py     # reads workbook inputs, recomputes, regenerates charts 06 & 07
python3 render_opplan.py           # renders Swanzey Operating Plan vX.pdf + .docx from the computed model
```
The plan's **project-financing table, reserve ladder, funding-stack chart, tax-glide chart, dashboard,
and forecast table** all derive from those inputs. Edit a workbook cell → re-run → the plan reflects it.
(Verified: changing the valuation input moves the per-home tax impact in the plan.)

## Note on "live" links
A Word/PDF can't safely auto-pull from Excel in a shareable file, so sync is by **regeneration**, not a
fragile embedded link. The workbooks are canonical; the document is a generated artifact. Bump `VER` in
`render_opplan.py` to version each rebuild.
