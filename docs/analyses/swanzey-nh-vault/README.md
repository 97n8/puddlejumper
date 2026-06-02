# Swanzey, NH — VAULT Deep Dive

A PublicLogic **VAULT** methodology applied to a real municipality: the Town of Swanzey,
Cheshire County, New Hampshire. Built as a demonstration of fail-closed municipal AI governance
against public data.

## Contents

| File | What it is |
|---|---|
| [`WORKBOOK.md`](./WORKBOOK.md) | The full workbook — 11 tabs + forecast, every figure provenance-tagged |
| [`swanzey-nh.tailored.json`](./swanzey-nh.tailored.json) | Tailored Piece (Piece 10) instance — NH RSA bindings, role map, retention, hard rails |
| [`formkey-registry.csv`](./formkey-registry.csv) | Candidate municipal processes as immutable FormKeys, with verdicts & ceilings |
| [`retention-map.csv`](./retention-map.csv) | RSA 33-A:3-a record categories → VAULT `retentionClass` |
| [`forecast.csv`](./forecast.csv) | 3-scenario budget & municipal-rate projection (2025–2030) |

## Provenance tags

- `[R]` real / sourced  ·  `[D]` derived (arithmetic on real figures)  ·  `[M]` modeled (projection)

## The one-line thesis

VAULT's job in Swanzey is **not** to automate the town. It is to make every municipal action
*prove it was allowed* — under a 5-business-day RSA 91-A clock, an RSA 33-A retention chain that
refuses early deletion, and a hard rail that never auto-moves money. ~70% of transactional
citizen-service load becomes safely governable; 0% of money or legislative authority ever
auto-authorizes.

> Demonstration only. Not a registered Tailored Piece, no legal signoff, authorizes nothing.
