# Canon migration reference set

This directory holds the **canon migration set** prescribed by the Master Build
Spec v1.1, Part 11. These three files describe the canonical SQLite schema for
a **fresh PuddleJumper deployment** (single DB, single overlay).

They are intentionally **not** wired into the production migration runner at
`apps/logic-commons/src/lib/migrations.ts`, which:

- Requires `YYYYMMDD_*` filenames (8-digit date prefix, regex-enforced).
- Targets three production databases (`prr`, `approvals`, `audit`) selected via
  a `-- Database:` header.
- Verifies checksums against an applied-migrations table.

The production migrations live in `/migrations/` and continue to apply against
the live multi-DB layout. The canon reference set here is the source of truth
for what a **brand-new spec-conformant deployment** would look like.

When Phase 1 (`@pj/db`) is built, it will consume the files in this directory
verbatim to bootstrap a fresh deployment DB. Until then, these files are
documentation that the canon shape is locked.

The canon append-only triggers on `audit_events` (Rule 2) are also defined
in `apps/logic-commons/src/lib/audit-store.ts` and run today against the live
audit database. `scripts/ship.sh` verifies both locations.
