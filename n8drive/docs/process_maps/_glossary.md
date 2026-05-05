# PublicLogic process map system — glossary

**Version:** v2 · **Date:** 2026-05-05 · **Owner:** PublicLogic LLC · **Status:** canonical

## Purpose

Source of truth for what talks to what, where state lives, where authority sits. Used for product, ops, onboarding, and external explanation. One canonical runtime map (L2) plus task-optimized cuts (L1, L3, L4×N). Maps are SVG only, source-controlled, and follow the encoding rules below.

## Layer taxonomy

The system is divided into seven rows. Every component in any map belongs to exactly one row.

| # | Row | Color | Contains |
|---|---|---|---|
| 1 | Access | Gray | Users, operators, external systems |
| 2 | Experience | Coral | LogicOS (UI surface) |
| 3 | Control plane | Teal | PuddleJumper API, Org Manager |
| 4 | Execution · transit | Teal | Auth · session, Routes, Connectors |
| 5 | Execution · work | Teal | Governance engine, Feature modules |
| 6 | State | Purple | Operational stores |
| 7 | Evidence | Purple | audit_events, ARCHIEVE, SEAL |

Control plane and Execution share teal; State and Evidence share purple. Row position in the stack disambiguates. (v2: Execution is split into transit vs. work to keep request-routing surfaces visually distinct from work-doing surfaces.)

## Color tokens

Hex stops match Anthropic Sans design system. Both light and dark are mandatory in every SVG via `@media (prefers-color-scheme: dark)`.

| Ramp | Light fill | Light stroke | Dark fill | Dark stroke |
|---|---|---|---|---|
| Gray | `#F1EFE8` | `#5F5E5A` | `#2C2C2A` | `#B4B2A9` |
| Coral | `#FAECE7` | `#993C1D` | `#712B13` | `#F0997B` |
| Teal | `#E1F5EE` | `#0F6E56` | `#085041` | `#5DCAA5` |
| Purple | `#EEEDFE` | `#534AB7` | `#3C3489` | `#AFA9EC` |

## Arrow encoding

| Class | Stroke | Width | Dash | Meaning |
|---|---|---|---|---|
| `arr-w` | dark | 2 | solid | Default write / state mutation |
| `arr-r` | mid | 1 | solid | Default read |
| `arr-cw` | dark | 2 | dashed | Conditional / wired-by-feature write |
| `arr-cr` | mid | 1 | dashed | Conditional / wired-by-feature read |

All arrows use the shared `#arrow` marker, oriented to line direction.

## Sideband markers

Pill badges placed adjacent to a box. 11px medium text, neutral fill, 0.5px stroke.

| Tag | Meaning | Do **not** apply to |
|---|---|---|
| `auth` | Authenticated session required | — |
| `admin` | Administrative role required | — |
| `ext` | External dependency (out-of-PJ) | — |
| `append` | Append-only — no update / no delete | Tables that allow updates |
| `sealed` | Held under retention rule (ARCHIEVE / SEAL) | Encrypted-at-rest values, tokens, caches |
| `async` | Async / background execution | Synchronous request handlers |

No new tags without a glossary update. **`sealed` is reserved for retention-held evidence — do not use it as a stand-in for "encrypted" or "secret."**

## Naming glossary (stable labels)

**Access** — `User access`, `Operator`, `External systems`

**Experience** — `LogicOS`

**Control plane** — `PuddleJumper API`, `Org Manager`

**Execution · transit** — `Auth · session`, `Routes`, `Connectors`

**Execution · work** — `Governance engine`, `Feature modules`

**State** — `Operational stores`

**Evidence** — `audit_events`, `ARCHIEVE`, `SEAL`

Feature module names: `AED`, `Civic`, `PRR` (and additions per build).

## Workflow vocabularies

**PRR lifecycle (statutory, MGL c.66):**
`received → logged → assigned → searching → reviewing → responded → closed`

**VAULT lifecycle:**
`Verification → Authority → Utility → Legitimacy → Transfer`

**Build / deploy:**
`local → git → CI → Vercel (LogicOS) | Fly.io (PuddleJumper API)`

**OAuth / connector path:**
`client → consent → token → connector → provider API`

**Failure / incident:**
`failure event → PJ API exception → audit_events + LogicOS error → operator alert (conditional) → governance review (conditional)`

## File index

- `_glossary.md` — this document
- `INDEX.md` — entry point and reading order
- `L1_executive_system_map.svg` — seven-row overview
- `L2_runtime_request_path.svg` — canonical runtime map
- `L3_data_state_map.svg` — what writes to where
- `L4_prr_lifecycle.svg` — PRR statutory state machine
- `L4_build_deploy_pipeline.svg` — local → deploy
- `L4_vault_lifecycle.svg` — V·A·U·L·T sequence
- `L4_connector_oauth_path.svg` — OAuth handshake
- `L4_failure_incident_path.svg` — failure propagation, audit, alerting

## Editing rules

1. Stable labels only — change the glossary first, then maps.
2. Two ramps + gray + coral max per map.
3. Every box belongs to exactly one row.
4. Every arrow uses one of the four encodings — no novel arrow styles.
5. Sideband markers are exactly the six in the table — no new tags without glossary update.
6. **No semantic bleed.** A box must not mix runtime, deployment, and evidence semantics. If you need to describe a deployment artifact in a runtime map, name only its runtime role.
7. **No overclaims.** Do not say "every write" or "always sealed" if the system has exceptions. Use conditional arrows or add a caveat subtitle.
8. SVG only. No PNG / JPG. No external CSS.
9. `viewBox="0 0 680 H"` — width fixed, height per content.
10. Light + dark mode both required.
11. Every SVG carries a `v… · YYYY-MM-DD` banner top-right and a legend block bottom-right.

## Versioning

- Bump glossary `vN → vN+1` on any structural change.
- Note version in SVG `<title>`, in the top-right banner, and at the top of this glossary.
- Major architectural shifts: new file with date suffix, old version moved to `archive/`.

## v2 changelog

- Split Execution row into transit and work in L1.
- Removed `sealed` from L4 OAuth token store (overclaim — tokens are encrypted at rest, not retention-held).
- Added caveat subtitles to L2 ("Canonical write path shown; some requests terminate earlier") and L3 ("Material writes audit by trigger; transient/cache writes do not").
- Added version/date banner top-right and a tiny legend block bottom-right to every SVG.
- New L4 file: `L4_failure_incident_path.svg`.
- New `sealed` discipline note above; new editing rules 6 (no semantic bleed) and 7 (no overclaims).
