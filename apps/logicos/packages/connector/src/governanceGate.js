import { pjFetch } from './client.js';

const REJECTION_REASONS = [
  'JURISDICTION_MISMATCH',
  'INSUFFICIENT_AUTHORITY',
  'RULE_NOT_ACTIVE',
  'AI_CONFIDENCE_BELOW_THRESHOLD',
  'MISSING_REQUIRED_CONTEXT',
];

/**
 * 5-path rejection protocol.
 * Every rejection is logged to SEAL via the provided sealAppend callback.
 */
export async function checkGovernance({ package_id, jurisdiction_id, rule_ids = [], confidence = 1.0, actor, sealAppend }) {
  const rejections = [];

  if (!jurisdiction_id) rejections.push('JURISDICTION_MISMATCH');
  if (!actor || !actor.role) rejections.push('INSUFFICIENT_AUTHORITY');
  if (rule_ids.length === 0) rejections.push('RULE_NOT_ACTIVE');
  if (confidence < 0.70) rejections.push('AI_CONFIDENCE_BELOW_THRESHOLD');
  if (!package_id) rejections.push('MISSING_REQUIRED_CONTEXT');

  for (const reason of rejections) {
    if (typeof sealAppend === 'function') {
      await sealAppend({
        entry_type: 'governance_rejection',
        object_id:  package_id || 'unknown',
        actor:      actor?.id || 'system',
        actor_type: 'system',
        payload:    { reason, jurisdiction_id, rule_ids },
      });
    }
    console.warn(`[governanceGate] REJECTED: ${reason}`);
  }

  return { allowed: rejections.length === 0, rejections };
}
