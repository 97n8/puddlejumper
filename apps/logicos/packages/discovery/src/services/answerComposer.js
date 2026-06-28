'use strict';
require('dotenv').config();

const CONFIDENCE_THRESHOLD = 0.70;
const AI_TIMEOUT_MS = 8000;
const PJ_BASE_URL   = process.env.PJ_BASE_URL || 'http://localhost:3002';

async function callPJ(intent, rules, raw_query) {
  const res = await fetch(`${PJ_BASE_URL}/api/v1/assistant/ask`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ intent, rules, raw_query }),
  });
  if (!res.ok) throw new Error(`PJ responded ${res.status}`);
  const json = await res.json();
  return json.data || json;
}

function scoreConfidence(aiResult, rules, intent) {
  let score = 0.5;
  const citations = rules.map(r => r.source_citation).filter(Boolean);
  if (aiResult.citation && citations.some(c => aiResult.citation.includes(c))) score += 0.20;
  if (aiResult.plain && intent.case_type &&
      aiResult.plain.toLowerCase().includes(intent.case_type)) score += 0.15;
  if (aiResult.who_decides) score += 0.10;
  if (aiResult.next_step)   score += 0.05;
  return Math.min(score, 1.0);
}

function getCatchesFromRules(rules) {
  const all = rules.flatMap(r => JSON.parse(r.common_catches || '[]'));
  return [...new Set(all)].slice(0, 5);
}

function buildRulesOnlyAnswer(intent, rules) {
  if (!rules || rules.length === 0) {
    return {
      plain:       'We found your jurisdiction but could not locate specific rules for this request. Contact your town hall directly.',
      citation:    null,
      next_step:   'Contact the municipal office.',
      who_decides: null,
      common_catches:  [],
      answer_source:   'rules_only_no_match',
      confidence:      0,
    };
  }
  const primary = rules[0];
  const actions = JSON.parse(primary.actions || '[]');
  const requiresPermit = actions.some(a => a.type === 'require');
  return {
    plain: requiresPermit
      ? `Based on local rules, this project likely requires a ${actions[0]?.object || 'permit'}.`
      : 'Based on local rules, this project may not require a formal permit. Confirm with your local office.',
    citation:    primary.source_citation || null,
    next_step:   requiresPermit
      ? 'File the required application with your municipality.'
      : 'Confirm with your local office before proceeding.',
    who_decides:     null,
    common_catches:  getCatchesFromRules(rules),
    answer_source:   'rules_only',
    confidence:      0.50,
  };
}

async function compose({ intent, rules, raw_query }) {
  if (rules.length > 0) {
    try {
      const aiResult = await Promise.race([
        callPJ(intent, rules, raw_query),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), AI_TIMEOUT_MS)),
      ]);
      const confidence = scoreConfidence(aiResult, rules, intent);
      if (confidence >= CONFIDENCE_THRESHOLD) {
        return {
          ...aiResult,
          common_catches: getCatchesFromRules(rules),
          answer_source:  'ai_assisted',
          confidence,
        };
      }
      console.warn('[answerComposer] Low confidence:', confidence);
    } catch (err) {
      console.warn('[answerComposer] AI unavailable, using fallback:', err.message);
    }
  }
  return buildRulesOnlyAnswer(intent, rules);
}

module.exports = { compose };
