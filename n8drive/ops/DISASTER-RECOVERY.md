# PuddleJumper Disaster Recovery Plan

**Version:** February 2026
**System:** PuddleJumper Governance Control Plane
**Infrastructure:** Fly.io (backend) + Vercel (frontend) + SQLite WAL

---

## Recovery Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** (Recovery Time Objective) | ≤ 30 minutes | Governance workflows tolerate brief outages; approval chains can resume |
| **RPO** (Recovery Point Objective) | ≤ 6 hours | Automated backups run every 6 hours; manual backup before major changes |

---

## 1. Backup Strategy

### Automated Backups

- **Frequency:** Every 6 hours via GitHub Actions scheduled workflow
- **Retention:** 30 days (stored as workflow artifacts)
- **Databases backed up:** `approvals.db`, `prr.db`, `connectors.db`, `idempotency.db`, `audit.db`
- **Verification:** Integrity checks run after each backup (`PRAGMA integrity_check`)

### Manual Backup (before deployments)

```bash
# SSH into Fly machine
fly ssh console -a publiclogic-puddlejumper

# Create dated backup
cd /app/data
sqlite3 approvals.db ".backup /app/data/approvals-$(date +%Y%m%d-%H%M).db"
sqlite3 prr.db ".backup /app/data/prr-$(date +%Y%m%d-%H%M).db"
sqlite3 connectors.db ".backup /app/data/connectors-$(date +%Y%m%d-%H%M).db"
sqlite3 audit.db ".backup /app/data/audit-$(date +%Y%m%d-%H%M).db"
```

### Backup Verification Schedule

| Check | Frequency | Method |
|-------|-----------|--------|
| Integrity check | Every backup | `PRAGMA integrity_check` |
| Restore test | Weekly | Restore to temp volume, verify row counts |
| Full DR drill | Monthly | Complete restore walkthrough |

---

## 2. Full Restore Walkthrough

### Step 1: Obtain Latest Backup

```bash
# Download from GitHub Actions artifacts
# Navigate to Actions → Latest "Database Backup" run → Download artifact
# OR from Fly volume (if machine is accessible):
fly ssh console -a publiclogic-puddlejumper
cp /app/data/approvals.db /tmp/approvals-backup.db
```

### Step 2: Validate Backup Integrity

```bash
# Local validation
cd n8drive
pnpm run db:validate-restore -- --db ./backup/approvals.db
# Checks: PRAGMA integrity_check, required tables exist, row counts
```

### Step 3: Deploy Fresh Instance (if needed)

```bash
# If existing machine is unrecoverable:
fly apps create publiclogic-puddlejumper --org publiclogic
fly volumes create pj_data --region ewr --size 10 -a publiclogic-puddlejumper
fly deploy -a publiclogic-puddlejumper
```

### Step 4: Restore Databases

```bash
# Upload backup to Fly volume
fly ssh sftp shell -a publiclogic-puddlejumper
put ./backup/approvals.db /app/data/approvals.db
put ./backup/prr.db /app/data/prr.db
put ./backup/connectors.db /app/data/connectors.db
put ./backup/audit.db /app/data/audit.db

# Restart to pick up restored databases
fly apps restart publiclogic-puddlejumper
```

### Step 5: Verify Restoration

```bash
# Check health endpoint
curl -s https://publiclogic-puddlejumper.fly.dev/health | jq .

# Verify all checks are "ok"
# Expected: { "status": "ok", "checks": { "prr": { "status": "ok" }, ... } }

# Verify readiness
curl -s https://publiclogic-puddlejumper.fly.dev/ready | jq .
```

---

## 3. Secret Restoration

### Required Secrets

All secrets are stored in Fly.io secrets (not in the database):

```bash
# List current secrets
fly secrets list -a publiclogic-puddlejumper

# Required secrets to restore:
fly secrets set JWT_SECRET="<value>" -a publiclogic-puddlejumper
fly secrets set AUTH_ISSUER="<value>" -a publiclogic-puddlejumper
fly secrets set AUTH_AUDIENCE="<value>" -a publiclogic-puddlejumper
fly secrets set CONNECTOR_STATE_SECRET="<value>" -a publiclogic-puddlejumper
fly secrets set GITHUB_CLIENT_ID="<value>" -a publiclogic-puddlejumper
fly secrets set GITHUB_CLIENT_SECRET="<value>" -a publiclogic-puddlejumper
fly secrets set GOOGLE_CLIENT_ID="<value>" -a publiclogic-puddlejumper
fly secrets set GOOGLE_CLIENT_SECRET="<value>" -a publiclogic-puddlejumper
fly secrets set MICROSOFT_CLIENT_ID="<value>" -a publiclogic-puddlejumper
fly secrets set MICROSOFT_CLIENT_SECRET="<value>" -a publiclogic-puddlejumper
fly secrets set METRICS_TOKEN="<value>" -a publiclogic-puddlejumper
```

### Secret Storage Location

Primary: Fly.io secrets (encrypted at rest, injected as env vars)
Backup: Documented in secure team vault (1Password, Bitwarden, or equivalent)

---

## 4. OAuth Provider Rebind

If OAuth credentials are rotated or lost:

1. **GitHub:** https://github.com/settings/developers → Create new OAuth App
   - Callback URL: `https://publiclogic-puddlejumper.fly.dev/api/auth/github/callback`
2. **Google:** https://console.cloud.google.com/apis/credentials → Create OAuth 2.0 Client
   - Redirect URI: `https://publiclogic-puddlejumper.fly.dev/api/auth/google/callback`
3. **Microsoft:** https://portal.azure.com → App registrations → New registration
   - Redirect URI: `https://publiclogic-puddlejumper.fly.dev/api/auth/microsoft/callback`

After creating new credentials:
```bash
fly secrets set GITHUB_CLIENT_ID="new-id" GITHUB_CLIENT_SECRET="new-secret" -a publiclogic-puddlejumper
# Repeat for Google, Microsoft
fly apps restart publiclogic-puddlejumper
```

---

## 5. Rebuild From Scratch

If everything is lost (code + data + secrets):

1. Clone repository: `git clone https://github.com/97n8/puddlejumper.git`
2. Install: `cd n8drive && corepack enable && pnpm install`
3. Build: `pnpm run build`
4. Create Fly app: `fly apps create publiclogic-puddlejumper`
5. Create volume: `fly volumes create pj_data --region ewr --size 10`
6. Set all secrets (see Secret Restoration above)
7. Deploy: `fly deploy`
8. Restore data from backup (see Full Restore Walkthrough)
9. Verify health: `curl https://publiclogic-puddlejumper.fly.dev/health`
10. Re-create OAuth apps (see OAuth Provider Rebind)
11. Update DNS if needed
12. Verify frontend: confirm Vercel deployment at `pj.publiclogic.org`

---

## 6. Failure Scenarios

| Scenario | Impact | Recovery |
|----------|--------|----------|
| Machine crash | Service unavailable | Fly auto-restarts (min_machines=1); data persists on volume |
| Volume corruption | Data loss | Restore from latest backup; RPO ≤ 6h |
| Secret leak | Security breach | Rotate all secrets immediately; invalidate JWT sessions |
| OAuth provider outage | Login unavailable | Users cannot log in; existing JWT sessions remain valid |
| Region outage (ewr) | Full outage | Deploy to backup region; restore data from backup |
| Vercel outage | Frontend unavailable | Backend API still accessible directly |
