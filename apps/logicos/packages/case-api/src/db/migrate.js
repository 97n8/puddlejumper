'use strict';
const path = require('path');
const fs   = require('fs');
const { getDb } = require('./adapter');

const SCHEMA = path.join(__dirname, 'schema.sql');

try {
  const db  = getDb();
  const sql = fs.readFileSync(SCHEMA, 'utf8');
  db.exec(sql);
  console.log('Migration complete. All 17 tables created.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}
