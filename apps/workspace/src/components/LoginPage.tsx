import { useState, type ReactNode } from 'react'
import { useAuth } from '@/services/auth/AuthContext'
import { ArrowRight, GithubLogo, GoogleLogo, MicrosoftOutlookLogo, ShieldCheck } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LegalModal } from './LegalModal'

type LegalTab = 'terms' | 'privacy' | 'acceptable' | 'data'

const residentActions = [
  'Report an Issue',
  'Apply for a Permit',
  'Request Public Records',
  'View Meetings & Notices',
]

const staffMetrics: Array<{ label: string; value: string }> = [
  { label: 'Overdue Public Records', value: '3 items' },
  { label: "Tonight's Board Quorum Risk", value: 'ZBA · 7:00 PM' },
  { label: 'SLA On-Time', value: '87%' },
  { label: 'Board Vacancies', value: '4 seats' },
]

const trustSignals = [
  {
    title: 'Massachusetts-specific',
    body: 'OML, PRR, and MGL statutory frameworks built in — not bolted on after the fact.',
  },
  {
    title: 'Town-owned from day one',
    body: 'Your data, your systems, your governance layer. PublicLogic builds it, then hands it off clean.',
  },
  {
    title: 'No implementation mystery',
    body: 'We handle discovery, grant strategy, buildout, and transfer. You get a working system — not a subscription and a manual.',
  },
]

const roleOptions = [
  'Town Administrator / Manager',
  'Town Clerk',
  'Finance / Procurement',
  'IT / Systems',
  'Board / Committee',
  'Other',
]

const pressureOptions = [
  'Grants',
  'Procurement',
  'Compliance / OML / PRR',
  'Records / Turnover',
  'Process breakdown',
  'Not sure — just need it to hold',
]

const signInOptions = [
  { provider: 'github' as const, Icon: GithubLogo, label: 'GitHub' },
  { provider: 'google' as const, Icon: GoogleLogo, label: 'Google' },
  { provider: 'microsoft' as const, Icon: MicrosoftOutlookLogo, label: 'Microsoft' },
]

