# 00_CONTROL — How This Folder Works

This is the command center for the Michigan LTC corridor record.

## What lives here
- **Michigan_LTC_VAULT_Workbook.xlsx** — the control surface (16 tabs + Dashboard). The map of the whole project.
- *Living control docs (add as produced):* Corridor Brief (current), Open Items Register, Decision Log Export,
  Source Register Export.

## How to use the VAULT Workbook
| Tab | Use it to answer |
|---|---|
| 00 Dashboard | Where are we? (corridor, sites, leads, phase, headline economics, risk, next deliverables) |
| 01 Source Register | What original file backs this? (every claim → a Source ID) |
| 02 Entity + Role Map | Who is who, and who can bind what |
| 03 Site Register | Lincoln/Coleman/Flint (+ inactive Coldwater) |
| 04 Grant Register | What grant, what ask, which site, who owns it, what's next |
| 05 Financial Assumptions | Confirmed vs contingent vs stress vs open — keyed to Canonical v2.0 |
| 06 Staffing + Operations | The 5-FTE-vs-62-FTE swing; the real operating model |
| 07 Regulatory Register | EGLE + permit path by site/material; RFS/45Z gate |
| 08 Decision Log | What we decided and why |
| 09 Open Questions | What's genuinely unresolved (be brutally honest) |
| 10 Claims + Evidence | What can be said publicly (banned claims listed) |
| 11 Deliverables Register | Every output and its status |
| 12 Public Language | Approved phrases vs avoid |
| 13 Risk Register | What could go wrong + mitigation |
| 14 Contact Register | Who to reach |
| 15 Change Log | What changed in the record (vs decisions) |
| 16 Reuse Library | Assets reusable for the next site / next state |

## The operating loop
1. A file arrives → save the original in `01_SOURCE_FILES`, give it a **Source ID** in tab 01.
2. Any number/claim/role it carries → land it in the right tab (Financial Assumptions, Site, Grant, Claims…).
3. A decision is made → tab 08. A record changes → tab 15. Something's unresolved → tab 09.
4. An output is produced → tab 11, file it in `09_DELIVERABLES`, export a clean copy to `99_EXPORTS`.

## Current state (2026-06-05)
- **Basis of record:** Canonical Financial Model v2.0 (executed WasteWerx Model 3 Pro Forma).
- **Headline economics:** signed Pro Forma EBITDA $30,200,531 (5-FTE basis); operator-reality ~$22,047,043;
  base-fuel-only floor ~$1,618,483. $20,428,560 of revenue is RFS/45Z-contingent. Carbon black $0 in base (Flag 1).
- **Top open items:** actual staffing (Q-001), carbon-black grade/price (Q-003), RFS/45Z timeline (Q-004),
  feedstock pricing (Q-005), investor-return structure + securities counsel (Q-007), entity/LARA (Q-008).

*Update the workbook before any external circulation. Not financial/legal/securities advice.*
