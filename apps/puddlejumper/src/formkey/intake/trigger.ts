import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FormDefinition, IntakeRecord } from '../types.js';
import { archieveLog } from '../../archieve/index.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postWithRetry(url: string, body: unknown, maxAttempts = 3): Promise<void> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      return;
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error('All retry attempts failed');
}

export async function fireSynchron8Trigger(
  form: FormDefinition,
  record: IntakeRecord,
  _db: Database.Database
): Promise<void> {
  if (!form.automationTrigger) return;

  const trigger = form.automationTrigger;

  // Check condition for conditional trigger
  if (trigger.triggerEvent === 'on_submit_if' && trigger.condition) {
    const conditionMet = Object.entries(trigger.condition).every(([fieldId, expectedValue]) => {
      return record.fields[fieldId] === expectedValue;
    });
    if (!conditionMet) return;
  }

  // Build input mapping
  const input: Record<string, unknown> = {};
  if (trigger.inputMapping) {
    for (const [automationField, recordField] of Object.entries(trigger.inputMapping)) {
      input[automationField] = record.fields[recordField];
    }
  }

  const port = process.env.PORT ?? 3000;
  const url = `http://localhost:${port}/api/syncronate/run`;
  const body = {
    automationId: trigger.automationId,
    input,
    sourceRecordId: record.id,
  };

  try {
    await postWithRetry(url, body);
    archieveLog({
      requestId: crypto.randomUUID(),
      tenantId: form.tenantId,
      module: 'formkey',
      eventType: 'FORMKEY_TRIGGER_SUCCEEDED',
      actor: { userId: 'system', role: 'system', sessionId: 'formkey-internal' },
      severity: 'info',
      data: { formId: form.formId, submissionId: record.id, automationId: trigger.automationId },
    });
  } catch (err) {
    try {
      archieveLog({
        requestId: crypto.randomUUID(),
        tenantId: form.tenantId,
        module: 'formkey',
        eventType: 'FORMKEY_TRIGGER_FAILED',
        actor: { userId: 'system', role: 'system', sessionId: 'formkey-internal' },
        severity: 'warn',
        data: { formId: form.formId, submissionId: record.id, automationId: trigger.automationId, error: (err as Error).message },
      });
    } catch { /* ignore */ }
  }
}
