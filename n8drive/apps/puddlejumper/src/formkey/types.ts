import type { SealToken } from '../seal/types.js';

export type { SealToken };

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'multiselect' | 'file' | 'email' | 'textarea';
  required: boolean;
  order: number;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
    allowedValues?: string[];
    fileTypes?: string[];
    maxFileSizeMb?: number;
  };
  pii: boolean;
  sensitive: boolean;
  dlpExempt?: boolean;
  consentCovered: boolean;
  showIf?: { fieldId: string; value: unknown };
  outputPlaceholder?: string;
}

export interface ConsentConfig {
  required: boolean;
  consentText: string;
  consentVersion: string;
  expiryDays?: number;
  withdrawable?: boolean;
}

export interface VaultMapping {
  recordType: string;
  namespace: string;
  fieldMap: Record<string, string>;
  /** Hours until this form response is considered overdue (default: none) */
  slaHours?: number;
  /** When true, submission creates a review gate before the record is acted on */
  requiresApproval?: boolean;
  /** Org role required to approve — matched against OrgManager governance roles */
  approvalRole?: string;
  /** Recurring schedule for this form (annual filing, permit renewal, etc.) */
  recurrence?: 'once' | 'annual' | 'quarterly' | 'monthly';
}

export interface OutputConfig {
  templateId?: string;
  fieldBindings: Record<string, string>;
  includeConsentStamp?: boolean;
  includeSealToken?: boolean;
  includeRetentionTier?: boolean;
  pageSize?: string;
  orientation?: 'portrait' | 'landscape';
}

export interface AutomationTrigger {
  automationId: string;
  triggerEvent: 'on_submit' | 'on_submit_if';
  condition?: Record<string, unknown>;
  inputMapping?: Record<string, string>;
}

export interface FormDefinition {
  id: string;
  formId: string;
  tenantId: string;
  version: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'deprecated' | 'suspended_mismatch';
  purpose?: string;
  legalBasis?: 'legal_obligation' | 'public_task' | 'consent' | 'contract';
  retentionTier?: string;
  dataTypes?: string[];
  sensitivity: string;
  consentConfig: ConsentConfig;
  fields: FormField[];
  vaultMapping: VaultMapping;
  outputConfig?: OutputConfig;
  sealToken: SealToken | null;
  automationTrigger?: AutomationTrigger;
  createdAt: string;
  publishedAt?: string;
  deprecatedAt?: string;
}

export interface FormSubmissionPayload {
  submitterId: string;
  submitterType: string;
  fields: Record<string, unknown>;
  consentToken?: string;
  sourceSystem?: string;
  submittedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SubmissionResult {
  recordId: string;
  intakeSealToken: SealToken;
  submittedAt: string;
  retentionTier: string;
  consentVersion: string;
  /** Set when form requires approval — the review record ID */
  reviewId?: string;
  /** SLA deadline for response (ISO 8601) */
  slaDueAt?: string;
}

export interface ConsentRecord {
  id: string;
  tenantId: string;
  submitterId: string;
  formId: string;
  consentVersion: string;
  consentTextHash: string;
  grantedAt: string;
  expiresAt?: string;
  withdrawn: boolean;
  withdrawnAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConsentStamp {
  id: string;
  tenantId: string;
  formId: string;
  formVersion: string;
  submissionId: string;
  consentRecordId: string;
  intakeSealToken: SealToken;
  stampedAt: string;
}

export interface GovernanceEnvelope {
  purpose: string;
  legalBasis: string;
  retentionTier: string;
  sensitivity: string;
  dataTypes: string[];
  formId: string;
  formVersion: string;
  consentVersion: string;
  submittedAt: string;
  intakeSealToken: SealToken;
  consentStampId: string | null;
}

export type IntakeRecordStatus = 'received' | 'under_review' | 'responded' | 'closed';

export interface IntakeRecord {
  id: string;
  tenantId: string;
  formId: string;
  formVersion: string;
  recordType: string;
  namespace: string;
  governance: GovernanceEnvelope;
  fields: Record<string, unknown>;
  createdAt: string;
  // Lifecycle tracking
  status: IntakeRecordStatus;
  slaDueAt?: string;
  reviewedBy?: string;
  respondedAt?: string;
  closedAt?: string;
  reviewId?: string;
}

export interface FormKeyHealth {
  status: 'ok' | 'degraded' | 'error';
  formsRegistered: number;
  suspendedForms: number;
  intakeRecords?: number;
  submissionRateLimitPerMinute: number;
}

// Error classes
export class FormNotFound extends Error {
  constructor(formId: string) {
    super(`Form not found: ${formId}`);
    this.name = 'FormNotFound';
  }
}

export class FormNotAccepting extends Error {
  constructor(formId: string, status: string) {
    super(`Form '${formId}' is not accepting submissions (status: ${status})`);
    this.name = 'FormNotAccepting';
  }
}

export class FieldValidationFailed extends Error {
  public errors: Array<{ code: string; fieldId: string; [key: string]: unknown }>;
  constructor(errors: Array<{ code: string; fieldId: string; [key: string]: unknown }>) {
    super('Field validation failed');
    this.name = 'FieldValidationFailed';
    this.errors = errors;
  }
}

export class ConsentRequired extends Error {
  constructor(formId: string) {
    super(`Consent is required for form: ${formId}`);
    this.name = 'ConsentRequired';
  }
}

export class OutputNotConfigured extends Error {
  constructor(formId: string) {
    super(`Output not configured for form: ${formId}`);
    this.name = 'OutputNotConfigured';
  }
}

export class RecordNotFound extends Error {
  constructor(recordId: string) {
    super(`Record not found: ${recordId}`);
    this.name = 'RecordNotFound';
  }
}

export class IntakeSealInvalid extends Error {
  constructor(reason?: string) {
    super(`Intake SEAL is invalid${reason ? ': ' + reason : ''}`);
    this.name = 'IntakeSealInvalid';
  }
}
