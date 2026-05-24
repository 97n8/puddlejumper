-- Database: prr
-- Description: Add public_id column to prr table and index it.
-- Author: 97n8
-- Date: 2026-02-06

ALTER TABLE prr ADD COLUMN public_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ix_prr_public_id ON prr(public_id);
