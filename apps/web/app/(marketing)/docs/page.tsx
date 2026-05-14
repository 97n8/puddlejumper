import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation",
  description: "PuddleJumper GPR documentation — architecture, API, VAULT, deployment.",
};

const navSections = [
  {
    title: "Getting Started",
    items: ["Overview", "Local Setup", "Your First Flow", "Architecture Primer"],
  },
  {
    title: "Architecture",
    items: ["GPR Concepts", "SQLite & Audit", "Tenant Isolation", "AI-Assists-Never-Decides"],
  },
  {
    title: "VAULT Framework",
    items: ["What is VAULT", "Verification", "Authority", "Utility", "Legitimacy", "Transfer"],
  },
  {
    title: "Product Suite",
    items: ["LogicOS", "CAL — Civic Automation", "ARCHIEVE — Retention", "SYNCHRON8 — Jobs", "Org Manager", "Puddles"],
  },
  {
    title: "MCP Tools",
    items: ["Tool Catalog (60+)", "12 Domains", "Using MCP in Flows", "Building Custom Tools"],
  },
  {
    title: "API Reference",
    items: ["Authentication", "Flows API", "VAULT API", "Audit API", "Org Manager API"],
  },
  {
    title: "Deployment",
    items: ["Self-Hosted", "Vercel", "Environment Variables", "SQLite in Production"],
  },
];

const overviewCards = [
  {
    title: "GPR Concepts",
    desc: "What makes PuddleJumper a runtime rather than an engine. Authority, audit, and the conditions that govern every action.",
    href: "#",
    tag: "Start here",
  },
  {
    title: "VAULT Framework",
    desc: "Verification, Authority, Utility, Legitimacy, Transfer. The five conditions that must be satisfied before any governed action can proceed.",
    href: "#",
    tag: "Core doctrine",
  },
  {
    title: "SQLite & Audit",
    desc: "Why SQLite everywhere. Why audit_events is append-only. Why you can't UPDATE a record. The technical foundation of institutional certainty.",
    href: "#",
    tag: "Architecture",
  },
  {
    title: "MCP Tool Catalog",
    desc: "60+ tools across 12 domains. Each tool is a callable governance action — authenticated, audited, and scoped to the active tenant.",
    href: "#",
    tag: "Reference",
  },
  {
    title: "Local Setup",
    desc: "Get PuddleJumper running locally in under 10 minutes. Node 20+, pnpm, SQLite. No external services required for development.",
    href: "#",
    tag: "Setup",
  },
  {
    title: "Deployment",
    desc: "Self-hosted on any VPS or Vercel. SQLite in WAL mode. Environment variables. What to configure before you go live.",
    href: "#",
    tag: "Ops",
  },
];

export default function DocsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16 lg:grid lg:grid-cols-[240px_1fr] gap-12">
      {/* Sidebar Nav */}
      <nav aria-label="Documentation" className="hidden lg:block">
        <div className="sticky top-24 space-y-6">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-2">
                {section.title.toUpperCase()}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="block text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] py-0.5 transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// DOCS</p>
        <h1 className="text-4xl mb-4">PuddleJumper Documentation</h1>
        <p className="text-lg text-[var(--text-muted)] mb-12 max-w-2xl leading-relaxed">
          PuddleJumper Governance Process Runtime — technical documentation.
          Architecture, VAULT framework, API reference, and deployment guides.
        </p>

        {/* Quick links */}
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          {overviewCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="block border border-[var(--pj-steel)]/20 rounded-lg p-5 hover:border-[var(--pj-navy)] transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold group-hover:text-[var(--pj-navy)] transition-colors">
                  {card.title}
                </h3>
                <span className="shrink-0 text-xs font-mono text-[var(--pj-gold)] bg-[var(--pj-midnight)] px-2 py-0.5 rounded">
                  {card.tag}
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{card.desc}</p>
            </Link>
          ))}
        </div>

        {/* AI-Assists banner */}
        <div className="border border-[var(--pj-gold)]/30 rounded-lg p-6 bg-[var(--pj-midnight)] text-[var(--pj-cream)]">
          <p className="text-xs font-mono text-[var(--pj-gold)] mb-2">// CORE PRINCIPLE</p>
          <h3 className="text-xl font-semibold mb-3">AI assists, never decides.</h3>
          <p className="text-sm opacity-80 leading-relaxed">
            Every AI interaction in PuddleJumper — Puddles chat, MCP tool calls, automated suggestions —
            is logged to audit_events. The AI surfaces options. A human with authority makes the decision.
            VAULT evaluates the decision before it executes. This is not a policy. It&apos;s the architecture.
          </p>
        </div>
      </main>
    </div>
  );
}
