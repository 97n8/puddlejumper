'use strict';
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'logicos-dev-secret-change-in-production';

function issueStaffToken(actor) {
  return jwt.sign(
    { actor_id: actor.id, jurisdiction_id: actor.jurisdiction_id, role: actor.role },
    SECRET,
    { expiresIn: '24h' }
  );
}

function validateToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { issueStaffToken, validateToken };
