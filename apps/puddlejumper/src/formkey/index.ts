import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Router } from 'express';
import type { FormDefinition, FormKeyHealth } from './types.js';
import { initFormKeyDefinitionStore, listFormDefinitions } from './registry/definition-store.js';
import { initConsentStore } from './consent/store.js';
import { initConsentStampStore } from './consent/stamp.js';
import { initIntakeRecordStore } from './intake/pipeline.js';
import { sealVerify } from '../seal/index.js';
import { archieveLog } from '../archieve/index.js';
import { createFormKeyApiRouter } from './api.js';

// In-memory registry: tenantId → formId → FormDefinition
const _registry = new Map<string, Map<string, FormDefinition>>();

let _initialized = false;
let _formsRegistered = 0;
let _suspendedForms = 0;

export function getFormRegistry(): Map<string, Map<string, FormDefinition>> {
  return _registry;
}

export async function initFormKey(db: Database.Database): Promise<void> {
  if (_initialized) return;

  console.info('[formkey] initializing...');

  // Init all stores
  initFormKeyDefinitionStore(db);
  initConsentStore(db);
  initConsentStampStore(db);
  initIntakeRecordStore(db);

  // Load all published FormDefinitions into in-memory registry
  let registered = 0;
  let suspended = 0;

  try {
    const allPublished = listFormDefinitions('default', 'published');
    // Also load for other tenants if needed — for now load all statuses and filter
    const allDefs = db.prepare(
      "SELECT DISTINCT tenant_id FROM formkey_definitions WHERE status = 'published'"
    ).all() as { tenant_id: string }[];

    const tenantIds = [...new Set([...allDefs.map(r => r.tenant_id), 'default'])];

    for (const tenantId of tenantIds) {
      const forms = listFormDefinitions(tenantId, 'published');
      for (const form of forms) {
        // Verify SEAL token
        if (form.sealToken) {
          try {
            // Reconstruct the canonical payload used during publish
            const serializable = { ...form, sealToken: null };
            const canonical = JSON.stringify(jcsSortKeys(serializable));
            const buf = Buffer.from(canonical, 'utf8');
            const result = await sealVerify(buf, form.sealToken);
            if (!result.valid) {
              console.warn(`[formkey] SEAL mismatch for form ${form.formId} (${form.id}): ${result.reason}`);
              suspended++;
              // Mark as suspended_mismatch in DB (don't add to registry)
              db.prepare(
                "UPDATE formkey_definitions SET status = 'suspended_mismatch' WHERE id = ?"
              ).run(form.id);
              continue;
            }
          } catch (err) {
            console.warn(`[formkey] SEAL verify error for form ${form.formId}:`, (err as Error).message);
            suspended++;
            continue;
          }
        }

        // Add to registry
        if (!_registry.has(tenantId)) {
          _registry.set(tenantId, new Map());
        }
        _registry.get(tenantId)!.set(form.formId, form);
        registered++;
      }
    }
  } catch (err) {
    console.error('[formkey] Failed to load registry:', (err as Error).message);
  }

  _formsRegistered = registered;
  _suspendedForms = suspended;

  // archieveLog FORMKEY_INITIALIZED
  try {
    archieveLog({
      requestId: crypto.randomUUID(),
      tenantId: 'default',
      module: 'formkey',
      eventType: 'FORMKEY_INITIALIZED',
      actor: { userId: 'system', role: 'system', sessionId: 'formkey-internal' },
      severity: 'info',
      data: { formsRegistered: registered, suspendedForms: suspended },
    });
  } catch (err) {
    console.warn('[formkey] Failed to log FORMKEY_INITIALIZED:', (err as Error).message);
  }

  _initialized = true;
  console.info(`[formkey] initialized (${registered} forms, ${suspended} suspended)`);
}

export function getFormKeyHealth(): FormKeyHealth {
  return {
    status: _suspendedForms > 0 ? 'degraded' : 'ok',
    formsRegistered: _formsRegistered,
    suspendedForms: _suspendedForms,
    submissionRateLimitPerMinute: parseInt(process.env.FORMKEY_SUBMISSION_RATE_LIMIT ?? '10', 10),
  };
}

export function createFormKeyRouter(db: Database.Database): Router {
  return createFormKeyApiRouter(db);
}

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
