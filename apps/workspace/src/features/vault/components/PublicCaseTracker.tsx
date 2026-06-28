/**
 * PublicCaseTracker
 *
 * Citizen-facing case status lookup. No auth required.
 * Pre-auth route: /track?c={caseNumber}
 *
 * Queries PuddleJumper's public endpoint — gracefully degrades if unavailable.
 */

import { useState, useEffect } from 'react'
import { MagnifyingGlass, CheckCircle, Clock, Warning, ArrowSquareOut } from '@phosphor-icons/react'
import { pjBase } from '@/services/pjBase'

const PJ = pjBase

type CaseStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error'

interface PublicCaseSummary {
  caseNumber: string
  type: string
  submittedDate: string
  currentStage: string
  citizenStageLabel: string
  estimatedCompletion?: string
  isComplete: boolean
  decision?: string
  town: string
}

// Citizen-friendly stage labels (hides internal process jargon)
function citizenLabel(stage: string): string {
  const map: Record<string, string> = {
    'Intake':                'Received',
    'Assessment':            'Under Review',
    'Gathering':             'Gathering Records',
    'Review':                'Under Review',
    'Response':              'Response Being Prepared',
    'Closure':               'Completed',
    'Completeness Review':   'Under Review',
    'Plan Review':           'Under Review',
    'Fee Collection':        'Awaiting Payment',
    'Issuance':              'Decision Ready',
    'Application':           'Received',
    'Application Intake':    'Received',
    'Approval / Denial':     'Under Review',
    'Filing':                'Filed',
    'Complaint Intake':      'Received',
    'Initial Investigation': 'Under Investigation',
    'Notice of Violation':   'Notice Issued',
    'Compliance Period':     'Awaiting Compliance',
    'Re-Inspection':         'Inspection Scheduled',
    'Escalation':            'Referred for Action',
  }
  return map[stage] ?? stage
}

export function PublicCaseTracker() {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<CaseStatus>('idle')
  const [result, setResult] = useState<PublicCaseSummary | null>(null)

  // Pre-fill from URL ?c= param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('c')
    if (c) {
      setInput(c.toUpperCase())
      lookup(c.toUpperCase())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function lookup(caseNumber = input) {
    const id = caseNumber.trim().toUpperCase()
    if (!id) return
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch(`${PJ}/api/public/cases?id=${encodeURIComponent(id)}`, {
        signal: AbortSignal.timeout(30_000),
      })
      if (res.status === 404) { setStatus('not-found'); return }
      if (!res.ok) { setStatus('error'); return }
      const data = await res.json() as PublicCaseSummary
      data.citizenStageLabel = citizenLabel(data.currentStage)
      setResult(data)
      setStatus('found')
      // Update URL without reload
      const url = new URL(window.location.href)
      url.searchParams.set('c', id)
      window.history.replaceState({}, '', url.toString())
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-[11px] font-black tracking-tight">V</span>
        </div>
        <div>
          <span className="text-sm font-bold text-foreground">VAULT</span>
          <span className="text-muted-foreground text-sm"> · Case Status</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-4 py-10 max-w-xl mx-auto w-full">
        <div className="w-full">
          <h1 className="text-2xl font-bold text-foreground mb-1">Check Your Request Status</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your case number to see the current status of your public records request or permit application.
          </p>

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="e.g. PRR-2026-001"
              className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <button
              onClick={() => lookup()}
              disabled={status === 'loading' || !input.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <MagnifyingGlass size={15} weight="bold" />
              {status === 'loading' ? 'Searching…' : 'Search'}
            </button>
          </div>

          {/* Results */}
          <div className="mt-6">
            {status === 'found' && result && (
              <CaseResult result={result} />
            )}

            {status === 'not-found' && (
              <div className="rounded-xl border border-border p-5 text-center">
                <Warning size={32} className="text-amber-500 mx-auto mb-2" weight="duotone" />
                <p className="font-semibold text-sm">Case Not Found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  We couldn't find a case matching <span className="font-mono font-semibold">{input}</span>.
                  Please double-check your case number and try again, or contact your municipality directly.
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="rounded-xl border border-border p-5 text-center">
                <Warning size={32} className="text-red-500 mx-auto mb-2" weight="duotone" />
                <p className="font-semibold text-sm">Service Temporarily Unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  We're unable to retrieve case information right now. Please try again in a few minutes
                  or contact your municipality directly.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-4 text-center">
        <a
          href="https://publiclogic.org"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Powered by PublicLogic <ArrowSquareOut size={11} />
        </a>
      </footer>
    </div>
  )
}

function CaseResult({ result }: { result: PublicCaseSummary }) {
  const submittedDate = result.submittedDate
    ? new Date(result.submittedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null
  const completionDate = result.estimatedCompletion
    ? new Date(result.estimatedCompletion).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Top bar */}
      <div className={`px-4 py-3 flex items-center justify-between ${result.isComplete ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
        <div>
          <div className="text-white font-mono font-bold text-sm">{result.caseNumber}</div>
          <div className="text-white/70 text-[11px]">{result.type}</div>
        </div>
        {result.isComplete
          ? <CheckCircle size={22} className="text-white" weight="fill" />
          : <Clock size={22} className="text-white/80" weight="duotone" />
        }
      </div>

      {/* Details */}
      <div className="px-4 py-4 space-y-3">
        <StatusRow label="Municipality" value={result.town} />
        {submittedDate && <StatusRow label="Submitted" value={submittedDate} />}
        <StatusRow
          label="Current Status"
          value={result.citizenStageLabel}
          highlight={!result.isComplete}
        />
        {completionDate && !result.isComplete && (
          <StatusRow label="Estimated Response" value={completionDate} />
        )}
        {result.decision && (
          <div className="pt-2 border-t border-border">
            <StatusRow label="Decision" value={result.decision} />
          </div>
        )}
      </div>

      {result.isComplete && (
        <div className="px-4 pb-4 text-xs text-muted-foreground">
          This case has been closed. If you have questions about the decision, please contact your municipality directly.
        </div>
      )}
    </div>
  )
}

function StatusRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${highlight ? 'text-indigo-600' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}
