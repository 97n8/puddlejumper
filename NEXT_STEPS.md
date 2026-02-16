# PuddleJumper — Next Steps Roadmap

> Generated 2026-02-16 from a full repo review. Use this as a living checklist.

---

## Current State Summary

| Area | Status |
|------|--------|
| Core governance engine | ✅ V1 shipped — approval workflows, chain templates, dispatch |
| Multi-tenant workspaces | ✅ Role-based access, invitations, auto-accept on OAuth |
| Tier management | ✅ Free / Pro tiers with enforcement |
| OAuth (GitHub/Google/Microsoft) | ✅ Working with session refresh |
| CI (GitHub Actions) | ✅ Build + unit tests + Docker smoke test on push/PR |
| Production deployment | ✅ Fly.io (persistent volume for SQLite) |
| Test count | 507 (73 logic-commons + 434 puddlejumper) |
| Open issues | #18, #19, #20, #21 |

---

## 1 — Open-Issue Fixes (tracked in GitHub Issues)

### Issue #19 — Contract check failing on main
- `pnpm run check:pj-contract` fails because `server.ts` does not expose literal `app.get("/api/pj/actions"` or `app.post("/api/pj/execute"` patterns the checker regex expects.
- Routes are mounted via `createGovernanceRoutes` and the checker does not follow that indirection.
- **Next step:** Either update `check-pj-contract.mjs` to search the governance route file, or add explicit route aliases in `server.ts` so the pattern matches.

### Issue #20 — Staging Fly.io deployment (SQLite volume permissions)
- Production Fly.io works. Staging (`fly.staging.toml`) uses port 8080 but the Dockerfile exposes 3002. The entrypoint may not create the data directory with the correct permissions.
- **Next step:** Align `fly.staging.toml` internal_port to 3002, or update the Dockerfile/entrypoint to honour PORT; ensure `entrypoint.sh` creates `/app/data` with appropriate ownership before starting the app.

### Issue #18 — PRR routes should accept injected db for testability
- PRR routes open their own SQLite connections via `dataDir`. Tests cannot inject in-memory databases.
- **Next step:** Refactor `publicPrr.ts`, `prrAdmin.ts`, and `prrStore.ts` to accept a database instance (or factory) as a parameter so tests can inject `:memory:` databases.

### Issue #21 — Repo hygiene cleanup
See **Section 2** below for specifics.

---

## 2 — Repository Hygiene

| Task | Detail |
|------|--------|
| Remove `.DS_Store` | `publiclogic-site/.DS_Store` is tracked in git |
| Remove stale `n8drive/.github/workflows/` | 5 workflow files that GitHub never runs (Actions only reads `.github/workflows/` at repo root) |
| Remove stale `n8drive/.github/pull_request_template.md` | Same — PR templates must live in repo-root `.github/` |
| Standardise on pnpm | `package-lock.json` files exist in `n8drive/`, `n8drive/web/`, `chamber-connect/`, `live-edit-deploy-console/` (and sub-dirs). Remove them and add `package-lock.json` to `.gitignore` |
| Consolidate test directories | `n8drive/test/` (root-level integration tests) and `n8drive/tests/` (Playwright E2E) coexist — document or merge |
| Remove zero-byte / placeholder files | `live-edit-deploy-console/data/context-audit.jsonl`, `live-edit-deploy-console/content/prompt.txt`, etc. — replace with `.gitkeep` or remove |
| Clean up `publiclogic-os-ui/` | Has no `package.json`; appears to be a static prototype with `config.js` (may contain secrets) — review and either move to a docs folder or remove |

---

## 3 — CI / CD Improvements

- [ ] **Move active workflows to repo-root only.** Delete `n8drive/.github/workflows/*` (they are duplicates of the already-active `.github/workflows/*` files at the repo root).
- [ ] **Fix contract check in CI.** Currently uses `continue-on-error: true`. Once #19 is fixed, remove the `continue-on-error` so CI catches regressions.
- [ ] **Add logic-commons unit tests to CI.** The CI only runs `core` and `puddlejumper` tests; the 73 logic-commons tests are not in the pipeline.
- [ ] **Pin GitHub Actions versions.** `docker/build-push-action@v4` and `superfly/flyctl-actions/setup-flyctl@master` should be pinned to specific SHA or tag for supply-chain safety.
- [ ] **Add Playwright E2E step to CI.** The `tests/` directory has E2E specs but CI does not run them.
- [ ] **Cache Docker layers.** CI builds Docker from scratch each run; use `docker/build-push-action` layer caching.

