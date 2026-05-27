// Process list (Canvas, 1fr column).
// Renders rows shaped to the canon @publiclogic/core Process type.

import type { Process } from '@publiclogic/core';

const STATE_LABEL: Record<string, string> = {
  received:  'Received',
  logged:    'Logged',
  assigned:  'Assigned',
  searching: 'Searching',
  reviewing: 'Reviewing',
  responded: 'Responded',
  closed:    'Closed',
};

const STATE_TONE: Record<string, string> = {
  received:  'var(--color-ink3)',
  logged:    'var(--color-ink2)',
  assigned:  'var(--color-blue)',
  searching: 'var(--color-amber)',
  reviewing: 'var(--color-amber)',
  responded: 'var(--color-g)',
  closed:    'var(--color-ink3)',
};

function fmtAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

interface Props {
  processes: Process[];
  selectedId?: string;
}

export default function ProcessList({ processes, selectedId }: Props) {
  return (
    <section className="border-r flex flex-col" style={{ borderColor: 'var(--color-bd)' }}>
      <header
        className="px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--color-bd)' }}
      >
        <div>
          <h2 className="text-[18px] leading-none">Public records</h2>
          <p className="text-[12px] text-[var(--color-ink3)] mt-1 mono">
            M.G.L. c.66 §10 · {processes.length} active
          </p>
        </div>
        <button
          type="button"
          className="text-[12px] px-3 py-1.5 rounded mono"
          style={{
            background: 'var(--color-g)',
            color: 'white',
          }}
        >
          + new request
        </button>
      </header>

      <ol className="overflow-y-auto">
        {processes.map((p) => {
          const subject = typeof p.fields?.subject === 'string' ? p.fields.subject : '(untitled)';
          const isSelected = p.process_id === selectedId;
          return (
            <li
              key={p.process_id}
              className="border-b cursor-pointer"
              style={{
                borderColor: 'var(--color-bd)',
                background: isSelected ? 'var(--color-g-lt)' : 'var(--color-s0)',
              }}
            >
              <article className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-[var(--color-ink)] truncate">{subject}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-ink3)] mono truncate">
                    {p.process_id.slice(0, 12)}… · created {fmtAge(p.created_at)} ago
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className="text-[11px] mono"
                    style={{ color: STATE_TONE[p.current_state] ?? 'var(--color-ink2)' }}
                  >
                    {STATE_LABEL[p.current_state] ?? p.current_state}
                  </span>
                  {p.assignee_ref && (
                    <p className="text-[10px] text-[var(--color-ink3)] mt-1 mono">
                      → {p.assignee_ref}
                    </p>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
