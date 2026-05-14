-- File: migrations/20260206_add_prr_public_id.sql
-- Migration: Add public_id column to prr table and index it.
-- Idempotent index creation uses IF NOT EXISTS.
-- NOTE: ALTER TABLE must be applied once by the migration runner.

BEGIN TRANSACTION;

ALTER TABLE prr ADD COLUMN public_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ix_prr_public_id ON prr(public_id);

COMMIT;
