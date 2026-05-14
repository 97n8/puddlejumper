// spark.utils.retry

export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  backoff?: number;
  onRetry?: (attempt: number, err: unknown) => void;
}

export function createSparkRetry() {
  return {
    async run<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
      const { retries = 3, delayMs = 500, backoff = 2, onRetry } = opts;
      let lastErr: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastErr = err;
          if (attempt < retries) {
            onRetry?.(attempt + 1, err);
            await new Promise(r => setTimeout(r, delayMs * Math.pow(backoff, attempt)));
          }
        }
      }
      throw lastErr;
    },
  };
}
