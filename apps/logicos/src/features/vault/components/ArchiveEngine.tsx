import { useState, memo } from 'react'
import { ArrowLeft, Shield, CheckCircle, Warning } from '@phosphor-icons/react'
import type { VaultCase, ArchiveEntry } from '../types'
import { generateBossHTML } from '../utils/generateBossHTML'
import { pjApi } from '@/services/pjApi'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ArchiveEngine')

export const ArchiveEngine = memo(function ArchiveEngine({
  envId: _envId,
  town,
  allCases,
  archiveLog,
  getConnector,
  onArchive,
  onBack,
}: {
  envId: string
  town: string
  allCases: VaultCase[]
  archiveLog: ArchiveEntry[]
  getConnector: (moduleId: string) => string
  onArchive: (entry: ArchiveEntry) => void
  onBack: () => void
}) {
  const [running, setRunning] = useState<string | null>(null)
  const [, setLastRun] = useState<number | null>(null)
  const closedCases = allCases.filter(c => c.currentStage === 'CLOSED')
  const archivedIds = new Set(archiveLog.filter(e => e.success).map(e => e.caseId))
  const unarchived = closedCases.filter(c => !archivedIds.has(c.id))

  async function archiveCase(vaultCase: VaultCase) {
    setRunning(vaultCase.id)
    try {
      const provider = getConnector(vaultCase.moduleId)
      const html = await generateBossHTML(vaultCase, town, provider !== 'none' ? provider as 'microsoft' | 'google' | 'github' : undefined)
      const filename = `${vaultCase.caseNumber}-archive-${new Date().toISOString().slice(0, 10)}.html`

      let success = true
      let error: string | undefined

      if (provider !== 'none') {
        try {
          await pjApi.cloudSave({
            provider: provider as 'microsoft' | 'google' | 'github',
            filename,
            contentBase64: btoa(unescape(encodeURIComponent(html))),
            mimeType: 'text/html',
          })
        } catch (e) {
          success = false
          error = e instanceof Error ? e.message : 'Upload failed'
        }
      }

      // Always download locally too
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      onArchive({
        id: crypto.randomUUID(),
        caseId: vaultCase.id,
        caseNumber: vaultCase.caseNumber,
        timestamp: Date.now(),
        provider,
        filename,
        success,
        error,
      })
      setLastRun(Date.now())
    } catch (error) {
      logger.error('Archive action failed.', error)
    } finally {
      setRunning(null)
    }
  }

  async function archiveAll() {
    for (const c of unarchived) {
      await archiveCase(c)
    }
  }

  function fmtTs(ts: number) {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button aria-label="Go back" onClick={onBack} className="text-muted-foreground hover:text-foreground/80 transition-colors"><ArrowLeft size={18} /></button>
          <div>
            <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Archive Engine</div>
            <div className="font-semibold text-foreground">{town} — Record Archive</div>
          </div>
        </div>
        {unarchived.length > 0 && (
          <button onClick={archiveAll} disabled={!!running}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-foreground px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            <Shield size={14} /> Archive All ({unarchived.length})
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6">

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-foreground">{closedCases.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Closed Cases</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-emerald-400">{archivedIds.size}</div>
            <div className="text-xs text-muted-foreground mt-1">Archived</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className={`text-2xl font-bold ${unarchived.length > 0 ? 'text-amber-400' : 'text-white'}`}>{unarchived.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Pending Archive</div>
          </div>
        </div>

        {/* Connector routing */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Connector Routing</div>
          <div className="space-y-2">
            {['VAULTPRR', 'VAULTDOG', 'VAULTCLERK', 'VAULTFISCAL', 'VAULTFIX', 'VAULTONBOARD', 'VAULTTIME']
              .filter(mid => allCases.some(c => c.moduleId === mid))
              .map(mid => {
                const connector = getConnector(mid)
                return (
                  <div key={mid} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-mono text-xs">{mid}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${connector !== 'none' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-slate-700 text-muted-foreground'}`}>
                      {connector === 'none' ? '— Local only' : connector === 'microsoft' ? '📁 SharePoint' : connector === 'google' ? '📂 Drive' : '🐙 GitHub'}
                    </span>
                  </div>
                )
              })}
            {!allCases.some(c => c.moduleId) && (
              <div className="text-sm text-muted-foreground">No cases yet.</div>
            )}
          </div>
        </div>

        {/* Unarchived cases */}
        {unarchived.length > 0 && (
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">⚠ Pending Archive</div>
            <div className="space-y-2">
              {unarchived.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-card border border-amber-800/30 rounded-xl px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.caseNumber}</div>
                    <div className="text-xs text-muted-foreground">{c.moduleId} · Closed</div>
                  </div>
                  <button onClick={() => archiveCase(c)} disabled={running === c.id}
                    className="text-xs bg-amber-900/40 hover:bg-amber-800/50 border border-amber-700/50 text-amber-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                    {running === c.id ? 'Archiving…' : 'Archive Now'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Archive log */}
        <div>
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Archive Log</div>
          {archiveLog.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
              No archives yet. Archive a closed case to create the first record.
            </div>
          ) : (
            <div className="space-y-1">
              {[...archiveLog].reverse().map(entry => (
                <div key={entry.id} className="flex items-center gap-3 py-2.5 border-b border-slate-800">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${entry.success ? 'bg-emerald-900/50' : 'bg-red-900/50'}`}>
                    {entry.success ? <CheckCircle size={12} className="text-emerald-400" /> : <Warning size={12} className="text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{entry.caseNumber}</span>
                      <span className="text-xs text-muted-foreground">{entry.filename}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtTs(entry.timestamp)} · {entry.provider === 'none' ? 'Local download only' : entry.provider}
                      {entry.error && <span className="text-red-400 ml-2">{entry.error}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
)  // end memo
