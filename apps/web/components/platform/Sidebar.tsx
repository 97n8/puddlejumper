'use client';

// Sidebar (196px) — domain + workspace nav. The domain items are also the
// filter for the canvas (controlled by the parent via onSelectDomain).

import type { TemplateDomain } from '../../lib/templates';

export type DomainFilter = 'all' | TemplateDomain;

interface Props {
  active: DomainFilter;
  counts: Record<TemplateDomain, number>;
  total: number;
  onSelect: (next: DomainFilter) => void;
}

const DOMAIN_TINT: Record<TemplateDomain, string> = {
  Campaign:    'var(--g)',
  PublicLogic: 'var(--blue)',
  Personal:    'var(--amber)',
};

export default function Sidebar({ active, counts, total, onSelect }: Props) {
  const items: Array<{ id: DomainFilter; label: string; count: number; tint?: string }> = [
    { id: 'all',         label: 'All processes', count: total },
    { id: 'Campaign',    label: 'Campaign',      count: counts.Campaign,    tint: DOMAIN_TINT.Campaign },
    { id: 'PublicLogic', label: 'PublicLogic',   count: counts.PublicLogic, tint: DOMAIN_TINT.PublicLogic },
    { id: 'Personal',    label: 'Personal',      count: counts.Personal,    tint: DOMAIN_TINT.Personal },
  ];

  return (
    <aside
      aria-label="Context"
      className="sb overflow-y-auto"
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--s1)',
        borderRight: '1px solid var(--bd)',
      }}
    >
      <header className="px-4 py-4" style={{ borderBottom: '1px solid var(--bd)' }}>
        <p className="font-medium text-[15px] leading-tight" style={{ color: 'var(--ink)' }}>
          Nathan Boudreau
        </p>
        <p
          className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide"
          style={{ color: 'var(--g)', fontFamily: 'var(--mono)' }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--g)' }}
          />
          PJ Single
        </p>
      </header>

      <section className="px-2 py-3">
        <h3
          className="px-2 pb-1 text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
        >
          Domains
        </h3>
        <ul>
          {items.map((it) => {
            const isActive = it.id === active;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onSelect(it.id)}
                  className="sb-item w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[13px]"
                  style={{
                    background: isActive ? 'var(--s2)' : 'transparent',
                    color: 'var(--ink)',
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {it.tint && (
                      <span
                        aria-hidden
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: it.tint }}
                      />
                    )}
                    <span className="truncate">{it.label}</span>
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
                    {it.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-2 py-3" style={{ borderTop: '1px solid var(--bd)' }}>
        <h3
          className="px-2 pb-1 text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
        >
          Workspace
        </h3>
        <ul className="text-[13px]" style={{ color: 'var(--ink2)' }}>
          <li className="px-2 py-1.5">Templates</li>
          <li className="px-2 py-1.5">Integration</li>
          <li className="px-2 py-1.5">Audit stream</li>
        </ul>
      </section>
    </aside>
  );
}
