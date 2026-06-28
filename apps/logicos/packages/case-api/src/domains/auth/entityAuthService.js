'use strict';
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryRun } = require('../../db/adapter');
const { appendEntry } = require('seal');

async function lookup({ email, case_number, jurisdiction_id }) {
  // 1. Find case
  const caseRow = queryOne(
    'SELECT * FROM cases WHERE case_number = ? AND jurisdiction_id = ?',
    [case_number, jurisdiction_id]
  );
  if (!caseRow) throw Object.assign(new Error('Case not found'), { status: 404 });

  // 2. Find or create entity
  let entity = queryOne('SELECT * FROM entities WHERE email = ?', [email]);
  const now  = new Date().toISOString();
  if (!entity) {
    const eid = uuidv4();
    queryRun(
      'INSERT INTO entities (id, email, entity_type, created_at, updated_at) VALUES (?,?,?,?,?)',
      [eid, email, 'individual', now, now]
    );
    entity = queryOne('SELECT * FROM entities WHERE id = ?', [eid]);
  }

  // 3. Assign entity to case if unassigned
  if (!caseRow.side_b_entity) {
    queryRun('UPDATE cases SET side_b_entity = ?, updated_at = ? WHERE id = ?',
      [entity.id, now, caseRow.id]);
  } else if (caseRow.side_b_entity !== entity.id) {
    // 4. Different entity owns this case
    throw Object.assign(new Error('Case belongs to a different entity'), { status: 403 });
  }

  // 5-6. Generate token + hash
  const token      = crypto.randomBytes(32).toString('hex');
  const token_hash = crypto.createHash('sha256').update(token).digest('hex');
  const issued_at  = now;
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const session_id = uuidv4();

  // 7. Insert session
  queryRun(
    `INSERT INTO entity_sessions (id, entity_id, case_id, token_hash, issued_at, expires_at)
     VALUES (?,?,?,?,?,?)`,
    [session_id, entity.id, caseRow.id, token_hash, issued_at, expires_at]
  );

  // 8. Append SEAL entry
  const { getDb } = require('../../db/adapter');
  appendEntry(getDb(), {
    entry_type: 'entity_lookup',
    object_id:  caseRow.id,
    actor:      entity.id,
    actor_type: 'entity',
    payload:    { email, case_number, session_id },
  });

  // 9. Return
  return { token, expires_at, case_id: caseRow.id, entity_id: entity.id };
}

module.exports = { lookup };
