import type { Metadata } from "next";

export const metadata: Metadata = { title: "Puddles" };

const capabilities = [
  { name: "PRR Assistant",     desc: "Draft acknowledgment letters, find responsive records, suggest VAULT-compliant response language. You decide, review, send." },
  { name: "Flow Drafting",     desc: "Describe a process in plain language. Puddles drafts the governed flow structure — framework, steps, review gates. You approve." },
  { name: "Audit Interpreter", desc: "Ask questions about the audit log. 'What happened to this request?' 'Who approved this?'. Puddles reads, you trust the source." },
  { name: "VAULT Explainer",   desc: "Before a governed action runs, Puddles can explain which VAULT conditions apply and why. No surprises." },
  { name: "Document Drafting", desc: "Draft procurement specifications, staff reports, board meeting summaries. PuddleJumper logs every draft as an AI-assisted artifact." },
];

export default function PuddlesPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-1">// PUDDLES</p>
        <h1 className="text-2xl font-semibold">Puddles</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">AI assistant · Assists, never decides</p>
      </div>

      <div className="mb-6 border border-[var(--pj-warning)]/30 rounded-lg px-4 py-3 bg-[var(--pj-warning)]/5">
        <p className="text-xs font-mono text-[var(--pj-warning)]">
          // ANTHROPIC_API_KEY not configured — Puddles is offline
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Set <code className="font-mono">ANTHROPIC_API_KEY</code> in your environment to activate Puddles.
        </p>
      </div>

      <div className="mb-8">
        <p className="text-xs font-mono text-[var(--pj-gold)] mb-4">// CORE PRINCIPLE</p>
        <div className="border border-[var(--pj-gold)]/30 rounded-lg p-5 bg-[var(--pj-midnight)] text-[var(--pj-cream)]">
          <h2 className="font-semibold text-lg mb-2">AI assists, never decides.</h2>
          <p className="text-sm opacity-80 leading-relaxed">
            Every Puddles interaction is logged to <code className="font-mono text-xs">audit_events</code>.
            Puddles surfaces options and drafts text. A human with authority makes the decision.
            VAULT evaluates the decision before it executes. This is not a policy — it&apos;s the architecture.
          </p>
        </div>
      </div>

      <h2 className="text-sm font-semibold mb-4">What Puddles can do</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {capabilities.map((c) => (
          <div key={c.name} className="border border-[var(--pj-steel)]/20 rounded-lg p-5 bg-[var(--surface-elevated)]">
            <p className="font-medium mb-1.5">{c.name}</p>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
