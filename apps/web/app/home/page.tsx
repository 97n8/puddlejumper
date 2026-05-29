/* =====================================================================
   PUDDLEJUMPER · HOME · /home
   Canon-locked home surface (v1.0). The buildable home shell — calm on
   the surface, governance machinery underneath. Static in this phase;
   wiring gates → /approvals and Recordstream → the audit ledger is later.
   ===================================================================== */
import type { Metadata } from 'next'
import './home.css'
import {
  Sidebar,
  Spine,
  GovernanceGates,
  Needs,
  CaseSpaces,
  QuickActions,
  Recover,
  Recordstream,
  CaptureRail,
} from './home.components'
import { env } from './home.data'

export const metadata: Metadata = {
  // Absolute so the root layout's "%s · PuddleJumper" template doesn't double-apply.
  title: { absolute: `${env.instance} · PuddleJumper Home` },
  description: 'Governed continuity — gates where judgment is required, append-only proof for everything else.',
}

export default function HomePage() {
  return (
    <div className="pj-home">
      <div className="app">
        <Sidebar />

        <main className="main">
          <div className="topbar">
            <div className="title">
              <h1>What needs attention?</h1>
              <p>
                Governed continuity for {env.instance} — gates where judgment is required, append-only proof for
                everything else.
              </p>
            </div>
            <div className="toptools">
              <input className="search" placeholder="Search CaseSpaces, files, people…" aria-label="Search" />
              <button className="btn secondary">Start</button>
              <button className="btn primary">+ Capture</button>
            </div>
          </div>

          <Spine />

          <section className="grid">
            <div>
              <GovernanceGates />
              <Needs />
              <CaseSpaces />
            </div>
            <div>
              <QuickActions />
              <Recover />
              <Recordstream />
            </div>
          </section>
        </main>

        <CaptureRail />
      </div>
    </div>
  )
}
