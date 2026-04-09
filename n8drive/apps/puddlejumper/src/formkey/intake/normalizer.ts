// ── FormKey Plain-Language Normalizer ─────────────────────────────────────────
//
// Takes a user's plain-English request and maps it to the best matching
// FormDefinition, then pre-fills fields where the text provides values.
//
// Uses OpenAI if OPENAI_API_KEY is set; falls back to keyword scoring.

import type { FormDefinition } from '../types.js';

export interface NormalizeResult {
  formId: string | null;
  formName: string | null;
  confidence: number;
  prefill: Record<string, string>;
  source: 'ai' | 'keyword' | 'none';
  alternatives: Array<{ formId: string; formName: string; confidence: number }>;
}

// ── Keyword scorer ─────────────────────────────────────────────────────────────

function scoreForm(form: FormDefinition, text: string): number {
  const haystack = text.toLowerCase();
  const name = form.name.toLowerCase();
  const desc = (form.description ?? '').toLowerCase();
  const purpose = (form.purpose ?? '').toLowerCase();

  let score = 0;

  // Name word overlap
  for (const word of name.split(/\s+/)) {
    if (word.length > 3 && haystack.includes(word)) score += 3;
  }

  // Description / purpose overlap
  for (const word of `${desc} ${purpose}`.split(/\s+/)) {
    if (word.length > 4 && haystack.includes(word)) score += 1;
  }

  // Field label overlap
  for (const field of form.fields ?? []) {
    const label = field.label.toLowerCase();
    for (const word of label.split(/\s+/)) {
      if (word.length > 3 && haystack.includes(word)) score += 0.5;
    }
  }

  return score;
}

// ── Pre-fill extraction ────────────────────────────────────────────────────────

function extractPrefill(form: FormDefinition, text: string): Record<string, string> {
  const prefill: Record<string, string> = {};

  for (const field of form.fields ?? []) {
    const label = field.label.toLowerCase();

    // Name extraction
    if (/name|owner|applicant/.test(label)) {
      const nameMatch = text.match(/(?:my name is|i(?:'m| am)|owner[:,]?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
      if (nameMatch) prefill[field.id] = nameMatch[1].trim();
    }

    // Address extraction
    if (/address|street|location/.test(label)) {
      const addrMatch = text.match(/\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Dr|Ln|Blvd|Way|Court|Ct|Place|Pl)\b/i);
      if (addrMatch) prefill[field.id] = addrMatch[0].trim();
    }

    // Date extraction
    if (/date|when|born|birthday/.test(label) && field.type === 'date') {
      const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
      if (dateMatch) prefill[field.id] = dateMatch[0];
    }

    // Email extraction
    if (/email|e-mail/.test(label) && field.type === 'email') {
      const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) prefill[field.id] = emailMatch[0];
    }

    // Phone extraction
    if (/phone|tel|mobile/.test(label)) {
      const phoneMatch = text.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
      if (phoneMatch) prefill[field.id] = phoneMatch[0];
    }
  }

  return prefill;
}

// ── AI-powered normalization ──────────────────────────────────────────────────

async function aiNormalize(
  text: string,
  forms: FormDefinition[],
  openAiKey: string
): Promise<{ formId: string | null; confidence: number; prefill: Record<string, string> } | null> {
  const formSummaries = forms.slice(0, 20).map(f => ({
    id: f.formId,
    name: f.name,
    description: f.description,
    fields: (f.fields ?? []).slice(0, 10).map(fld => ({ id: fld.id, label: fld.label, type: fld.type })),
  }));

  const prompt = `You are a government form matching assistant.

Available forms:
${JSON.stringify(formSummaries, null, 2)}

User request: "${text}"

Respond ONLY with JSON:
{
  "formId": "<id of best matching form, or null>",
  "confidence": <0.0-1.0>,
  "prefill": { "<fieldId>": "<extracted value>" }
}

Only include prefill fields where you can extract a value from the user's request.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { formId?: string; confidence?: number; prefill?: Record<string, string> };
    return {
      formId: parsed.formId ?? null,
      confidence: parsed.confidence ?? 0,
      prefill: parsed.prefill ?? {},
    };
  } catch {
    return null;
  }
}

// ── Main normalize function ───────────────────────────────────────────────────

export async function normalizeToForm(
  text: string,
  forms: FormDefinition[],
  openAiKey?: string
): Promise<NormalizeResult> {
  const publishedForms = forms.filter(f => f.status === 'published');

  if (publishedForms.length === 0) {
    return { formId: null, formName: null, confidence: 0, prefill: {}, source: 'none', alternatives: [] };
  }

  // Try AI first
  if (openAiKey) {
    const aiResult = await aiNormalize(text, publishedForms, openAiKey);
    if (aiResult && aiResult.formId && aiResult.confidence > 0.4) {
      const matched = publishedForms.find(f => f.formId === aiResult.formId);
      if (matched) {
        // Enhance with regex prefill for any fields AI missed
        const regexPrefill = extractPrefill(matched, text);
        const prefill = { ...regexPrefill, ...aiResult.prefill };

        // Score all forms for alternatives
        const scored = publishedForms
          .map(f => ({ formId: f.formId, formName: f.name, confidence: scoreForm(f, text) / 10 }))
          .filter(s => s.formId !== matched.formId && s.confidence > 0.1)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 3);

        return {
          formId: matched.formId,
          formName: matched.name,
          confidence: aiResult.confidence,
          prefill,
          source: 'ai',
          alternatives: scored,
        };
      }
    }
  }

  // Keyword fallback
  const scored = publishedForms
    .map(f => ({ form: f, score: scoreForm(f, text) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { formId: null, formName: null, confidence: 0, prefill: {}, source: 'none', alternatives: [] };
  }

  const best = scored[0];
  const maxPossible = best.form.fields.length * 3 + best.form.name.split(' ').length * 3;
  const confidence = Math.min(best.score / (maxPossible || 1), 0.85);
  const prefill = extractPrefill(best.form, text);

  const alternatives = scored.slice(1, 4).map(s => ({
    formId: s.form.formId,
    formName: s.form.name,
    confidence: Math.min(s.score / (maxPossible || 1), 0.85),
  }));

  return {
    formId: best.form.formId,
    formName: best.form.name,
    confidence,
    prefill,
    source: 'keyword',
    alternatives,
  };
}
