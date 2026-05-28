import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/services/auth/AuthContext'
import { GithubLogo, GoogleLogo, MicrosoftOutlookLogo, X, ArrowRight } from '@phosphor-icons/react'

type Role = 'staff' | 'public'
type Provider = 'github' | 'google' | 'microsoft'

// ─── Scoped styles using the app's design tokens ─────────────────────────────
const TOWN_STYLES = `
  .town-page {
    background:
      radial-gradient(circle at top left, color-mix(in oklab, var(--color-primary) 7%, transparent), transparent 28%),
      radial-gradient(circle at bottom right, color-mix(in oklab, var(--color-primary) 5%, transparent), transparent 24%),
      var(--color-background);
    color: var(--color-foreground);
  }

  /* Side panels */
  .tp-side {
    position:relative; overflow:hidden; border-radius:var(--radius-xl);
    border:1px solid var(--color-border);
    box-shadow:var(--shadow-lg);
    padding:34px; display:flex; flex-direction:column; justify-content:space-between;
    transition:transform .2s ease, box-shadow .2s ease, opacity .3s ease, filter .3s ease;
    cursor:pointer;
  }
  .tp-side:hover { transform:translateY(-2px); }
  .tp-side.active { box-shadow:0 0 0 1px color-mix(in oklab, var(--color-primary) 20%, transparent), var(--shadow-lg); }
  .tp-side-staff {
    background: color-mix(in oklab, var(--color-card) 90%, color-mix(in oklab, var(--color-primary) 15%, transparent));
  }
  .tp-side-staff::before {
    content:''; position:absolute; inset:0; pointer-events:none;
    background-image:
      linear-gradient(color-mix(in oklab, var(--color-primary) 8%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in oklab, var(--color-primary) 8%, transparent) 1px, transparent 1px);
    background-size:44px 44px;
    mask-image:linear-gradient(to bottom, rgba(0,0,0,.6), rgba(0,0,0,.12));
  }
  .tp-side-public {
    background: color-mix(in oklab, var(--color-card) 92%, color-mix(in oklab, var(--color-muted) 10%, transparent));
  }
  .tp-side-public::before {
    content:''; position:absolute; inset:0; pointer-events:none; opacity:.5;
    background-image:radial-gradient(color-mix(in oklab, var(--color-border) 80%, transparent) 1px, transparent 1px);
    background-size:22px 22px;
  }

  /* World (split layout) */
  .tp-world {
    display:grid; grid-template-columns:1fr 1fr; gap:18px; min-height:0;
    transition:grid-template-columns .55s cubic-bezier(.77,0,.18,1);
  }
  .tp-world.staff-open  { grid-template-columns:1.15fr .85fr; }
  .tp-world.public-open { grid-template-columns:.85fr 1.15fr; }
  .tp-world.locked .tp-side:not(.active) { opacity:.45; filter:saturate(.75) blur(1px); pointer-events:none; }

  /* Rail */
  .tp-rail {
    position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
    z-index:4; display:flex; flex-direction:column; align-items:center; gap:12px;
    pointer-events:none;
    transition:left .55s cubic-bezier(.77,0,.18,1);
  }
  .tp-world.staff-open  .tp-rail { left:57.5%; }
  .tp-world.public-open .tp-rail { left:42.5%; }
  .tp-rail-core {
    padding:12px 16px; border:1px solid var(--color-border); border-radius:var(--radius-lg);
    background: color-mix(in oklab, var(--color-card) 85%, transparent);
    backdrop-filter:blur(14px) saturate(150%);
    box-shadow:var(--shadow-md); display:flex; flex-direction:column;
    align-items:center; gap:4px;
    transition:transform .28s ease, box-shadow .28s ease;
  }
  .tp-rail.active .tp-rail-core {
    transform:scale(1.05);
    box-shadow:0 0 0 1px color-mix(in oklab, var(--color-primary) 14%, transparent), var(--shadow-lg);
  }

  /* Auth overlay */
  .tp-auth-overlay {
    position:fixed; inset:0; z-index:30;
    display:flex; align-items:center; justify-content:center;
    background: color-mix(in oklab, var(--color-foreground) 12%, transparent);
    backdrop-filter:blur(8px);
    opacity:0; pointer-events:none; transition:opacity .25s ease;
  }
  .tp-auth-overlay.open { opacity:1; pointer-events:auto; }
  .tp-auth-card {
    width:min(440px, calc(100vw - 32px));
    background: var(--color-card); border:1px solid var(--color-border);
    border-radius:var(--radius-xl); box-shadow:var(--shadow-xl); overflow:hidden;
    transform:translateY(18px) scale(.98);
    transition:transform .3s cubic-bezier(.22,1,.36,1);
  }
  .tp-auth-overlay.open .tp-auth-card { transform:translateY(0) scale(1); }

  /* Proof chips */
  .tp-proof-chip {
    padding:7px 10px; border-radius:999px; border:1px solid var(--color-border);
    background: color-mix(in oklab, var(--color-card) 72%, transparent); white-space:nowrap;
  }
  .tp-trust-pill {
    padding:7px 10px; border-radius:999px;
    background: color-mix(in oklab, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
  }

  /* Provider buttons */
  .tp-provider-btn {
    width:100%; display:flex; align-items:center; gap:12px;
    padding:13px 16px; border-radius:var(--radius-md); border:1px solid var(--color-border);
    background:var(--color-card); color:var(--color-foreground);
    font-size:15px; font-weight:500; cursor:pointer;
    transition:background .15s ease, border-color .15s ease, transform .1s ease;
  }
  .tp-provider-btn:hover {
    background: color-mix(in oklab, var(--color-muted) 60%, transparent);
    border-color: color-mix(in oklab, var(--color-primary) 28%, transparent);
    transform:translateY(-1px);
  }
  .tp-provider-btn:active { transform:translateY(0); }
  .tp-provider-btn.primary {
    background:var(--color-primary); color:var(--color-primary-foreground);
    border-color:var(--color-primary);
  }
  .tp-provider-btn.primary:hover {
    background: color-mix(in oklab, var(--color-primary) 85%, black);
    border-color: color-mix(in oklab, var(--color-primary) 85%, black);
  }

  @media (max-width: 680px) {
    .tp-world { grid-template-columns:1fr !important; }
    .tp-side { min-height: 360px; }
    .tp-rail { display:none; }
  }
`

