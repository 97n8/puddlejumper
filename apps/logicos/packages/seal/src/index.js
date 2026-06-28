const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const GENESIS_HASH = '0'.repeat(64);

function appendEntry(db, { entry_type, object_id, actor, actor_type, payload }) {
  const last = db.prepare(
    'SELECT sequence, entry_hash FROM seal_entries ORDER BY sequence DESC LIMIT 1'
  ).get();

  const prev_hash    = last ? last.entry_hash : GENESIS_HASH;
  const next_seq     = last ? last.sequence + 1 : 1;
  const payload_hash = sha256(JSON.stringify(payload));
  const entry_hash   = sha256(`${next_seq}${payload_hash}${prev_hash}`);
  const id           = crypto.randomUUID();
  const created_at   = new Date().toISOString();

  db.prepare(`
    INSERT INTO seal_entries
      (id, sequence, entry_type, object_id, actor, actor_type,
       payload_hash, prev_hash, entry_hash, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(id, next_seq, entry_type, object_id, actor, actor_type,
         payload_hash, prev_hash, entry_hash, created_at);

  return { id, sequence: next_seq, entry_hash };
}

function verifyChain(db) {
  const entries = db.prepare(
    'SELECT * FROM seal_entries ORDER BY sequence ASC'
  ).all();

  let prev_hash = GENESIS_HASH;
  for (const e of entries) {
    const expected = sha256(`${e.sequence}${e.payload_hash}${prev_hash}`);
    if (expected !== e.entry_hash) {
      return { valid: false, broken_at: e.sequence, expected, found: e.entry_hash };
    }
    prev_hash = e.entry_hash;
  }
  return { valid: true, total: entries.length };
}

function getLastEntry(db) {
  return db.prepare(
    'SELECT * FROM seal_entries ORDER BY sequence DESC LIMIT 1'
  ).get() || null;
}

module.exports = {
  appendEntry,
  verifyChain,
  getLastEntry,
};
