/* =====================================================================
   PUDDLEJUMPER · HOME · presentational components
   Static, canon-faithful port of the v1.0 home shell. All pieces are
   server components — no interactivity is wired in this phase. The
   white-label swap point lives in <EnvBadge>, fed from home.data.ts.
   ===================================================================== */
import {
  env,
  spine,
  surfaces,
  workspaceNav,
  gates,
  needs,
  caseSpaces,
  quickActions,
  recover,
  recordstream,
  formKeyStamp,
  connections,
} from './home.data'

/** Original duck mark (no third-party IP) — calm surface, machinery beneath. */
export function DuckMark() {
  return (
    <svg className="mark" viewBox="0 0 44 44" role="img" aria-label="PuddleJumper">
      <defs>
        <linearGradient id="pjg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f5d50" />
          <stop offset="1" stopColor="#315d74" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="14" fill="url(#pjg)" />
      <path d="M7 31 Q22 27 37 31" stroke="rgba(255,255,255,.30)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="26.5" cy="17.5" r="6" fill="#fbfaf6" />
      <circle cx="28.2" cy="16.6" r="1.3" fill="#17211d" />
      <path d="M32 18 l5 1.4 -5 1.8 z" fill="#b88a3b" />
      <path d="M14 25 Q15 17 23 18 q5 .6 6 5 -3 3 -9 3 -5 0 -6 -1 z" fill="#fbfaf6" />
      <path d="M16 25 q6 2 11 .4" stroke="rgba(23,33,29,.18)" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

/** WHITE-LABEL SWAP POINT — instance name + (source-only) base chip. */
export function EnvBadge() {
  return (
    <div className="env" data-env-base={env.base} data-env-instance={env.instance}>
      <small>Environment</small>
      <div className="envrow">
        <b>{env.instance}</b>
        {env.showBaseChip ? <span className="base">{env.base} base</span> : null}
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <DuckMark />
        <div className="wordmark">
          PuddleJumper<small>Governance Runtime</small>
        </div>
      </div>

      <EnvBadge />

      <div className="navgroup">Surfaces</div>
      <nav className="nav">
        {surfaces.map((s) => (
          <a key={s.label} className={s.active ? 'active' : undefined} href="#">
            {s.label}
            {s.badge ? <span className="badge">{s.badge}</span> : null}
          </a>
        ))}
      </nav>

      <div className="navgroup">Workspace</div>
      <nav className="nav">
        {workspaceNav.map((s) => (
          <a key={s.label} href="#">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="canon">
        <b>PJ is the runtime.</b> It advances each CaseSpace through its states. Recordstream proves what happened; the
        Retention Catalog preserves it.
      </div>
    </aside>
  )
}

export function Spine() {
  return (
    <div className="spine" aria-label="Runtime spine">
      <span className="lab">Spine</span>
      <div className="chain">
        {spine.map((node, i) => (
          <span key={node} style={{ display: 'contents' }}>
            <span className="node">{node}</span>
            {i < spine.length - 1 ? <span className="arr">→</span> : null}
          </span>
        ))}
      </div>
    </div>
  )
}

export function GovernanceGates() {
  return (
    <div className="card">
      <h2>
        <span className="dot" />
        Governance Gates
      </h2>
      <div className="sub">
        The runtime holds here. Nothing commits until an authorized actor approves and the Recordstream stamps it.
      </div>
      <div className="gov-note">
        <b>This is the governance.</b> PJ governs the <b>conditions</b> under which work can happen — authority, policy,
        audit — not the work itself. The gates below plus the append-only Recordstream are the governed layer.
        Everything else on this screen is continuity.
      </div>
      <div className="list">
        {gates.map((g) => (
          <div className="item gate" key={g.title}>
            <div className="row">
              <b>{g.title}</b>
              <span className={`tag ${g.tag}`}>{g.tagLabel}</span>
            </div>
            <span>{g.detail}</span>
            <div className="gateline">
              <span className="stamp">{g.stamp}</span>
              <button className="approve">{g.cta}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Needs() {
  return (
    <div className="card">
      <h2>
        <span className="dot" style={{ background: 'var(--blue)' }} />
        Needs
      </h2>
      <div className="sub">Open states the runtime is tracking: Need Info · Waiting · Draft Needed.</div>
      <div className="list">
        {needs.map((n) => (
          <div className="item" key={n.title}>
            <div className="row">
              <b>{n.title}</b>
              <span className={`tag ${n.tag}`}>{n.tagLabel}</span>
            </div>
            <span>{n.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CaseSpaces() {
  return (
    <div className="card">
      <h2>
        <span className="dot" style={{ background: 'var(--green2)' }} />
        CaseSpaces
      </h2>
      <div className="sub">
        Continuity containers. FORM defines their DNA; the FormKey stamp binds identity and authority to every instance.
      </div>
      <div className="spaces">
        {caseSpaces.map((c) => (
          <div className="space" key={c.name}>
            <div>
              <b>{c.name}</b>
              <br />
              <small>{c.blurb}</small>
            </div>
            {c.pills ? (
              <div className="pills">
                {c.pills.map((p) => (
                  <span className="pill" key={p}>
                    {p}
                  </span>
                ))}
              </div>
            ) : (
              <div className="statechain">
                {c.statechain.steps.map((step, i) => (
                  <span key={step}>
                    {step === c.statechain.active ? <em>{step}</em> : step}
                    {i < c.statechain.steps.length - 1 ? ' → ' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function QuickActions() {
  return (
    <div className="card">
      <h2>
        <span className="dot" />
        Quick Actions
      </h2>
      <div className="sub">Safe actions run immediately. Gated actions stop at a human checkpoint before commit.</div>
      <div className="actions-grid">
        {quickActions.map((a) => (
          <button className={`action${a.gated ? ' gated' : ''}`} key={a.label}>
            <b>{a.label}</b>
            <small className={a.gated ? undefined : 'safe'}>{a.gated ? 'Gate' : 'Safe'}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Recover() {
  return (
    <div className="card">
      <h2>
        <span className="dot" style={{ background: 'var(--blue)' }} />
        Recover
      </h2>
      <div className="sub">Resume work that should not disappear.</div>
      <div className="list">
        {recover.map((r) => (
          <div className="item" key={r.title}>
            <div className="row">
              <b>{r.title}</b>
              <span className={`tag ${r.tag}`}>{r.tagLabel}</span>
            </div>
            <span>{r.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Recordstream() {
  return (
    <div className="card">
      <h2>
        <span className="dot" style={{ background: 'var(--green2)' }} />
        Recordstream
      </h2>
      <div className="sub">Append-only proof, feeding the Retention Catalog. ARCHIEVE stamps on close.</div>
      <div className="list">
        {recordstream.map((e) => (
          <div className="item" key={e.at}>
            <span>
              <b>{e.at}</b> · {e.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CaptureRail() {
  return (
    <aside className="right">
      <div className="capture">
        <h2>Capture</h2>
        <p>
          The front door. Drop real life here — PJ normalizes it, stamps it with a FormKey, and routes it to a
          CaseSpace.
        </p>
        <div className="capturebox">“Forward this email, scan this document, or say what just happened.”</div>
        <div className="capgrid">
          <button>Voice</button>
          <button>Photo / Scan</button>
          <button>Email to PJ</button>
          <button>Share Sheet</button>
        </div>
      </div>

      <div className="panel">
        <h3>
          <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />{' '}
          FormKey Stamp
        </h3>
        <div className="ph">
          Binds identity + authority + version to every FORM instance. This is the hook that makes the audit trail
          attributable.
        </div>
        <div className="mini-list">
          {formKeyStamp.map((f) => (
            <div className="linkrow" key={f.label}>
              <span>{f.label}</span>
              <b>{f.value}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Connections</h3>
        <div className="mini-list">
          {connections.map((c) => (
            <div className="linkrow" key={c.label}>
              <span>{c.label}</span>
              <b>{c.value}</b>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
