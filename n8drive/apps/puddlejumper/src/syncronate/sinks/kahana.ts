import type { FeedDef, SinkConnectorDef } from '../types.js';
import { sealSignManifest } from '../../seal/index.js';
import { scan as dlpScan, applyDlp } from '../dlp-engine.js';
import JSZip from 'jszip';

export interface KahanaDocument {
  id: string;
  name: string;
  content: string | Buffer;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

function getKahanaApiKey(tenantId: string): string | null {
  return process.env[`KAHANA_API_KEY_${tenantId}`] ?? null;
}

export async function buildBundle(
  feedDef: FeedDef,
  sinkDef: SinkConnectorDef,
  documents: KahanaDocument[],
  syncJobId: string
): Promise<Buffer> {
  const tenantId = feedDef.tenantId;

  // DLP clearance check on all documents
  for (const doc of documents) {
    const content = typeof doc.content === 'string' ? doc.content : doc.content.toString('utf-8');
    const findings = dlpScan({ content }, feedDef.syncConfig);
    const { blocked } = applyDlp({ content }, findings, feedDef.syncConfig.dlpOutboundAction ?? 'mask');
    if (blocked) {
      throw new Error(`DLP block on document ${doc.id}`);
    }
  }

  const zip = new JSZip();

  // manifest.json per spec §10.2
  const manifest = {
    version: '1.0',
    feedId: feedDef.feedId,
    tenantId,
    syncJobId,
    createdAt: new Date().toISOString(),
    documentCount: documents.length,
    documents: documents.map(d => ({ id: d.id, name: d.name, mimeType: d.mimeType ?? 'application/octet-stream' })),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // SEAL sign manifest
  try {
    const sealToken = await sealSignManifest(manifest, {
      tenantId,
      callerModule: 'SYNCRONATE',
      callerContext: `kahana-sink:${syncJobId}`,
    });
    zip.file('manifest.sig', JSON.stringify(sealToken, null, 2));
  } catch (err) {
    console.warn(`[syncronate/kahana] SEAL sign manifest failed: ${(err as Error).message}`);
    zip.file('manifest.sig', JSON.stringify({ error: 'signing unavailable' }));
  }

  // metadata.json
  const metadata = {
    feedId: feedDef.feedId,
    displayName: feedDef.displayName,
    source: feedDef.source.type,
    sinkConfig: sinkDef.config,
    exportedAt: new Date().toISOString(),
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // documents/ folder
  const docFolder = zip.folder('documents')!;
  const summariesFolder = zip.folder('summaries')!;

  for (const doc of documents) {
    const content = typeof doc.content === 'string' ? doc.content : doc.content;
    docFolder.file(doc.name, content);

    // summary stub
    const summary = {
      id: doc.id,
      name: doc.name,
      size: typeof doc.content === 'string' ? doc.content.length : doc.content.byteLength,
      metadata: doc.metadata ?? {},
    };
    summariesFolder.file(`${doc.id}.json`, JSON.stringify(summary, null, 2));
  }

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  return Buffer.from(arrayBuffer);
}

export async function deliver(bundle: Buffer, feedDef: FeedDef, sinkDef: SinkConnectorDef): Promise<void> {
  const tenantId = feedDef.tenantId;
  const apiKey = getKahanaApiKey(tenantId);
  const endpoint = sinkDef.config.endpoint as string | undefined;

  if (!endpoint || !apiKey) {
    console.info(`[syncronate/kahana] No endpoint/apiKey configured — bundle stub log (${bundle.length} bytes)`);
    return;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/zip',
    },
    body: bundle as unknown as BodyInit,
  });

  if (!res.ok) {
    throw new Error(`Kahana delivery failed: ${res.status} ${res.statusText}`);
  }
}
