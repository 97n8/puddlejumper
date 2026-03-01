import crypto from 'node:crypto';
import { getRegistryEntry } from '../registry/registry-publisher.js';
import { getDefinitionById } from '../registry/definition-store.js';
import { decryptHandler } from '../handler/encryptor.js';
import { verifyHandlerHash } from '../handler/hasher.js';
import { runInSandbox } from './sandbox.js';
import { buildSparkContext } from '../spark/index.js';
import { scan as dlpScan } from '../../syncronate/dlp-engine.js';
import type { CircuitBreakerState, ExecuteRequest, ExecuteResult } from '../types.js';
import { log as archieveLog } from '../../archieve/logger.js';

// Simple in-memory circuit breakers per connectorId
const circuitBreakers = new Map<string, CircuitBreakerState>();
const CB_FAILURE_THRESHOLD = 5;
const CB_RESET_MS = 60_000;

function getCircuitBreaker(connectorId: string): CircuitBreakerState {
  if (!circuitBreakers.has(connectorId)) {
    circuitBreakers.set(connectorId, { failures: 0, lastFailureAt: 0, open: false });
  }
  return circuitBreakers.get(connectorId)!;
}

function recordFailure(connectorId: string): void {
  const cb = getCircuitBreaker(connectorId);
  cb.failures++;
  cb.lastFailureAt = Date.now();
  if (cb.failures >= CB_FAILURE_THRESHOLD) cb.open = true;
}

function recordSuccess(connectorId: string): void {
  const cb = getCircuitBreaker(connectorId);
  cb.failures = 0;
  cb.open = false;
}

function isCircuitOpen(connectorId: string): boolean {
  const cb = getCircuitBreaker(connectorId);
  if (cb.open && Date.now() - cb.lastFailureAt > CB_RESET_MS) {
    cb.open = false;
    cb.failures = 0;
  }
  return cb.open;
}

// RBAC check: does the caller's profile match the connector's allowedProfiles?
function checkRbac(
  connectorEntry: ReturnType<typeof getRegistryEntry>,
  req: ExecuteRequest
): { allowed: boolean; reason?: string } {
  if (!connectorEntry) return { allowed: false, reason: 'Connector not found in registry' };
  if (connectorEntry.status === 'suspended_mismatch') {
    return { allowed: false, reason: 'Connector is suspended due to seal mismatch' };
  }
  if (connectorEntry.status === 'deprecated') {
    return { allowed: false, reason: 'Connector is deprecated' };
  }
  if (connectorEntry.allowedProfiles.length > 0 && req.profileId) {
    if (!connectorEntry.allowedProfiles.includes(req.profileId)) {
      return { allowed: false, reason: `Profile '${req.profileId}' is not authorized for this connector` };
    }
  }
  return { allowed: true };
}

