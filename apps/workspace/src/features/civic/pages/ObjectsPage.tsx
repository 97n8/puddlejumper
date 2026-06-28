import { useState, useEffect } from 'react'
import { civicApi } from '../api/civicApi'
import type { CivicObject } from '../api/civicApi'

const VAULT_CLASS_BADGE: Record<string, string> = {
  public: 'bg-green-800 text-green-200',
  internal: 'bg-blue-800 text-blue-200',
  restricted: 'bg-amber-800 text-amber-200',
  privileged: 'bg-red-800 text-red-200',
  permanent: 'bg-purple-800 text-purple-200',
  unset: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-800/50 text-green-300',
  open: 'bg-blue-800/50 text-blue-300',
  in_progress: 'bg-amber-800/50 text-amber-300',
  under_review: 'bg-purple-800/50 text-purple-300',
  searching: 'bg-red-800/50 text-red-300',
  executed: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
}

export function ObjectsPage() {
  const [objects, setObjects] = useState<CivicObject[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ type: '', subtype: '', status: '', vault_class: '' })
  const [selected, setSelected] = useState<CivicObject | null>(null)
  const [detail, setDetail] = useState<{ object: CivicObject; audit: unknown[] } | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (filter.type) params.type = filter.type
    if (filter.subtype) params.subtype = filter.subtype
    if (filter.status) params.status = filter.status
    if (filter.vault_class) params.vault_class = filter.vault_class
    civicApi.objects(params)
      .then(r => setObjects(r.objects))
      .catch(() => setObjects([]))
      .finally(() => setLoading(false))
  }, [filter])

  const handleRowClick = async (obj: CivicObject) => {
    setSelected(obj)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const d = await civicApi.getObject(obj.id)
      setDetail(d)
    } catch {
      setDetailError('Could not load details. Try again.')
    } finally {
      setDetailLoading(false)
    }
  }

  const parseData = (obj: CivicObject) => obj.data ?? {}

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Object Table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="px-5 py-3 border-b border-border flex gap-3 items-center">
          <h2 className="text-foreground font-bold text-sm">Objects</h2>
          <div className="flex gap-2 ml-4">
            <select
              value={filter.type}
              onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
              className="bg-muted border border-border text-muted-foreground text-xs rounded px-2 py-1"
            >
              <option value="">All types</option>
              <option value="actor">Actor</option>
              <option value="body">Body</option>
              <option value="record">Record</option>
              <option value="workflow">Workflow</option>
            </select>
            <input
              value={filter.subtype}
              onChange={e => setFilter(f => ({ ...f, subtype: e.target.value }))}
              placeholder="Subtype…"
              className="bg-muted border border-border text-muted-foreground text-xs rounded px-2 py-1 w-32"
            />
            <select
              value={filter.vault_class}
              onChange={e => setFilter(f => ({ ...f, vault_class: e.target.value }))}
              className="bg-muted border border-border text-muted-foreground text-xs rounded px-2 py-1"
            >
              <option value="">All classes</option>
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="restricted">Restricted</option>
              <option value="unset">⚠ Unset</option>
            </select>
          </div>
          <span className="ml-auto text-muted-foreground/60 text-xs">{objects.length} object{objects.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : objects.length === 0 ? (
            <p className="text-muted-foreground/60 text-sm text-center py-12">No objects match the current filters.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2 text-muted-foreground/60 font-medium">Type</th>
                  <th className="px-4 py-2 text-muted-foreground/60 font-medium">Subtype</th>
                  <th className="px-4 py-2 text-muted-foreground/60 font-medium">Status</th>
                  <th className="px-4 py-2 text-muted-foreground/60 font-medium">VAULT Class</th>
                  <th className="px-4 py-2 text-muted-foreground/60 font-medium">Stage</th>
                  <th className="px-4 py-2 text-muted-foreground/60 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {objects.map(obj => (
                  <tr
                    key={obj.id}
                    onClick={() => handleRowClick(obj)}
                    className={`border-b border-border/50 cursor-pointer transition ${
                      selected?.id === obj.id ? 'bg-muted' : 'hover:bg-muted/50'
                    }`}
                  >
                    <td className="px-4 py-2 text-muted-foreground">{obj.type}</td>
                    <td className="px-4 py-2 text-foreground/80 font-medium">{obj.subtype}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[obj.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {obj.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${VAULT_CLASS_BADGE[obj.vault_class] ?? 'bg-muted text-muted-foreground'}`}>
                        {obj.vault_class}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{obj.stage}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(obj.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="w-80 border-l border-border flex flex-col bg-card overflow-y-auto">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-foreground font-bold text-sm">{selected.subtype}</h3>
            <button onClick={() => { setSelected(null); setDetail(null); setDetailError(null) }} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
          </div>
          {detailLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {detailError && !detailLoading && (
            <div className="p-4 text-center">
              <p className="text-muted-foreground text-xs mb-2">{detailError}</p>
              <button onClick={() => handleRowClick(selected)} className="text-xs text-red-600 hover:text-red-500 underline">Retry</button>
            </div>
          )}
          {!detailLoading && !detailError && (
          <div className="p-4 space-y-3 text-xs">
            <div>
              <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">ID</p>
              <p className="text-muted-foreground font-mono break-all">{selected.id}</p>
            </div>
            <div className="flex gap-3">
              <div>
                <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">Stage</p>
                <p className="text-foreground/80">{selected.stage}</p>
              </div>
              <div>
                <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">Status</p>
                <p className="text-foreground/80">{selected.status}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">VAULT Class</p>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${VAULT_CLASS_BADGE[selected.vault_class] ?? 'bg-muted text-muted-foreground'}`}>
                {selected.vault_class}
              </span>
            </div>
            {Object.keys(parseData(selected)).length > 0 && (
              <div>
                <p className="text-muted-foreground/60 uppercase tracking-wide mb-1">Data</p>
                {Object.entries(parseData(selected)).map(([k, v]) => (
                  <div key={k} className="flex gap-2 py-0.5">
                    <span className="text-muted-foreground/60 shrink-0 w-28 truncate">{k}</span>
                    <span className="text-foreground/80">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {detail?.audit && detail.audit.length > 0 && (
              <div>
                <p className="text-muted-foreground/60 uppercase tracking-wide mb-2 mt-2">Recent Audit</p>
                <div className="space-y-1.5">
                  {(detail.audit as Array<{ id: string; action: string; actor_display: string | null; created_at: string }>)
                    .slice(0, 5).map(entry => (
                      <div key={entry.id} className="border-l-2 border-border pl-2">
                        <p className="text-foreground/80 font-medium">{entry.action}</p>
                        <p className="text-muted-foreground/60">{entry.actor_display} · {new Date(entry.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  )
}