// ─── Proof card data ───────────────────────────────────────────────────────────
const STAFF_PROOF = [
  { label: 'Deadline tracking', title: 'Nothing slips unnoticed', copy: 'PRR clocks, OML deadlines, and board seat vacancies surface before they become problems.' },
  { label: 'Shared record', title: 'One place, all context', copy: 'Requests, meetings, records, and approvals share a single audit trail.' },
  { label: 'Plain handoff', title: 'Continuity by design', copy: 'The system remembers so people don\'t have to re-explain on day one.' },
]

const PUBLIC_CARDS = [
  { title: 'Can I build this?', copy: 'Permit steps, likely approvals, and what you need to have ready.' },
  { title: 'Where is my request?', copy: 'Progress, ownership, and next milestone — no guessing who to call.' },
  { title: 'What applies to my property?', copy: 'Start from your question, not a department name.' },
  { title: 'Public meetings & notices', copy: 'Agendas, minutes, and upcoming sessions in one place.' },
]

const PROVIDERS: { id: Provider; label: string; Icon: React.ElementType }[] = [
  { id: 'github',    label: 'Continue with GitHub',    Icon: GithubLogo },
  { id: 'google',    label: 'Continue with Google',    Icon: GoogleLogo },
  { id: 'microsoft', label: 'Continue with Microsoft', Icon: MicrosoftOutlookLogo },
]

