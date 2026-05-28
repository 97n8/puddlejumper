# Merge Followups

Things intentionally **not** done in the LogicOS → `apps/workspace` merge PR. Each item should be filed here during the merge so it doesn't get lost, then opened as its own issue or PR after the merge lands.

The merge PR is meant to be boring and big: move the code, rename the brand, wire the turborepo. Everything else waits.

---

## Type drift

Shared types between PJ API and the workspace that are duplicated, divergent, or should live in `packages/core` or a new `packages/types`. Note both locations and the diff.

- _(filled during merge)_

---

## Shared dependencies

Workspace and PJ both depend on the same library at different versions, or both define the same dep at the app level when it should live at the root. List the dep, both versions, and which package wins.

- _(filled during merge)_

---

## CI workflow tuning

Anything in `.github/workflows/` that should be added, consolidated, or removed once the workspace is in the monorepo. Includes parallel jobs, cache reuse, matrix builds, Vercel preview triggers.

- _(filled during merge)_

---

## Env var reconciliation

Variables LogicOS expected that PJ doesn't define, or names that overlap and conflict. From the Phase 1 env diff. Each entry: name, what it does, which Vercel project it needs to land in.

- _(filled during merge)_

---

## Deploy / Vercel

Things that need to happen during the cutover that aren't part of this PR. Nate handles Vercel by hand — this section is the handoff list.

- _(filled during merge)_

---

## Docs to update post-merge

`docs/claude-memory.md`, PJ canon, ARCHITECTURE.md at repo root, the PJ-runtime-tour doc, the publiclogic.org landing page copy — anything that still says LogicOS where it should say Workspace.

- _(filled during merge)_

---

## Code smells noticed during the move

Things that look wrong but weren't fixed because they were out of scope. File path + one-line description. Don't fix them here.

- _(filled during merge)_

---

## Test gaps

Areas of the workspace that don't have test coverage and should before the next release. Don't add tests in the merge PR — note them here.

- _(filled during merge)_
