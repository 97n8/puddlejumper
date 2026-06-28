/**
 * SSCB1Page — Standalone project control page for Swansea SC Biochar 1
 *
 * Route: /aed/SSCB1
 * Design: navy topbar / light-grey body matching the SSCB1 Workspace demo
 * Access: auth-gated (login prompt overlay if not signed in)
 * IP: stakeholder view — curated disclosure, no internal PL methodology
 */

import type { PJUser } from '@/services/auth/AuthContext'
import { useAuth } from '@/services/auth/AuthContext'
import { SSCB1CaseSpace } from './SSCB1CaseSpace'

// ── Color tokens (matching demo HTML) ────────────────────────────────────────
const C = {
  navy: '#0f1d2f',
  navyMid: '#1a2e4a',
  navyLight: '#243d5c',
  green: '#3a7528',
  greenBright: '#4a9932',
  greenGlow: 'rgba(74,153,50,0.12)',
  mint: '#f5f9f3',
  crit: '#e63946',
  critBg: 'rgba(230,57,70,0.08)',
  high: '#e09f3e',
  highBg: 'rgba(224,159,62,0.08)',
  watch: '#457b9d',
  greyBg: '#f4f5f7',
  greyBorder: '#e2e4e8',
  text: '#1a1a2e',
  muted: '#6b7280',
  white: '#ffffff',
}

// ── Static seed data from the SSCB1 Packet ──────────────────────────────────

const STACK_ROWS = [
  { id: 'S01', name: 'Carbon Credit Presale', sub: '~$595K/yr basis', status: 'early', owner: 'Joseph + Rick', next: 'Confirm registry + methodology', risk: 'critical' },
  { id: 'S02', name: 'Trex ChipMax', sub: '$589K', status: 'potential', owner: 'Joseph / Brian', next: 'Decide sequence by Week 3', risk: 'high' },
  { id: 'S03', name: 'ARTi Pyrolysis Unit', sub: '$4.5M total build', status: 'assembling', owner: 'Joseph / Brian', next: 'Confirm delivery window', risk: 'high' },
  { id: 'S04', name: 'ORC / IRC §48 ITC', sub: '30% of equipment', status: 'active', owner: 'AED + Tax counsel', next: 'ElectraTherm spec + tax opinion', risk: 'critical' },
  { id: 'S05', name: 'Feedstock — BES', sub: '10-yr, zero-cost', status: 'strong', owner: 'BES + AED', next: 'Retrieve executed copy', risk: 'high' },
  { id: 'S06', name: 'Wood Chip Off-take', sub: '$22/ST · ~$1.56M/yr', status: 'structured', owner: 'Joseph / BES', next: 'Retrieve agreement + escalator', risk: 'high' },
  { id: 'S07', name: 'Carbon Registry', sub: 'Verification pathway', status: 'mustmature', owner: 'AED + registry', next: 'Registry shortlist Week 5', risk: 'critical' },
  { id: 'S08', name: 'Tax Counsel', sub: 'ITC + NMTC opinion', status: 'notformal', owner: 'Legal / tax', next: 'Engage counsel; scope opinion', risk: 'critical' },
  { id: 'S09', name: 'SC DHEC Permit', sub: 'Construction + Operating', status: 'defined', owner: 'Robert Chew', next: 'Confirm filing window', risk: 'high' },
]

const RISKS = [
  { id: 'R01', title: 'Carbon presale moves before verification methodology is real', owner: 'Joseph', mitigation: 'STOP-SSCB-001 active', sev: 'critical' },
  { id: 'R02', title: 'ITC recapture clock forgotten after Year 1', owner: 'Tax counsel', mitigation: '5-year ITC Tracker', sev: 'critical' },
  { id: 'R07', title: 'Registry selection stalls — no methodology to validate CO₂ claim', owner: 'AED + registry', mitigation: 'Shortlist Week 5', sev: 'critical' },
  { id: 'R04', title: 'ChipMax purchased before ARTi financing lane is clear', owner: 'Joseph', mitigation: 'Resolve by Week 3', sev: 'high' },
  { id: 'R06', title: 'Tax credit opinion not formalized before ITC claim window', owner: 'Joseph + counsel', mitigation: 'Engage by Week 2', sev: 'high' },
  { id: 'R10', title: 'No single source of truth for project status across team', owner: 'PublicLogic', mitigation: 'This system live by Week 5', sev: 'high' },
]

