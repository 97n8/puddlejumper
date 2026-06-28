/**
 * serverPrefsCache — singleton for server-backed user preferences.
 *
 * On first load after auth, we fetch all prefs from PuddleJumper in one
 * request. useKV reads from this cache synchronously and writes back to both
 * localStorage and the server. All useKV instances are notified when the
 * server data arrives so they can update their in-memory state.
 */
import { pjApi } from './pjApi'

let cache: Record<string, unknown> | null = null
let loadPromise: Promise<void> | null = null
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

/** Load all prefs from the server once per session. Idempotent. */
export function loadPrefsFromServer(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = pjApi.prefs.getAll().then(serverPrefs => {
    cache = serverPrefs
    // Merge into localStorage (server wins) and notify all useKV instances
    for (const [key, value] of Object.entries(serverPrefs)) {
      try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
    }
    window.dispatchEvent(new CustomEvent('server-prefs-ready', { detail: { prefs: serverPrefs } }))
  }).catch(() => {
    cache = {}
  })
  return loadPromise
}

/** Get a server pref synchronously (only after loadPrefsFromServer resolves). */
export function getServerPref(key: string): unknown | undefined {
  return cache?.[key]
}

/** Returns true once the server prefs have been loaded. */
export function serverPrefsLoaded(): boolean {
  return cache !== null
}

/**
 * Write a pref to the server. Debounced at 600ms per key so rapid updates
 * (e.g. typing in a settings field) don't hammer the API.
 */
export function writeServerPref(key: string, value: unknown): void {
  if (cache) cache[key] = value
  if (pendingWrites.has(key)) clearTimeout(pendingWrites.get(key)!)
  pendingWrites.set(key, setTimeout(() => {
    pendingWrites.delete(key)
    pjApi.prefs.set(key, value)
  }, 600))
}

/** Reset the cache (used on logout). */
export function resetPrefsCache(): void {
  cache = null
  loadPromise = null
  for (const t of pendingWrites.values()) clearTimeout(t)
  pendingWrites.clear()
}