// ─── Component ────────────────────────────────────────────────────────────────
export function TownPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [activeRole, setActiveRole] = useState<Role | null>(null)
  const [hovered, setHovered] = useState<Role | null>(null)

  // If already logged in, show portal mode (choose experience)
  const isLoggedIn = !!user

  // After OAuth return — check pending role and route accordingly
  useEffect(() => {
    const pendingRole = sessionStorage.getItem('townRole') as Role | null
    if (user && pendingRole) {
      sessionStorage.removeItem('townRole')
      if (pendingRole === 'staff') {
        navigate('/', { replace: true })
      }
      // public stays on /town
    }
  }, [user, navigate])

  const openAuth = useCallback((role: Role) => {
    setActiveRole(role)
  }, [])

  const closeAuth = useCallback(() => {
    setActiveRole(null)
  }, [])

  const handleProvider = useCallback((provider: Provider) => {
    if (activeRole) {
      sessionStorage.setItem('townRole', activeRole)
    }
    login(provider)
  }, [activeRole, login])

  const handleEnterStaff = () => navigate('/')
  const handleEnterPublic = () => {
    // Stay on /town with public view — or route to a public portal
    // For now scroll down to public section
    document.getElementById('public-side')?.scrollIntoView({ behavior: 'smooth' })
  }

  const worldClass = [
    'tp-world',
    activeRole === 'staff' ? 'staff-open locked' : '',
    activeRole === 'public' ? 'public-open locked' : '',
    !activeRole && hovered ? `${hovered}-open` : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="town-page min-h-screen p-5 md:p-6 grid gap-4" style={{ gridTemplateRows: 'auto 1fr auto' }}>
      <style>{TOWN_STYLES}</style>

      {/* Top bar */}
      <header className="flex items-center justify-between px-1.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display font-black text-[28px] leading-none tracking-tight text-foreground">
            Work<span className="text-primary">space</span>
          </span>
          <span className="font-mono text-[9px] tracking-[.12em] uppercase text-muted-foreground">
            Town Portal
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full border border-border bg-card/70 backdrop-blur-sm shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-primary ring-4 ring-primary/10" />
          <span className="font-mono text-[9px] tracking-[.12em] uppercase text-muted-foreground">
            os.publiclogic.org
          </span>
        </div>
      </header>

      {/* Main world */}
      <div className="relative" style={{ minHeight: 0 }}>
        <div className={worldClass} id="tp-world">

          {/* Staff side */}
          <div
            id="staff-side"
            className={`tp-side tp-side-staff${activeRole === 'staff' ? ' active' : ''}`}
            onClick={() => !activeRole && openAuth('staff')}
            onMouseEnter={() => !activeRole && setHovered('staff')}
            onMouseLeave={() => !activeRole && setHovered(null)}
          >
            {/* Top bar */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span className="font-mono text-[9px] tracking-[.16em] uppercase text-muted-foreground">Staff workbench</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {['OML', 'PRR', 'Deadlines'].map(t => (
                  <span key={t} className="tp-proof-chip font-mono text-[9px] tracking-[.08em] text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>

            {/* Copy */}
            <div style={{ position: 'relative', zIndex: 1, marginTop: 28, display: 'grid', gap: 22 }}>
              <div>
                <h1 className="font-display font-semibold text-foreground" style={{ fontSize: 'clamp(40px,4.5vw,68px)', lineHeight: .94, letterSpacing: '-.03em', maxWidth: '9ch' }}>
                  See what <em className="italic text-primary">matters</em> first.
                </h1>
                <p className="text-muted-foreground" style={{ maxWidth: '34ch', fontSize: 16, lineHeight: 1.7, marginTop: 16 }}>
                  Deadlines, ownership, and the next step — surfaced before they become problems.
                </p>
              </div>

              {/* Proof cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {STAFF_PROOF.map(c => (
                  <div key={c.label} className="surface-panel" style={{ padding: 16, borderRadius: 'var(--radius-lg)' }}>
                    <div className="font-mono text-muted-foreground mb-2" style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase' }}>{c.label}</div>
                    <div className="text-foreground font-semibold mb-1" style={{ fontSize: 14 }}>{c.title}</div>
                    <div className="text-muted-foreground" style={{ fontSize: 12, lineHeight: 1.55 }}>{c.copy}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between gap-4 pt-4 mt-2 border-t border-border/50" style={{ position: 'relative', zIndex: 1 }}>
              {isLoggedIn ? (
                <button
                  className="tp-provider-btn primary"
                  style={{ width: 'auto', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 'var(--radius-md)' }}
                  onClick={e => { e.stopPropagation(); handleEnterStaff() }}
                >
                  Enter staff workbench <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button
                    className="inline-flex items-center gap-2.5 font-semibold bg-primary text-primary-foreground shadow-sm"
                    style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', letterSpacing: '.01em', border: 'none', cursor: 'pointer', fontSize: 14 }}
                    onClick={e => { e.stopPropagation(); openAuth('staff') }}
                  >
                    Sign in <ArrowRight size={14} />
                  </button>
                  <div>
                    <div className="font-mono text-muted-foreground" style={{ fontSize: 10, letterSpacing: '.08em' }}>For town staff only</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {['Massachusetts', 'Audit-ready', 'MGL-native'].map(t => (
                        <span key={t} className="tp-trust-pill font-mono" style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Center rail */}
          <div className={`tp-rail${activeRole ? ' active' : ''}`}>
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-border to-transparent" />
            <div className="tp-rail-core">
              <span className="font-mono text-muted-foreground" style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase' }}>Powered by</span>
              <span className="font-display font-bold text-foreground text-xl leading-tight">
                Work<span className="text-primary">space</span>
              </span>
              <span className="text-muted-foreground text-xs">One system</span>
            </div>
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-border to-transparent" />
          </div>

          {/* Public side */}
          <div
            id="public-side"
            className={`tp-side tp-side-public${activeRole === 'public' ? ' active' : ''}`}
            onClick={() => !activeRole && openAuth('public')}
            onMouseEnter={() => !activeRole && setHovered('public')}
            onMouseLeave={() => !activeRole && setHovered(null)}
          >
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span className="font-mono text-[9px] tracking-[.16em] uppercase text-muted-foreground">Public services</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Residents', 'Property', 'Permits'].map(t => (
                  <span key={t} className="tp-proof-chip font-mono text-[9px] tracking-[.08em] text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', zIndex: 1, marginTop: 28, display: 'grid', gap: 22 }}>
              <div>
                <h1 className="font-display font-semibold text-foreground" style={{ fontSize: 'clamp(40px,4.5vw,68px)', lineHeight: .94, letterSpacing: '-.03em', maxWidth: '9ch' }}>
                  Get answers <em className="italic text-primary">without</em> guessing.
                </h1>
                <p className="text-muted-foreground" style={{ maxWidth: '34ch', fontSize: 16, lineHeight: 1.7, marginTop: 16 }}>
                  Permits, requests, property questions, and public meetings — no municipal fluency required.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {PUBLIC_CARDS.map(c => (
                  <div key={c.title} className="surface-panel" style={{ padding: 16, borderRadius: 'var(--radius-lg)' }}>
                    <strong className="block text-foreground font-semibold mb-1" style={{ fontSize: 14 }}>{c.title}</strong>
                    <span className="text-muted-foreground" style={{ fontSize: 12, lineHeight: 1.55 }}>{c.copy}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 mt-2 border-t border-border/50" style={{ position: 'relative', zIndex: 1 }}>
              {isLoggedIn ? (
                <button
                  className="tp-provider-btn primary"
                  style={{ width: 'auto', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 'var(--radius-md)' }}
                  onClick={e => { e.stopPropagation(); handleEnterPublic() }}
                >
                  Browse public services <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button
                    className="inline-flex items-center gap-2.5 font-semibold bg-primary text-primary-foreground shadow-sm"
                    style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', letterSpacing: '.01em', border: 'none', cursor: 'pointer', fontSize: 14 }}
                    onClick={e => { e.stopPropagation(); openAuth('public') }}
                  >
                    Sign in <ArrowRight size={14} />
                  </button>
                  <div>
                    <div className="font-mono text-muted-foreground" style={{ fontSize: 10, letterSpacing: '.08em' }}>
                      Or{' '}
                      <button
                        className="text-primary bg-transparent border-none cursor-pointer p-0 font-mono"
                        style={{ fontSize: 'inherit', letterSpacing: 'inherit' }}
                        onClick={e => { e.stopPropagation(); navigate('/forms') }}
                      >
                        browse as guest →
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {['Open access', 'No account needed', 'Plain language'].map(t => (
                        <span key={t} className="tp-trust-pill font-mono" style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-1.5">
        <span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground">
          © {new Date().getFullYear()} PublicLogic — Municipal governance infrastructure
        </span>
        <div className="flex gap-4">
          {['Terms', 'Privacy', 'Contact'].map(l => (
            <span key={l} className="font-mono text-[10px] tracking-[.08em] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">{l}</span>
          ))}
        </div>
      </footer>

      {/* ── Auth overlay ─────────────────────────────────────────────────────── */}
      <div
        className={`tp-auth-overlay${activeRole ? ' open' : ''}`}
        onClick={e => { if ((e.target as HTMLElement).classList.contains('tp-auth-overlay')) closeAuth() }}
      >
        <div className="tp-auth-card">

          {/* Header */}
          <div style={{ padding: '26px 26px 18px', display: 'grid', gap: 8, position: 'relative' }}>
            <span className="font-mono text-primary" style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase' }}>
              {activeRole === 'staff' ? 'Staff workbench' : 'Public services'}
            </span>
            <h2 className="font-display font-bold text-foreground" style={{ fontSize: 32, lineHeight: 1 }}>
              {activeRole === 'staff' ? 'Welcome back.' : 'Pick up where you left off.'}
            </h2>
            <p className="text-muted-foreground" style={{ fontSize: 14, lineHeight: 1.6, maxWidth: '32ch' }}>
              {activeRole === 'staff'
                ? 'Sign in to see what needs attention, what is due, and who owns the next step.'
                : 'Sign in to track requests, save activity, and keep your questions in one place.'}
            </p>
            <button
              className="absolute right-3.5 top-3.5 w-8 h-8 rounded-full border border-border bg-card text-muted-foreground flex items-center justify-center cursor-pointer hover:text-foreground transition-colors"
              onClick={closeAuth}
            >
              <X size={15} />
            </button>
          </div>

          {/* Provider buttons */}
          <div style={{ padding: '0 26px 26px', display: 'grid', gap: 10 }}>
            {PROVIDERS.map(({ id, label, Icon }, i) => (
              <button
                key={id}
                className={`tp-provider-btn${i === 0 ? ' primary' : ''}`}
                onClick={() => handleProvider(id)}
              >
                <Icon size={20} weight={i === 0 ? 'fill' : 'regular'} />
                {label}
              </button>
            ))}

            <div className="flex justify-between items-center mt-1">
              <span className="font-mono text-muted-foreground" style={{ fontSize: 10, letterSpacing: '.08em' }}>
                {activeRole === 'staff' ? 'Need access? Ask your administrator' : 'No account? Browse as guest below'}
              </span>
              {activeRole === 'public' && (
                <button
                  className="font-mono text-primary bg-transparent border-none cursor-pointer p-0"
                  style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase' }}
                  onClick={() => { closeAuth(); navigate('/forms') }}
                >
                  Guest access →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
