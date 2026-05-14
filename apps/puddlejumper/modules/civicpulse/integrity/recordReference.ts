// Stub files for integrity and approval workflow supporting modules.
// These exist as extension points; core logic lives in sealValidator.ts.

export interface RecordReference {
  vaultRecordId: string;
  vaultBaseUrl: string;
  actionType: string;
  recordedAt: string;
}

export function buildRecordReference(
  vaultRecordId: string,
  vaultBaseUrl: string,
  actionType: string,
  recordedAt: string,
): RecordReference {
  return { vaultRecordId, vaultBaseUrl, actionType, recordedAt };
}

export function recordLink(ref: RecordReference): string {
  return `${ref.vaultBaseUrl.replace(/\/$/, '')}/records/${ref.vaultRecordId}`;
}
