-- ─────────────────────────────────────────────────────────────────────────────
-- PuddleJumper canon migration 006 — identity overlay fields
-- Source: SEED prompt — personal tenant + identities with OAuth linkage.
--
-- The canon Identity record (migration 001) keeps the structural fields
-- (identity_id, tenant_id, kind, active, created_at, deactivated_at).
-- For the seed + OAuth flow to work without overlays, the email +
-- display_name + oauth subject map need to live on the row directly.
-- These are nullable so existing rows keep working; they're populated by
-- the seed and by onUserAuthenticated on first login.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE identities ADD COLUMN email          TEXT;
ALTER TABLE identities ADD COLUMN display_name   TEXT;
ALTER TABLE identities ADD COLUMN oauth_subjects TEXT NOT NULL DEFAULT '{}';

-- Tenant-scoped uniqueness on email so the seed (and OAuth login) can
-- look up an identity by (tenant_id, email).  Partial index lets a tenant
-- have multiple identities without email set (service identities, etc).
CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_tenant_email
  ON identities (tenant_id, email)
  WHERE email IS NOT NULL;
