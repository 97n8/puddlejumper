# What's Next — PuddleJumper Roadmap

> Post-V1.0.0 priorities, ordered by impact and urgency.

---

## P0 — Ship Blockers (Before Next Production Push)

- [ ] **Fix staging Fly.io deployment** — SQLite `CANTOPEN` errors on volume mount; build succeeds but runtime permissions fail. Production works. ([#20](https://github.com/97n8/puddlejumper/issues/20))
- [ ] **Merge admin-only chain template access** — GET endpoints on chain templates must require admin/owner role; viewers must receive 403. ([PR #34](https://github.com/97n8/puddlejumper/pull/34))
- [ ] **Async PolicyProvider interface** — Convert PolicyProvider methods to async, add VAULT policy gates. ([PR #32](https://github.com/97n8/puddlejumper/pull/32))

## P1 — V1.1 Features

- [ ] **Audit log viewer UI** — Events are logged but there is no UI to browse or search them.
- [ ] **Email delivery for invitations** — Currently copy-link only; integrate SendGrid or Postmark.
- [ ] **Stripe billing integration** — Plan upgrades are manual admin operations today.
- [ ] **Multi-workspace support** — Users are limited to a single workspace.
- [ ] **Slack / Teams notification integrations** — Notify approvers via chat when a decision is pending.
- [ ] **Export approvals to CSV/JSON** — Allow admins to download approval history.

## P2 — Hardening & Quality

- [ ] **API rate limiting (production)** — Sensitive endpoints have in-memory buckets; move to persistent rate-limit store for multi-instance deploys.
- [ ] **Webhook signature verification** — Outbound webhooks are HMAC-signed but inbound verification is not yet enforced.
- [ ] **Consolidate test directories** — Merge legacy `/test/` into package-specific `apps/puddlejumper/test/` (see `TEST_STRUCTURE.md`).
- [ ] **Patch dev-dependency vulnerabilities** — `esbuild` and `path-to-regexp` advisories; dev-only but should be updated.
- [ ] **Workspace ownership transfer** — Allow owners to transfer to another admin.

## P3 — Future Vision

- [ ] **Federated multi-tenant governance** — Cross-municipality approval chains.
- [ ] **Pluggable policy engine** — Swap local policy evaluation for OPA / Cedar.
- [ ] **Real-time collaboration** — WebSocket push for approval queue changes.
- [ ] **Mobile-native UI** — React Native or PWA companion for field operators.

---

## Open Pull Requests (in-flight work)

| PR | Title | Status |
|----|-------|--------|
| [#34](https://github.com/97n8/puddlejumper/pull/34) | Enforce admin-only access on chain template GET endpoints | Open |
| [#33](https://github.com/97n8/puddlejumper/pull/33) | Remove pnpm-lock.yaml churn from role authorization PR | Open |
| [#32](https://github.com/97n8/puddlejumper/pull/32) | Async PolicyProvider interface with VAULT policy gates | Open |

---

_Last updated: 2026-02-16_
