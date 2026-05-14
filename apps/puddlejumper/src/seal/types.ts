export interface SealToken {
  artifactHash: string;    // SHA-256 hex, 64 chars lowercase
  signature: string;       // base64url DER ECDSA-P256 signature
  algorithm: 'ECDSA-P256';
  keyId: string;           // esk-{tenantId}-v{version}
  tenantId: string;
  signedAt: string;        // ISO 8601 UTC
  tsaToken?: string;       // base64url RFC 3161 DER (when requested)
  tsaUrl?: string;         // TSA endpoint used (present when tsaToken set)
  handlerHash?: string;    // LOGICBRIDGE use: SHA-256 of handler plaintext
  intakeFields?: string[]; // FormKey/CaseSpace use: field names covered
}

export interface VerificationResult {
  valid: boolean;
  reason?: 'hash_mismatch' | 'signature_invalid' | 'key_not_found' | 'algorithm_unsupported' | 'token_malformed' | 'tsa_invalid';
  keyId: string;
  tenantId: string;
  signedAt: string;
  tsaVerified: boolean | null;
}

export class SealError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SealError';
  }
}

export const SEAL_KMS_UNAVAILABLE = 'SEAL_KMS_UNAVAILABLE';
export const SEAL_ESK_NOT_FOUND = 'SEAL_ESK_NOT_FOUND';
export const SEAL_SIGNING_FAILED = 'SEAL_SIGNING_FAILED';
export const SEAL_TSA_TIMEOUT = 'SEAL_TSA_TIMEOUT';
export const SEAL_INVALID_ARTIFACT = 'SEAL_INVALID_ARTIFACT';
export const SEAL_MISMATCH_VIOLATION_CODE = 'SEAL_MISMATCH_VIOLATION';
