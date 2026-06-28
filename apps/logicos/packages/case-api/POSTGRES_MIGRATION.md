# Postgres Migration Guide

When LogicOS outgrows SQLite, migrate to Postgres using the following steps.

## Why Migrate

- Multi-writer concurrency (SQLite WAL has limits)
- Horizontal scaling of `case-api`
- Analytics queries on large datasets

## Steps

1. Export all data from `data/logicos.db` using `.dump`
2. Replace `better-sqlite3` in `src/db/adapter.js` with `pg` (node-postgres)
3. Update `getDb()` to return a `pg.Pool` instance
4. Translate SQLite-specific syntax in `schema.sql`:
   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
   - `TEXT` date fields → `TIMESTAMPTZ`
   - `STRICT` table modifier → remove (not supported in Postgres)
5. Re-apply immutable trigger logic using Postgres `RULE` or trigger functions
6. Update `.env` to replace `DB_PATH` with `DATABASE_URL`
7. Run `pnpm migrate` with the new adapter
8. Verify all 11 Step 15 checks still pass

## Connection Pooling

Use `pg.Pool` with `max: 10`. Keep `idempotency_key UNIQUE` constraint — Postgres handles
`ON CONFLICT DO NOTHING` natively and more efficiently than SQLite.

## SEAL Integrity

`seal_entries` immutability must be re-implemented as a Postgres trigger:
```sql
CREATE OR REPLACE FUNCTION prevent_seal_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'seal_entries is immutable'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seal_immutable
BEFORE UPDATE OR DELETE ON seal_entries
FOR EACH ROW EXECUTE FUNCTION prevent_seal_mutation();
```
