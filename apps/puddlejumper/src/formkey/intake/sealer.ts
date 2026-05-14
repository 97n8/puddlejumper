import type { FormDefinition } from '../types.js';
import type { SealToken } from '../../seal/types.js';
import { sealSign } from '../../seal/index.js';

function jcsSortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(jcsSortKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map(k => [k, jcsSortKeys((obj as Record<string, unknown>)[k])])
    );
  }
  return obj;
}

export async function sealIntakePayload(
  form: FormDefinition,
  fields: Record<string, unknown>,
  submissionId: string
): Promise<SealToken> {
  // Filter consentCovered fields in order (sort by field.order)
  const coveredFields = form.fields
    .filter(f => f.consentCovered)
    .sort((a, b) => a.order - b.order);

  const sealPayload: Record<string, unknown> = {};
  for (const f of coveredFields) {
    if (fields[f.id] !== undefined) {
      sealPayload[f.id] = fields[f.id];
    }
  }

  const canonical = JSON.stringify(jcsSortKeys(sealPayload));
  const buf = Buffer.from(canonical, 'utf8');

  return sealSign(buf, {
    tenantId: form.tenantId,
    callerModule: 'formkey',
    callerContext: `${form.formId}/intake/${submissionId}`,
    intakeFields: coveredFields.map(f => f.id),
  });
}
