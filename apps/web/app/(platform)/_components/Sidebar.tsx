// Spec Part 8 — Sidebar (196px). Context nav.
// Single-tier label shows the operator name + tier badge.

type SidebarItem = { id: string; name: string; count?: number };
type SidebarSection = { label: string; items: SidebarItem[] };

const sections: SidebarSection[] = [
  {
    label: 'Today',
    items: [
      { id: 'queue',    name: 'Priority queue', count: 7 },
      { id: 'overdue',  name: 'Overdue',        count: 1 },
    ],
  },
  {
    label: 'Records',
    items: [
      { id: 'prr-active', name: 'Active PRRs',  count: 4 },
      { id: 'prr-closed', name: 'Closed PRRs',  count: 38 },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'templates',   name: 'Templates' },
      { id: 'integration', name: 'Integration' },
      { id: 'audit',       name: 'Audit stream' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside
      aria-label="Context"
      className="border-r overflow-y-auto"
      style={{
        borderColor: 'var(--color-bd)',
        background: 'var(--color-s1)',
      }}
    >
      <header className="px-4 py-4 border-b" style={{ borderColor: 'var(--color-bd)' }}>
        <p className="text-[var(--color-ink)] font-medium text-[15px] leading-tight">
          Nathan Boudreau
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--color-g)] mono">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--color-g)' }}
          />
          PJ Single
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.label} className="px-2 py-3">
          <h3 className="px-2 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-ink3)] mono">
            {section.label}
          </h3>
          <ul>
            {section.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] text-[var(--color-ink)] hover:bg-[var(--color-s2)]"
                >
                  <span>{item.name}</span>
                  {item.count !== undefined && (
                    <span className="text-[11px] text-[var(--color-ink3)] mono">
                      {item.count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
