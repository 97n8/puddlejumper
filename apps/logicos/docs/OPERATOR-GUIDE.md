# Operator Guide

## 1. Repo layout

`~/LogicOS` is the frontend and operator workspace. It contains the LogicOS UI under `src/`, repo-local API handlers under `api/`, shared packages under `packages/`, and the SQLite spine implementation under `src/lib/logicos/`. Use `~/LogicOS/docs/TREE.md` for the current depth-3 map.

`~/puddlejumper` is the service and deployment repo. The actual application workspace lives under `n8drive/`, with the API app in `n8drive/apps/puddlejumper/`, shared packages in `n8drive/packages/`, and deployment/config material in `n8drive/docs/`, `n8drive/ops/`, and `n8drive/scripts/`. Use `~/puddlejumper/docs/TREE.md` for the current depth-3 map.

## 2. Daily commands

Use these commands first before making changes:

```bash
cd ~/LogicOS
git status
git --no-pager log --oneline -5
git --no-pager diff --stat
git --no-pager diff
```

```bash
cd ~/puddlejumper
git status
git --no-pager log --oneline -5
git --no-pager diff --stat
git --no-pager diff
```

## 3. Architecture lock

The architecture lock is there to keep both repos on the approved substrate: SQLite with `better-sqlite3` and WAL, local routing tables, and explicit application-layer integrations. Forbidden dependencies are `@vercel/kv`, Postgres clients (`pg`), Redis clients (`redis`, `ioredis`), workflow engines such as `n8n`, queue stacks such as `bullmq`, and Mongo stacks (`mongoose`, `mongodb`). Those are blocked because they would move the system away from the current deterministic local spine, introduce a second persistence model, or hide execution state outside the operator-visible path.

Check the lock with:

```bash
cd ~/LogicOS
grep -E '"(@vercel/kv|pg|redis|ioredis|n8n|bullmq|mongoose|mongodb)"' package.json
grep -rEn "@vercel/kv|lib/logicos/kv" src/ api/ 2>/dev/null
```

```bash
cd ~/puddlejumper
grep -E '"(@vercel/kv|pg|redis|ioredis|n8n|bullmq|mongoose|mongodb)"' package.json
```

## 4. Spine verification

Use the release-gate checks against `src/lib/logicos/migrations/001_logicos_spine.sql`:

```bash
cd ~/LogicOS
SPINE="src/lib/logicos/migrations/001_logicos_spine.sql"
grep -q "STRICT" "$SPINE"
grep -qE "CREATE TABLE.*logicos_records" "$SPINE"
grep -qE "CREATE TABLE.*audit_events" "$SPINE"
grep -qE "CREATE TABLE.*id_sequence" "$SPINE"
grep -qE "CREATE TABLE.*logicos_routing" "$SPINE"
grep -q "BEFORE UPDATE ON audit_events" "$SPINE"
grep -q "BEFORE DELETE ON audit_events" "$SPINE"
grep -q "REFERENCES civic_actors" "$SPINE"
```

## 5. Commit split convention

Keep commits grouped by concern so review and rollback stay clean. The working split used here is:

1. `logicos: spine`
2. `truthful-state: hardening`
3. `flows: ...`
4. `tests + deps`
5. `chore: env example`
6. repo-specific docs commits

When a follow-up patch lands later, use the same rule: commit the boundary change first, UI polish second, test fixture updates third, and only then a residual catch-all if anything truly does not fit.

## 6. Validation gates per repo

LogicOS requires all three gates:

```bash
cd ~/LogicOS
npm run typecheck
npm test
npm run build
```

PuddleJumper uses the scripts actually exposed by the root repo:

```bash
cd ~/puddlejumper
npm test
npm run build
```

Do not push a repo that has not cleared its own full validation gate.

## 7. Push procedure

Validate first, push second, confirm the remote third.

```bash
cd ~/LogicOS
npm run typecheck && npm test && npm run build
git push origin main
git --no-pager log --oneline origin/main..HEAD
```

```bash
cd ~/puddlejumper
npm test && npm run build
git push origin main
git --no-pager log --oneline origin/main..HEAD
```

The final `git log origin/main..HEAD` should print nothing when the push is complete.

## 8. `ship.sh` usage

The release helper is expected to live at `~/bin/ship.sh`. Run it only after both repos are already locally green.

```bash
~/bin/ship.sh
```

Override repo locations if needed:

```bash
LOGICOS_DIR=~/97N8Labs/Live/Repos/puddlejumper/apps/logicos PJ_DIR=~/97N8Labs/Live/Repos/puddlejumper ~/bin/ship.sh
```

The script is a release gate, not a fixer. If it halts, fix the repo state first and rerun it from the top.

## 9. Recovery

Prefer the least destructive recovery path. Use `git revert` for pushed history. Use `git reset --hard` only when you explicitly intend to discard local work. Treat force pushes as exceptional because they rewrite shared branch history.

Inspect before recovering:

```bash
git status
git --no-pager diff
git --no-pager log --oneline -10
```

Discard local uncommitted work only when you are certain:

```bash
git reset --hard HEAD
```

Revert a bad pushed commit without rewriting history:

```bash
git revert <sha>
git push origin main
```

If a force push is unavoidable, confirm nobody else is building on the branch first:

```bash
git push --force-with-lease origin main
```

## 10. Where things live

Public-facing LogicOS lives on Vercel under `publiclogic.org`. PuddleJumper services are exposed through Fly and the API host at `api.publiclogic.org`. The PuddleJumper application host is `pj.publiclogic.org`. When you verify a release, check the deployed UI on Vercel, the API behavior on Fly, and the PuddleJumper host together so the operator path is validated end to end.

## 11. Test backlog

- `civic.test` passes in isolation but fails in a full-suite run. Investigate test ordering or shared state leakage. Likely shared SQLite handle or a singleton mock that is not being reset between tests.
