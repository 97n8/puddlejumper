'use client';

// DetailPanel (340px) — det-head, step-track, det-body, det-foot.
// Renders selected process detail + live audit feed from GET /api/audit/:id.

import { useState } from 'react';
import type { Process, AuditEvent } from '@publiclogic/core';
import { audit_summary, fmtDateTime } from '../../lib/format';
import {
  STATE_LABEL,
  STATE_ORDER,
  TRIGGER_LABEL,
  nextTriggerFor,
  type PrrState,
  type PrrTrigger,
} from '../../lib/transitions';

interface Props {
  process: Process | null;
  audit: AuditEvent[];
  auditLoading: boolean;
  auditError: string | null;
  advancing: boolean;
  closing: boolean;
  onAdvance: (trigger: PrrTrigger) => void;
  onClose: () => void;
  onToggleChecklistItem: (idx: number, done: boolean) => void;
}

function asChecklist(fields: Record<string, unknown> | null | undefined): Array<{ label: string; done: boolean }> {
  if (!fields) return [];
  const raw = fields.checklist;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { label: string; done?: boolean } => typeof item === 'object' && item !== null)
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label : '(item)',
      done: Boolean(item.done),
    }));
}

function asNotes(fields: Record<string, unknown> | null | undefined): string | null {
  if (!fields) return null;
  return typeof fields.notes === 'string' ? fields.notes : null;
}

function asKv(fields: Record<string, unknown> | null | undefined): Array<[string, string]> {
  if (!fields) return [];
  const out: Array<[string, string]> = [];
  for (const key of Object.keys(fields)) {
    if (key === 'checklist' || key === 'notes' || key === 'subject' || key === 'title') continue;
    const v = fields[key];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out.push([key, String(v)]);
    }
  }
  return out;
}

