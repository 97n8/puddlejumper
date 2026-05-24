-- Database: audit
-- Description: Add Relay V1 JSON-path indexes to audit_events.metadata.
-- Author: 97n8
-- Date: 2026-05-24

CREATE INDEX IF NOT EXISTS idx_audit_scope
  ON audit_events(json_extract(metadata, '$.scope'));
CREATE INDEX IF NOT EXISTS idx_audit_primitive
  ON audit_events(json_extract(metadata, '$.primitive'));
CREATE INDEX IF NOT EXISTS idx_audit_relay_id
  ON audit_events(json_extract(metadata, '$.relay_id'));
CREATE INDEX IF NOT EXISTS idx_audit_case_space_id
  ON audit_events(json_extract(metadata, '$.case_space_id'));
CREATE INDEX IF NOT EXISTS idx_audit_expires_at
  ON audit_events(json_extract(metadata, '$.expires_at'));
CREATE INDEX IF NOT EXISTS idx_audit_relay_to_position
  ON audit_events(json_extract(metadata, '$.to.position_id'));
