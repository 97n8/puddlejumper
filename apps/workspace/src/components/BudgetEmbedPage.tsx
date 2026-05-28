import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react'

const BUDGET_EMBED_URL = 'https://marine-signal-44944190.figma.site'

export function BudgetEmbedPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5faf6_0%,#edf5ef_52%,#e7efe9_100%)] p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4 sm:min-h-[calc(100vh-3rem)]">
        <div className="flex flex-col gap-3 rounded-[28px] border border-white/75 bg-[#f7fbf7]/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-2">
            <a href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800">
              <ArrowLeft size={14} />
              Back to PublicLogic
            </a>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-700">Budget workspace</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                LogicOS Budget
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Embedded budget experience for municipal demos, planning reviews, and working sessions.
              </p>
            </div>
          </div>

          <a
            href={BUDGET_EMBED_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-300 hover:text-emerald-700"
          >
            Open standalone
            <ArrowSquareOut size={16} />
          </a>
        </div>

        <div className="flex-1 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <iframe
            title="LogicOS Budget"
            src={BUDGET_EMBED_URL}
            className="h-full min-h-[70vh] w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        </div>
      </div>
    </div>
  )
}
