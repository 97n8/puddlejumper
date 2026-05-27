'use client';

// ProcessCard (pc) — single row in the canvas list.

import type { Process } from '@publiclogic/core';
import { fmtAge } from '../../lib/format';
import { STATE_LABEL, STATE_ORDER, type PrrState } from '../../lib/transitions';
import type { TemplateDomain } from '../../lib/templates';

const DOMAIN_ACCENT: Record<TemplateDomain, string> = {
  Campaign:    'var(--g)',
  PublicLogic: 'var(--blue)',
  Personal:    'var(--amber)',
};

function progressFor(state: string): number {
  const idx = STATE_ORDER.indexOf(state as PrrState);
  if (idx < 0) return 0;
  return Math.round((idx / (STATE_ORDER.length - 1)) * 100);
}

function urgencyTone(due: string | null | undefined): { label: string; color: string } | null {
  if (!due) return null;
  const ms = new Date(due).getTime() - Date.now();
  const days = Math.floor(ms / 86_400_000);
  if (days < 0)  return { label: 'overdue', color: 'var(--red)' };
  if (days < 2)  return { label: 'hot',     color: 'var(--amber)' };
  if (days < 7)  return { label: 'warm',    color: 'var(--blue)' };
  return { label: 'cool', color: 'var(--ink3)' };
}

interface Props {
  process: Process;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function ProcessCard({ process, selected, onSelect }: Props) {
  const title = typeof process.fields?.subject === 'string'
    ? process.fields.subject
    : typeof process.fields?.title === 'string'
      ? (process.fields.title as string)
      : '(untitled)';
  const domain = (typeof process.fields?.domain === 'string'
    ? (process.fields.domain as TemplateDomain)
    : 'PublicLogic') as TemplateDomain;
  const due = typeof process.fields?.due === 'string' ? (process.fields.due as string) : null;
  const tone = urgencyTone(due);
  const progress = progressFor(process.current_state);

  return (
    <li
      className="pc"
      style={{
        background: selected ? 'var(--g-lt)' : 'var(--s0)',
        borderBottom: '1px solid var(--bd)',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(process.process_id)}
        className="w-full text-left flex gap-3 px-5 py-3"
      >
        {/* Domain accent bar */}
        <span
          aria-hidden
          className="shrink-0 w-0.5 rounded-full"
          style={{ background: DOMAIN_ACCENT[domain] }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] truncate" style={{ color: 'var(--ink)' }}>
              {title}
            </p>
            {tone && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide"
                style={{
                  background: 'var(--s2)',
                  color: tone.color,
                  fontFamily: 'var(--mono)',
                }}
              >
                {tone.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] truncate" style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
            {STATE_LABEL[process.current_state as PrrState] ?? process.current_state}
            {' · '}
            created {fmtAge(process.created_at)} ago
          </p>
          {/* Progress bar — 0..100 based on state position */}
          <div
            className="mt-2 h-1 rounded"
            style={{ background: 'var(--s2)' }}
          >
            <div
              className="h-1 rounded"
              style={{ width: `${progress}%`, background: 'var(--g-mid)' }}
            />
          </div>
        </div>
      </button>
    </li>
  );
}
