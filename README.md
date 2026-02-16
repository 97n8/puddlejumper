# 🦆 PuddleJumper

**Your Shortcut to the Clouds**

PuddleJumper is a multi-tenant governance engine for municipal decision workflows, part of the [PublicLogic](https://publiclogic.org) ecosystem.

## Repository Structure

| Directory | Description |
|-----------|-------------|
| `n8drive/` | Core PuddleJumper application (TypeScript, Express, pnpm monorepo) |
| `chamber-connect/` | Chamber of Commerce case management prototype |
| `live-edit-deploy-console/` | Municipal M365 tenant deployment engine |
| `publiclogic-operating-system/` | PublicLogic OS playbooks (canonical source) |
| `publiclogic-os-ui/` | PublicLogic OS frontend (static vanilla JS app) |
| `publiclogic-site/` | Marketing/public site (includes HMLP, a mirror of OS UI) |
| `scripts/` | Sync utilities and helper scripts |
| `tests/` | E2E tests (Playwright) |

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 20+ | `nvm install 20` or [nodejs.org](https://nodejs.org) |
| **pnpm** | 8.x | `corepack enable && corepack prepare pnpm@8.15.8 --activate` |
| **Git** | 2.x+ | [git-scm.com](https://git-scm.com) |

> **Note:** Clone via HTTPS if you don't have SSH keys configured:
> ```bash
> git clone https://github.com/97n8/puddlejumper.git
> ```

## Getting Started

**Quick setup** (automated):
```bash
bash scripts/bootstrap.sh
```

**Manual setup:**
```bash
cd n8drive
pnpm install
pnpm --filter @publiclogic/core run build
pnpm --filter @publiclogic/logic-commons run build
pnpm --filter @publiclogic/puddlejumper run build
cp .env.sample .env          # edit to add OAuth secrets if needed
pnpm run dev                 # starts server on http://localhost:3002
```

**Run tests:**
```bash
cd n8drive
pnpm test                    # all unit tests
pnpm run typecheck           # TypeScript type checking
pnpm run check:pj-contract   # PJ contract validation
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

- See `n8drive/README.md` for detailed PuddleJumper documentation
- See `n8drive/docs/` for architecture and release docs
- See `n8drive/ops/ARCHITECTURE-NORTH-STAR.md` for strategic roadmap
- See `n8drive/SECURITY.md` for security policy
- See `publiclogic-operating-system/README.md` for Logicville connection

## License

See LICENSE file.
