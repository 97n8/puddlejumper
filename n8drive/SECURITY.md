# Security Model

## Authentication
- `/api/login` built-in credentials are disabled by default and require explicit opt-in:
  - `ALLOW_ADMIN_LOGIN=true`
  - `NODE_ENV` must not be `production`
- Built-in login users are loaded from `PJ_LOGIN_USERS_JSON` and must provide `passwordHash` values (bcrypt-compatible hashes).
- No default plaintext credential fallback exists when `PJ_LOGIN_USERS_JSON` is unset.
- `/api/login` issues a signed JWT as an `HttpOnly` session cookie (`jwt`) with `SameSite=Lax`.
- All protected `/api/*` routes accept either:
  - `Authorization: Bearer <JWT>` (debug/external caller compatibility), or
  - `jwt` cookie (browser session path).
- Tokens are verified server-side only.
- Supported verification modes:
  - `RS256` using `JWT_PUBLIC_KEY` (preferred).
  - `HS256` using `JWT_SECRET` (minimum 256-bit secret).
- Required JWT validations:
  - `exp`
  - `iss` (`AUTH_ISSUER`)
  - `aud` (`AUTH_AUDIENCE`)
- Client-supplied identity headers (for example `x-user-*`, `x-session-*`) are ignored.
- `/api/logout` clears the `jwt` cookie.

## CSRF Protection
- Mutating `/api/*` methods (`POST`, `PUT`, `PATCH`, `DELETE`) require:
  - `X-PuddleJumper-Request: true`
- Safe methods (`GET`, `HEAD`, `OPTIONS`) are exempt.
- Missing marker on a mutating request returns `403`.

## Authorization
- `/api/identity`: authenticated user required.
- `/api/runtime/context`: authenticated user required.
- `/api/config/tiles`: authenticated user required.
- `/api/config/capabilities`: authenticated user required.
- `/api/prompt`: authenticated admin required (`role === "admin"`).
- `/api/evaluate`: authenticated user with `deploy` permission required.
- Unauthorized requests return `401`.
- Authenticated but unauthorized requests return `403`.

## Trust Boundaries
- The only trusted identity source is the verified JWT payload.
- Request payload `operator` fields are overwritten with verified token identity and permissions.
- Idempotency keys are namespaced by verified user and tenant in the API layer.
- UI configuration is sourced from server-side runtime config endpoints; static demo defaults are not used.

## SSRF Protections
- Canonical source URLs must be:
  - `https://...`
  - host allowlisted (`raw.githubusercontent.com`, `github.com`, plus optional configured hosts).
- Hostnames are resolved before fetch.
- Requests are blocked if any resolved IP is private/internal, including:
  - `127.0.0.0/8`
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
  - `169.254.0.0/16` (including `169.254.169.254`)
  - `::1`
  - `fc00::/7`
- Canonical fetch hardening:
  - timeout: `3000ms`
  - redirect policy: `error`
  - max response size: `1MB`
  - content type must include `application/json`

## Runtime Security Controls
- Security response headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - restrictive baseline `Content-Security-Policy`
- Route-level rate limiting:
  - `/api/login`
  - `/api/evaluate`
  - `/api/prompt`
  - In-memory buckets are TTL-evicted to prevent unbounded growth.
- Input validation:
  - Zod schemas on API requests
  - unknown fields rejected
  - malformed payloads rejected with `400`

## Proxy Assumptions
- The service does not require a trusted proxy to sanitize identity headers.
- If deployed behind a proxy/gateway, authentication remains token-based at this service boundary.
- Proxies must not terminate security controls in a way that bypasses JWT validation at the app layer.
- If TLS termination occurs upstream, deploy with HTTPS and set `NODE_ENV=production` so session cookies are emitted with `Secure`.

## Deployment Requirements
- Set one of:
  - `JWT_PUBLIC_KEY` (recommended), or
  - `JWT_SECRET` (strong secret, >= 256-bit).
- Set:
  - `AUTH_ISSUER`
  - `AUTH_AUDIENCE`
- Optional:
  - `PJ_CANONICAL_HOST_ALLOWLIST` for additional canonical domains.
  - `ALLOW_ADMIN_LOGIN=true` for local-only built-in login use.
  - `PJ_LOGIN_USERS_JSON` for explicit built-in login users using `passwordHash`.
- Required in production:
  - `PJ_RUNTIME_CONTEXT_JSON`
  - `PJ_RUNTIME_TILES_JSON`
  - `PJ_RUNTIME_CAPABILITIES_JSON`
