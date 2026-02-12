# Launch Checklist (Phillipston)

## 1) Backup Location
- Primary SQLite data directory: `/Users/n8/Documents/New project/n8drive/data`
- Recommended backup directory: `/Users/n8/Documents/New project/n8drive/backups`
- Idempotency/audit DB path in production must be inside `data/` (`IDEMPOTENCY_DB_PATH`)
- Rate-limit DB path in production must be inside `data/` (`RATE_LIMIT_DB_PATH`)

## 2) Backup Steps
1. Run:
```bash
npm run db:backup -- --source /Users/n8/Documents/New\ project/n8drive/data/idempotency.db --out /Users/n8/Documents/New\ project/n8drive/backups/idempotency-$(date +%F-%H%M%S).db
```
2. Validate backup:
```bash
npm run db:validate-restore -- --db /Users/n8/Documents/New\ project/n8drive/backups/<backup-file>.db
```
3. Confirm output contains `"ok": true` and required tables `idempotency`, `decision_audit`.

## 3) Restore Steps
1. Stop application process.
2. Copy selected backup file into the controlled data directory:
```bash
cp /Users/n8/Documents/New\ project/n8drive/backups/<backup-file>.db /Users/n8/Documents/New\ project/n8drive/data/idempotency.db
```
3. Run restore validation:
```bash
npm run db:validate-restore -- --db /Users/n8/Documents/New\ project/n8drive/data/idempotency.db
```
4. Start application and verify `/health` and one authenticated `/api/identity` request.

## 4) Required Environment Variables (Production)
- `NODE_ENV=production`
- `AUTH_ISSUER`
- `AUTH_AUDIENCE`
- `JWT_SECRET` **or** `JWT_PUBLIC_KEY` (no `dev-secret`)
- `IDEMPOTENCY_DB_PATH` (must be under `data/`)
- `RATE_LIMIT_DB_PATH` (must be under `data/`)
- `PJ_RUNTIME_CONTEXT_JSON`
- `PJ_RUNTIME_TILES_JSON`
- `PJ_RUNTIME_CAPABILITIES_JSON`

## 5) Admin Rotation
1. If production is IdP/JWT managed: rotate admin at the identity provider by removing old admin claims and issuing new credentials/claims.
2. Rotate JWT signing material (`JWT_SECRET` or keypair), restart app, and invalidate old tokens.
3. If built-in login is used in non-production: update `PJ_LOGIN_USERS_JSON` with new bcrypt hash and remove old account.
4. Confirm old admin token/account no longer accesses `/api/prompt`.

## 6) Health Verification
1. `GET /health` returns `200`.
2. Unauthenticated `GET /api/capabilities/manifest` returns `401`.
3. Authenticated `GET /api/capabilities/manifest` returns capability map.
4. Unauthenticated `POST /api/evaluate` returns `401`.
5. Authenticated `POST /api/evaluate` with request marker and deploy permission returns deterministic decision.
6. `POST /api/prr/intake` creates `received` record with server-generated `received_at`.
7. Authenticated `POST /api/prr/:id/status` writes status transition + audit.
8. Authenticated `POST /api/prr/:id/close` writes closed state + audit.
9. Public `GET /api/public/prrs/:publicId` returns public-safe tracking payload only.
10. Confirm `X-Correlation-Id` is returned on responses.

## 7) Final Go-Live Gates
- `npm test` passes.
- `npx tsc --noEmit` passes.
- Backup and restore validation completed within last 24 hours.
- `ALLOW_ADMIN_LOGIN` is not set to `true` in production.
- `public_id` migration applied and backfill completed: `npm run prr:backfill-public-id`.
