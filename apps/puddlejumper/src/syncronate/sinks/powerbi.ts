import type { FeedDef, SinkConnectorDef } from '../types.js';
import { sealSign } from '../../seal/index.js';
import { scan as dlpScan, applyDlp } from '../dlp-engine.js';

export interface DeliveryResult {
  pushedBatches: number;
  totalRows: number;
  sealToken?: unknown;
  blocked: boolean;
  error?: string;
}

function getPowerBiCreds(tenantId: string): { clientId: string; clientSecret: string; powerBiTenantId: string } | null {
  const clientId = process.env[`POWERBI_CLIENT_ID_${tenantId}`];
  const clientSecret = process.env[`POWERBI_CLIENT_SECRET_${tenantId}`];
  const powerBiTenantId = process.env[`POWERBI_TENANT_ID_${tenantId}`];
  if (!clientId || !clientSecret || !powerBiTenantId) return null;
  return { clientId, clientSecret, powerBiTenantId };
}

async function getOAuthToken(creds: { clientId: string; clientSecret: string; powerBiTenantId: string }): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: 'https://analysis.windows.net/powerbi/api/.default',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${creds.powerBiTenantId}/oauth2/v2.0/token`,
    { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  if (!res.ok) throw new Error(`PowerBI OAuth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function pushBatchWithRetry(
  url: string,
  token: string,
  batch: Record<string, unknown>[]
): Promise<void> {
  const BASE_DELAY = 2000;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: batch }),
    });

    if (res.status === 429 || res.status >= 500) {
      await new Promise(r => setTimeout(r, BASE_DELAY * (attempt + 1)));
      lastErr = new Error(`PowerBI push failed: ${res.status}`);
      continue;
    }
    if (!res.ok) throw new Error(`PowerBI push failed: ${res.status} ${res.statusText}`);
    return;
  }
  throw lastErr ?? new Error('PowerBI push failed after retries');
}

export async function deliverRows(
  feedDef: FeedDef,
  sinkDef: SinkConnectorDef,
  rows: Record<string, unknown>[],
  syncJobId: string
): Promise<DeliveryResult> {
  const tenantId = feedDef.tenantId;
  const creds = getPowerBiCreds(tenantId);
  if (!creds) {
    console.warn(`[syncronate/powerbi] Missing credentials for tenant ${tenantId}`);
    return { pushedBatches: 0, totalRows: 0, blocked: false, error: 'Missing Power BI credentials' };
  }

  // Outbound DLP scan
  for (const row of rows) {
    const findings = dlpScan(row, feedDef.syncConfig);
    const { blocked } = applyDlp(row, findings, feedDef.syncConfig.dlpOutboundAction ?? 'mask');
    if (blocked) {
      return { pushedBatches: 0, totalRows: 0, blocked: true };
    }
  }

  const datasetId = sinkDef.config.datasetId as string;
  const tableId = sinkDef.config.tableId as string;
  if (!datasetId || !tableId) {
    return { pushedBatches: 0, totalRows: 0, blocked: false, error: 'Missing datasetId or tableId in sink config' };
  }

  const token = await getOAuthToken(creds);
  const pushUrl = `https://api.powerbi.com/v1.0/myorg/datasets/${datasetId}/tables/${tableId}/rows`;

  let pushedBatches = 0;
  const BATCH_SIZE = 100;
  let lastSealToken: unknown;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    // SEAL sign each row
    const signedBatch = await Promise.all(
      batch.map(async row => {
        try {
          const artifact = Buffer.from(JSON.stringify(row));
          const sealToken = await sealSign(artifact, {
            tenantId,
            callerModule: 'SYNCRONATE',
            callerContext: `powerbi-sink:${syncJobId}`,
          });
          lastSealToken = sealToken;
          return { ...row, __sealToken: sealToken.signature };
        } catch {
          return row;
        }
      })
    );

    await pushBatchWithRetry(pushUrl, token, signedBatch);
    pushedBatches++;
  }

  return { pushedBatches, totalRows: rows.length, sealToken: lastSealToken, blocked: false };
}
