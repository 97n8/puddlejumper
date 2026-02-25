// CivicPulse — public API surface
// All external consumers should import from this file only.

export { ActionType, type VaultRecord } from './core/actionTypes.js';
export { DEFAULT_THRESHOLDS, type Threshold } from './core/thresholdConfig.js';
export { loadRuleSet, resolveThreshold, type RuleSet } from './core/ruleSet.js';
export { evaluateTrigger, evaluateBatch, type TriggerResult } from './core/triggerEngine.js';

export { type CivicSummary, type ApprovalStatus } from './summaryEngine/summarySchema.js';
export { mapVaultRecord, type MappedFields } from './summaryEngine/fieldMapper.js';
export { generateSummary, type SummaryOptions } from './summaryEngine/summaryGenerator.js';

export {
  sealSummary,
  validateSeal,
  generateHash,
  canonicalize,
  type Seal,
  type SealValidationResult,
} from './integrity/sealValidator.js';
export { incrementVersion } from './integrity/versionManager.js';
export { buildRecordReference, recordLink } from './integrity/recordReference.js';

export {
  routeSummary,
  applyRoutingDecision,
  type RoutingConfig,
  type RoutingDecision,
} from './approvalWorkflow/workflowRouter.js';
export {
  checkBackstop,
  computeDeadline,
  isOverdue,
  isApproaching,
  type BackstopEntry,
  type EscalationConfig,
} from './approvalWorkflow/backstopMonitor.js';
export { ApprovalQueue } from './approvalWorkflow/approvalQueue.js';
export { LegalHoldQueue } from './approvalWorkflow/legalHoldQueue.js';

export { renderWebsitePost, renderSocialDraft } from './dispatch/payloadRenderer.js';

export {
  VaulyMockAdapter,
  buildPublicationEvent,
  type PublicationEvent,
  type VaulyAdapter,
} from './publicationLog/vaulyInterface.js';
export { LogStore } from './publicationLog/logStore.js';
export { exportBySummary, type AuditExport } from './publicationLog/auditExport.js';

export { validateGates, REQUIRED_GATES } from './config/deploymentManifest.js';
export { RuleSetVersionRegistry } from './config/ruleSetVersioning.js';
