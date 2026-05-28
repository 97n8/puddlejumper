import { useState, useEffect } from 'react'
import { civicApi } from '../api/civicApi'
import type { CivicTemplate } from '../api/civicApi'

const CAT_COLORS: Record<string, string> = {
  oml: 'bg-blue-800 text-blue-200',
  records: 'bg-amber-800 text-amber-200',
  procurement: 'bg-purple-800 text-purple-200',
  governance: 'bg-green-800 text-green-200',
  permitting: 'bg-cyan-800 text-cyan-200',
  finance: 'bg-yellow-800 text-yellow-200',
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<CivicTemplate[]>([])
  const [selected, setSelected] = useState<CivicTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    civicApi.templates()
      .then(r => setTemplates(r.templates))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  )

  const categories = [...new Set(templates.map(t => t.category))]

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Template List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-3">
          <h2 className="text-foreground font-bold text-sm">Templates</h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="ml-4 bg-muted border border-border text-muted-foreground text-xs rounded px-3 py-1.5 w-52"
          />
          <span className="ml-auto text-muted-foreground/60 text-xs">{filtered.length} of {templates.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {categories.map(cat => {
            const catTemplates = filtered.filter(t => t.category === cat)
            if (catTemplates.length === 0) return null
            return (
              <div key={cat} className="mb-5">
                <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-2 px-1">{cat}</p>
                <div className="space-y-1">
                  {catTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${
                        selected?.id === t.id
                          ? 'bg-muted border-border/80'
                          : 'bg-muted/50 border-border hover:bg-muted hover:border-border/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-foreground/80 text-xs font-medium flex-1">{t.name}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${CAT_COLORS[t.category] ?? 'bg-muted text-muted-foreground'}`}>
                          {t.category}
                        </span>
                      </div>
                      {(() => {
                        try {
                          const vars: string[] = JSON.parse(t.variables)
                          return vars.length > 0 ? (
                            <p className="text-muted-foreground/60 text-[10px] mt-1">{vars.length} variable{vars.length !== 1 ? 's' : ''}: {vars.slice(0, 3).join(', ')}{vars.length > 3 ? '…' : ''}</p>
                          ) : null
                        } catch { return null }
                      })()}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Preview Panel */}
      {selected && (
        <div className="w-96 border-l border-border flex flex-col bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-foreground font-bold text-sm">{selected.name}</h3>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${CAT_COLORS[selected.category] ?? 'bg-muted text-muted-foreground'}`}>
                {selected.category}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {(() => {
              try {
                const vars: string[] = JSON.parse(selected.variables)
                return vars.length > 0 ? (
                  <div className="mb-4">
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-bold mb-2">Variables</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vars.map(v => (
                        <span key={v} className="bg-muted border border-border text-muted-foreground text-[10px] px-1.5 py-0.5 rounded font-mono">
                          {'{{'}{v}{'}}'}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null
              } catch { return null }
            })()}
            <p className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-bold mb-2">Body Preview</p>
            <pre className="text-foreground/80 text-xs leading-relaxed whitespace-pre-wrap font-mono bg-muted/50 rounded-lg p-3">
              {selected.body}
            </pre>
            <button className="mt-4 w-full py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition">
              Use Template →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
