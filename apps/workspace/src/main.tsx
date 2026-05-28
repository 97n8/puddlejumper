import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { ColorProvider } from './lib/colorContext.tsx'
import { AuthProvider } from './services/auth/AuthContext.tsx'
import { CloudSaveProvider } from './context/CloudSaveContext.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

const STALE_CHUNK_RELOAD_KEY = 'workspace-stale-chunk-reload'
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

// Apply persisted theme before first render to avoid flash
;(() => {
  try {
    const raw = localStorage.getItem('logicworkspace-workspace-settings')
    const theme = raw ? JSON.parse(raw)?.theme : 'system'
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-appearance', 'dark')
    } else if (!theme || theme === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-appearance', 'dark')
      }
    }
    const compact = raw ? JSON.parse(raw)?.compactMode : false
    if (compact) document.documentElement.setAttribute('data-compact', 'true')
  } catch { /* ignore */ }
})()

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  try {
    if (sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) === '1') {
      sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY)
      return
    }
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1')
  } catch {
    // If sessionStorage is unavailable, still attempt a one-time reload.
  }

  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <QueryClientProvider client={queryClient}>
      <ColorProvider>
        <AuthProvider>
            <CloudSaveProvider>
              <BrowserRouter basename={ROUTER_BASENAME}>
                <App />
              </BrowserRouter>
            </CloudSaveProvider>
          </AuthProvider>
      </ColorProvider>
    </QueryClientProvider>
   </ErrorBoundary>
)

try {
  sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY)
} catch {
  // ignore
}
