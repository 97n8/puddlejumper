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

- 7 Dependabot PRs on standalone LogicOS at time of merge (PRs #81, #84, #85, #87, #88, #89, #90) were intentionally not merged before the subtree. Equivalent updates will be re-detected by Dependabot against puddlejumper after this PR lands.

---

## Env var reconciliation

Variables LogicOS expected that PJ doesn't define, or names that overlap and conflict. From the Phase 1 env diff. Each entry: name, what it does, which Vercel project it needs to land in.

- `ANTHROPIC_API_KEY` — Claude API key for workspace AI features. Land in Vercel project for apps/workspace as a secret.
- `WORKSPACE_GOOGLE_ROOT_FOLDER_ID` — Google Drive root folder for LogicDocs cloud sync. Note: was `LOGICOS_GOOGLE_ROOT_FOLDER_ID` in standalone LogicOS; the rename script will convert it during Phase 3.
- `PJ_MCP_URL` — URL of PJ's MCP server, called from workspace for AI tool calls. Land in Vercel.
- `VITE_PJ_API_URL` — Frontend's PJ API endpoint. Vite-prefixed for client-side exposure. Land in Vercel.

---

## Deploy / Vercel

Things that need to happen during the cutover that aren't part of this PR. Nate handles Vercel by hand — this section is the handoff list.

- Standalone LogicOS Deploy job is currently failing on commit `531231d` (Vercel config issue — today's `VERCEL_TOKEN` refactor did not fully fix it). Do **not** copy the standalone LogicOS Vercel project configuration when setting up the new `apps/workspace` deploy in Phase 6. Treat as clean setup.

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
