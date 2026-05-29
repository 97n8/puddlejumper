import { useState, useEffect } from 'react'
import { ChatCircle, Bell, X, PaperPlaneTilt, Warning, Desktop, ArrowSquareOut, Globe } from '@phosphor-icons/react'
import { civicApi } from '../api/civicApi'

interface WatchEvent {
  id: string
  flag_type: string
  created_at: string
  object_id?: string
}

interface MobileDockProps {
  watchEvents?: WatchEvent[]
}

type DockTab = 'ask' | 'now' | 'help'

export function MobileDock({ watchEvents = [] }: MobileDockProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DockTab>('ask')
  const [question, setQuestion] = useState('')
  const [aiReply, setAiReply] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [townName, setTownName] = useState<string | null>(null)

  useEffect(() => {
    civicApi.get<{ town?: { name?: string } }>('/org-manager/status')
      .then(r => { if (r?.town?.name) setTownName(r.town.name) })
      .catch(() => null)
  }, [])

  const sendQuestion = async () => {
    if (!question.trim()) return
    setAiLoading(true); setAiError(null); setAiReply(null)
    try {
      const res = await civicApi.post<{ code?: string; response?: string }>('/assistant/ask', { question })
      if (res.code === 'AI_UNAVAILABLE') {
        setAiError('AI assistant is not available. Contact your administrator.')
      } else {
        setAiReply(res.response ?? JSON.stringify(res))
      }
    } catch {
      setAiError('Unable to connect. Check your network.')
    }
    setAiLoading(false)
  }

  const townWebsiteUrl = townName
    ? `https://www.${townName.toLowerCase().replace(/\s+/g, '')}ma.gov`
    : null

  const TABS: { id: DockTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ask',  label: 'Ask',  icon: <ChatCircle size={18} weight="duotone" /> },
    { id: 'now',  label: 'Now',  icon: <Bell size={18} weight="duotone" /> },
    { id: 'help', label: 'Help', icon: <Desktop size={18} weight="duotone" /> },
  ]

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-12 h-12 bg-red-700 hover:bg-red-600 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-105">
          <ChatCircle size={22} weight="duotone" />
          {watchEvents.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-bold flex items-center justify-center">
              {watchEvents.length}
            </span>
          )}
        </button>
      )}

      {/* Dock panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-80 h-[440px] bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-border">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  activeTab === t.id ? 'text-red-400 border-b-2 border-red-500' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* Ask */}
            {activeTab === 'ask' && (
              <div className="flex flex-col h-full gap-3">
                {aiReply && (
                  <div className="bg-muted/60 border border-border/50 rounded-xl p-3">
                    <p className="text-xs text-foreground/80 leading-relaxed">{aiReply}</p>
                  </div>
                )}
                {aiError && (
                  <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-800/40 rounded-xl p-3">
                    <Warning size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-300">{aiError}</p>
                  </div>
                )}
                {!aiReply && !aiError && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <ChatCircle size={32} className="text-muted-foreground/60 mb-2" weight="duotone" />
                    <p className="text-xs text-muted-foreground">Ask a governance question</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">MGL compliance, deadlines, procedures</p>
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  <input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendQuestion()}
                    placeholder="Ask anything…"
                    className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                  />
                  <button onClick={sendQuestion} disabled={aiLoading || !question.trim()}
                    className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white transition disabled:opacity-40">
                    {aiLoading ? <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" /> : <PaperPlaneTilt size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Now / Watch Events */}
            {activeTab === 'now' && (
              <div className="flex flex-col gap-2">
                {watchEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell size={28} className="text-muted-foreground/60 mx-auto mb-2" weight="duotone" />
                    <p className="text-xs text-muted-foreground">No active flags on your objects</p>
                  </div>
                ) : (
                  watchEvents.map(ev => (
                    <div key={ev.id} className="flex items-start gap-2 p-3 bg-muted/50 rounded-xl">
                      <Warning size={14} className="text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-foreground font-medium">{ev.flag_type.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Help — desktop link + town website */}
            {activeTab === 'help' && (
              <div className="flex flex-col gap-3 py-2">
                <a
                  href={window.location.origin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-muted/60 border border-border/50 rounded-xl hover:bg-muted transition-colors active:scale-[0.97]"
                >
                  <Desktop size={20} weight="duotone" className="text-foreground/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">Open on a computer</p>
                    <p className="text-[10px] text-muted-foreground">Full layout with all tools and panels</p>
                  </div>
                  <ArrowSquareOut size={13} className="text-muted-foreground/50 shrink-0" />
                </a>
                {townWebsiteUrl ? (
                  <a
                    href={townWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-muted/60 border border-border/50 rounded-xl hover:bg-muted transition-colors active:scale-[0.97]"
                  >
                    <Globe size={20} weight="duotone" className="text-foreground/70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">Town Website</p>
                      <p className="text-[10px] text-muted-foreground truncate">{townWebsiteUrl}</p>
                    </div>
                    <ArrowSquareOut size={13} className="text-muted-foreground/50 shrink-0" />
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-border/30 rounded-xl">
                    <Globe size={20} weight="duotone" className="text-muted-foreground/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Town Website</p>
                      <p className="text-[10px] text-muted-foreground/60">Configure in Org Manager to enable this link</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
