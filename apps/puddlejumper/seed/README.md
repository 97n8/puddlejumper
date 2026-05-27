# PJ Seed

This directory owns the answer to "who can use PJ."

## To add a person

1. Edit `people.yaml`. Append an entry under `identities`.
2. Run `pnpm --filter @publiclogic/puddlejumper seed`.
3. Tell them to log in with their OAuth email. Their identity links to
   their OAuth subject on first login.

## To change a role

Do NOT edit YAML — the seed is non-destructive on roles by design. If you
change the role in YAML and re-run, you get a `WARN` and the DB row
stays as it was. Use the org-manager API or admin UI for role changes.

## To remove someone

Do NOT just delete from YAML. Call the deactivate endpoint:

```
PATCH /api/org/identities/:id/deactivate
```

Deactivated identities cannot be assigned to new processes and cannot
transition existing ones. Their audit history remains.

## Production

This seed is safe to run on production. It is idempotent, emits audit
events, and makes no destructive changes. To bootstrap a fresh prod DB:

```
PJ_DB_PATH=/app/data/pj.db pnpm --filter @publiclogic/puddlejumper seed
```

## OAuth linkage caveat

As of 2026-05-27 the `onUserAuthenticated` hook in
`apps/puddlejumper/src/api/server.ts` does NOT look up canon identities
by `(tenant_id, email)`. The seed fills email/display_name into the
canon `identities` row, but bridging that to OAuth login is a separate
follow-up. Until then, login still uses the legacy `workspace` row path.
