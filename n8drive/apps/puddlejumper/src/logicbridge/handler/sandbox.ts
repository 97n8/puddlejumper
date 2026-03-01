import vm from 'node:vm';

// V8 isolate pool — uses isolated-vm if available, falls back to Node vm

const POOL_SIZE = Number(process.env.LOGICBRIDGE_POOL_SIZE ?? '10');
const MEMORY_LIMIT_MB = 128;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ivmModule: any = null;
let ivmAvailable = false;

async function tryLoadIvm(): Promise<void> {
  try {
    // Use variable to prevent TypeScript from resolving the optional module at compile time
    const modName = 'isolated-vm';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ivmModule = await (import(/* @vite-ignore */ modName) as Promise<any>);
    ivmAvailable = true;
    console.log('[logicbridge/sandbox] isolated-vm loaded successfully');
  } catch {
    console.warn('[logicbridge/sandbox] isolated-vm not available — falling back to Node vm.runInNewContext (dev mode)');
    ivmAvailable = false;
  }
}

interface PooledIsolate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isolate: any;
  inUse: boolean;
}

const pool: PooledIsolate[] = [];

export async function initSandboxPool(): Promise<void> {
  await tryLoadIvm();

  if (!ivmAvailable || !ivmModule) {
    console.warn('[logicbridge/sandbox] Running without isolated-vm — sandbox isolation is NOT enforced');
    return;
  }

  const ivm = ivmModule;
  for (let i = 0; i < POOL_SIZE; i++) {
    try {
      const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
      pool.push({ isolate, inUse: false });
    } catch (err) {
      console.error('[logicbridge/sandbox] Failed to create isolate', i, (err as Error).message);
    }
  }
  console.log(`[logicbridge/sandbox] pool initialized: ${pool.length}/${POOL_SIZE} isolates`);
}

export function getSandboxPoolInfo(): { poolSize: number; available: number } {
  if (!ivmAvailable) return { poolSize: 0, available: 0 };
  const available = pool.filter(p => !p.inUse).length;
  return { poolSize: pool.length, available };
}

function acquireIsolate(): PooledIsolate | null {
  const entry = pool.find(p => !p.inUse);
  if (entry) {
    entry.inUse = true;
    return entry;
  }
  return null;
}

function releaseIsolate(entry: PooledIsolate): void {
  entry.inUse = false;
}

export interface SandboxRunOptions {
  handlerSource: string;
  payload: Record<string, unknown>;
  sparkContext: Record<string, unknown>;
  timeoutMs?: number;
}

export interface SandboxRunResult {
  output: unknown;
  durationMs: number;
  timedOut: boolean;
  sandboxViolation: boolean;
  error?: string;
}

export async function runInSandbox(opts: SandboxRunOptions): Promise<SandboxRunResult> {
  const { handlerSource, payload, sparkContext, timeoutMs = 30_000 } = opts;
  const start = Date.now();

  if (ivmAvailable && ivmModule && pool.length > 0) {
    return runInIvm(handlerSource, payload, sparkContext, timeoutMs, start);
  }
  return runInNodeVm(handlerSource, payload, sparkContext, timeoutMs, start);
}

async function runInIvm(
  handlerSource: string,
  payload: Record<string, unknown>,
  sparkContext: Record<string, unknown>,
  timeoutMs: number,
  start: number
): Promise<SandboxRunResult> {
  const ivm = ivmModule!;
  let entry = acquireIsolate();
  let ownedIsolate = false;

  if (!entry) {
    // Create a temporary isolate if pool exhausted
    try {
      const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
      entry = { isolate, inUse: true };
      ownedIsolate = true;
    } catch (err) {
      return runInNodeVm(handlerSource, payload, sparkContext, timeoutMs, start);
    }
  }

  try {
    const ctx = await entry.isolate.createContext();
    const jail = ctx.global;
    await jail.set('__payload', new ivm.ExternalCopy(payload).copyInto());

    // Build spark dispatch stubs — V1: only http and credentials need host calls
    // Inject spark as a serialized proxy. For V1, we pass a simple object.
    const sparkSerial = JSON.stringify(buildSerializableSparkContext(sparkContext));
    await jail.set('__sparkJson', sparkSerial);

    const bootstrapCode = `
      const spark = JSON.parse(__sparkJson);
      // Patch up functions: V1 spark in isolate is data-only, HTTP requires host dispatch.
      // For V1, spark.http.get/post are stubs that record calls (simulation mode).
      void 0;
    `;

    const wrapperCode = `
      ${bootstrapCode}
      (async function() {
        const __handler = ${handlerSource};
        if (typeof __handler !== 'function') throw new Error('Handler must export a function');
        const result = await __handler(spark, __payload);
        return JSON.stringify(result !== undefined ? result : null);
      })()
    `;

    const script = await entry.isolate.compileScript(wrapperCode);
    const resultRef = await script.run(ctx, { timeout: timeoutMs, promise: true });
    const resultStr = await resultRef;
    const output = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
    return { output, durationMs: Date.now() - start, timedOut: false, sandboxViolation: false };
  } catch (err: unknown) {
    const msg = (err as Error).message ?? String(err);
    const timedOut = msg.includes('Script execution timed out') || msg.includes('Isolate was disposed');
    return {
      output: null,
      durationMs: Date.now() - start,
      timedOut,
      sandboxViolation: false,
      error: msg,
    };
  } finally {
    if (ownedIsolate) {
      try { entry.isolate.dispose(); } catch { /* ignore */ }
    } else {
      releaseIsolate(entry);
    }
  }
}

function buildSerializableSparkContext(sparkContext: Record<string, unknown>): Record<string, unknown> {
  // For isolated-vm, we can only pass JSON-serializable data
  // spark.credentials values, kv data etc. are pre-resolved before entering isolate
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sparkContext)) {
    try {
      JSON.stringify(v); // test serializability
      safe[k] = v;
    } catch {
      safe[k] = null;
    }
  }
  return safe;
}

async function runInNodeVm(
  handlerSource: string,
  payload: Record<string, unknown>,
  sparkContext: Record<string, unknown>,
  timeoutMs: number,
  start: number
): Promise<SandboxRunResult> {
  try {
    const sandbox = {
      spark: sparkContext,
      __payload: payload,
      __result: undefined as unknown,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      setTimeout, clearTimeout, setInterval, clearInterval,
      Promise,
    };

    const wrapperCode = `
      (async function() {
        const __handler = ${handlerSource};
        if (typeof __handler !== 'function') throw new Error('Handler must export a function');
        __result = await __handler(spark, __payload);
      })()
    `;

    const ctx = vm.createContext(sandbox);
    const script = new vm.Script(wrapperCode);
    const prom = script.runInContext(ctx, { timeout: timeoutMs });
    if (prom && typeof (prom as Promise<unknown>).then === 'function') {
      await (prom as Promise<unknown>);
    }

    return {
      output: sandbox.__result ?? null,
      durationMs: Date.now() - start,
      timedOut: false,
      sandboxViolation: false,
    };
  } catch (err: unknown) {
    const msg = (err as Error).message ?? String(err);
    const timedOut = msg.includes('timed out') || msg.includes('Script execution timed out');
    return {
      output: null,
      durationMs: Date.now() - start,
      timedOut,
      sandboxViolation: false,
      error: msg,
    };
  }
}
