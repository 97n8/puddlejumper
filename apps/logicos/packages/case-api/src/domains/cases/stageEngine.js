'use strict';
const { queryOne, queryAll, queryRun } = require('../../db/adapter');
const { appendStageChange } = require('../audit/auditLog');

function validateAdvance(db, { case_id, from_stage, to_stage, actor_id, authority_basis }) {
  const caseRow = queryOne('SELECT * FROM cases WHERE id = ?', [case_id]);
  if (!caseRow) return { allowed: false, reason: 'Case not found.' };

  if (from_stage === 'RECEIVES' && to_stage === 'OPENS') {
    if (!caseRow.side_a_owner) return { allowed: false, reason: 'Case must have an assigned owner before opening.' };
  } else if (from_stage === 'OPENS' && to_stage === 'WORKS') {
    const obls = queryAll('SELECT id FROM obligations WHERE case_id = ?', [case_id]);
    if (obls.length === 0) return { allowed: false, reason: 'At least one obligation must exist before work begins.' };
    if (!authority_basis) return { allowed: false, reason: 'authority_basis is required.' };
  } else if (from_stage === 'WORKS' && to_stage === 'DECIDES') {
    const pending = queryAll(
      `SELECT id FROM obligations WHERE case_id = ? AND assigned_side = 'B' AND status != 'fulfilled'`,
      [case_id]
    );
    if (pending.length > 0) return { allowed: false, reason: 'All Side B obligations must be fulfilled.' };
    if (!authority_basis) return { allowed: false, reason: 'authority_basis is required.' };
  } else if (from_stage === 'DECIDES' && to_stage === 'RECORDS') {
    const decisions = queryAll(
      `SELECT id FROM case_actions WHERE case_id = ? AND action_type IN ('approval','denial')`,
      [case_id]
    );
    if (decisions.length === 0) return { allowed: false, reason: 'A decision action (approval/denial) must exist.' };
  } else if (from_stage === 'RECORDS' && to_stage === 'NOTIFIES') {
    const sealEntry = queryOne(
      `SELECT id FROM seal_entries WHERE entry_type = 'case_action' AND object_id = ?`,
      [case_id]
    );
    if (!sealEntry) return { allowed: false, reason: 'SEAL must contain a case_action entry for this case.' };
  } else if (from_stage === 'NOTIFIES' && to_stage === 'ARCHIVES') {
    const sent = queryOne(
      `SELECT id FROM pulse_tasks WHERE case_id = ? AND sent_at IS NOT NULL`,
      [case_id]
    );
    if (!sent) return { allowed: false, reason: 'At least one pulse task must have been sent.' };
  } else if (from_stage === 'ARCHIVES' && to_stage === 'LEARNS') {
    if (actor_id !== 'system') return { allowed: false, reason: 'LEARNS stage can only be set by system.' };
  }

  // Advance approved
  const now = new Date().toISOString();
  queryRun('UPDATE cases SET stage = ?, updated_at = ? WHERE id = ?', [to_stage, now, case_id]);
  appendStageChange(db, { case_id, from_stage, to_stage, actor: actor_id });

  return { allowed: true };
}

module.exports = { validateAdvance };
