import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { useCloudSave } from '@/context/CloudSaveContext'
import { CloudArrowUp } from '@phosphor-icons/react'
import type { EnvironmentConfig, EnvironmentActor } from './types'

interface EnvironmentShellProps {
  config: EnvironmentConfig
  onBack: () => void
  /**
   * Render a module by ID. The third arg `onNavigate` lets modules switch modules.
   * The fourth arg `openCloudSave` lets modules trigger the global cloud save dialog.
   */
  renderModule: (moduleId: string, actor: EnvironmentActor, onNavigate: (moduleId: string) => void, openCloudSave: ReturnType<typeof useCloudSave>['openCloudSave']) => ReactNode
  fetchActor: () => Promise<EnvironmentActor>
  sidebar?: ReactNode
  /** Deep-link: open this module on first render instead of the config default */
  initialModule?: string
}

type EnvironmentShellState =
  | { status: 'loading' }
  | { status: 'auth_required'; message: string }
  | { status: 'unauthorized'; message: string }
  | { status: 'load_error'; message: string }
  | { status: 'ok'; actor: EnvironmentActor }

export function EnvironmentShell({ config, onBack, renderModule, fetchActor, sidebar, initialModule }: EnvironmentShellProps) {
  const { user, loading: authLoading } = useAuth()
  const { openCloudSave } = useCloudSave()
  const [state, setState] = useState<EnvironmentShellState>({ status: 'loading' })
  const availableModuleIds = config.modules.filter(module => !module.comingSoon).map(module => module.id)
  const defaultModuleId = availableModuleIds.includes(config.defaultModule)
    ? config.defaultModule
    : (availableModuleIds[0] ?? config.defaultModule)
  const [activeModule, setActiveModule] = useState(() => (
    initialModule && availableModuleIds.includes(initialModule) ? initialModule : defaultModuleId
  ))
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setState({
        status: 'auth_required',
        message: 'Log in to LogicOS to access this environment.',
      })
      return
    }

    setState({ status: 'loading' })
    try {
      const a = await fetchActor()
      setState({ status: 'ok', actor: a })
    } catch (e: unknown) {
      const status = (e as { status?: number }).status
      if (status === 401) {
        setState({
          status: 'auth_required',
          message: 'Log in to LogicOS to access this environment.',
        })
        return
      }
      if (status === 403) {
        setState({
          status: 'unauthorized',
          message: 'Your account is not authorized for this environment.',
        })
        return
      }
      setState({
        status: 'load_error',
        message: e instanceof Error && e.message
          ? e.message
          : 'Connection failed. Please try again.',
      })
    }
  }, [fetchActor, user])

  useEffect(() => {
    if (authLoading) {
      setState({ status: 'loading' })
      return
    }
    if (!user) {
      setState({
        status: 'auth_required',
        message: 'Log in to LogicOS to access this environment.',
      })
      return
    }
    void load()
  }, [authLoading, user, load])

  useEffect(() => {
    if (initialModule && availableModuleIds.includes(initialModule) && initialModule !== activeModule) {
      setActiveModule(initialModule)
      return
    }
    if (!availableModuleIds.includes(activeModule) && activeModule !== defaultModuleId) {
      setActiveModule(defaultModuleId)
    }
  }, [activeModule, availableModuleIds, defaultModuleId, initialModule])

  const groups = Array.from(new Set(config.modules.map(m => m.group)))

  if (authLoading || state.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className={`w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3 ${
            config.color === 'red' ? 'border-red-600' : 'border-primary'
          }`} />
          <p className="text-muted-foreground text-sm">Opening {config.name}…</p>
        </div>
      </div>
    )
  }

  if (state.status === 'auth_required') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-3xl mb-3">🔒</div>
          <h2 className="text-foreground font-bold text-lg mb-1">{config.name}</h2>
          <p className="text-muted-foreground text-sm mb-4">{state.message}</p>
          <button onClick={onBack} className="w-full py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition">
            ← Back to LogicOS
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'unauthorized') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-3xl mb-3">⛔</div>
          <h2 className="text-foreground font-bold text-lg mb-1">{config.name}</h2>
          <p className="text-muted-foreground text-sm mb-4">{state.message}</p>
          <button onClick={onBack} className="w-full py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition">
            ← Back to LogicOS
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'load_error') {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-3xl mb-3">⚠</div>
          <h2 className="text-foreground font-bold text-lg mb-1">{config.name}</h2>
          <p className="text-muted-foreground text-sm mb-4">{state.message}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => void load()} className="w-full py-2.5 bg-foreground hover:opacity-90 text-background text-sm font-medium rounded-xl transition">
              Retry
            </button>
            <button onClick={onBack} className="w-full py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition">
              ← Back to LogicOS
            </button>
          </div>
        </div>
      </div>
    )
  }

  const resolvedActor = state.actor

  const townName = (resolvedActor.town?.town_name as string | undefined) ?? config.name

  return (
    <div className="flex-1 flex overflow-hidden bg-background text-foreground" data-appearance="dark">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {sidebar ?? (
        <div className={`${sidebarOpen ? 'w-52' : 'w-12'} flex-shrink-0 bg-card border-r border-border flex flex-col transition-all duration-200 overflow-hidden`}>

          {/* Env header */}
          <div className="px-3 py-3 border-b border-border">
            {sidebarOpen ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-black text-sm">{config.name}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">LIVE</span>
                  <button
                    onClick={() => openCloudSave({ provider: 'google', filename: `${config.name.toLowerCase().replace(/\s+/g, '-')}-export.md`, content: '' })}
                    title="Save to cloud"
                    aria-label="Save to cloud"
                    className="ml-auto text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <CloudArrowUp size={13} />
                  </button>
                </div>
                <div className="text-muted-foreground text-[10px] mt-0.5 truncate">{townName}</div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <span>⚖</span>
                <button
                  onClick={() => openCloudSave({ provider: 'google', filename: `${config.name.toLowerCase().replace(/\s+/g, '-')}-export.md`, content: '' })}
                  title="Save to cloud"
                  aria-label="Save to cloud"
                  className="hover:text-foreground transition-colors"
                >
                  <CloudArrowUp size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto py-2 px-1.5">
            {groups.map(group => (
              <div key={group} className="mb-3">
                {sidebarOpen && (
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1">{group}</div>
                )}
                {config.modules
                  .filter(m => m.group === group)
                  .map(mod => (
                    <button
                      key={mod.id}
                      onClick={() => !mod.comingSoon && setActiveModule(mod.id)}
                      title={!sidebarOpen ? mod.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-0.5 ${
                        mod.comingSoon ? 'opacity-40 cursor-default' :
                        activeModule === mod.id
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }`}
                    >
                      <span className="shrink-0 text-[14px] leading-none">{mod.icon}</span>
                      {sidebarOpen && <span className="truncate">{mod.label}</span>}
                      {sidebarOpen && mod.comingSoon && <span className="ml-auto text-[9px] text-muted-foreground/40">soon</span>}
                    </button>
                  ))}
              </div>
            ))}
          </nav>

          {/* Actor footer */}
          {sidebarOpen && (
            <div className="border-t border-border px-3 py-2.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-red-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {resolvedActor.display_name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-foreground truncate">{resolvedActor.display_name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{resolvedActor.email}</div>
              </div>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="border-t border-border py-2 text-center text-muted-foreground/40 hover:text-muted-foreground transition-colors text-xs"
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderModule(
          availableModuleIds.includes(activeModule) ? activeModule : defaultModuleId,
          resolvedActor,
          (moduleId) => {
            if (availableModuleIds.includes(moduleId)) setActiveModule(moduleId)
          },
          openCloudSave,
        )}
      </div>
    </div>
  )
}
