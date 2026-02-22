# 🦆 PuddleJumper

**Your Shortcut to the Clouds**

PuddleJumper is a multi-tenant governance engine for municipal decision workflows, part of the [PublicLogic](https://publiclogic.org) ecosystem.

## Repository Structure

### Applications

| Directory | What it is | Status |
|-----------|-----------|--------|
| `n8drive/` | Core PuddleJumper engine — TypeScript/Express backend, Next.js frontend, pnpm monorepo | **Active** |
| `publiclogic-os-ui/` | PublicLogic operations portal — vanilla JS, MSAL auth, M365 integration | **Active** |
| `live-edit-deploy-console/` | M365 tenant deployment console ("Tenebrux Veritas") — React + Node | **Active** |
| `chamber-connect/` | Chamber of Commerce case management — Node.js prototype | **Prototype** |

### Content & Sites

| Directory | What it is | Status |
|-----------|-----------|--------|
| `publiclogic-operating-system/` | Business playbooks (mission, offers, delivery, metrics) — **canonical source** | **Active** |
| `publiclogic-site/` | Netlify deploy target for publiclogic.org (includes HMLP mirror of OS UI) | **Active** |

### Tooling

| Path | What it is |
|------|-----------|
| `scripts/` | Repo utilities: `bootstrap.sh`, `sync-playbooks.sh`, `smoke-test.sh` |
| `tests/` | E2E tests (Playwright) |
| `docs/` | Repo-level docs: developer bootstrap guide, DNS configuration |

## Getting Started

```bash
# Bootstrap everything (Node 20, pnpm, install, build, test)
bash scripts/bootstrap.sh

# Or manually:
cd n8drive
pnpm install
pnpm run dev
```

## Playbook Sync

Three directories hold playbook content and must stay in sync:
- `publiclogic-operating-system/` — canonical source
- `publiclogic-os-ui/content/playbooks/` — UI copy
- `publiclogic-site/HMLP/content/playbooks/` — site copy

```bash
./scripts/sync-playbooks.sh          # sync all copies from canonical source
./scripts/sync-playbooks.sh --check  # check for drift (CI-friendly, exits 1 if out of sync)
```

## Documentation

- [`docs/DEVELOPER.md`](docs/DEVELOPER.md) — Bootstrap, test credentials, known pitfalls
- [`docs/DNS.md`](docs/DNS.md) — DNS routing for publiclogic.org
- [`n8drive/README.md`](n8drive/README.md) — PuddleJumper application docs
- [`n8drive/SECURITY.md`](n8drive/SECURITY.md) — Security policy
- [`n8drive/docs/`](n8drive/docs/) — Architecture and release notes
- [`n8drive/ops/`](n8drive/ops/) — Operational runbooks, disaster recovery, readiness criteria

## License

See LICENSE file.
