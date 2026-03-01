export type SyncJobStatus =
  | 'queued'
  | 'running'
  | 'transforming'
  | 'writing'
  | 'delivering'
  | 'completed'
  | 'partial'
  | 'failed';

export type FeedStatus = 'draft' | 'active' | 'paused' | 'retired';

export type TransformFn =
  | { type: 'trim' }
  | { type: 'lowercase' }
  | { type: 'uppercase' }
  | { type: 'date-iso' }
  | { type: 'map-value'; mapping: Record<string, string> }
  | { type: 'concat'; fields: string[]; separator?: string }
  | { type: 'extract-domain' };

export interface FilterRule {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'not-contains' | 'exists' | 'not-exists' | 'gt' | 'lt';
  value?: unknown;
}

export interface FieldMapDef {
  sourceField: string;
  targetField: string;
  transform?: TransformFn;
  required?: boolean;
  piiClass?: string;
}

export interface FederationField {
  value: unknown;
  piiClass?: string;
  masked?: boolean;
}

export interface DlpFinding {
  field: string;
  entityType: string;
  confidence: 'low' | 'medium' | 'high';
  masked?: boolean;
}

export interface FederationRecord {
  recordId: string;
  feedId: string;
  tenantId: string;
  externalId: string;
  sourceConnectorId: string;
  sourceUpdatedAt: string;
  fields: Record<string, FederationField>;
  raw?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SourceConnectorDef {
  connectorId: string;
  type: 'monday' | 'polimorphic' | 'salesforce';
  config: Record<string, unknown>;
}

export interface SinkConnectorDef {
  connectorId: string;
  type: 'powerbi' | 'kahana';
  config: Record<string, unknown>;
}

export interface SyncConfig {
  batchSize?: number;
  scheduleExpression?: string; // e.g. "*/15 * * * *" (cron-like, parsed manually)
  filterRules?: FilterRule[];
  dlpInboundAction?: 'mask' | 'redact' | 'block';
  dlpOutboundAction?: 'mask' | 'redact' | 'block';
}

export interface FeedDef {
  feedId: string;
  tenantId: string;
  displayName: string;
  status: FeedStatus;
  source: SourceConnectorDef;
  sinks: SinkConnectorDef[];
  fieldMap: FieldMapDef[];
  syncConfig: SyncConfig;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
}

export interface SyncJobStats {
  ingested: number;
  updated: number;
  skipped: number;
  blocked: number;
  transformErrors: number;
  delivered: number;
  deliveryFailed: number;
}

export interface SyncJob {
  jobId: string;
  feedId: string;
  tenantId: string;
  status: SyncJobStatus;
  triggerType: 'manual' | 'scheduled' | 'webhook';
  startedAt: string;
  completedAt?: string;
  stats: SyncJobStats;
  cursor?: string;
  error?: { message: string; code?: string };
}

export interface ConnectorMetadata {
  type: string;
  displayName: string;
  direction: 'source' | 'sink' | 'both';
  description: string;
  configSchema: Record<string, unknown>;
}

export interface SyncronateDashboard {
  activeFeeds: number;
  jobsToday: number;
  recordsIngested: number;
  dlpBlocks: number;
  recentJobs: SyncJob[];
}

export interface TransformError {
  field: string;
  message: string;
}
