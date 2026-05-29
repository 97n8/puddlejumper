'use strict';
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./adapter');

try {
  const db = getDb();

  const now = new Date().toISOString();

  const jurisdictionId = uuidv4();
  db.prepare(`
    INSERT OR IGNORE INTO jurisdictions
      (id, name, state, slug, timezone, fiscal_year_start, setup_complete, config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(jurisdictionId, 'Demo Municipality', 'MA', 'demo', 'America/New_York', '07-01', 0, '{}', now, now);

  const orgConfigId = uuidv4();
  db.prepare(`
    INSERT OR IGNORE INTO org_config
      (id, jurisdiction_id, setup_step, complete, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(orgConfigId, jurisdictionId, 1, 0, now, now);

  const ruleId = uuidv4();
  db.prepare(`
    INSERT OR IGNORE INTO rules
      (id, jurisdiction_id, rule_key, version, description, source_citation,
       conditions, actions, common_catches, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ruleId,
    jurisdictionId,
    'shed-permit-001',
    '1.0.0',
    'Accessory structure permit requirement',
    'Model Zoning Bylaw §4.3.2',
    JSON.stringify([{ field: 'structure_type', operator: 'equals', value: 'shed' }]),
    JSON.stringify([{ type: 'require', object: 'buildingPermit', dueDays: 30 }]),
    JSON.stringify([
      'Setback from all property lines must be ≥10 ft',
      'Maximum height 15 ft in residential zones',
      'Conservation Commission review required within 100 ft of wetland',
      'Lot coverage limit may apply — check your zoning district',
      'Electrical work inside shed requires separate permit'
    ]),
    'active',
    now,
    now
  );

  console.log('Seed complete. Demo jurisdiction, org_config, and shed-permit-001 rule created.');
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exit(1);
}
