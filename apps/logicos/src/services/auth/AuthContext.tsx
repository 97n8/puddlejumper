import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { toast } from 'sonner'
import { loadPrefsFromServer, resetPrefsCache } from '@/services/serverPrefsCache'
import { pjUrl } from '@/services/pjBase'

export type PJUser = {
  sub: string
  email: string | null
  name: string | null
  role: string
  provider: string | null
  workspaceId: string
  workspaceName?: string | null
  mustChangePassword?: boolean
}

type AuthContextType = {
  user: PJUser | null
  loading: boolean
  /** True on the render cycle immediately after returning from PJ OAuth */
  returnedFromAuth: boolean
  /** Provider that was just connected via connector OAuth (e.g. 'github') */
  connectedProvider: string | null
  login: (provider: 'github' | 'google' | 'microsoft') => void
  logout: () => Promise<void>
  /** Call after a successful password change to clear the must-change flag */
  clearMustChangePassword: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  returnedFromAuth: false,
  connectedProvider: null,
  login: () => {},
  logout: async () => {},
  clearMustChangePassword: () => {},
})

function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function getLocalBypassUser(): PJUser | null {
  if (!import.meta.env.DEV) return null
  if (typeof window === 'undefined') return null
  if (!isLocalhostHost(window.location.hostname)) return null
  if ((import.meta.env.VITE_LOCAL_AUTH_BYPASS as string | undefined) !== '1') return null
  return {
    sub: 'local-dev-owner',
    email: 'local@publiclogic.dev',
    name: 'Local Dev',
    role: 'owner',
    provider: 'local',
    workspaceId: 'local-dev',
    workspaceName: 'Local Dev Workspace',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PJUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [returnedFromAuth, setReturnedFromAuth] = useState(false)
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null)

  useEffect(() => {
    const localBypassUser = getLocalBypassUser()
    if (localBypassUser) {
      setUser(localBypassUser)
      setLoading(false)
      return
    }

    const params = new URLSearchParams(window.location.search)
    const hasAuth = params.has('auth')
    const connected = params.get('connected') ?? null
    const oauthError = params.get('oauth_error') ?? null

    if (hasAuth || connected || oauthError) {
      window.history.replaceState({}, '', window.location.pathname)
      if (hasAuth) setReturnedFromAuth(true)
      if (connected) {
        setConnectedProvider(connected)
        // Clear the flag after showing the toast — no need to persist it
        setTimeout(() => setConnectedProvider(null), 5000)
      }
      if (oauthError) {
        const msg = oauthError === 'access_denied'
          ? 'Access denied — your account is not authorized for this workspace.'
          : `Sign-in failed: ${oauthError}`
        setTimeout(() => toast.error(msg, { duration: 8000 }), 100)
      }
    }

    const controller = new AbortController()

    fetch(pjUrl('/api/me'), { credentials: 'include', signal: AbortSignal.any
      ? AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
      : controller.signal })
      .then(r => {
        if (r.status === 403) {
          // Session invalid — clear it server-side before dropping local state
          fetch(pjUrl('/api/auth/logout'), { method: 'POST', credentials: 'include', headers: { 'x-puddlejumper-request': 'true' } }).catch(() => {})
          setTimeout(() => toast.error('Access denied — your account is not authorized for this workspace.', { duration: 8000 }), 100)
          return null
        }
        if (!r.ok) {
          if (r.status >= 500) {
            setTimeout(() => toast.error(`Service unavailable (${r.status}) — please refresh or try again shortly.`, { duration: 8000 }), 100)
          }
          return null
        }
        return r.json()
      })
      .then((data: PJUser | null) => {
        setUser(data)
        setLoading(false)
        if (data) {
          loadPrefsFromServer()
          if (hasAuth) {
            toast.success(`Signed in as ${data.name || data.email || 'you'}`)
          }
          if (connected) {
            const label = connected === 'github' ? 'GitHub'
              : connected === 'microsoft' ? 'Microsoft 365'
              : connected === 'google' ? 'Google'
              : connected
            toast.success(`${label} connected!`)
          }
        }
      })
      .catch((err: unknown) => {
        // Ignore abort errors (component unmounted or timeout handled elsewhere)
        if (err instanceof Error && err.name === 'AbortError') return
        setLoading(false)
      })

    return () => controller.abort()
  }, [])

  const login = (provider: 'github' | 'google' | 'microsoft') => {
    const redirectTo = window.location.href
    window.location.href = pjUrl(`/api/auth/${provider}/login?redirect_to=${encodeURIComponent(redirectTo)}`)
  }

  const logout = async () => {
    await fetch(pjUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-puddlejumper-request': 'true' },
    }).catch(() => { /* logout always clears local state regardless of server response */ })
    setUser(null)
    setReturnedFromAuth(false)
    setConnectedProvider(null)
    resetPrefsCache()
  }

  const clearMustChangePassword = () => {
    setUser(prev => prev ? { ...prev, mustChangePassword: false } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, loading, returnedFromAuth, connectedProvider, login, logout, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
