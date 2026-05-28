import { useState, type FormEvent } from 'react'
import { ArrowLeft, Buildings, ShieldCheck } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SUTTON_TOWN_ENTRY_KEY, SUTTON_TOWN_ENTRY_PATH } from '@/lib/environmentAccess'

const PJ = (import.meta.env.VITE_PJ_API_URL as string | undefined ?? 'https://api.publiclogic.org').replace(/\/$/, '')

export function TownLoginPage() {
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState('AC3')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!username.trim()) {
      setError('Enter the username for your municipal Workspace demo account.')
      return
    }
    if (!password) {
      setError('Enter the password for this municipal demo account.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${PJ}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-puddlejumper-request': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error ?? 'Unable to sign in.')
      }

      sessionStorage.setItem(SUTTON_TOWN_ENTRY_KEY, '1')
      setSuccess(`Signed in as ${body?.user?.name ?? username.trim()} — opening your town workspace…`)
      window.location.href = SUTTON_TOWN_ENTRY_PATH
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_28%),linear-gradient(180deg,#f6faf7_0%,#edf5ef_52%,#e7efe9_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center justify-center">
        <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="surface-panel-strong rounded-[28px] p-8">
            <a href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800">
              <ArrowLeft size={14} />
              Back to PublicLogic
            </a>

            <div className="mt-8 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-2">
                  <Buildings size={14} />
                  Municipal Entry
                </Badge>
                <Badge variant="outline" className="border-slate-300/80 bg-white/75 text-slate-700">Guided workspace access</Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                  Workspace Town Login
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
                  This entry is for towns and cities engaging with Workspace through a guided demo or active implementation.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="surface-panel rounded-2xl p-4">
                  <div className="mb-2 inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-700">
                    <ShieldCheck size={18} />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Allowlisted access</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Approved accounts route directly into the right municipal environment after sign-in.
                  </p>
                </div>

                <div className="surface-panel rounded-2xl p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-800">What happens next</div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Sign in with your credentials and Workspace opens a tailored municipal workspace with pre-populated modules, records, and automation paths.
                  </p>
                </div>
              </div>
            </div>
          </section>

            <section className="surface-panel rounded-[28px] p-6 sm:p-7">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Continue to your town workspace</p>
                  <p className="mt-1 text-sm text-slate-500">Use the username and password provided for your municipal Workspace environment.</p>
                </div>

              <form className="space-y-3" onSubmit={handleLogin}>
                <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
                  Username
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-[#fcfdfb] px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500/50"
                    autoComplete="username"
                  />
                </label>

                <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-[#fcfdfb] px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500/50"
                    autoComplete="current-password"
                  />
                </label>

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {success}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  size="lg"
                  className="w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Signing in…' : 'Open Workspace demo'}
                </Button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm leading-relaxed text-slate-600">
                This entry point shows how Workspace can stand up a clean municipal environment fast: tailored modules, pre-populated records, and a direct path into the right operating workspace.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
