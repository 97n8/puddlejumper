"use client";

import { useChat } from "ai/react";
import { useRef, useEffect } from "react";

const SUGGESTED_PROMPTS = [
  "Draft an acknowledgment letter for a new public records request",
  "What VAULT conditions apply to a procurement decision?",
  "How do I calculate the 10-day SLA for a PRR?",
  "Explain M.G.L. c.30A open meeting requirements",
  "What's the difference between clerk and operator roles?",
  "Draft a denial basis for a c.66 §10 exemption",
];

export default function PuddlesPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const empty = messages.length === 0;

  function submitPrompt(text: string) {
    handleInputChange({ target: { value: text } } as React.ChangeEvent<HTMLInputElement>);
    setTimeout(() => {
      document.querySelector<HTMLFormElement>("form#chat-form")?.requestSubmit();
    }, 30);
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--pj-midnight)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: "var(--pj-cream)" }}>Puddles</span>
            <span className="text-xs font-mono" style={{ color: "var(--pj-gold)" }}>// GPR</span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            AI governance assistant · assists, never decides
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-1 rounded"
          style={{ background: "rgba(232,168,56,0.12)", color: "var(--pj-gold)" }}>
          dev-tenant
        </span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {empty ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-mono mb-2" style={{ color: "var(--pj-gold)" }}>// PUDDLES</p>
              <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--pj-cream)" }}>
                What can I help you govern?
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                I assist with public records, procurement, open meeting, and other governed processes.
                Every response is advisory — a human with authority makes all decisions.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitPrompt(prompt)}
                  className="text-left text-xs p-3 rounded-lg transition-colors"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--pj-cream)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--pj-steel)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="shrink-0 w-6 h-6 rounded-full mr-2 mt-1 flex items-center justify-center text-xs font-bold"
                    style={{ background: "var(--pj-gold)", color: "var(--pj-midnight)" }}>
                    P
                  </div>
                )}
                <div
                  className="max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={m.role === "user"
                    ? { background: "var(--pj-navy)", color: "var(--pj-cream)" }
                    : { background: "var(--surface)", color: "var(--pj-cream)", border: "1px solid var(--border)" }
                  }
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="shrink-0 w-6 h-6 rounded-full mr-2 mt-1 flex items-center justify-center text-xs font-bold"
                  style={{ background: "var(--pj-gold)", color: "var(--pj-midnight)" }}>P</div>
                <div className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span className="font-mono text-xs" style={{ color: "var(--pj-gold)" }}>thinking…</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg p-3 text-xs font-mono text-center"
                style={{ background: "rgba(224,92,92,0.1)", color: "var(--pj-error)", border: "1px solid rgba(224,92,92,0.3)" }}>
                {error.message?.includes("ANTHROPIC_API_KEY")
                  ? "// ANTHROPIC_API_KEY not configured — set it in .env.local to activate Puddles"
                  : `// Error: ${error.message}`}
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Doctrine bar */}
      {!empty && (
        <div className="text-center py-1.5 text-xs font-mono shrink-0"
          style={{ color: "var(--text-muted)", opacity: 0.35 }}>
          // AI assists, never decides · suggestions require human review · interactions logged to audit_events
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-5 shrink-0">
        <div className="max-w-2xl mx-auto">
          <form
            id="chat-form"
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-xl p-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about a governed process, draft a letter, or look up a statute…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm py-2 px-2"
              style={{ color: "var(--pj-cream)", minHeight: "40px", maxHeight: "160px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                }
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: "var(--pj-gold)", color: "var(--pj-midnight)" }}
            >
              Send
            </button>
          </form>
          <p className="text-center text-xs mt-2 font-mono"
            style={{ color: "var(--text-muted)", opacity: 0.35 }}>
            ↵ send · shift+↵ newline
          </p>
        </div>
      </div>
    </div>
  );
}
