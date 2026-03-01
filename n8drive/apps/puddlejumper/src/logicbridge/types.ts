// LOGICBRIDGE — Type Definitions

export type ConnectorStatus =
  | 'draft'
  | 'validated'
  | 'simulated'
  | 'published'
  | 'deprecated'
  | 'suspended_mismatch';

export type RegistryStatus = 'active' | 'deprecated' | 'suspended_mismatch';

export interface SealToken {
  signature: string;
  keyId: string;
  signedAt: string;
  handlerHash: string;
  callerModule: string;
  callerContext: string;
}

export interface PolicySimResult {
  passed: boolean;
  ranAt: string;
  durationMs: number;
  dlpFindings: Array<{ field: string; entityType: string; confidence: string }>;
  detectedCapabilities: string[];
  declaredCapabilities: string[];
  capabilityMismatch: boolean;
  error?: string;
}

export interface ConnectorDefinition {
  id: string;
  tenantId: string;
  name: string;
  version: string;
  status: ConnectorStatus;
  handlerEncrypted: string | null;
  handlerHash: string | null;
  sealToken: SealToken | null;
  capabilities: string[];
  dataTypes: string[];
  allowedProfiles: string[];
  samplePayload: Record<string, unknown> | null;
  simResult: PolicySimResult | null;
  residencyAttestation: string | null;
  metadata: {
    name?: string;
    description?: string;
    author?: string;
    tags?: string[];
    baseUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
  supersededBy: string | null;
}

export interface ConnectorRegistryEntry {
  connectorId: string;
  displayName: string;
  version: string;
  provider: 'logicbridge';
  tenantId: string;
  status: RegistryStatus;
  capabilities: string[];
  dataTypes: string[];
  allowedProfiles: string[];
  handlerHash: string;
  sealToken: SealToken;
  sourceDefinitionId: string;
  publishedAt: string;
  registeredAt: string;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureAt: number;
  open: boolean;
}

export interface LogicBridgeHealth {
  status: 'ok' | 'degraded' | 'error';
  connectorsRegistered: number;
  suspendedConnectors: number;
  sandboxPoolSize: number;
  sandboxAvailable: number;
}

export interface ExecuteRequest {
  payload: Record<string, unknown>;
  profileId?: string;
  userId?: string;
}

export interface ExecuteResult {
  success: boolean;
  output: unknown;
  durationMs: number;
  dlpFindings?: Array<{ field: string; entityType: string; confidence: string }>;
  sealToken?: SealToken;
  error?: string;
}
