'use client';

// CaseSpaceView — the first Visibility Layer windshield (Issue #101, C101-B).
// Render the thread. Do not create the thread.
//
// This component RENDERS the CaseSpaceView the backend projects. It fetches
// GET /api/casespaces/:id (which calls @pj/casespace-view server-side) and
// shows the six tiles: + New Item, Current State, Waiting On, Recent Changes,
// Generated Outputs, Show Proof. It invents no state — every tile is a view of
// the fetched read model, and Show Proof expands the SAME proof[] rows that
// Recent Changes summarized.

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/api';

// Mirrors the @pj/casespace-view CaseSpaceView shape (the web app cannot import
// the server/DB package, so the read-model type is declared here).
interface CaseSpaceViewModel {
  caseSpaceId: string;
  currentState: { active: number; waitingApproval: number; blocked: number };
  waitingOn: Array<{
    holdId: string;
    action: string;
    requiredRole: string;
    requestedAt: string;
  }>;
  recentChanges: Array<{
    auditEventId: string;
    type: string;
    summary: string;
    createdAt: string;
  }>;
  generatedOutputs: Array<{
    outputId: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  proof: Array<{
    auditEventId: string;
    type: string;
    payload: unknown;
    createdAt: string;
  }>;
}

type ViewResponse = { ok: true; data: CaseSpaceViewModel };

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return `${e.code}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return 'Request failed';
}

export default function CaseSpaceView({ caseSpaceId }: { caseSpaceId: string }) {
  const [view, setView] = useState<CaseSpaceViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProof, setShowProof] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ViewResponse>(
        `/api/casespaces/${encodeURIComponent(caseSpaceId)}`,
      );
      setView(res.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [caseSpaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <main className="cs-wrap">Loading…</main>;
  if (error) return <main className="cs-wrap cs-error">{error}</main>;
  if (!view) return <main className="cs-wrap">No CaseSpace.</main>;

  return (
    <main className="cs-wrap">
      <header className="cs-head">
        <h1>{view.caseSpaceId}</h1>
        <button type="button" className="cs-new-item" disabled>
          + New Item
        </button>
      </header>

      <section className="cs-tile cs-current-state">
        <h2>Current State</h2>
        <ul>
          <li>{view.currentState.active} Active</li>
          <li>{view.currentState.waitingApproval} Waiting Approval</li>
          <li>{view.currentState.blocked} Blocked</li>
        </ul>
      </section>

      <section className="cs-tile cs-waiting-on">
        <h2>Waiting On</h2>
        {view.waitingOn.length === 0 ? (
          <p className="cs-empty">Nothing waiting.</p>
        ) : (
          <ul>
            {view.waitingOn.map((w) => (
              <li key={w.holdId}>
                {w.action}
                {w.requiredRole ? ` — ${w.requiredRole}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cs-tile cs-recent-changes">
        <h2>Recent Changes</h2>
        {view.recentChanges.length === 0 ? (
          <p className="cs-empty">No changes yet.</p>
        ) : (
          <ul>
            {view.recentChanges.map((c) => (
              <li key={c.auditEventId}>{c.summary}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="cs-tile cs-generated-outputs">
        <h2>Generated Outputs</h2>
        {view.generatedOutputs.length === 0 ? (
          <p className="cs-empty">No outputs yet.</p>
        ) : (
          <ul>
            {view.generatedOutputs.map((o) => (
              <li key={o.outputId}>
                {o.title} <span className="cs-status">({o.status})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cs-tile cs-proof">
        <button
          type="button"
          className="cs-show-proof"
          onClick={() => setShowProof((s) => !s)}
          aria-expanded={showProof}
        >
          {showProof ? 'Hide Proof' : 'Show Proof →'}
        </button>
        {showProof && (
          <ol className="cs-proof-list">
            {/* Show Proof expands the SAME rows Recent Changes summarized. */}
            {view.proof.map((p) => (
              <li key={p.auditEventId}>
                <code>{p.type}</code> · {p.createdAt}
                <pre className="cs-proof-payload">
                  {JSON.stringify(p.payload, null, 2)}
                </pre>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
