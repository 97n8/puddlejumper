// @pj/pipeline — V1 synchronous pipeline skeleton (Issue #99, build step C1).
// Models the Input → State → Output → Proof → Retention spine and writes
// one Recordstream/audit proof per run via @pj/db's appendAuditEvent.

export { runPipeline } from './run.js';
export type { PipelineResult, RunOptions, StopStage } from './run.js';

export {
  checkSubstance,
  defaultSubstanceChecker,
} from './substance.js';
export type { SubstanceResult, SubstanceChecker } from './substance.js';

export { checkAccess, openAccessEvaluator } from './access.js';
export type { AccessRequest, AccessResult, AccessEvaluator } from './access.js';

export {
  generateOutput,
  seedOutputTemplate,
  findOutputTemplate,
  GUEST_ARRIVAL_BRIEF,
  TIMESHEET_REVIEW_SUMMARY,
  EXPENSE_RECEIPT_REVIEW_PACKET,
} from './output.js';
export type {
  TemplateBinding,
  TemplateBody,
  SeedTemplateInput,
  OutputScope,
  RenderedField,
  OutputResult,
} from './output.js';

export {
  PIPELINE_STAGES,
  buildStages,
} from './stages.js';
export type {
  PipelineStage,
  StageOutcome,
  StageResult,
  StageFn,
  PipelineInput,
  PipelineContext,
} from './stages.js';

export {
  resolveActiveRulePack,
  findActiveRulePack,
  seedRulePack,
  seedTriadPack,
  seedGuestopsStay,
  seedTimedeskMuni,
  seedFinanceBiz,
  GUESTOPS_STAY,
  TIMEDESK_MUNI,
  FINANCE_BIZ,
  PJRulePackNotFound,
} from './rulepack.js';
export type {
  RulePack,
  RulePackScope,
  SeedRulePackInput,
} from './rulepack.js';

export { enrichItem, ENRICHED_PACKS } from './enrichment.js';
export type { EnrichmentAnchor, EnrichmentResult } from './enrichment.js';

export { decideVault, AUTONOMY_LADDER } from './vault.js';
export type {
  AutonomyLevel,
  ActionVerdict,
  ActionSpec,
  ActionDecision,
  VaultDecision,
} from './vault.js';

export { persistDecision, resolveHold, PJHoldNotResolvable } from './state.js';
export type {
  PersistScope,
  PersistResult,
  ActionStateOutcome,
  ResolveHoldResult,
} from './state.js';
