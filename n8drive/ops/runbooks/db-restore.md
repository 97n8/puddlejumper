# Database Restore Runbook

## Overview

PuddleJumper uses SQLite databases stored on a persistent Fly.io volume at `/app/data`.
The `db-backup.yml` GitHub Action creates automated backups every 6 hours and stores them
as GitHub Actions artifacts (30-day retention).

**Databases:**

| Database | Default Path | Purpose |
|----------|-------------|---------|
| `prr.db` | `/app/data/prr.db` | Public Records Requests |
| `connectors.db` | `/app/data/connectors.db` | Connector state (OAuth tokens, config) |
| `approvals.db` | `/app/data/approvals.db` | Approval chains, governance decisions |
| `oauth_state.db` | `/app/data/oauth_state.db` | OAuth CSRF state tokens |
| `workspaces.db` | `/app/data/workspaces.db` | Workspace membership, roles |

All databases use SQLite WAL mode for concurrent read performance.

---

## Prerequisites

- Fly CLI installed and authenticated: `fly auth login`
- App name: `publiclogic-puddlejumper`
- GitHub CLI (`gh`) for downloading artifacts

---

## 1. Download Backup Artifact from GitHub

```bash
# List recent backup artifacts
gh run list --repo 97n8/puddlejumper --workflow db-backup.yml --limit 10

# Download the most recent backup artifact
gh run download <run-id> --repo 97n8/puddlejumper --name pj-db-backup --dir ./restore-tmp
```

Verify the downloaded files:

```bash
ls -lh ./restore-tmp/
# Should contain: prr.db, connectors.db, approvals.db (and possibly others)
```

---

## 2. Validate Backup Integrity

Before restoring, verify each database is not corrupt:

```bash
for db in ./restore-tmp/*.db; do
  echo "Checking $db..."
  sqlite3 "$db" "PRAGMA integrity_check;" && echo "✓ OK" || echo "✗ CORRUPT"
done
```

For the approvals database specifically, verify key tables exist:

```bash
sqlite3 ./restore-tmp/approvals.db ".tables"
# Expected: approvals  approval_chain_steps  approval_chain_templates  ...

sqlite3 ./restore-tmp/prr.db ".tables"
# Expected: public_records_requests  ...
```

---

## 3. Restore to Fly.io (Production)

### 3a. Stop the running machine

```bash
# List machines
fly machines list --app publiclogic-puddlejumper

# Stop the machine (note the machine ID)
fly machines stop <machine-id> --app publiclogic-puddlejumper
```

### 3b. Upload backup files via SFTP

```bash
# Connect via SSH proxy
fly ssh console --app publiclogic-puddlejumper -C "ls /app/data/"

# Move existing DBs aside (safety)
# Note: \$ escaping is required because the command runs inside a -C "..." string
fly ssh console --app publiclogic-puddlejumper -C "
  cd /app/data &&
  for f in prr.db connectors.db approvals.db oauth_state.db; do
    [ -f \$f ] && mv \$f \$f.pre-restore
  done
"

# Upload each backup file
for db in prr.db connectors.db approvals.db; do
  fly ssh sftp shell --app publiclogic-puddlejumper <<EOF
put ./restore-tmp/$db /app/data/$db
EOF
done
```

### 3c. Restart the machine

```bash
fly machines start <machine-id> --app publiclogic-puddlejumper
```

---

## 4. Restore Locally (Development)

```bash
# Stop the local server (Ctrl-C or kill the process)

# Back up current data
cp -r n8drive/apps/puddlejumper/data n8drive/apps/puddlejumper/data.pre-restore

# Copy backup files into place
cp ./restore-tmp/prr.db n8drive/apps/puddlejumper/data/prr.db
cp ./restore-tmp/connectors.db n8drive/apps/puddlejumper/data/connectors.db
cp ./restore-tmp/approvals.db n8drive/apps/puddlejumper/data/approvals.db

# Restart
cd n8drive && pnpm run dev
```

---

## 5. Post-Restore Validation

After restore, verify the system is fully functional:

### 5a. Health check

```bash
export BASE=https://publiclogic-puddlejumper.fly.dev  # or http://localhost:3002
curl -s "$BASE/health" | python3 -m json.tool
```

**Expected:** All checks return `"ok"`:
- `prr`: ok
- `connectors`: ok
- `approvals`: ok
- `volume`: ok
- `secrets`: ok (or warn if OAuth secrets not configured)

### 5b. Verify data integrity

```bash
export TOKEN="<your-jwt>"
export CSRF="X-PuddleJumper-Request: true"

# Check approval count
curl -s -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/approvals/count/pending" | python3 -m json.tool

# List recent approvals
curl -s -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/approvals?limit=5" | python3 -m json.tool

# Verify PRR records
curl -s -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/prr?limit=5" | python3 -m json.tool
```

### 5c. Verify auth flow

```bash
# Check identity endpoint
curl -s -H "Authorization: Bearer $TOKEN" -H "$CSRF" \
  "$BASE/api/me" | python3 -m json.tool
```

---

## 6. Rollback

If the restore causes issues, roll back to the pre-restore files:

```bash
# Fly.io
fly ssh console --app publiclogic-puddlejumper -C "
  cd /app/data &&
  for f in prr.db connectors.db approvals.db oauth_state.db; do
    [ -f \$f.pre-restore ] && mv \$f.pre-restore \$f
  done
"
fly machines restart <machine-id> --app publiclogic-puddlejumper

# Local
rm -rf n8drive/apps/puddlejumper/data
mv n8drive/apps/puddlejumper/data.pre-restore n8drive/apps/puddlejumper/data
```

---

## 7. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `health` returns `"error"` for a DB | Corrupt or missing DB file | Re-restore from backup or let app recreate empty DB |
| `volume` check fails | Fly volume not mounted | `fly volumes list --app publiclogic-puddlejumper` and verify mount |
| Auth fails after restore | JWT secret changed between backup and restore | Ensure `JWT_SECRET` env var matches the signing key used when tokens were issued |
| Approval chains show wrong state | Backup was taken mid-dispatch | Check `approval_status` column; manually reset `dispatching` rows to `approved` if needed |
| WAL file left behind | SQLite WAL not checkpointed before backup | Run `sqlite3 <db> "PRAGMA wal_checkpoint(TRUNCATE);"` then re-backup |

---

## 8. Backup Schedule

- **Automated:** Every 6 hours via `db-backup.yml` GitHub Action
- **Retention:** 30 days as GitHub Actions artifacts
- **Manual trigger:** `gh workflow run db-backup.yml --repo 97n8/puddlejumper`
- **Storage:** Fly.io also keeps backups in `/app/data/backups/` (cleaned after 2 days)
