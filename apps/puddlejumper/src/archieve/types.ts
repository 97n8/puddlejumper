export type ArchieveSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface ArchieveActor {
  userId: string;
  role: string;
  sessionId: string;
  ip?: string;
}

export interface ArchieveEvent {
  // Required by caller
  requestId: string;
  tenantId: string;
  module: string;
  eventType: string;
  actor: ArchieveActor;
  timestamp?: string; // ISO 8601 UTC — injected if not provided
  severity: ArchieveSeverity;
  data: Record<string, unknown>;
  // Injected by archieve.log()
  eventId?: string;
  chainPos?: number;
  hash?: string;
  prevHash?: string;
  hmac?: string;
}

export interface WALQueueEntry {
  rowid?: number;
  event_id: string;
  tenant_id: string;
  event_type: string;
  event_json: string;
  queued_at: string;
  delivery_attempts: number;
  last_attempt_at?: string;
}

export interface DeliveredEntry {
  rowid?: number;
  event_id: string;
  tenant_id: string;
  event_type: string;
  chain_pos: number;
  hash: string;
  delivered_at: string;
  event_json: string;
}

export interface NotarizationRecord {
  date: string;
  chainHead: string;
  rootHash: string;
  tsaToken: string; // base64url DER-encoded
  tsaUrl: string;
}

export interface ChainVerificationResult {
  result: 'CHAIN_VALID' | 'CHAIN_VIOLATION';
  eventsVerified?: number;
  chainHead?: string;
  headHash?: string;
  eventId?: string;
  chainPos?: number;
  reason?: string;
  expectedHash?: string;
  foundHash?: string;
  expectedPrevHash?: string;
  foundPrevHash?: string;
}

export class ArchieveError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ArchieveError';
  }
}

export const ARCHIEVE_INVALID_EVENT = 'ARCHIEVE_INVALID_EVENT';
export const ARCHIEVE_KMS_UNAVAILABLE = 'ARCHIEVE_KMS_UNAVAILABLE';
export const ARCHIEVE_WAL_WRITE_FAILED = 'ARCHIEVE_WAL_WRITE_FAILED';
export const ARCHIEVE_QUEUE_FULL = 'ARCHIEVE_QUEUE_FULL';