export async function runInterceptor(
  tenantId: string,
  connectorId: string,
  req: ExecuteRequest
): Promise<ExecuteResult> {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  // Gate 1: Auth / RBAC
  const entry = getRegistryEntry(tenantId, connectorId);
  const rbac = checkRbac(entry, req);
  if (!rbac.allowed) {
    logGateBlocked(tenantId, connectorId, req.userId ?? 'unknown', 'rbac', rbac.reason ?? 'RBAC check failed', requestId);
    return { success: false, output: null, durationMs: Date.now() - start, error: rbac.reason };
  }

  // Gate 2: Circuit breaker
  if (isCircuitOpen(connectorId)) {
    const reason = 'Circuit breaker open — too many recent failures';
    logGateBlocked(tenantId, connectorId, req.userId ?? 'unknown', 'circuit-breaker', reason, requestId);
    return { success: false, output: null, durationMs: Date.now() - start, error: reason };
  }

  // Gate 3: DLP pre-scan on payload
  const payloadFindings = dlpScan(req.payload);
  const highConfidencePre = payloadFindings.filter(f => f.confidence === 'high');
  if (highConfidencePre.length > 0) {
    const reason = `DLP pre-scan blocked ${highConfidencePre.length} high-confidence finding(s) in payload`;
    logGateBlocked(tenantId, connectorId, req.userId ?? 'unknown', 'dlp-pre', reason, requestId);
    return { success: false, output: null, durationMs: Date.now() - start, error: reason };
  }

  // Gate 4: Sandbox execute
  const def = getDefinitionById(connectorId);
  if (!def?.handlerEncrypted) {
    return { success: false, output: null, durationMs: Date.now() - start, error: 'Handler not found' };
  }

  let handlerSource: string;
  try {
    handlerSource = decryptHandler(def.handlerEncrypted);
  } catch (err) {
    return { success: false, output: null, durationMs: Date.now() - start, error: `Decrypt failed: ${(err as Error).message}` };
  }

  if (entry!.handlerHash && !verifyHandlerHash(handlerSource, entry!.handlerHash)) {
    const reason = 'Handler integrity check failed at runtime';
    logGateBlocked(tenantId, connectorId, req.userId ?? 'unknown', 'hash-verify', reason, requestId);
    return { success: false, output: null, durationMs: Date.now() - start, error: reason };
  }

  const spark = buildSparkContext(tenantId, connectorId);
  const sandboxResult = await runInSandbox({
    handlerSource,
    payload: req.payload,
    sparkContext: spark as unknown as Record<string, unknown>,
    timeoutMs: 30_000,
  });

  if (sandboxResult.timedOut) {
    recordFailure(connectorId);
    try {
      archieveLog({
        requestId,
        tenantId,
        module: 'LOGICBRIDGE',
        eventType: 'LOGICBRIDGE_HANDLER_TIMEOUT',
        actor: { userId: req.userId ?? 'system', sessionId: 'system', role: 'system' },
        severity: 'warn',
        data: { connectorId, handlerId: connectorId },
      });
    } catch { /* never throw */ }
    return { success: false, output: null, durationMs: Date.now() - start, error: 'Handler timed out' };
  }

  if (sandboxResult.sandboxViolation) {
    recordFailure(connectorId);
    try {
      archieveLog({
        requestId,
        tenantId,
        module: 'LOGICBRIDGE',
        eventType: 'LOGICBRIDGE_HANDLER_SANDBOX_VIOLATION',
        actor: { userId: req.userId ?? 'system', sessionId: 'system', role: 'system' },
        severity: 'error',
        data: { connectorId, handlerId: connectorId, violation: sandboxResult.error ?? 'unknown' },
      });
    } catch { /* never throw */ }
    return { success: false, output: null, durationMs: Date.now() - start, error: 'Sandbox violation' };
  }

  if (sandboxResult.error && !sandboxResult.output) {
    recordFailure(connectorId);
    return { success: false, output: null, durationMs: Date.now() - start, error: sandboxResult.error };
  }

  // Gate 5: DLP post-scan on output
  const outputFields: Record<string, unknown> =
    sandboxResult.output !== null && typeof sandboxResult.output === 'object'
      ? (sandboxResult.output as Record<string, unknown>)
      : { output: String(sandboxResult.output ?? '') };

  const outputFindings = dlpScan(outputFields);
  const dlpFindings = outputFindings.map(f => ({ field: f.field, entityType: f.entityType, confidence: f.confidence }));
  const highConfidencePost = outputFindings.filter(f => f.confidence === 'high');
  if (highConfidencePost.length > 0) {
    const reason = `DLP post-scan blocked ${highConfidencePost.length} high-confidence finding(s) in output`;
    logGateBlocked(tenantId, connectorId, req.userId ?? 'unknown', 'dlp-post', reason, requestId);
    return { success: false, output: null, durationMs: Date.now() - start, error: reason, dlpFindings };
  }

  // Gate 6: SEAL sign output (V1: generate a simple signature token)
  const outputHash = crypto.createHash('sha256')
    .update(JSON.stringify(sandboxResult.output ?? null))
    .digest('hex');
  const sealToken = {
    signature: outputHash,
    keyId: `lb-output-v1-${tenantId}`,
    signedAt: new Date().toISOString(),
    handlerHash: entry!.handlerHash,
    callerModule: 'logicbridge',
    callerContext: `${connectorId}@${entry!.version}`,
  };

  recordSuccess(connectorId);

  try {
    archieveLog({
      requestId,
      tenantId,
      module: 'LOGICBRIDGE',
      eventType: 'LOGICBRIDGE_HANDLER_EXECUTED',
      actor: { userId: req.userId ?? 'system', sessionId: 'system', role: 'system' },
      severity: 'info',
      data: { connectorId, handlerId: connectorId, durationMs: sandboxResult.durationMs },
    });
  } catch { /* never throw */ }

  return {
    success: true,
    output: sandboxResult.output,
    durationMs: Date.now() - start,
    dlpFindings,
    sealToken,
  };
}

function logGateBlocked(
  tenantId: string,
  connectorId: string,
  userId: string,
  gate: string,
  reason: string,
  requestId: string
): void {
  try {
    archieveLog({
      requestId,
      tenantId,
      module: 'LOGICBRIDGE',
      eventType: 'LOGICBRIDGE_GATE_BLOCKED',
      actor: { userId, sessionId: 'system', role: 'user' },
      severity: 'warn',
      data: { connectorId, gate, reason },
    });
  } catch { /* never throw */ }
}
