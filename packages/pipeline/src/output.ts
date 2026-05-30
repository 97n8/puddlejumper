// @pj/pipeline — C8 FormKey output engine.
// Create trusted outputs. Don't make a document platform yet.
//
// Turns governed state + enrichment into a trusted output: resolve the
// template's bindings against the run's anchors, render minimal HTML + JSON,
// and write a generated_outputs row. A missing required binding fails SAFELY
// (status 'failed' + proof), never a half-rendered document. No real
// PDF/DOCX, no connectors, no UI — HTML/JSON only.
//
// Templates live in the C2 output_templates table; body_json defines the
// bindings. The DB handle is injected; this module never opens its own
// connection.

import crypto from 'node:crypto';
import type { DatabaseHandle } from '@pj/db';
import type { EnrichmentResult } from './enrichment.js';

/** One template binding: a label filled from an enrichment anchor key. */
export interface TemplateBinding {
  /** Human label rendered in the output. */
  label: string;
  /** Enrichment anchor key that supplies the value. */
  from: string;
  /** When true, a missing anchor fails the render (vs. rendering blank). */
  required?: boolean;
}

/** A template body: title + ordered bindings. Stored as body_json. */
export interface TemplateBody {
  title: string;
  format: 'html' | 'json';
  bindings: TemplateBinding[];
}

/** Input to seed an output template row. */
export interface SeedTemplateInput {
  tenant_id: string;
  module: string;
  environment: string;
  name: string;
  version?: string;
  body: TemplateBody;
}

/**
 * Seed one active output template. Idempotent-friendly for tests: returns the
 * existing active template for (tenant, module, name) if present.
 */
export function seedOutputTemplate(
  db: DatabaseHandle,
  input: SeedTemplateInput,
): string {
  const existing = db
    .prepare(
      `SELECT template_id FROM output_templates
       WHERE tenant_id = ? AND module = ? AND name = ? AND is_active = 1`,
    )
    .get(input.tenant_id, input.module, input.name) as
    | { template_id: string }
    | undefined;
  if (existing) return existing.template_id;

  const templateId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO output_templates (
       template_id, tenant_id, module, environment, name, version, is_active, body_json
     ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    templateId,
    input.tenant_id,
    input.module,
    input.environment,
    input.name,
    input.version ?? '1',
    JSON.stringify(input.body),
  );
  return templateId;
}

/** Look up the active output template by name for a scope. */
export function findOutputTemplate(
  db: DatabaseHandle,
  tenant_id: string,
  module: string,
  name: string,
): { template_id: string; body: TemplateBody } | null {
  const row = db
    .prepare(
      `SELECT template_id, body_json FROM output_templates
       WHERE tenant_id = ? AND module = ? AND name = ? AND is_active = 1`,
    )
    .get(tenant_id, module, name) as
    | { template_id: string; body_json: string }
    | undefined;
  if (!row) return null;
  try {
    return { template_id: row.template_id, body: JSON.parse(row.body_json) as TemplateBody };
  } catch {
    return null;
  }
}

/** Scope needed to persist a generated output. */
export interface OutputScope {
  tenant_id: string;
  case_space_id: string;
  process_id: string;
}

/** A single resolved field in the rendered output. */
export interface RenderedField {
  label: string;
  from: string;
  value: string | null;
  missing: boolean;
}

/** Result of the output engine for one run. */
export interface OutputResult {
  /** 'generated' when all required bindings resolved, else 'failed'. */
  status: 'generated' | 'failed';
  output_id: string;
  template_id: string | null;
  /** Rendered HTML (always present; a failed render still shows what it had). */
  html: string;
  fields: RenderedField[];
  /** Required binding keys that were missing (drives 'failed'). */
  missing_required: string[];
}

