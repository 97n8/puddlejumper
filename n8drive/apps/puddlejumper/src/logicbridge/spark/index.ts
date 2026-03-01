import { createSparkHttp } from './http.js';
import { createSparkCredentials } from './credentials.js';
import { createSparkKv } from './kv.js';
import { createSparkXml } from './utils/xml.js';
import { createSparkMask } from './utils/mask.js';
import { createSparkPaginate } from './utils/paginate.js';
import { createSparkRetry } from './utils/retry.js';
import { createSparkAuth } from './utils/auth.js';
import { createSparkHash } from './utils/hash.js';
import { createSparkTransform } from './utils/transform.js';

export interface SparkContext {
  http: ReturnType<typeof createSparkHttp>;
  credentials: ReturnType<typeof createSparkCredentials>;
  kv: ReturnType<typeof createSparkKv>;
  utils: {
    xml: ReturnType<typeof createSparkXml>;
    mask: ReturnType<typeof createSparkMask>;
    paginate: ReturnType<typeof createSparkPaginate>;
    retry: ReturnType<typeof createSparkRetry>;
    auth: ReturnType<typeof createSparkAuth>;
    hash: ReturnType<typeof createSparkHash>;
    transform: ReturnType<typeof createSparkTransform>;
  };
}

export function buildSparkContext(tenantId: string, connectorId: string): SparkContext {
  return {
    http: createSparkHttp(),
    credentials: createSparkCredentials(tenantId),
    kv: createSparkKv(tenantId, connectorId),
    utils: {
      xml: createSparkXml(),
      mask: createSparkMask(),
      paginate: createSparkPaginate(),
      retry: createSparkRetry(),
      auth: createSparkAuth(),
      hash: createSparkHash(),
      transform: createSparkTransform(),
    },
  };
}
