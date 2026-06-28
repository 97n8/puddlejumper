'use strict';
const { queryOne } = require('../db/adapter');

function jurisdictionScope(req, res, next) {
  // Staff routes: jurisdiction from JWT actor
  if (req.actor && req.actor.jurisdiction_id) {
    req.scope = { jurisdiction_id: req.actor.jurisdiction_id };
    return next();
  }
  // Public routes: resolve from slug in query or body
  const slug = req.query.jurisdiction_slug || (req.body && req.body.jurisdiction_slug);
  if (!slug) {
    req.scope = { jurisdiction_id: null };
    return next();
  }
  const jur = queryOne('SELECT id FROM jurisdictions WHERE slug = ?', [slug]);
  if (!jur) return res.status(404).json({ error: 'JURISDICTION_NOT_FOUND' });
  req.scope = { jurisdiction_id: jur.id };
  next();
}

module.exports = { jurisdictionScope };
