-- Database: approvals
-- Description: Add Relay V1 support fields to casespaces and query indexes.
-- Author: 97n8
-- Date: 2026-05-24

ALTER TABLE casespaces ADD COLUMN status TEXT CHECK(status IN ('active','closed'));
ALTER TABLE casespaces ADD COLUMN current_responsible_actor_id TEXT;
ALTER TABLE casespaces ADD COLUMN current_responsible_role TEXT;
ALTER TABLE casespaces ADD COLUMN current_responsible_position_id TEXT;
ALTER TABLE casespaces ADD COLUMN last_relay_id TEXT;

CREATE INDEX IF NOT EXISTS idx_casespaces_status
  ON casespaces(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_casespaces_responsible_position
  ON casespaces(current_responsible_position_id);
CREATE INDEX IF NOT EXISTS idx_casespaces_last_relay
  ON casespaces(last_relay_id);
