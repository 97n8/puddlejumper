# Environment Reference

## `PJ_BASE_URL`
- Purpose: External PuddleJumper URL used by the OS shell pop-out.
- Default: Unset (`/pj` relative path fallback in the shell).
- Read in: `/Users/n8/AGNOSTIC/PublicLogic OS Component Library (4)/src/auth/publiclogicConfig.ts` via `resolvePuddleJumperUrl`.

## `IDEMPOTENCY_TTL_HOURS`
- Purpose: Expiration window for persisted idempotency keys.
- Default: `24`.
- Read in: `/Users/n8/Documents/New project/n8drive/src/engine/governanceEngine.ts` in `createGovernanceEngine`.

## `IDEMPOTENCY_DB_PATH`
- Purpose: SQLite file path for idempotency persistence.
- Default: `./data/idempotency.db`.
- Read in: `/Users/n8/Documents/New project/n8drive/src/engine/governanceEngine.ts` in `createGovernanceEngine`.

## `PJ_ALLOWED_PARENT_ORIGINS`
- Purpose: Trusted parent origins for iframe identity context postMessage.
- Default: empty list (same-origin only).
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/server.ts` in `/api/identity`.

## `AUTH_ISSUER`
- Purpose: Required JWT `iss` claim for API authentication.
- Default: `puddle-jumper`.
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/auth.ts`.

## `AUTH_AUDIENCE`
- Purpose: Required JWT `aud` claim for API authentication.
- Default: `puddle-jumper-api`.
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/auth.ts`.

## `JWT_PUBLIC_KEY`
- Purpose: RS256 JWT verification key (preferred production mode).
- Default: unset.
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/auth.ts`.

## `JWT_SECRET`
- Purpose: HS256 JWT verification secret (fallback mode, must be 256-bit minimum).
- Default: unset.
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/auth.ts`.

## `PJ_LOGIN_USERS_JSON`
- Purpose: Optional JSON array of built-in login users consumed by `/api/login`.
- Required shape: each user entry must include `passwordHash` (bcrypt-compatible hash), not plaintext passwords.
- Default: unset (`/api/login` returns `503 Login unavailable` when built-in login is enabled but no users are configured).
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/server.ts`.

## `ALLOW_ADMIN_LOGIN`
- Purpose: Explicit opt-in for built-in `/api/login` credentials in non-production environments.
- Default: unset/false (built-in login endpoint returns 404).
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/server.ts`.

## `PJ_CANONICAL_HOST_ALLOWLIST`
- Purpose: Additional allowed hosts for canonical integrity fetches.
- Default: empty (core allowlist still includes `raw.githubusercontent.com` and `github.com`).
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/server.ts`.

## `PJ_RUNTIME_CONTEXT_JSON`
- Purpose: Live runtime context payload used by `/api/runtime/context` (workspace, municipality, action defaults).
- Default: unset (required in production; endpoint returns `503` in non-production when unset).
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/server.ts`.

## `PJ_RUNTIME_TILES_JSON`
- Purpose: Live tile definitions consumed by `/api/config/tiles`.
- Default: unset (required in production; endpoint returns `503` in non-production when unset).
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/server.ts`.

## `PJ_RUNTIME_CAPABILITIES_JSON`
- Purpose: Live capability definitions (automations and quick actions) consumed by `/api/config/capabilities`.
- Default: unset (required in production; endpoint returns `503` in non-production when unset).
- Read in: `/Users/n8/Documents/New project/n8drive/src/api/server.ts`.