export default function DetailPanel(props: Props) {
  const { process, audit, auditLoading, auditError, advancing, closing, onAdvance, onClose, onToggleChecklistItem } = props;

  if (!process) {
    return (
      <aside
        className="det"
        style={{
          width: 'var(--detail-w)',
          background: 'var(--s1)',
          borderLeft: '1px solid var(--bd)',
        }}
      >
        <div className="px-5 py-6">
          <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>
            Select a process from the canvas to see its detail.
          </p>
        </div>
      </aside>
    );
  }

  const title = typeof process.fields?.subject === 'string'
    ? process.fields.subject
    : typeof process.fields?.title === 'string'
      ? (process.fields.title as string)
      : '(untitled)';

  const nextTrigger = nextTriggerFor(process.current_state);
  const checklist = asChecklist(process.fields);
  const notes = asNotes(process.fields);
  const kv = asKv(process.fields);
  const stateIdx = STATE_ORDER.indexOf(process.current_state as PrrState);

  return (
    <aside
      className="det overflow-y-auto"
      style={{
        width: 'var(--detail-w)',
        background: 'var(--s1)',
        borderLeft: '1px solid var(--bd)',
      }}
    >
      <header
        className="det-head px-5 py-4"
        style={{ borderBottom: '1px solid var(--bd)' }}
      >
        <p
          className="text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
        >
          {process.process_type}
        </p>
        <h2 className="mt-2 text-[20px] leading-tight" style={{ fontFamily: 'var(--display)' }}>
          {title}
        </h2>
        <p
          className="mt-2 text-[11px] break-all"
          style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
        >
          {process.process_id}
        </p>
      </header>

      {/* step-track */}
      <section
        className="step-track px-5 py-3"
        style={{ borderBottom: '1px solid var(--bd)' }}
      >
        <div className="flex items-center gap-1">
          {STATE_ORDER.map((s, idx) => {
            const reached = idx <= stateIdx;
            return (
              <span
                key={s}
                title={STATE_LABEL[s]}
                aria-label={STATE_LABEL[s]}
                className="flex-1 h-1.5 rounded"
                style={{ background: reached ? 'var(--g-mid)' : 'var(--s2)' }}
              />
            );
          })}
        </div>
        <p
          className="mt-2 text-[12px]"
          style={{ color: 'var(--ink2)', fontFamily: 'var(--mono)' }}
        >
          {STATE_LABEL[process.current_state as PrrState] ?? process.current_state}
        </p>
      </section>

      <section className="det-body">
        {notes && (
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--bd)' }}>
            <h3
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
            >
              Notes
            </h3>
            <p className="text-[13px] whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>
              {notes}
            </p>
          </div>
        )}

        {kv.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--bd)' }}>
            <h3
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
            >
              Fields
            </h3>
            <dl className="text-[12px] grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              {kv.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>{k}</dt>
                  <dd style={{ color: 'var(--ink)' }}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {checklist.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--bd)' }}>
            <h3
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
            >
              Checklist
            </h3>
            <ul>
              {checklist.map((item, idx) => (
                <li key={`${idx}-${item.label}`} className="flex items-center gap-2 py-1">
                  <input
                    id={`cl-${idx}`}
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => onToggleChecklistItem(idx, e.target.checked)}
                  />
                  <label
                    htmlFor={`cl-${idx}`}
                    className="text-[13px]"
                    style={{
                      color: item.done ? 'var(--ink3)' : 'var(--ink)',
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}
                  >
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Audit feed — append-only, real events */}
        <div className="px-5 py-4">
          <h3
            className="text-[10px] uppercase tracking-wider mb-3"
            style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
          >
            Audit stream
          </h3>
          <AuditFeed events={audit} loading={auditLoading} error={auditError} />
        </div>
      </section>

      <footer
        className="det-foot px-5 py-3 flex items-center gap-2 sticky bottom-0"
        style={{
          borderTop: '1px solid var(--bd)',
          background: 'var(--s1)',
        }}
      >
        {nextTrigger && nextTrigger !== 'close' && (
          <button
            type="button"
            disabled={advancing}
            onClick={() => onAdvance(nextTrigger)}
            className="flex-1 text-[12px] px-3 py-2 rounded"
            style={{
              background: 'var(--g)',
              color: 'white',
              fontFamily: 'var(--mono)',
              opacity: advancing ? 0.6 : 1,
            }}
          >
            {advancing ? 'Advancing…' : TRIGGER_LABEL[nextTrigger]}
          </button>
        )}
        {process.current_state === 'responded' && (
          <button
            type="button"
            disabled={closing}
            onClick={onClose}
            className="flex-1 text-[12px] px-3 py-2 rounded border"
            style={{
              borderColor: 'var(--g-bd)',
              color: 'var(--g)',
              fontFamily: 'var(--mono)',
              opacity: closing ? 0.6 : 1,
            }}
          >
            {closing ? 'Closing…' : 'Close PRR'}
          </button>
        )}
        {process.current_state === 'closed' && (
          <p
            className="flex-1 text-center text-[12px]"
            style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
          >
            Closed {process.closed_at ? `· ${fmtDateTime(process.closed_at)}` : ''}
          </p>
        )}
      </footer>
    </aside>
  );
}

function AuditFeed({
  events, loading, error,
}: { events: AuditEvent[]; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <ul aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3 py-1">
            <span
              className="shrink-0 w-1 mt-1 rounded h-4"
              style={{ background: 'var(--s2)' }}
            />
            <div className="flex-1">
              <div className="h-3 w-3/4 rounded" style={{ background: 'var(--s2)' }} />
              <div className="mt-1 h-2 w-1/2 rounded" style={{ background: 'var(--s2)' }} />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (error) {
    return (
      <p className="text-[12px]" style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>
        {error}
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <p className="text-[12px]" style={{ color: 'var(--ink3)' }}>
        No events yet.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.event_id} className="flex gap-3">
          <span
            aria-hidden
            className="shrink-0 w-1 mt-1 rounded"
            style={{ background: 'var(--g-bd)' }}
          />
          <div className="min-w-0">
            <p
              className="text-[12px]"
              style={{ color: 'var(--ink)', fontFamily: 'var(--mono)' }}
            >
              {audit_summary(e.event_subtype)}
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: 'var(--ink3)' }}
            >
              {(e.actor_ref ?? 'system')} · {fmtDateTime(e.occurred_at)}
              <span
                className="ml-1"
                style={{ color: 'var(--ink4)', fontFamily: 'var(--mono)' }}
              >
                {e.event_subtype}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
// Silence unused-state warnings in strict environments.
void useState;
