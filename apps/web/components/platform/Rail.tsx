// Rail (48px) — primary icon nav.

const ITEMS = [
  { id: 'home',     label: 'Home',       glyph: '◯' },
  { id: 'capture',  label: 'Capture',    glyph: '＋' },
  { id: 'cases',    label: 'CaseSpaces', glyph: '▦' },
  { id: 'records',  label: 'Records',    glyph: '※' },
  { id: 'puddles',  label: 'Puddles',    glyph: '✦' },
];

export default function Rail() {
  return (
    <nav
      aria-label="Primary"
      className="rail flex flex-col items-center justify-between py-3"
      style={{
        width: 'var(--rail-w)',
        background: 'var(--s0)',
        borderRight: '1px solid var(--bd)',
      }}
    >
      <ul className="flex flex-col items-center gap-1">
        {ITEMS.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              aria-label={it.label}
              title={it.label}
              className="w-9 h-9 grid place-items-center rounded text-base hover:bg-[var(--s2)]"
              style={{ color: 'var(--ink3)' }}
            >
              <span aria-hidden>{it.glyph}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        className="w-9 h-9 grid place-items-center rounded hover:bg-[var(--s2)]"
        style={{ color: 'var(--ink3)' }}
      >
        <span aria-hidden>⚙</span>
      </button>
    </nav>
  );
}
