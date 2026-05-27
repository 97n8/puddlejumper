// Process detail (340px right panel) — fields, transitions, audit timeline.

import type { Process } from '@publiclogic/core';
import { MOCK_AUDIT } from './mock-processes';

const TRIGGER_LABEL: Record<string, string> = {
  intake_complete: 'Mark intake complete',
  route:           'Route to assignee',
  search_begin:    'Begin search',
  search_complete: 'Search complete',
  respond:         'Submit response',
  reassign:        'Reassign',
  close:           'Close',
};

const ALLOWED: Record<string, string[]> = {
  received:  ['intake_complete'],
  logged:    ['route'],
  assigned:  ['search_begin'],
  searching: ['search_complete'],
  reviewing: ['respond', 'reassign'],
  responded: ['close'],
  closed:    [],
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface Props {
  process: Process;
}

export default function ProcessDetail({ process }: Props) {
  const allowed = ALLOWED[process.current_state] ?? [];
  const subject = typeof process.fields?.subject === 'string' ? process.fields.subject : '(untitled)';
  const requester = typeof process.fields?.requester_email === 'string'
    ? process.fields.requester_email
    : null;

  return (
    <aside
      className="border-l overflow-y-auto"
      style={{
        width: 'var(--detail-width)',
        borderColor: 'var(--color-bd)',
        background: 'var(--color-s1)',
      }}
    >
      <header className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-bd)' }}>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink3)] mono">
          Public records request
        </p>
        <h2 className="mt-2 text-[20px] leading-tight">{subject}</h2>
        <p className="mt-2 text-[11px] text-[var(--color-ink3)] mono break-all">
          {process.process_id}
        </p>
      </header>

      <section className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-bd)' }}>
        <h3 className="text-[10px] uppercase tracking-wider text-[var(--color-ink3)] mono mb-2">
          State
        </h3>
        <p className="text-[15px]">{process.current_state}</p>

        {allowed.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {allowed.map((trigger) => (
              <button
                key={trigger}
                type="button"
                className="text-left text-[13px] px-3 py-1.5 rounded border"
                style={{
                  borderColor: 'var(--color-g-bd)',
                  color: 'var(--color-g)',
                  background: 'var(--color-s0)',
                }}
              >
                {TRIGGER_LABEL[trigger] ?? trigger}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-bd)' }}>
        <h3 className="text-[10px] uppercase tracking-wider text-[var(--color-ink3)] mono mb-2">
          Requester
        </h3>
        <p className="text-[13px] text-[var(--color-ink)]">
          {requester ?? <span className="text-[var(--color-ink3)]">(not provided)</span>}
        </p>
      </section>

      {process.assignee_ref && (
        <section className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-bd)' }}>
          <h3 className="text-[10px] uppercase tracking-wider text-[var(--color-ink3)] mono mb-2">
            Assignee
          </h3>
          <p className="text-[13px] mono">{process.assignee_ref}</p>
        </section>
      )}

      <section className="px-5 py-4">
        <h3 className="text-[10px] uppercase tracking-wider text-[var(--color-ink3)] mono mb-3">
          Audit stream
        </h3>
        <ol className="flex flex-col gap-3">
          {MOCK_AUDIT.map((event) => (
            <li key={event.event_id} className="flex gap-3">
              <span
                className="shrink-0 w-1 mt-1 rounded"
                style={{ background: 'var(--color-g-bd)' }}
              />
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--color-ink)] mono">
                  {event.event_subtype}
                </p>
                <p className="text-[11px] text-[var(--color-ink3)] mt-0.5">
                  {event.actor_ref} · {fmtDateTime(event.occurred_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
