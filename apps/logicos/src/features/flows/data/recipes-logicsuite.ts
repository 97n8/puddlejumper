import { pjApi } from '@/services/pjApi'
import type { Recipe, Connection } from '../types'

export const recipesLogicsuite: Recipe[] = [
  {
    id: 'ls-seal-verify', name: 'Verify a SEAL token',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Show verification result', canRunNow: true,
    connection: 'logicsuite' as Connection,
    configFields: [
      { key: 'token', label: 'SEAL token (paste JSON)', placeholder: '{"keyId":"esk-…","signature":"…"}', required: true, type: 'textarea' as const },
      { key: 'tenantId', label: 'Tenant ID', placeholder: 'sutton', required: true },
    ],
    run: async (cfg) => {
      const parsed = JSON.parse(cfg.token)
      const artifact = parsed.artifact ?? ''
      const token = parsed.token ?? parsed
      const result = await pjApi.seal.verify(artifact, token)
      if (result.valid) return `✅ Valid — key ${result.keyId} · signed ${result.signedAt ? new Date(result.signedAt).toLocaleString() : 'unknown'}`
      return `❌ Invalid — ${result.reason ?? 'verification failed'}`
    },
  },

  {
    id: 'ls-seal-public-key', name: 'Get SEAL public key for a tenant',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy PEM to clipboard', canRunNow: true,
    connection: 'logicsuite' as Connection,
    configFields: [
      { key: 'tenantId', label: 'Tenant ID', placeholder: 'sutton', required: true },
    ],
    run: async (cfg) => {
      const result = await pjApi.seal.publicKey(cfg.tenantId, '')
      const pem = result?.publicKeyPem ?? ''
      await navigator.clipboard.writeText(pem)
      return `Key ${result?.keyId} copied · ${result?.algorithm ?? 'P-256'}`
    },
  },

  {
    id: 'ls-archieve-search', name: 'Search ARCHIEVE audit events',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy report to clipboard', canRunNow: true,
    connection: 'logicsuite' as Connection,
    configFields: [
      { key: 'query', label: 'Keyword or event type', placeholder: 'SEAL_SIGNED or actor email…', required: true },
      { key: 'limit', label: 'Max results', placeholder: '20', type: 'number' as const },
    ],
    run: async (cfg) => {
      const limit = parseInt(cfg.limit || '20', 10)
      const result = await pjApi.archieve.events({ eventType: cfg.query, limit })
      const events = result?.events ?? []
      if (events.length === 0) { return 'No events found' }
      const lines = events.map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.eventType} — ${e.actor?.userId ?? '—'}`)
      await navigator.clipboard.writeText(lines.join('\n'))
      return `${events.length} events copied to clipboard`
    },
  },

  {
    id: 'ls-syncronate-feeds', name: 'List Syncronate feed statuses',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy status to clipboard', canRunNow: true,
    connection: 'logicsuite' as Connection,
    configFields: [],
    run: async () => {
      const result = await pjApi.syncronate.listFeeds() as { feeds?: { id: string; name: string; enabled: boolean; lastRunAt?: string; lastRunStatus?: string }[] }
      const feeds = result?.feeds ?? []
      if (feeds.length === 0) return 'No feeds configured'
      const lines = feeds.map(f => `${f.enabled ? '✅' : '⏸️'} ${f.name} — ${f.lastRunStatus ?? 'never run'}${f.lastRunAt ? ` (${new Date(f.lastRunAt).toLocaleString()})` : ''}`)
      await navigator.clipboard.writeText(lines.join('\n'))
      return `${feeds.length} feeds copied`
    },
  },

  {
    id: 'ls-syncronate-trigger', name: 'Trigger a Syncronate feed now',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Trigger sync', canRunNow: true,
    connection: 'logicsuite' as Connection,
    configFields: [
      { key: 'feedId', label: 'Feed ID', placeholder: 'feed-uuid', required: true },
    ],
    run: async (cfg) => {
      const result = await pjApi.syncronate.triggerSync(cfg.feedId) as { jobId?: string; status?: string }
      return `Feed triggered · job ${result?.jobId ?? '—'} · ${result?.status ?? 'queued'}`
    },
  },
]
