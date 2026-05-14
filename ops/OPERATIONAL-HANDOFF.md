# PuddleJumper Operational Handoff

**Version:** February 2026
**Purpose:** "If Nate is hit by a bus" — everything needed to operate PuddleJumper.

---

## System Overview

PuddleJumper is a governance control plane for Massachusetts municipalities.
It handles approval chains, webhook dispatch, access control, and public records requests.

- **Backend:** Node 20, Express, SQLite WAL on Fly.io (`publiclogic-puddlejumper`)
- **Frontend:** Next.js on Vercel (`pj.publiclogic.org`)
- **Auth:** OAuth (GitHub, Google, Microsoft) + JWT sessions
- **Data:** SQLite databases on a Fly.io persistent volume (`/app/data`)

---

## 1. Environment Variable Manifest

### Required (server will not start without these)

| Variable | Purpose | Example |
|----------|---------|---------|
| `JWT_SECRET` | Signs JWT tokens (≥32 chars) | `<random 64-char hex>` |
| `AUTH_ISSUER` | JWT issuer claim | `publiclogic-puddlejumper` |
| `AUTH_AUDIENCE` | JWT audience claim | `publiclogic-puddlejumper` |

### Required in Production

| Variable | Purpose |
|----------|---------|
| `PJ_RUNTIME_CONTEXT_JSON` | Municipality workspace config (JSON) |
| `PJ_RUNTIME_TILES_JSON` | Tile layout config (JSON) |
| `PJ_RUNTIME_CAPABILITIES_JSON` | Capabilities manifest (JSON) |
| `PRR_DB_PATH` | Path to PRR database |
| `IDEMPOTENCY_DB_PATH` | Path to idempotency database |
| `RATE_LIMIT_DB_PATH` | Path to rate limit database |
| `ACCESS_NOTIFICATION_WEBHOOK_URL` | Webhook URL for access notifications |
| `FRONTEND_URL` | Frontend URL for CORS |
| `CONNECTOR_STATE_SECRET` | HMAC key for connector state |

### OAuth Provider Credentials

| Variable | Provider |
|----------|----------|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `GITHUB_REDIRECT_URI` | GitHub callback URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_REDIRECT_URI` | Google callback URL |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth |
| `MICROSOFT_REDIRECT_URI` | Microsoft callback URL |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `METRICS_TOKEN` | Bearer token for `/metrics` | None (open) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS origins | Dev defaults |
| `PJ_ALLOWED_PARENT_ORIGINS` | Allowed iframe parent origins | Dev defaults |
| `COOKIE_DOMAIN` | Cookie domain attribute | None |
| `VAULT_URL` | Remote Vault service URL | None (local provider) |
| `PORT` | Server port | `3002` |

---

## 2. Required Secrets

All production secrets are stored in **Fly.io secrets** (encrypted at rest).

```bash
# View current secrets (names only)
fly secrets list -a publiclogic-puddlejumper

# Set a secret
fly secrets set KEY="value" -a publiclogic-puddlejumper
```

**Critical secrets to safeguard:**
1. `JWT_SECRET` — if lost, all user sessions are invalidated
2. `CONNECTOR_STATE_SECRET` — if lost, connector auth flows break
3. OAuth client secrets — if lost, must re-create OAuth apps

---

## 3. Deployment Checklist

### Routine Deployment

1. [ ] Merge PR to `main`
2. [ ] CI passes (tests, typecheck)
3. [ ] Manual backup: `fly ssh console` → backup databases
4. [ ] Deploy: `cd n8drive && fly deploy`
5. [ ] Verify health: `curl https://publiclogic-puddlejumper.fly.dev/health`
6. [ ] Verify readiness: `curl https://publiclogic-puddlejumper.fly.dev/ready`
7. [ ] Spot-check: log in via OAuth, view approval queue

### First-Time Setup

See `ops/DISASTER-RECOVERY.md` section "Rebuild From Scratch".

