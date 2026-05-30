// @pj/pipeline — V1 synchronous pipeline skeleton (Issue #99, build step C1).
// Models the Input → State → Output → Proof → Retention spine and writes
// one Recordstream/audit proof per run via @pj/db's appendAuditEvent.

export { runPipeline } from './run.js';
export type { PipelineResult } from './run.js';

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
  seedGuestopsStay,
  GUESTOPS_STAY,
  PJRulePackNotFound,
} from './rulepack.js';
export type {
  RulePack,
  RulePackScope,
  SeedRulePackInput,
} from './rulepack.js';
