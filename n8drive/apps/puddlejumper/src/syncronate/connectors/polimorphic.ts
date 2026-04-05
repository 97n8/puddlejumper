import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FeedDef } from '../types.js';

export interface PolimorphicEvent {
  eventId: string;
  eventType: string;
  tenantId?: string;
  resourceId?: string;
  resourceType?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

function getWebhookSecret(tenantId: string): string | null {
  const key = `POLIMORPHIC_WEBHOOK_SECRET_${tenantId.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] ?? null;
}

function getPat(tenantId: string): string | null {
  const key = `POLIMORPHIC_PAT_${tenantId.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] ?? null;
}

export function verifyWebhookSignature(body: Buffer, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const sigBuf = Buffer.from(sigHex, 'hex');
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

export async function handleWebhookEvent(
  event: PolimorphicEvent,
  feedDef: FeedDef,
  _db: Database.Database
): Promise<void> {
  // Route by event type per §5.2
  // V1: log and return. The sync-engine processes via record pipeline
  console.info(`[syncronate/polimorphic] webhook event ${event.eventType} for feed ${feedDef.feedId}`);
}

export async function pollEvents(
  feedDef: FeedDef,
  sinceISO: string
): Promise<PolimorphicEvent[]> {
  const tenantId = feedDef.tenantId;
  const pat = getPat(tenantId);
  if (!pat) {
    console.warn(`[syncronate/polimorphic] No PAT for tenant ${tenantId}`);
    return [];
  }

  const baseUrl = feedDef.source.config.baseUrl as string | undefined;
  if (!baseUrl) {
    throw new Error('Polimorphic source config missing baseUrl');
  }

  const url = `${baseUrl}/events?since=${encodeURIComponent(sinceISO)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Polimorphic poll error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { events?: PolimorphicEvent[] };
  return data.events ?? [];
}

export function getWebhookSecretForFeed(feedDef: FeedDef): string | null {
  return getWebhookSecret(feedDef.tenantId);
}