---

## 4 — Testing Gaps

| Area | Gap |
|------|-----|
| PRR API routes | Tests skipped (`prr.api.test.skip.txt`). Blocked by #18. |
| Playwright E2E | Specs exist (`tests/e2e-smoke.spec.ts`, `tests/login.spec.ts`) but are not run in CI |
| Web frontend (`web/`) | Next.js app has no tests |
| Subprojects (`chamber-connect`, `live-edit-deploy-console`) | No test infrastructure |
| OAuth end-to-end | Only state-store and factory unit tests; no integration tests for full callback flow |

---

## 5 — Security & Hardening

- [ ] **Audit `publiclogic-os-ui/config.js`** — file is tracked in git. Contains MSAL `clientId`/`tenantId` (public config, not secrets) and `allowedEmails` with team email addresses. Decide whether email addresses should be in the repo.
- [ ] **Review `render.yaml` placeholder webhook URL** — `https://placeholder-webhook.invalid` is deployed to Render. Ensure it does not cause runtime errors.
- [ ] **Pin pnpm version in `package.json`** — add `"packageManager": "pnpm@8.15.8"` to root `package.json` for Corepack.
- [ ] **Rotate `JWT_SECRET`** if `.env.production` was ever committed (per issue #21 note).
- [ ] **Review dev dependency vulnerabilities** — V1 release notes mention moderate vulns in esbuild and path-to-regexp (dev-only). Track updates.
- [ ] **Add `Strict-Transport-Security` header** to the Express server (currently only documented for the Next.js frontend).

---

## 6 — Architecture / Code Quality

- [ ] **Consolidate the `n8drive/` wrapper.** The entire pnpm monorepo lives inside `n8drive/`. Consider flattening: move `apps/`, `packages/`, `pnpm-workspace.yaml`, etc. to repo root. This would simplify CI, Dockerfile, and developer onboarding.
- [ ] **Clean up ENV_REFERENCE.md.** File paths reference local machine paths (`/Users/n8/Documents/...`). Replace with repo-relative paths.
- [ ] **Extract `server.ts` further.** At 550 lines, the app factory still does a lot. The auth-gating section (lines 396-414) could move into a dedicated middleware.
- [ ] **TypeScript strict mode.** `tsconfig.base.json` has `strict: true` but workspace packages may override. Audit for consistency.

---

## 7 — Documentation

- [ ] **Update `LAUNCH_CHECKLIST.md`** — references local machine paths (`/Users/n8/...`). Replace with relative paths or env-var-based paths.
- [ ] **Update `ENV_REFERENCE.md`** — same local-path issue.
- [ ] **Add CONTRIBUTING.md** — the README says "submit a pull request" but there is no contributor guide (lint commands, branch naming, commit conventions).
- [ ] **Document subproject status** — `chamber-connect`, `live-edit-deploy-console`, `publiclogic-operating-system`, `publiclogic-os-ui`, `publiclogic-site` are not mentioned in any development docs. Clarify which are active vs. archived.

---

## 8 — Feature Roadmap (from V1 release notes)

These items are already listed in `n8drive/docs/v1-release.md` under "Planned for V1.1+":

- [ ] Stripe billing integration
- [ ] Email delivery via SendGrid / Postmark
- [ ] Multi-workspace support
- [ ] Workspace ownership transfer
- [ ] Audit log viewer UI
- [ ] Slack / Teams notification integrations
- [ ] Export approvals to CSV / JSON
- [ ] API rate limiting (per-tenant quotas beyond current per-route limits)
- [ ] Webhook signature verification

---

## Suggested Priority Order

| Priority | Items |
|----------|-------|
| **P0 — Now** | Fix contract check (#19), repo hygiene (#21), remove stale `n8drive/.github/`, clean `.DS_Store` |
| **P1 — Next sprint** | PRR testability refactor (#18), add logic-commons tests to CI, fix staging deploy (#20) |
| **P2 — Near-term** | Playwright in CI, pin Actions versions, CONTRIBUTING.md, clean ENV_REFERENCE paths |
| **P3 — Backlog** | Monorepo flatten, Stripe billing, email delivery, audit log UI |