function anchorMap(enrichment: EnrichmentResult): Map<string, string> {
  return new Map(enrichment.anchors.map((a) => [a.key, a.value]));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderHtml(title: string, fields: RenderedField[]): string {
  const rows = fields
    .map(
      (f) =>
        `    <tr><th>${escapeHtml(f.label)}</th><td>${
          f.value === null ? '' : escapeHtml(f.value)
        }</td></tr>`,
    )
    .join('\n');
  return `<section class="pj-output">\n  <h1>${escapeHtml(title)}</h1>\n  <table>\n${rows}\n  </table>\n</section>`;
}

/**
 * Generate an output from the active named template, resolving bindings
 * against the run's enrichment anchors, and write a generated_outputs row.
 *
 * Fail-safe: a missing REQUIRED binding (or a missing template) writes a
 * `failed` row with the partial render + the missing keys — never a silent
 * blank document. Non-required missing bindings render as empty values.
 */
export function generateOutput(
  db: DatabaseHandle,
  scope: OutputScope,
  templateName: string,
  module: string,
  enrichment: EnrichmentResult,
): OutputResult {
  const template = findOutputTemplate(db, scope.tenant_id, module, templateName);

  // Missing template → fail safely with proof-able state.
  if (!template) {
    const outputId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO generated_outputs (
         output_id, tenant_id, case_space_id, template_id, process_id, status, content_json
       ) VALUES (?, ?, ?, ?, ?, 'failed', ?)`,
    ).run(
      outputId,
      scope.tenant_id,
      scope.case_space_id,
      null,
      scope.process_id,
      JSON.stringify({ error: 'template_not_found', template: templateName }),
    );
    return {
      status: 'failed',
      output_id: outputId,
      template_id: null,
      html: '',
      fields: [],
      missing_required: [`template:${templateName}`],
    };
  }

  const anchors = anchorMap(enrichment);
  const fields: RenderedField[] = template.body.bindings.map((b) => {
    const has = anchors.has(b.from);
    return {
      label: b.label,
      from: b.from,
      value: has ? (anchors.get(b.from) as string) : null,
      missing: !has,
    };
  });

  const missing_required = template.body.bindings
    .filter((b) => b.required && !anchors.has(b.from))
    .map((b) => b.from);

  const status: 'generated' | 'failed' =
    missing_required.length === 0 ? 'generated' : 'failed';
  const html = renderHtml(template.body.title, fields);
  const outputId = crypto.randomUUID();

  db.prepare(
    `INSERT INTO generated_outputs (
       output_id, tenant_id, case_space_id, template_id, process_id, status, content_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    outputId,
    scope.tenant_id,
    scope.case_space_id,
    template.template_id,
    scope.process_id,
    status,
    JSON.stringify({
      title: template.body.title,
      format: template.body.format,
      fields,
      missing_required,
      html,
    }),
  );

  return {
    status,
    output_id: outputId,
    template_id: template.template_id,
    html,
    fields,
    missing_required,
  };
}

// ── Seed bodies for the three V1 triad output templates ──────────────────────
// Binding `from` keys match the C4 enrichment anchor keys per pack.

/** Guest Arrival Brief — guestops.stay. */
export const GUEST_ARRIVAL_BRIEF: TemplateBody = {
  title: 'Guest Arrival Brief',
  format: 'html',
  bindings: [
    { label: 'Reservation', from: 'reservation_id', required: true },
    { label: 'Arrival', from: 'arrival', required: true },
    { label: 'Departure', from: 'departure', required: true },
    { label: 'Cleaning Window', from: 'cleaning_window' },
    { label: 'Lock Code', from: 'lock_code', required: true },
  ],
};

/** Timesheet Review Summary — timedesk.muni. */
export const TIMESHEET_REVIEW_SUMMARY: TemplateBody = {
  title: 'Timesheet Review Summary',
  format: 'html',
  bindings: [
    { label: 'Employee', from: 'employee_id', required: true },
    { label: 'Department', from: 'department', required: true },
    { label: 'Pay Period', from: 'pay_period', required: true },
    { label: 'Overtime Hours', from: 'overtime_hours' },
  ],
};

/** Expense / Receipt Review Packet — finance.biz. */
export const EXPENSE_RECEIPT_REVIEW_PACKET: TemplateBody = {
  title: 'Expense / Receipt Review Packet',
  format: 'html',
  bindings: [
    { label: 'Transaction', from: 'transaction_id', required: true },
    { label: 'Vendor', from: 'vendor', required: true },
    { label: 'Invoice', from: 'invoice_ref', required: true },
    { label: 'Receipt', from: 'receipt_ref', required: true },
    { label: 'Tax Category', from: 'tax_category' },
  ],
};
