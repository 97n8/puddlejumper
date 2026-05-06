# PublicLogic ecosystem repo

This repository is part of one connected **PublicLogic** universe:

- **LogicOS** - the operator workspace
- **PuddleJumper** - the control plane, approvals, dispatch, and runtime
- **LogicCommons** - shared governance and repository primitives
- **Vault** - compliance, policy, and audit authority

`n8drive/` is the canonical implementation root in this repository today. It contains the active pnpm monorepo for PuddleJumper plus shared packages that support the wider PublicLogic system.

## Repo truth

- **Canonical code root:** `n8drive/`
- **Canonical GitHub Actions location:** `.github/workflows/`
- **Canonical local workflow:** run commands from `n8drive/`

Nested workflow files under `n8drive/.github/workflows/` are intentionally not used; the live GitHub Actions definitions belong at the repository root.

## Repository layout

| Path | Role |
|---|---|
| `n8drive/apps/puddlejumper/` | PuddleJumper control plane app |
| `n8drive/apps/logic-commons/` | LogicCommons service/package surface used by the ecosystem |
| `n8drive/packages/core/` | shared auth, cookie, and governance primitives |
| `n8drive/packages/vault/` | Vault compliance and PolicyProvider implementation |
| `.github/workflows/` | live CI, deploy, backup, and smoke automation |

## Getting started

```bash
cd n8drive
corepack enable
pnpm install
pnpm run dev
```

## Key commands

```bash
cd n8drive
pnpm run test
pnpm run typecheck
pnpm run build
pnpm run ci
```

## Documentation

- `n8drive/README.md` - implementation and runtime guide
- `n8drive/ops/ARCHITECTURE-NORTH-STAR.md` - product and control-plane direction
- `n8drive/packages/vault/README.md` - Vault architecture and boundary

## License

See `LICENSE`.
