'use client';

// Canvas — center column. Holds cv-top header, filter bar, card list.

import type { Process } from '@publiclogic/core';
import ProcessCard from './ProcessCard';
import type { DomainFilter } from './Sidebar';
import type { TemplateDomain } from '../../lib/templates';

const FILTER_TABS: Array<{ id: DomainFilter; label: string }> = [
  { id: 'all',         label: 'All' },
  { id: 'Campaign',    label: 'Campaign' },
  { id: 'PublicLogic', label: 'PublicLogic' },
  { id: 'Personal',    label: 'Personal' },
];

interface Props {
  processes: Process[];
  filter: DomainFilter;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onSelectFilter: (f: DomainFilter) => void;
  onSelectProcess: (id: string) => void;
  onNewProcess: () => void;
}

function visible(processes: Process[], filter: DomainFilter): Process[] {
  if (filter === 'all') return processes;
  return processes.filter((p) => {
    const d = typeof p.fields?.domain === 'string'
      ? (p.fields.domain as TemplateDomain)
      : 'PublicLogic';
    return d === filter;
  });
}

export default function Canvas({
  processes, filter, selectedId, loading, error,
  onSelectFilter, onSelectProcess, onNewProcess,
}: Props) {
  const rows = visible(processes, filter);

  return (
    <section
      className="canvas flex flex-col min-w-0"
      style={{ background: 'var(--s0)' }}
    >
      <header
        className="cv-top px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--bd)' }}
      >
        <div>
          <h2 className="text-[18px] leading-none" style={{ fontFamily: 'var(--display)' }}>
            {filter === 'all' ? 'All processes' : filter}
          </h2>
          <p
            className="text-[11px] mt-1"
            style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
          >
            {rows.length} of {processes.length} total
          </p>
        </div>
        <button
          type="button"
          onClick={onNewProcess}
          className="text-[12px] px-3 py-1.5 rounded"
          style={{
            background: 'var(--g)',
            color: 'white',
            fontFamily: 'var(--mono)',
          }}
        >
          + Process
        </button>
      </header>

      <nav
        className="cv-filter flex gap-1 px-5 py-2"
        style={{ borderBottom: '1px solid var(--bd)' }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = tab.id === filter;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectFilter(tab.id)}
              className="text-[12px] px-2.5 py-1 rounded"
              style={{
                background: isActive ? 'var(--s2)' : 'transparent',
                color: isActive ? 'var(--ink)' : 'var(--ink3)',
                fontFamily: 'var(--mono)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {loading && processes.length === 0 ? (
          <ul aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="px-5 py-4"
                style={{ borderBottom: '1px solid var(--bd)' }}
              >
                <div
                  className="h-3 w-1/2 rounded"
                  style={{ background: 'var(--s2)' }}
                />
                <div
                  className="mt-2 h-2 w-1/4 rounded"
                  style={{ background: 'var(--s2)' }}
                />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="px-5 py-6">
            <p className="text-[13px]" style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>
              {error}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8">
            <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>
              No processes in this filter. Click <span style={{ fontFamily: 'var(--mono)' }}>+ Process</span> to start one.
            </p>
          </div>
        ) : (
          <ol>
            {rows.map((p) => (
              <ProcessCard
                key={p.process_id}
                process={p}
                selected={p.process_id === selectedId}
                onSelect={onSelectProcess}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