const ASSUMPTIONS = [
  { label: 'Biochar Output', value: '3,184 ST/yr', source: 'AED deck p.2', conf: 'firm' },
  { label: 'Fixed Carbon', value: '94.8%', source: 'AED deck p.4', conf: 'firm' },
  { label: 'CO₂ per MT Biochar', value: '2.1 MT', source: 'AED deck p.4 · Target: Week 7', conf: 'working' },
  { label: 'Chip Off-take Price', value: '$22/ST', source: 'Off-take agreement', conf: 'firm' },
  { label: 'BES Feedstock Cost', value: '$0/ST', source: '10-year contract', conf: 'firm' },
  { label: 'Carbon Credit Revenue', value: '$595K/yr', source: 'AED proforma · Target: Week 8', conf: 'working' },
  { label: 'ORC ITC Rate', value: '30%', source: 'IRC §48 · Target: Week 3', conf: 'working' },
  { label: 'Operating Days', value: '264/yr', source: 'AED deck p.7', conf: 'firm' },
  { label: 'Gross Revenue Yr 2+', value: '$3.285M', source: 'AED proforma · Target: Week 3', conf: 'working' },
]

const CADENCE = [
  { freq: 'Weekly', name: 'Stack Check', who: 'Joseph + Nate · 30 min · This system is the agenda' },
  { freq: 'Bi-weekly', name: 'AED Project Review', who: 'Joseph + Rick + Robert + Brian + Nate · 60 min' },
  { freq: 'Monthly', name: 'BES Alignment', who: 'Joseph + BES lead + Nate · Tonnage reconciliation' },
  { freq: 'Monthly', name: 'Tax Counsel Touch', who: 'Joseph + tax counsel + Nate · §48 opinion progress' },
  { freq: 'Monthly', name: 'Registry Touch', who: 'Rick + registry contact + Nate · Starting Week 6' },
  { freq: 'Weekly', name: 'Stakeholder View Export', who: 'Nate → Joseph · Live project status, always ready to share' },
]