function SectionCard({
  eyebrow,
  title,
  children,
  badge,
}: {
  eyebrow: string
  title: string
  children: ReactNode
  badge?: string
}) {
  return (
    <section className="surface-panel rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        {badge ? <Badge variant="secondary">{badge}</Badge> : null}
      </div>
      {children}
    </section>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const [legalOpen, setLegalOpen] = useState(false)
  const [legalTab, setLegalTab] = useState<LegalTab>('terms')
  const [submitting, setSubmitting] = useState(false)
  const demoRequestAction = (import.meta.env.VITE_PUBLIC_INTAKE_FORM_URL as string | undefined ?? 'https://formspree.io/f/xaqlywkp').trim()
  const submissionSucceeded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('submitted') === 'demo-request'
  const successRedirectUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?submitted=demo-request`
    : '/?submitted=demo-request'

  const openLegal = (tab: LegalTab) => {
    setLegalTab(tab)
    setLegalOpen(true)
  }

  return (
    <>
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} initialTab={legalTab} />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_30%),linear-gradient(180deg,#f7faf7_0%,#eef4ef_48%,#e8f0e9_100%)] text-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_420px]">
            <main className="space-y-6">
              <section className="surface-panel-strong rounded-[32px] p-6 sm:p-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-slate-300/80 bg-white/75 text-slate-700">PublicLogic LLC</Badge>
                      <Badge variant="secondary">Governance Infrastructure</Badge>
                      <Badge variant="outline" className="border-slate-300/80 bg-white/75 text-slate-700">Massachusetts Municipalities</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h1 className="text-5xl font-black tracking-tighter text-slate-950 sm:text-6xl">
                      Work<span className="text-emerald-600">space</span>
                    </h1>
                    <p className="text-2xl font-medium tracking-tight text-slate-900 sm:text-3xl">
                      Govern what holds.
                    </p>
                    <p className="max-w-3xl text-base leading-7 text-slate-600">
                      Statutory deadlines, PRR compliance, OML tracking, grant continuity, and institutional handoffs — the things that can&apos;t slip, in one governed municipal platform.
                    </p>
                    <p className="text-sm text-slate-500">
                      Gardner, MA · info@publiclogic.org · 978-807-0829 · publiclogic.org
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="section-kicker">Purpose</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">Operational clarity for statutory, staffing, and handoff-heavy municipal work.</p>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="section-kicker">Approach</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">Build the working system, govern the process, and hand off cleanly.</p>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="section-kicker">Result</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">Fewer black boxes, stronger continuity, and visible municipal throughput.</p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid gap-6 md:grid-cols-2">
                <SectionCard eyebrow="Residents" title="Your town, in your corner." badge="Town Common">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {residentActions.map((action) => (
                      <div key={action} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {action}
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard eyebrow="Staff" title="Governance Workspace" badge="Action Required">
                  <div className="space-y-2">
                    {staffMetrics.map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-sm text-slate-600">{label}</span>
                        <span className="text-sm font-semibold text-slate-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>

              <section className="grid gap-4 md:grid-cols-3">
                {trustSignals.map(({ title, body }) => (
                  <div key={title} className="surface-panel rounded-3xl p-5">
                    <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                  </div>
                ))}
              </section>
            </main>

            <aside className="space-y-6">
              <section className="surface-panel-strong rounded-[32px] p-6 sm:p-7">
                <div className="space-y-4">
                  <div>
                    <div className="section-kicker">PublicLogic LLC</div>
                    <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                      Tell us what needs to hold.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Fill this out and we&apos;ll follow up within one business day. No sales team. No prep required — just a direct conversation about your situation.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      We can talk grants, records compliance, board operations, or the full PublicLogic engagement.
                    </p>
                  </div>

                  {submissionSucceeded ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      Thanks — your request came through. We&apos;ll be in touch soon.
                    </div>
                  ) : null}

                  <form action={demoRequestAction} method="POST" className="space-y-3">
                    <input type="hidden" name="_subject" value="Workspace landing page request" />
                    <input type="hidden" name="_next" value={successRedirectUrl} />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        <span>Your role</span>
                        <select
                          name="role"
                          required
                          defaultValue=""
                          className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500"
                        >
                          <option value="" disabled>Select one</option>
                          {roleOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        <span>Biggest pressure point</span>
                        <select
                          name="pressure"
                          required
                          defaultValue=""
                          className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500"
                        >
                          <option value="" disabled>Select one</option>
                          {pressureOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      <span>What&apos;s the situation?</span>
                      <textarea
                        name="notes"
                        placeholder="Describe what's breaking down or what you need to hold..."
                        className="min-h-28 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500"
                      />
                    </label>

                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      <span>Full name</span>
                      <input
                        type="text"
                        name="name"
                        required
                        className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500"
                      />
                    </label>

                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      <span>Email</span>
                      <input
                        type="email"
                        name="email"
                        required
                        className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500"
                      />
                    </label>

                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      <span>Town / Organization</span>
                      <input
                        type="text"
                        name="org"
                        required
                        className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500"
                      />
                    </label>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                    >
                      Start the conversation
                      <ArrowRight size={16} weight="bold" />
                    </Button>
                  </form>
                </div>
              </section>

              <section className="surface-panel rounded-[32px] p-6 sm:p-7">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Already working in Workspace?</h2>
                    <p className="mt-1 text-sm text-slate-600">Sign in with your connected account.</p>
                  </div>

                  <div className="space-y-2.5">
                    {signInOptions.map(({ provider, Icon, label }) => (
                      <Button
                        key={provider}
                        onClick={() => {
                          setSubmitting(true)
                          login(provider)
                        }}
                        disabled={submitting}
                        aria-label={`Sign in with ${label}`}
                        variant="outline"
                        size="lg"
                        className="h-11 w-full justify-start rounded-2xl border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <Icon size={18} weight="fill" className="text-slate-500" />
                        {submitting ? 'Signing in…' : `Continue with ${label}`}
                      </Button>
                    ))}
                  </div>

                  <p className="text-xs leading-6 text-slate-500">
                    By signing in you agree to our{' '}
                    <button onClick={() => openLegal('terms')} className="underline underline-offset-2 hover:text-slate-700">
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button onClick={() => openLegal('privacy')} className="underline underline-offset-2 hover:text-slate-700">
                      Privacy Policy
                    </button>.
                  </p>

                  <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs leading-6 text-slate-500">
                    <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                      <ShieldCheck size={14} className="text-emerald-700" weight="fill" />
                      Workspace is a governance product by PublicLogic — purpose-built for public service teams.
                    </span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>

        <footer className="border-t border-white/80 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
            <div className="space-y-1">
              <div className="text-2xl font-black tracking-tighter text-slate-950">
                Work<span className="text-emerald-600">space</span>
              </div>
              <div>PublicLogic LLC</div>
              <div>Gardner, MA</div>
              <a href="mailto:info@publiclogic.org" className="block hover:text-slate-900">info@publiclogic.org</a>
              <div>978-807-0829</div>
              <a href="https://publiclogic.org" target="_blank" rel="noreferrer" className="block hover:text-slate-900">publiclogic.org</a>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <button onClick={() => openLegal('terms')} className="hover:text-slate-900">Terms</button>
              <button onClick={() => openLegal('privacy')} className="hover:text-slate-900">Privacy</button>
              <button onClick={() => openLegal('acceptable')} className="hover:text-slate-900">Acceptable Use</button>
              <button onClick={() => openLegal('data')} className="hover:text-slate-900">Data Processing</button>
              <span>© 2026 PublicLogic, Inc.</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
