# PuddleJumper GPR

**Government Process Runtime** — the governed execution engine for PublicLogic municipal AI.

## Architecture

```
apps/
  puddlejumper/     API server & governance engine    (port 3002)
  vault/            Policy authority & audit ledger   (port 3003)
  logic-commons/    Shared governance primitives
  logicos/          Operator mobile shell

packages/
  core/             Auth, JWT, middleware
```

## How it works

Every municipal AI action passes through a **fail-closed governance engine** before executing:

1. **Evaluate** — engine checks intent, authority, and policy
2. **Register** — manifest pre-flight with VAULT (freeze windows, legal citations)
3. **Approve** — multi-step chain (parallel + sequential)
4. **Authorize** — VAULT release gate (drift detection, TTL)
5. **Dispatch** — connector executes against GitHub / SharePoint / Slack / webhook

The `LocalPolicyProvider` runs standalone. Set `VAULT_URL` to route through the VAULT authority service.

## Quick start

```bash
pnpm install
pnpm dev:pj        # API server on :3002
pnpm dev:vault     # VAULT authority on :3003
```

## Deploy

```bash
pnpm deploy:fly    # Fly.io (publiclogic-puddlejumper.fly.dev)
```

## Packages

| Package | Description |
|---------|-------------|
| `@publiclogic/puddlejumper` | Governance engine, approval chains, dispatch |
| `@publiclogic/vault` | Policy provider, audit ledger, manifest registry |
| `@publiclogic/logic-commons` | Shared governance & repository primitives |
| `@publiclogic/core` | Auth, JWT, cookies, middleware |
| `@gpr/logicos` | Mobile operator shell |
