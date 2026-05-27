// Canon: Split-Row Runtime Contract.
// Source: Master Build Spec v1.1, Part 5 + Part 14 (RESOLVED-1, RESOLVED-2).
//
// A deployment that does not declare its splits is not allowed to execute.

// Closed set of split points (Part 5).
export type SplitPointId =
  | 'SP.STATE.NAMES'
  | 'SP.STATE.GUARDS'
  | 'SP.ROLE.BINDING'
  | 'SP.ROLE.ASSIGNMENT'
  | 'SP.EVENT.SUBTYPE'
  | 'SP.FORM.FIELDS'
  | 'SP.NOTIFY.CHANNEL'
  | 'SP.INTEG.ENDPOINT';

export interface Binding {
  split_point: SplitPointId;
  process_type?: string;
  /** Inline value for the binding. Mutually exclusive with value_ref / artifact_id. */
  value?: unknown;
  /** File-system reference to a separate overlay artifact. */
  value_ref?: string;
  /** Shared registry artifact (Part 14 RESOLVED-2). */
  artifact_id?: string;
  artifact_version?: string;
  /** Non-empty rationale — required (Part 5). */
  rationale: string;
}

export interface ManifestSignature {
  declared_by: string;
  declared_at: string;
  algorithm: 'Ed25519';
  public_key: string;
  signature: string;
  signing_required: boolean;
}

export interface DivergenceManifest {
  canon_version: string;
  deployment_id: string;
  overlay_name: string;
  overlay_version: string;
  declared_at: string;
  declared_by: string;
  bindings: Binding[];
  signatures?: ManifestSignature;
}

// Lint failure codes — see Part 5 + Part 14 RESOLVED-1/-2.
export type LintFailureCode =
  | 'MANIFEST_MISSING'
  | 'MANIFEST_PARSE_ERROR'
  | 'CANON_VERSION_MISMATCH'
  | 'UNKNOWN_SPLIT_POINT'
  | 'INVALID_BINDING_VALUE'
  | 'RATIONALE_MISSING'
  | 'VALUE_REF_NOT_FOUND'
  | 'ORPHAN_ARTIFACT'
  | 'SIGNATURE_MISSING'
  | 'SIGNATURE_INVALID'
  | 'ARTIFACT_NOT_FOUND';

export interface LintFailure {
  code: LintFailureCode;
  message: string;
  binding_index?: number;
  split_point?: SplitPointId;
}

export interface LintWarning {
  code: 'ARTIFACT_VERSION_MISMATCH' | 'ARTIFACT_DEPRECATED';
  message: string;
  binding_index?: number;
}

export interface LintResult {
  passed: boolean;
  failures: LintFailure[];
  warnings: LintWarning[];
}