---

## 4. Rollback Procedure

```bash
# List recent deployments
fly releases list -a publiclogic-puddlejumper

# Rollback to previous release
fly deploy --image <previous-image-ref> -a publiclogic-puddlejumper

# If database schema changed (rare):
# 1. Restore database backup from before the bad deploy
# 2. Then rollback the code
fly ssh sftp shell -a publiclogic-puddlejumper
put ./backup/approvals.db /app/data/approvals.db
# Then rollback code as above
```

---

## 5. Incident Response Playbook

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| SEV-1 | Service completely unavailable | Immediate |
| SEV-2 | Core feature degraded (approvals, login) | < 1 hour |
| SEV-3 | Non-critical feature issue | Next business day |

### Initial Triage Steps

1. **Check health:** `curl https://publiclogic-puddlejumper.fly.dev/health | jq .`
2. **Check logs:** `fly logs -a publiclogic-puddlejumper`
3. **Check machine status:** `fly status -a publiclogic-puddlejumper`
4. **Check metrics:** `curl -H "Authorization: Bearer $METRICS_TOKEN" https://publiclogic-puddlejumper.fly.dev/metrics`

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 503 on all endpoints | Machine crashed | `fly apps restart publiclogic-puddlejumper` |
| Health shows "degraded" | DB or volume issue | Check volume: `fly volumes list -a publiclogic-puddlejumper` |
| Login fails | OAuth misconfigured | Check `fly secrets list`, verify redirect URIs |
| Approvals stuck | Chain step has no approver | See `ops/runbooks/chain-stuck.md` |
| Rate limit errors | Aggressive client | Check rate limit DB, clear if needed |

---

## 6. Approval Chain Failure Triage

When approvals are stuck or not progressing:

1. **Check pending count:**
   ```bash
   curl -H "Authorization: Bearer $JWT" \
     https://publiclogic-puddlejumper.fly.dev/api/admin/stats | jq .data.pending
   ```

2. **Check for stuck chain steps** (via Prometheus):
   Look for `approval_chain_step_pending_gauge > 0` for extended periods.

3. **Common causes:**
   - Approver not assigned to step → Check chain template configuration
   - Dispatch failed → Check `dispatch_failure_total` metric, review logs
   - CAS conflict → Check `consume_for_dispatch_conflict_total` metric (self-healing, retry)

4. **Manual intervention:**
   ```bash
   fly ssh console -a publiclogic-puddlejumper
   sqlite3 /app/data/approvals.db "SELECT id, decision_status, approval_status FROM approvals WHERE approval_status = 'pending' ORDER BY created_at DESC LIMIT 10;"
   ```

See `ops/runbooks/approvals.md` for full operational procedures.

---

## 7. Key Files and Locations

| What | Where |
|------|-------|
| Server entry point | `n8drive/apps/puddlejumper/src/api/server.ts` |
| Approval engine | `n8drive/apps/puddlejumper/src/engine/approvalStore.ts` |
| Chain logic | `n8drive/apps/puddlejumper/src/engine/chainStore.ts` |
| Fly config | `n8drive/fly.toml` |
| Dockerfile | `n8drive/Dockerfile` |
| Alert rules | `n8drive/ops/alerts/approval-alerts.yml` |
| Runbooks | `n8drive/ops/runbooks/` |
| DR plan | `n8drive/ops/DISASTER-RECOVERY.md` |
| Grafana dashboard | `n8drive/ops/grafana/puddlejumper-approvals-dashboard.json` |

---

## 8. Contacts and Access

| System | Access Method |
|--------|--------------|
| Fly.io dashboard | https://fly.io/apps/publiclogic-puddlejumper |
| Vercel dashboard | https://vercel.com (publiclogic org) |
| GitHub repo | https://github.com/97n8/puddlejumper |
| OAuth apps | GitHub Developer Settings, Google Cloud Console, Azure Portal |
