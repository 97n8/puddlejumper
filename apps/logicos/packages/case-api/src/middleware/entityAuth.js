'use strict';
const crypto = require('crypto');
const { queryOne } = require('../db/adapter');

function entityAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing entity token.' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session   = queryOne(
    `SELECT * FROM entity_sessions
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    [tokenHash, new Date().toISOString()]
  );
  if (!session) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session.' });

  req.entity = { entity_id: session.entity_id, case_id: session.case_id, session_id: session.id };
  next();
}

module.exports = { entityAuth };
