/**
 * Formkey — Structured Data Ingestion
 * 
 * Not a form builder. A form runtime.
 * 
 * A Formkey knows:
 * - What flow it starts
 * - What VAULT conditions apply to the resulting record
 * - What data downstream steps need
 * - What retention policy (ARCHIEVE) governs the submission
 * - Where the artifact lands when Transfer completes (cloud sync target)
 * 
 * When a resident submits through a Formkey, the data enters PJ as a
 * governed record — not a PDF blob in someone's inbox. The submission
 * creates the flow, the flow activates the VAULT evaluation, and the
 * responsible party sees it in their casespace with everything structured.
 * No re-keying. No "I got an email, now let me enter this."
 * 
 * Formkeys can be embedded on municipal websites, CivicPlus pages,
 * or served directly from the PJ tenant.
 * 
 * // GPR
 */

import type { VaultCondition } from "@pj/core/vault";

/** A Formkey definition — the schema for a governed form */
export interface Formkey {
  id: string;
  tenantId: string;
  slug: string;            // URL-safe identifier (e.g. "prr-request", "dog-license")
  name: string;            // Human-readable name
  description: string;

  /** What governance flow does this form start? */
  triggersFlow: string;    // flow template ID

  /** Fields the submitter fills out */
  fields: FormkeyField[];

  /** VAULT conditions that apply to the resulting record */
  vaultConditions: VaultCondition[];

  /** ARCHIEVE retention policy for submissions */
  retentionPolicyId: string;

  /** Where does the artifact go after Transfer? */
  syncTarget?: SyncTarget;

  /** Is this form currently accepting submissions? */
  active: boolean;

  /** Public-facing or internal-only? */
  visibility: "public" | "internal";

  createdAt: string;
  updatedAt: string;
}

export interface FormkeyField {
  id: string;
  name: string;           // Machine name (e.g. "requester_name")
  label: string;          // Display label
  type: FormkeyFieldType;
  required: boolean;
  /** Validation rules */
  validation?: {
    pattern?: string;      // Regex
    min?: number;
    max?: number;
    options?: string[];    // For select/radio
  };
  /** Which flow step consumes this field? */
  consumedByStep?: string;
  /** Help text for the submitter */
  helpText?: string;
}

export type FormkeyFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "date"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "file_upload"
  | "address";

/** A submitted Formkey — becomes a governed record */
export interface FormkeySubmission {
  id: string;
  formkeyId: string;
  tenantId: string;
  data: Record<string, unknown>;
  /** The flow instance this submission created */
  flowId: string;
  /** Audit event for the submission itself */
  auditEventId: string;
  submittedAt: string;
  /** Where the submitter came from */
  source: "embed" | "direct" | "civicplus" | "email";
  /** Submitter identity (may be anonymous for public forms) */
  submitter?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

/** Cloud sync target — where the artifact goes after Transfer */
export interface SyncTarget {
  provider: "sharepoint" | "google_drive" | "civicplus" | "local";
  /** SharePoint: site URL + document library. Google: folder ID. */
  config: Record<string, string>;
  /** Provision structure on first sync? (ARCHIEVE labels, metadata columns, permissions) */
  provisionOnConnect: boolean;
}
