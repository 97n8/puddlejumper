# Process maps — index

**Version:** v2 · **Date:** 2026-05-05

Source-controlled, SVG only. Read with `_glossary.md` open.

## Canonical (start here)

- **L2 — Runtime request path** (`L2_runtime_request_path.svg`)
  Source of truth. What talks to what. Every other map is consistent with this.

## Operator views

- **L1 — Executive system map** (`L1_executive_system_map.svg`)
  Seven-row overview. 10-second skim. Use for onboarding, investor brief, external explanation.
- **L3 — Data / state map** (`L3_data_state_map.svg`)
  Where writes happen, what triggers audit, what feeds ARCHIEVE / SEAL.

## Workflow cuts

- **L4 — PRR lifecycle** (`L4_prr_lifecycle.svg`) — statutory state machine, MGL c.66.
- **L4 — Build / deploy pipeline** (`L4_build_deploy_pipeline.svg`) — local → Vercel / Fly.io.
- **L4 — VAULT lifecycle** (`L4_vault_lifecycle.svg`) — V·A·U·L·T per VAULT framework.
- **L4 — Connector / OAuth path** (`L4_connector_oauth_path.svg`) — OAuth handshake + token use.
- **L4 — Failure / incident path** (`L4_failure_incident_path.svg`) — exception → audit, error, alert, review.

## Reading order by audience

- **New engineer** → L1 → L2 → L3 → L4 (their feature) → L4 failure path
- **Investor / external** → L1 → one L4 cut as concrete example
- **Ops / on-call** → L2 → L4 failure path → L3 → L4 OAuth
- **Compliance / records** → L3 → L4 PRR

## Conventions

- All encoding (color, arrows, badges, names) defined in `_glossary.md`.
- Every arrow is one of: `arr-w`, `arr-r`, `arr-cw`, `arr-cr`.
- Sideband markers limited to: `auth`, `admin`, `ext`, `append`, `sealed`, `async`.
- `sealed` means retention-held — never use as shorthand for "encrypted."
- Every SVG carries a `v… · YYYY-MM-DD` banner top-right and a legend bottom-right.

## v2 changelog

See `_glossary.md` v2 changelog section.
