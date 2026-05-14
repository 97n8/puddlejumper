import { scan as dlpScan } from '../../syncronate/dlp-engine.js';
import { runInSandbox } from '../handler/sandbox.js';
import { decryptHandler } from '../handler/encryptor.js';
import { verifyHandlerHash } from '../handler/hasher.js';
import { buildSparkContext } from '../spark/index.js';
import { analyzeCapabilities, compareCapabilities } from './capability-analyzer.js';
import type { ConnectorDefinition, PolicySimResult } from '../types.js';

const SIM_TIMEOUT_MS = 5_000;

export async function runSimulation(def: ConnectorDefinition): Promise<PolicySimResult> {
  const ranAt = new Date().toISOString();
  const start = Date.now();

  if (!def.handlerEncrypted) {
    return {
      passed: false,
      ranAt,
      durationMs: 0,
      dlpFindings: [],
      detectedCapabilities: [],
      declaredCapabilities: def.capabilities,
      capabilityMismatch: false,
      error: 'No handler code found',
    };
  }

  let handlerSource: string;
  try {
    handlerSource = decryptHandler(def.handlerEncrypted);
  } catch (err) {
    return {
      passed: false,
      ranAt,
      durationMs: Date.now() - start,
      dlpFindings: [],
      detectedCapabilities: [],
      declaredCapabilities: def.capabilities,
      capabilityMismatch: false,
      error: `Handler decrypt failed: ${(err as Error).message}`,
    };
  }

  // Verify handler hash
  if (def.handlerHash && !verifyHandlerHash(handlerSource, def.handlerHash)) {
    return {
      passed: false,
      ranAt,
      durationMs: Date.now() - start,
      dlpFindings: [],
      detectedCapabilities: [],
      declaredCapabilities: def.capabilities,
      capabilityMismatch: false,
      error: 'Handler integrity check failed — hash mismatch',
    };
  }

  // Capability analysis
  const detectedCapabilities = analyzeCapabilities(handlerSource);
  const { mismatch: capabilityMismatch } = compareCapabilities(def.capabilities, detectedCapabilities);

  // Build spark context with sim-safe http (stubs don't actually call out)
  const spark = buildSparkContext(def.tenantId, def.id);

  // Run handler in sandbox with sim payload
  const payload = def.samplePayload ?? {};
  const sandboxResult = await runInSandbox({
    handlerSource,
    payload: payload as Record<string, unknown>,
    sparkContext: spark as unknown as Record<string, unknown>,
    timeoutMs: SIM_TIMEOUT_MS,
  });

  const durationMs = Date.now() - start;

  if (sandboxResult.timedOut) {
    return {
      passed: false,
      ranAt,
      durationMs,
      dlpFindings: [],
      detectedCapabilities,
      declaredCapabilities: def.capabilities,
      capabilityMismatch,
      error: `Simulation timed out after ${SIM_TIMEOUT_MS}ms`,
    };
  }

  if (sandboxResult.error && !sandboxResult.output) {
    return {
      passed: false,
      ranAt,
      durationMs,
      dlpFindings: [],
      detectedCapabilities,
      declaredCapabilities: def.capabilities,
      capabilityMismatch,
      error: sandboxResult.error,
    };
  }

  // DLP scan output
  const outputFields: Record<string, unknown> =
    sandboxResult.output !== null && typeof sandboxResult.output === 'object'
      ? (sandboxResult.output as Record<string, unknown>)
      : { output: String(sandboxResult.output ?? '') };

  const dlpRaw = dlpScan(outputFields as Record<string, unknown>);
  const dlpFindings = dlpRaw.map(f => ({
    field: f.field,
    entityType: f.entityType,
    confidence: f.confidence,
  }));

  const highConfidenceBlocked = dlpFindings.some(f => f.confidence === 'high');

  return {
    passed: !highConfidenceBlocked,
    ranAt,
    durationMs,
    dlpFindings,
    detectedCapabilities,
    declaredCapabilities: def.capabilities,
    capabilityMismatch,
    ...(highConfidenceBlocked ? { error: 'DLP scan detected high-confidence PII in output' } : {}),
  };
}
