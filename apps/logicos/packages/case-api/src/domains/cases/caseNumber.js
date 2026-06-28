'use strict';
const { queryAll } = require('../../db/adapter');

function generateCaseNumber(db, jurisdiction_id, slug) {
  const count = queryAll('SELECT id FROM cases WHERE jurisdiction_id = ?', [jurisdiction_id]).length;
  const seq   = String(count + 1).padStart(5, '0');
  const year  = new Date().getFullYear();
  return `${slug.toUpperCase()}-${year}-${seq}`;
}

module.exports = { generateCaseNumber };
