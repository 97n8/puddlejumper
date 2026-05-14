import Link from "next/link";

const footerLinks = [
  {
    heading: "Product",
    links: [
      { label: "LogicOS", href: "/product" },
      { label: "VAULT Framework", href: "/product#vault" },
      { label: "CAL — Civic Automation", href: "/product#modules" },
      { label: "ARCHIEVE — Retention", href: "/product#modules" },
      { label: "SYNCHRON8 Jobs", href: "/product#modules" },
      { label: "Formkey", href: "/formkey" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "API Reference", href: "/docs#api" },
      { label: "Grant Funding Guide", href: "/pricing#grants" },
      { label: "MCP Tool Catalog", href: "/docs#mcp" },
      { label: "Architecture Primer", href: "/docs#architecture" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Pricing", href: "/pricing" },
      { label: "GitHub", href: "https://github.com/publiclogic" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--pj-steel)]/20 bg-[var(--pj-midnight)] text-[var(--pj-cream)] py-16">
      <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="md:col-span-1">
          <p className="font-semibold text-base">PuddleJumper</p>
          <p className="text-sm opacity-60 mt-1 leading-relaxed">
            The first governance process runtime for municipal government.
          </p>
          <p className="text-xs opacity-30 mt-4 font-mono">
            PublicLogic LLC<br />
            Gardner, MA
          </p>
          <p className="text-xs opacity-20 mt-2 font-mono">
            © {new Date().getFullYear()} PublicLogic LLC
          </p>
        </div>

        {/* Link columns */}
        {footerLinks.map((col) => (
          <div key={col.heading}>
            <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3 uppercase">
              {col.heading}
            </p>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-6 mt-12 pt-6 border-t border-[var(--pj-steel)]/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <p className="text-xs opacity-20 font-mono">
          // AI assists, never decides. VAULT evaluates before any governed action executes.
        </p>
        <p className="text-xs opacity-20 font-mono">v0.1.0-pre · GPR runtime</p>
      </div>
    </footer>
  );
}
