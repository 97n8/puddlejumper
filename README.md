# 🦆 PuddleJumper

**Your Shortcut to the Clouds**

PuddleJumper is a multi-tenant governance engine for municipal decision workflows, part of the [PublicLogic](https://publiclogic.org) ecosystem.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | `nvm install 20` or [nodejs.org](https://nodejs.org) |
| pnpm | 8.15+ | `corepack enable` (ships with Node) |
| npm | (any) | Comes with Node — used only for `n8drive/web/` |
| Make | (any) | Pre-installed on macOS/Linux; `choco install make` on Windows |

## Quick Start

```bash
make setup     # install deps, build everything, run tests (first time)
make dev       # start the backend on http://localhost:3002
make dev-web   # start the Next.js frontend (separate terminal)
```

Run `make help` to see every available command:

```
  setup            First-time setup (install deps, build, run tests)
  install          Install dependencies (pnpm)
  dev              Start PuddleJumper backend (port 3002)
  dev-web          Start Next.js frontend dev server
  build            Build all packages
  test             Run all tests
  typecheck        TypeScript type-check across all packages
  ci               Full CI pipeline (typecheck + contract check + tests)
  lint             Lint the Next.js frontend
  clean            Remove build artifacts and node_modules
  smoke            Run local smoke test
  ...              (and more — run `make help` for the full list)
```

## Repository Structure

```
puddlejumper/
├── n8drive/                         # Core application (pnpm monorepo)
│   ├── apps/
│   │   ├── puddlejumper/            #   Express/TypeScript backend
│   │   └── logic-commons/           #   OAuth & shared business logic
│   ├── packages/
│   │   ├── core/                    #   Auth, JWT, middleware utilities
│   │   └── vault/                   #   Policy/audit deployment service
│   ├── web/                         #   Next.js frontend (uses npm)
│   ├── docs/                        #   Architecture & deployment guides
│   └── ops/                         #   Monitoring, runbooks, DR
│
├── publiclogic-operating-system/    # Playbooks — canonical source
├── publiclogic-os-ui/               # PublicLogic OS frontend (vanilla JS)
├── publiclogic-site/                # Marketing / public site
│
├── scripts/                         # bootstrap.sh, sync-playbooks.sh
├── tests/                           # E2E tests (Playwright)
├── docs/                            # DEVELOPER.md, DNS.md
├── _archived/                       # Retired projects (reference only)
├── Makefile                         # ← start here
└── smoke-test.sh                    # Quick local health check
```

## Playbook Sync

Three directories hold playbook content and must stay in sync:
- `publiclogic-operating-system/` — canonical source
- `publiclogic-os-ui/content/playbooks/` — UI copy
- `publiclogic-site/HMLP/content/playbooks/` — site copy

```bash
make sync         # sync all copies from canonical source
make sync-check   # check for drift (CI-friendly, exits 1 if out of sync)
```

## Documentation

| Document | Location |
|----------|----------|
| Developer bootstrap guide | [`docs/DEVELOPER.md`](docs/DEVELOPER.md) |
| PuddleJumper deep-dive | [`n8drive/README.md`](n8drive/README.md) |
| Environment variables | [`n8drive/ENV_REFERENCE.md`](n8drive/ENV_REFERENCE.md) |
| Security policy | [`n8drive/SECURITY.md`](n8drive/SECURITY.md) |
| Architecture roadmap | [`n8drive/ops/ARCHITECTURE-NORTH-STAR.md`](n8drive/ops/ARCHITECTURE-NORTH-STAR.md) |
| Disaster recovery | [`n8drive/ops/DISASTER-RECOVERY.md`](n8drive/ops/DISASTER-RECOVERY.md) |

## License

See [LICENSE](LICENSE) file.
