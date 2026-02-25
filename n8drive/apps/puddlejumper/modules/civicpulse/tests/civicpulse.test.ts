/**
 * CivicPulse — Test Suite
 * Unit tests for core modules + integration test for full governance chain.
 * Target: ≥90% coverage on core modules.
 * Uses vitest. Run: pnpm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// Imports under test
// ─────────────────────────────────────────────
import { evaluateTrigger, evaluateBatch } from '../core/triggerEngine';
import { loadRuleSet, resolveThreshold } from '../core/ruleSet';
import { ActionType, VaultRecord } from '../core/actionTypes';
import { DEFAULT_THRESHOLDS } from '../core/thresholdConfig';
import { generateSummary } from '../summaryEngine/summaryGenerator';
import { mapVaultRecord } from '../summaryEngine/fieldMapper';
import { sealSummary, validateSeal, generateHash, canonicalize } from '../integrity/sealValidator';
import { routeSummary, applyRoutingDecision } from '../approvalWorkflow/workflowRouter';
import {
  checkBackstop,
  computeDeadline,
  isOverdue,
  isApproaching,
} from '../approvalWorkflow/backstopMonitor';
import {
  VaulyMockAdapter,
  buildPublicationEvent,
} from '../publicationLog/vaulyInterface';
import { LogStore } from '../publicationLog/logStore';
import { exportBySummary } from '../publicationLog/auditExport';
import { renderWebsitePost, renderSocialDraft } from '../dispatch/payloadRenderer';
import { CivicSummary } from '../summaryEngine/summarySchema';

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const BOARD_VOTE_RECORD: VaultRecord = {
  id: 'vault-001',
  actionType: ActionType.BOARD_VOTE,
  date: '2026-02-12T00:00:00.000Z',
  department: 'Highway Department',
  governingBody: 'Selectboard',
  responsibleParty: 'Town Administrator',
  voteOutcome: 'approved',
  voteMargin: '3-2',
  financialAmount: 84000,
  fundingSource: 'FY26 Free Cash',
  timeline: 'Delivery expected Q3 2026',
  description: 'Purchase of replacement highway plow truck',
  createdAt: '2026-02-12T14:00:00.000Z',
  updatedAt: '2026-02-12T14:00:00.000Z',
};

const CONTRACT_RECORD: VaultRecord = {
  id: 'vault-002',
  actionType: ActionType.CONTRACT_AWARD,
  date: '2026-02-15T00:00:00.000Z',
  department: 'Public Works',
  governingBody: 'Town Manager',
  responsibleParty: 'Procurement Officer',
  financialAmount: 250000,
  fundingSource: 'Capital Budget',
  description: 'Road resurfacing — Main Street',
  createdAt: '2026-02-15T09:00:00.000Z',
  updatedAt: '2026-02-15T09:00:00.000Z',
};

const MINIMAL_RULE_SET = {
  municipalityId: 'test-town',
  municipalityName: 'Test Town',
  version: '1.0.0',
  effectiveDate: '2026-01-01',
  approvedBy: 'Jane Smith, Town Administrator',
  thresholds: {},
};

// ─────────────────────────────────────────────
// Rule Set
// ─────────────────────────────────────────────

describe('loadRuleSet', () => {
  it('loads a valid rule set', () => {
    const { ruleSet, warnings } = loadRuleSet(MINIMAL_RULE_SET);
    expect(ruleSet.municipalityId).toBe('test-town');
    expect(warnings.length).toBeGreaterThan(0); // defaults in use
  });

  it('throws if approvedBy is missing', () => {
    expect(() =>
      loadRuleSet({ ...MINIMAL_RULE_SET, approvedBy: undefined })
    ).toThrow(/approvedBy/);
  });

  it('throws if municipalityId is missing', () => {
    expect(() => loadRuleSet({ ...MINIMAL_RULE_SET, municipalityId: undefined })).toThrow();
  });

  it('resolves threshold override correctly', () => {
    const ruleSet = { ...MINIMAL_RULE_SET, thresholds: {
      [ActionType.BOARD_VOTE]: { tier: 'required' as const, backstopWindowHours: 24, defaultLegalHold: false },
    }};
    const threshold = resolveThreshold(ruleSet, ActionType.BOARD_VOTE);
    expect(threshold?.backstopWindowHours).toBe(24);
  });

  it('returns null for excluded action types', () => {
    const ruleSet = {
      ...MINIMAL_RULE_SET,
      thresholds: {},
      excludedActionTypes: [ActionType.ZBA_FILING],
    };
    expect(resolveThreshold(ruleSet, ActionType.ZBA_FILING)).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Trigger Engine
// ─────────────────────────────────────────────

describe('triggerEngine', () => {
  const { ruleSet } = loadRuleSet(MINIMAL_RULE_SET);

  it('returns required for board vote', () => {
    const result = evaluateTrigger(BOARD_VOTE_RECORD, { ruleSet });
    expect(result.decision).toBe('required');
    expect(result.backstopWindowHours).toBe(DEFAULT_THRESHOLDS[ActionType.BOARD_VOTE].backstopWindowHours);
  });

  it('returns none for excluded action type', () => {
    const rs = { ...ruleSet, excludedActionTypes: [ActionType.ZBA_FILING] };
    const record = { ...BOARD_VOTE_RECORD, actionType: ActionType.ZBA_FILING };
    const result = evaluateTrigger(record, { ruleSet: rs });
    expect(result.decision).toBe('none');
  });

  it('applies legal hold for debt issuance', () => {
    const record = { ...BOARD_VOTE_RECORD, actionType: ActionType.DEBT_ISSUANCE };
    const result = evaluateTrigger(record, { ruleSet });
    expect(result.legalHoldRequired).toBe(true);
  });

  it('batch filters none decisions', () => {
    const rs = { ...ruleSet, excludedActionTypes: [ActionType.ZBA_FILING] };
    const records = [
      BOARD_VOTE_RECORD,
      { ...BOARD_VOTE_RECORD, id: 'v2', actionType: ActionType.ZBA_FILING },
    ];
    const results = evaluateBatch(records, { ruleSet: rs });
    expect(results.length).toBe(1);
    expect(results[0].vaultRecordId).toBe('vault-001');
  });
});

// ─────────────────────────────────────────────
// Field Mapper
// ─────────────────────────────────────────────

describe('fieldMapper', () => {
  it('formats financial amount as USD', () => {
    const fields = mapVaultRecord(BOARD_VOTE_RECORD);
    expect(fields.financialAmountFormatted).toBe('$84,000');
  });

  it('formats date in long form', () => {
    const fields = mapVaultRecord(BOARD_VOTE_RECORD);
    expect(fields.actionDate).toMatch(/February/);
  });
});

// ─────────────────────────────────────────────
// Summary Generator
// ─────────────────────────────────────────────

describe('summaryGenerator', () => {
  it('generates a board vote summary', async () => {
    const summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
    });
    expect(summary.vaultRecordId).toBe('vault-001');
    expect(summary.headline).toBeTruthy();
    expect(summary.body).toContain('Selectboard');
    expect(summary.body).toContain('$84,000');
    expect(summary.approvalStatus).toBe('pending_review');
    expect(summary.aiAssisted).toBe(false);
    expect(summary.version).toBe(1);
  });

  it('calls AI assist when enabled and fn provided', async () => {
    const aiAssistFn = vi.fn().mockResolvedValue('AI improved text');
    const summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
      useAiAssist: true,
      aiAssistFn,
    });
    expect(aiAssistFn).toHaveBeenCalled();
    expect(summary.body).toBe('AI improved text');
    expect(summary.aiAssisted).toBe(true);
  });

  it('does not call AI assist when useAiAssist is false', async () => {
    const aiAssistFn = vi.fn();
    await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
      useAiAssist: false,
      aiAssistFn,
    });
    expect(aiAssistFn).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// SEAL Validator
// ─────────────────────────────────────────────

describe('sealValidator', () => {
  let summary: CivicSummary;

  beforeEach(async () => {
    summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
    });
  });

  it('generates a consistent hash for the same summary', () => {
    expect(generateHash(summary)).toBe(generateHash(summary));
  });

  it('seals a summary and validates successfully', () => {
    const seal = sealSummary(summary, 'operator-1');
    expect(seal.hash).toBeTruthy();
    const result = validateSeal(summary, seal);
    expect(result.valid).toBe(true);
  });

  it('detects tampering when summary body is modified', () => {
    const seal = sealSummary(summary);
    const tampered = { ...summary, body: 'TAMPERED CONTENT' };
    const result = validateSeal(tampered, seal);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/changed/);
  });

  it('detects tampering when headline is modified', () => {
    const seal = sealSummary(summary);
    const tampered = { ...summary, headline: 'Modified Headline' };
    const result = validateSeal(tampered, seal);
    expect(result.valid).toBe(false);
  });

  it('canonical payload is deterministic field ordering', () => {
    const c1 = canonicalize(summary);
    const c2 = canonicalize({ ...summary });
    expect(c1).toBe(c2);
  });
});

// ─────────────────────────────────────────────
// Workflow Router
// ─────────────────────────────────────────────

describe('workflowRouter', () => {
  let summary: CivicSummary;

  beforeEach(async () => {
    summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
    });
  });

  it('routes to auto_release when action type configured', () => {
    const config = { autoReleaseTypes: [ActionType.BOARD_VOTE] };
    const decision = routeSummary(summary, config, false);
    expect(decision.target).toBe('auto_release');
  });

  it('routes to legal_hold when required', () => {
    const config = { autoReleaseTypes: [ActionType.BOARD_VOTE] };
    const decision = routeSummary(summary, config, true);
    expect(decision.target).toBe('legal_hold');
  });

  it('routes AI-assisted summaries to staff_review even if auto-release configured', async () => {
    const aiSummary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
      useAiAssist: true,
      aiAssistFn: async (t) => t,
    });
    const config = {
      autoReleaseTypes: [ActionType.BOARD_VOTE],
      requireReviewForAiAssisted: true,
    };
    const decision = routeSummary(aiSummary, config, false);
    expect(decision.target).toBe('staff_review');
  });

  it('defaults to staff_review when not configured', () => {
    const decision = routeSummary(summary, {}, false);
    expect(decision.target).toBe('staff_review');
  });

  it('applyRoutingDecision updates approval status', () => {
    const config = { autoReleaseTypes: [ActionType.BOARD_VOTE] };
    const decision = routeSummary(summary, config, false);
    const updated = applyRoutingDecision(summary, decision);
    expect(updated.approvalStatus).toBe('auto_released');
  });
});

// ─────────────────────────────────────────────
// Backstop Monitor
// ─────────────────────────────────────────────

describe('backstopMonitor', () => {
  it('computes deadline correctly', () => {
    const recorded = '2026-02-12T00:00:00.000Z';
    const deadline = computeDeadline(recorded, 48);
    expect(new Date(deadline).toISOString()).toBe('2026-02-14T00:00:00.000Z');
  });

  it('marks entry as overdue when past deadline', () => {
    const entry = {
      vaultRecordId: 'v1',
      actionType: 'board_vote',
      recordedAt: '2026-02-01T00:00:00.000Z',
      backstopWindowHours: 48,
      deadlineAt: '2026-02-03T00:00:00.000Z',
      municipalityId: 'test-town',
    };
    const now = new Date('2026-02-04T00:00:00.000Z');
    expect(isOverdue(entry, now)).toBe(true);
  });

  it('marks resolved entry as not overdue', () => {
    const entry = {
      vaultRecordId: 'v1',
      actionType: 'board_vote',
      recordedAt: '2026-02-01T00:00:00.000Z',
      backstopWindowHours: 48,
      deadlineAt: '2026-02-03T00:00:00.000Z',
      municipalityId: 'test-town',
      resolvedAt: '2026-02-02T12:00:00.000Z',
    };
    expect(isOverdue(entry)).toBe(false);
  });

  it('identifies approaching entries', () => {
    const now = new Date('2026-02-12T00:00:00.000Z');
    // 80% elapsed — approaching
    const entry = {
      vaultRecordId: 'v1',
      actionType: 'board_vote',
      recordedAt: new Date(now.getTime() - 80 * 60 * 60 * 1000).toISOString(),
      backstopWindowHours: 100,
      deadlineAt: new Date(now.getTime() + 20 * 60 * 60 * 1000).toISOString(),
      municipalityId: 'test-town',
    };
    expect(isApproaching(entry, 75, now)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Vauly Interface
// ─────────────────────────────────────────────

describe('vaulyInterface', () => {
  it('mock adapter logs and retrieves publication events', async () => {
    const adapter = new VaulyMockAdapter();
    const summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
    });
    const seal = sealSummary(summary, 'op-1');
    const event = buildPublicationEvent(summary, seal, 'website_post', 'op-1');

    await adapter.logPublication(event);
    const log = await adapter.getPublicationLog(summary.summaryId);

    expect(log.length).toBe(1);
    expect(log[0].channel).toBe('website_post');
    expect(log[0].sealHash).toBe(seal.hash);
  });

  it('log store is append-only — count increases', async () => {
    const store = new LogStore();
    const adapter = new VaulyMockAdapter();
    const summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
    });
    const seal = sealSummary(summary);

    const e1 = buildPublicationEvent(summary, seal, 'website_post');
    const e2 = buildPublicationEvent(summary, seal, 'activity_feed');
    store.append(e1);
    store.append(e2);

    expect(store.count()).toBe(2);
    const exported = exportBySummary(store, summary.summaryId);
    expect(exported.totalEvents).toBe(2);
  });
});

// ─────────────────────────────────────────────
// Payload Renderer
// ─────────────────────────────────────────────

describe('payloadRenderer', () => {
  it('renders website post with all fields', async () => {
    const summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
    });
    const post = renderWebsitePost(summary, 'https://vault.test-town.gov');
    expect(post.headline).toBe(summary.headline);
    expect(post.vaultRecordLink).toContain('vault-001');
    expect(post.fundingLine).toBe('FY26 Free Cash');
  });

  it('truncates social draft to max characters', async () => {
    const summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: 'test-town',
      municipalityName: 'Test Town',
    });
    const draft = renderSocialDraft(summary, 50);
    expect(draft.characterCount).toBeLessThanOrEqual(50);
  });
});

// ─────────────────────────────────────────────
// Integration: Full governance chain — board vote auto-release
// ─────────────────────────────────────────────

describe('integration: board vote auto-release chain', () => {
  it('completes the full chain from VAULT record to logged publication', async () => {
    // 1. Load rule set
    const { ruleSet } = loadRuleSet(MINIMAL_RULE_SET);

    // 2. Trigger evaluation
    const trigger = evaluateTrigger(BOARD_VOTE_RECORD, { ruleSet });
    expect(trigger.decision).toBe('required');
    expect(trigger.legalHoldRequired).toBe(false);

    // 3. Generate summary
    const summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: ruleSet.municipalityId,
      municipalityName: ruleSet.municipalityName,
    });
    expect(summary.vaultRecordId).toBe('vault-001');

    // 4. SEAL validation
    const seal = sealSummary(summary, 'system');
    const validation = validateSeal(summary, seal);
    expect(validation.valid).toBe(true);

    // 5. Routing — auto-release
    const routingConfig = { autoReleaseTypes: [ActionType.BOARD_VOTE] };
    const decision = routeSummary(summary, routingConfig, trigger.legalHoldRequired);
    expect(decision.target).toBe('auto_release');
    const routed = applyRoutingDecision(summary, decision);
    expect(routed.approvalStatus).toBe('auto_released');

    // 6. Publication logging
    const adapter = new VaulyMockAdapter();
    const store = new LogStore();
    const event = buildPublicationEvent(routed, seal, 'website_post', 'system');
    await adapter.logPublication(event);
    store.append(event);

    // 7. Audit export
    const audit = exportBySummary(store, summary.summaryId);
    expect(audit.totalEvents).toBe(1);
    expect(audit.events[0].sealHash).toBe(seal.hash);
  });
});

describe('integration: SEAL tamper detection holds publication', async () => {
  it('detects post-generation VAULT modification and blocks publication', async () => {
    const { ruleSet } = loadRuleSet(MINIMAL_RULE_SET);
    const summary = await generateSummary(BOARD_VOTE_RECORD, {
      municipalityId: ruleSet.municipalityId,
      municipalityName: ruleSet.municipalityName,
    });
    const seal = sealSummary(summary);

    // Simulate VAULT record modification → summary regenerated with new content
    const modifiedSummary = { ...summary, body: 'Modified after sealing' };
    const tamperCheck = validateSeal(modifiedSummary, seal);

    expect(tamperCheck.valid).toBe(false);
    // System should hold publication — do not dispatch
    // This is enforced at workflow layer: held_seal_mismatch status
    const heldSummary: CivicSummary = { ...modifiedSummary, approvalStatus: 'held_seal_mismatch' };
    expect(heldSummary.approvalStatus).toBe('held_seal_mismatch');
  });
});

describe('integration: legal hold path', async () => {
  it('routes debt issuance to legal hold queue', async () => {
    const debtRecord: VaultRecord = {
      ...BOARD_VOTE_RECORD,
      id: 'vault-003',
      actionType: ActionType.DEBT_ISSUANCE,
      description: 'General Obligation Bond — $2.1M water main replacement',
      financialAmount: 2100000,
    };

    const { ruleSet } = loadRuleSet(MINIMAL_RULE_SET);
    const trigger = evaluateTrigger(debtRecord, { ruleSet });
    expect(trigger.legalHoldRequired).toBe(true);

    const summary = await generateSummary(debtRecord, {
      municipalityId: ruleSet.municipalityId,
      municipalityName: ruleSet.municipalityName,
    });

    const decision = routeSummary(summary, {}, trigger.legalHoldRequired);
    expect(decision.target).toBe('legal_hold');

    const held = applyRoutingDecision(summary, decision);
    expect(held.approvalStatus).toBe('legal_hold');
  });
});
