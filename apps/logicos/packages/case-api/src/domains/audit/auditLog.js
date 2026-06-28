'use strict';
const { appendEntry } = require('seal');

function appendCaseAction(db, { case_id, action_type, actor, actor_type, payload }) {
  return appendEntry(db, {
    entry_type: 'case_action',
    object_id:  case_id,
    actor,
    actor_type,
    payload:    { action_type, ...payload },
  });
}

function appendStageChange(db, { case_id, from_stage, to_stage, actor }) {
  return appendEntry(db, {
    entry_type: 'stage_change',
    object_id:  case_id,
    actor,
    actor_type: 'staff',
    payload:    { from_stage, to_stage },
  });
}

function appendEntityLookup(db, { case_id, entity_id }) {
  return appendEntry(db, {
    entry_type: 'entity_lookup',
    object_id:  case_id,
    actor:      entity_id,
    actor_type: 'entity',
    payload:    { case_id, entity_id },
  });
}

function appendAICall(db, { package_id, actor, jurisdiction_id }) {
  return appendEntry(db, {
    entry_type: 'ai_call',
    object_id:  package_id,
    actor,
    actor_type: 'ai',
    payload:    { package_id, jurisdiction_id },
  });
}

function appendRulePublish(db, { rule_id, jurisdiction_id, actor }) {
  return appendEntry(db, {
    entry_type: 'rule_publish',
    object_id:  rule_id,
    actor,
    actor_type: 'staff',
    payload:    { rule_id, jurisdiction_id },
  });
}

function appendCaseSpaceResolution(db, {
  requested_id,
  outcome,
  actor,
  actor_type,
  request_scope,
  jurisdiction_id,
}) {
  return appendEntry(db, {
    entry_type: `casespace_resolution_${outcome}`,
    object_id: requested_id,
    actor: actor || 'anonymous',
    actor_type,
    payload: {
      requested_id,
      outcome,
      request_scope: request_scope || null,
      jurisdiction_id: jurisdiction_id || null,
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = {
  appendCaseAction,
  appendStageChange,
  appendEntityLookup,
  appendAICall,
  appendRulePublish,
  appendCaseSpaceResolution,
};
