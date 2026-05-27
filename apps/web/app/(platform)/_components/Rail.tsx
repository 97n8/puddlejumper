// Spec Part 8 — Rail (48px). Icon nav. Mirrors pj-single-v2.html reference.

const items = [
  { id: 'home',     label: 'Home',      glyph: '◯' },
  { id: 'capture',  label: 'Capture',   glyph: '＋' },
  { id: 'cases',    label: 'CaseSpaces', glyph: '▦' },
  { id: 'records',  label: 'Records',   glyph: '※' },
  { id: 'puddles',  label: 'Puddles',   glyph: '✦' },
];

export default function Rail() {
  return (
    <nav
      aria-label="Primary"
      className="flex flex-col items-center justify-between border-r py-3"
      style={{
        borderColor: 'var(--color-bd)',
        background: 'var(--color-s0)',
      }}
    >
      <ul className="flex flex-col items-center gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-label={item.label}
              title={item.label}
              className="w-9 h-9 grid place-items-center rounded text-[var(--color-ink3)] hover:bg-[var(--color-s2)] hover:text-[var(--color-ink)]"
            >
              <span aria-hidden className="text-base leading-none">
                {item.glyph}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        className="w-9 h-9 grid place-items-center rounded text-[var(--color-ink3)] hover:bg-[var(--color-s2)]"
      >
        <span aria-hidden>⚙</span>
      </button>
    </nav>
  );
}
