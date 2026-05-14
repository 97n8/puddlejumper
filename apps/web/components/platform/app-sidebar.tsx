import Link from "next/link";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "⬛" },
  { label: "Flows & Approvals", href: "/dashboard/flows", icon: "⟳" },
  { label: "Audit Log", href: "/dashboard/audit", icon: "☰" },
  { label: "Org Manager", href: "/dashboard/org", icon: "◈" },
  { label: "SYNCHRON8 Jobs", href: "/dashboard/sync8", icon: "⚙" },
  { label: "Puddles", href: "/dashboard/puddles", icon: "✦" },
  { label: "Settings", href: "/dashboard/settings", icon: "⊙" },
];

export function AppSidebar() {
  return (
    <aside className="w-64 border-r border-[var(--pj-steel)]/20 bg-[var(--pj-midnight)] text-[var(--pj-cream)] flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-4 py-5 border-b border-[var(--pj-steel)]/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">PuddleJumper</span>
          <span className="text-xs font-mono text-[var(--pj-gold)]">// GPR</span>
        </div>
        <p className="text-xs opacity-50 font-mono">dev-tenant</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded text-sm opacity-70 hover:opacity-100 hover:bg-[var(--pj-navy)] transition-all"
          >
            <span className="text-[var(--pj-gold)] w-4 text-center text-xs font-mono">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Admin (role-gated) */}
      <div className="px-3 pb-4 border-t border-[var(--pj-steel)]/30 pt-4">
        <Link
          href="/admin"
          className="flex items-center gap-3 px-3 py-2.5 rounded text-sm opacity-50 hover:opacity-80 hover:bg-[var(--pj-navy)] transition-all"
        >
          <span className="text-[var(--pj-gold)] w-4 text-center text-xs font-mono">⊗</span>
          <span>Admin</span>
        </Link>
        <div className="mt-4 px-3">
          <p className="text-xs opacity-30 font-mono">v0.1.0-pre</p>
          <p className="text-xs opacity-20 font-mono">// GPR runtime active</p>
        </div>
      </div>
    </aside>
  );
}
