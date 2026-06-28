'use strict';
const { queryOne } = require('../db/adapter');

function orgGate(req, res, next) {
  const jurisdictionId = (req.actor || req.scope || {}).jurisdiction_id;
  if (!jurisdictionId) return res.status(400).json({ error: 'JURISDICTION_REQUIRED' });

  const cfg = queryOne('SELECT complete FROM org_config WHERE jurisdiction_id = ?', [jurisdictionId]);
  if (!cfg || cfg.complete === 0) {
    return res.status(503).json({
      error:   'ORG_MANAGER_INCOMPLETE',
      message: 'Complete Org Manager setup before accessing this resource.',
    });
  }
  next();
}

module.exports = { orgGate };