const VAULT_DOCS = [
  { id: 'V01', name: 'SSCB1 Cover Letter', type: 'DOCX', desc: 'Project framing, capital stack overview, operating cadence', seal: 'SEALED', date: 'Apr 2026' },
  { id: 'V02', name: 'Control Loop Reference', type: 'DOCX', desc: 'Governing process logic — receive, normalize, review, close', seal: 'SEALED', date: 'Apr 2026' },
  { id: 'V03', name: 'Governance & Technical Spec', type: 'DOCX', desc: 'Full system architecture, roles, schema, automation rules', seal: 'SEALED', date: 'Apr 2026' },
  { id: 'V04', name: 'Project Control Workbook', type: 'XLSX', desc: 'Live assumptions, stack, risk register, ITC tracker', seal: 'SEALED', date: 'Apr 2026' },
  { id: 'V05', name: 'Workspace Interface Reference', type: 'HTML', desc: 'Approved stakeholder view design and layout spec', seal: 'SEALED', date: 'Apr 2026' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function NavBar({ user, onLogin, onLogout }: { user: PJUser | null; onLogin: () => void; onLogout: () => void }) {
  return (
    <div style={{
      background: C.navy,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '0 32px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 28, height: 28,
          background: C.green,
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: 'white', fontSize: 13, letterSpacing: '-0.5px',
          fontFamily: 'system-ui, sans-serif',
        }}>PL</div>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 500, letterSpacing: '-0.2px' }}>
          <span style={{ color: C.greenBright, fontWeight: 700 }}>Workspace</span>
          {' '}&nbsp;/&nbsp;{' '}
          SSCB1 Control
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '4px 14px',
          fontSize: 12,
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'monospace',
        }}>v1.0 · Discussion Draft</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.greenBright }}>
          <span style={{
            width: 7, height: 7,
            background: C.greenBright,
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'sscb1-pulse 2s ease-in-out infinite',
          }} />
          Watch Layer Active
        </div>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{user.name ?? user.email ?? 'User'}</span>
            <button onClick={onLogout} style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            }}>Sign out</button>
          </div>
        ) : (
          <button onClick={onLogin} style={{
            background: C.green,
            border: 'none',
            color: 'white',
            borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Sign in</button>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, valueColor }: { label: string; value: string; sub: string; valueColor?: string }) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 10,
      padding: '18px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      border: `1px solid ${C.greyBorder}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: valueColor || C.navy, letterSpacing: '-0.5px', fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: 11, color: valueColor ? valueColor : C.green, marginTop: 4, fontWeight: 500 }}>{sub}</div>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: `1px solid ${C.greyBorder}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: C.navy, letterSpacing: '-0.2px', margin: 0 }}>{title}</h2>
      {count && <span style={{ fontSize: 11, fontFamily: 'monospace', background: C.greyBg, padding: '3px 10px', borderRadius: 12, color: C.muted }}>{count}</span>}
    </div>
  )
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  early: { bg: C.highBg, color: C.high, label: 'Early-Stage' },
  potential: { bg: C.highBg, color: C.high, label: 'Potential First' },
  assembling: { bg: 'rgba(69,123,157,0.1)', color: C.watch, label: 'Assembling' },
  structured: { bg: C.greenGlow, color: C.green, label: 'Structured' },
  strong: { bg: C.greenGlow, color: C.green, label: 'Strong' },
  active: { bg: C.highBg, color: C.high, label: 'Active' },
  mustmature: { bg: C.critBg, color: C.crit, label: 'Must Mature' },
  notformal: { bg: C.critBg, color: C.crit, label: 'Not Formalized' },
  defined: { bg: 'rgba(69,123,157,0.1)', color: C.watch, label: 'Defined' },
}

const RISK_STYLES: Record<string, { bg: string; color: string }> = {
  critical: { bg: C.crit, color: 'white' },
  high: { bg: C.high, color: 'white' },
  watch: { bg: C.watch, color: 'white' },
}

const CONF_BORDER: Record<string, string> = {
  firm: C.green,
  working: C.high,
  estimate: C.watch,
}

// ── Login Overlay ─────────────────────────────────────────────────────────────

function LoginOverlay({ onLogin }: { onLogin: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,29,47,0.92)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        background: C.white,
        borderRadius: 16,
        padding: '40px 48px',
        maxWidth: 420,
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          width: 48, height: 48,
          background: C.green,
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 20, color: 'white',
          margin: '0 auto 20px',
        }}>PL</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 8, letterSpacing: '-0.5px' }}>
          SSCB1 Project Control
        </h2>
        <p style={{ fontSize: 14, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>
          Swansea, SC Biochar 1
        </p>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>
          This is an authorized access environment.<br />
          Sign in to view the project control state.
        </p>
        <button onClick={onLogin} style={{
          background: C.navy,
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '12px 32px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%',
          marginBottom: 12,
        }}>
          Sign in with GitHub
        </button>
        <p style={{ fontSize: 11, color: C.muted }}>
          Access controlled by PublicLogic LLC · Confidential
        </p>
      </div>
    </div>
  )
}


// ── Main Page ─────────────────────────────────────────────────────────────────

export function SSCB1Page() {
  const { user, loading, login, logout } = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <NavBar user={user} onLogin={() => login('github')} onLogout={logout} />
      {!loading && !user && <LoginOverlay onLogin={() => login('github')} />}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
        <SSCB1CaseSpace standalone onNavigate={() => { window.location.href = '/aed' }} />
      </div>
    </div>
  )
}
