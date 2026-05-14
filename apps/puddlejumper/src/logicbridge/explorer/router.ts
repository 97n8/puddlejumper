import { Router, type Request, type Response } from 'express';
import type { ConnectorStore } from '../../api/connectorStore.js';

// API Explorer backend — proxies requests server-side using stored connector tokens
// V1: reuse tokens from connectorStore

let _connectorStore: ConnectorStore | null = null;

export function initExplorer(store: ConnectorStore): void {
  _connectorStore = store;
}

type ExplorerProvider = 'github' | 'microsoft' | 'google' | 'pj';
type StoredProvider = 'github' | 'microsoft' | 'google';

export function createExplorerRouter(): Router {
  const router = Router();

  // POST /api/logicbridge/explore — proxy an API request using stored credentials
  router.post('/', async (req: Request, res: Response) => {
    const { provider, url, method = 'GET', headers: extraHeaders = {}, body, tenantId, userId } = req.body as {
      provider: ExplorerProvider;
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      tenantId?: string;
      userId?: string;
    };

    if (!url || !provider) {
      res.status(400).json({ error: 'provider and url are required' });
      return;
    }

    const tid = tenantId ?? (req as any).auth?.tenantId ?? '';
    const uid = userId ?? (req as any).auth?.userId ?? '';

    const authHeaders = await resolveAuthHeaders(provider, tid, uid, req);
    if (!authHeaders) {
      res.status(401).json({ error: `No stored credentials for provider '${provider}'` });
      return;
    }

    try {
      const fetchRes = await fetch(url, {
        method: method.toUpperCase(),
        headers: { ...authHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
        body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
      });

      const responseBody = await fetchRes.text();
      let parsed: unknown;
      try { parsed = JSON.parse(responseBody); } catch { parsed = responseBody; }

      res.status(fetchRes.status).json({
        status: fetchRes.status,
        ok: fetchRes.ok,
        body: parsed,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

async function resolveAuthHeaders(
  provider: ExplorerProvider,
  tenantId: string,
  userId: string,
  req: Request
): Promise<Record<string, string> | null> {
  if (!_connectorStore) return null;

  if (provider === 'pj') {
    const token = req.headers.authorization;
    return token ? { Authorization: token } : null;
  }

  const token = _connectorStore.getToken(provider as StoredProvider, tenantId, userId);
  if (!token) return null;

  switch (provider) {
    case 'github':
      return { Authorization: `token ${token.accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'puddlejumper-logicbridge' };
    case 'microsoft':
      return { Authorization: `Bearer ${token.accessToken}` };
    case 'google':
      return { Authorization: `Bearer ${token.accessToken}` };
    default:
      return null;
  }
}
