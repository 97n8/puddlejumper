'use strict';

function validateRule({ conditions, actions, common_catches, source_citation }) {
  const errors = [];

  if (!source_citation || typeof source_citation !== 'string' || !source_citation.trim()) {
    errors.push('source_citation must be a non-empty string.');
  }

  if (!Array.isArray(conditions)) {
    errors.push('conditions must be an array.');
  } else {
    for (const c of conditions) {
      if (!c.field || !c.operator || c.value === undefined) {
        errors.push(`Invalid condition: ${JSON.stringify(c)} — must have field, operator, value.`);
      }
    }
  }

  if (!Array.isArray(actions)) {
    errors.push('actions must be an array.');
  } else {
    for (const a of actions) {
      if (!a.type || !a.object) {
        errors.push(`Invalid action: ${JSON.stringify(a)} — must have type and object.`);
      }
    }
  }

  if (!Array.isArray(common_catches)) {
    errors.push('common_catches must be an array.');
  } else {
    if (common_catches.length > 5) errors.push('common_catches must have ≤5 entries.');
    for (const c of common_catches) {
      if (typeof c !== 'string') errors.push('Each common_catch must be a string.');
      else if (c.length > 150)  errors.push(`common_catch too long (max 150 chars): "${c.slice(0,30)}…"`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateRule };
