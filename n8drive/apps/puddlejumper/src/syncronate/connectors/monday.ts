import type { FeedDef } from '../types.js';

export interface MondayItem {
  id: string;
  name: string;
  updated_at?: string;
  column_values?: Array<{ id: string; text: string; value: string }>;
  [key: string]: unknown;
}

interface MondayPage {
  items: MondayItem[];
  nextCursor: string | null;
}

function getCredential(tenantId: string): string | null {
  const key = `MONDAY_PAT_${tenantId.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] ?? null;
}

function maskPii(item: MondayItem): MondayItem {
  if (!item.column_values) return item;
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const phoneRe = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  return {
    ...item,
    column_values: item.column_values.map(col => {
      if (col.text) {
        const masked = col.text.replace(emailRe, '[MASKED-EMAIL]').replace(phoneRe, '[MASKED-PHONE]');
        return { ...col, text: masked };
      }
      return col;
    }),
  };
}

async function mondayFetch(
  pat: string,
  query: string,
  variables: Record<string, unknown>
): Promise<unknown> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pat,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1000));
      lastErr = new Error('Monday.com rate limited');
      continue;
    }

    if (!res.ok) {
      throw new Error(`Monday.com API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }
  throw lastErr ?? new Error('Monday.com fetch failed');
}

export async function fetchPage(
  feedDef: FeedDef,
  cursor: string | null,
  batchSize = 50
): Promise<MondayPage> {
  const tenantId = feedDef.tenantId;
  const pat = getCredential(tenantId);
  if (!pat) {
    console.warn(`[syncronate/monday] No PAT for tenant ${tenantId}`);
    return { items: [], nextCursor: null };
  }

  const boardId = feedDef.source.config.boardId as string | undefined;
  if (!boardId) {
    throw new Error('Monday.com source config missing boardId');
  }

  // Use cursor-based pagination
  const query = `
    query ($boardId: ID!, $limit: Int!, $cursor: String) {
      boards(ids: [$boardId]) {
        items_page(limit: $limit, cursor: $cursor) {
          cursor
          items {
            id
            name
            updated_at
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `;

  const data = await mondayFetch(pat, query, {
    boardId,
    limit: batchSize,
    cursor: cursor ?? null,
  }) as any;

  const itemsPage = data?.data?.boards?.[0]?.items_page;
  if (!itemsPage) {
    return { items: [], nextCursor: null };
  }

  const items: MondayItem[] = (itemsPage.items ?? []).map(maskPii);
  const nextCursor: string | null = itemsPage.cursor ?? null;

  return { items, nextCursor };
}
