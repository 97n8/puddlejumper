import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Command,
  Database,
  FileText,
  Folder,
  Inbox,
  Lock,
  Search,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { pjUrl } from '@/services/pjBase'

type PrimaryTab = 'today' | 'cases' | 'search' | 'ai'
type CaseTab = 'overview' | 'docket' | 'notes' | 'files'
type RuntimeState = 'loading' | 'ok' | 'degraded' | 'offline'
type FlowStageState = 'done' | 'active' | 'queued'

type CaseTask = {
  id: string
  text: string
  done: boolean
}

type MobileCase = {
  id: string
  title: string
  lane: string
  summary: string
  nextAction: string
  color: string
  updatedAt: string
  connections: string[]
  docket: CaseTask[]
  notes: string[]
  files: string[]
}

type CaptureItem = {
  id: string
  text: string
  caseId: string
  destination: 'vault' | 'inbox'
  createdAt: string
}

type FlowStage = {
  id: string
  label: string
  detail: string
  state: FlowStageState
}

type FlowRun = {
  id: string
  caseId: string
  sourceText: string
  destination: 'vault' | 'inbox'
  createdAt: string
  route: string
  verifyPath: string
  drivePath: string | null
  driveSummary: string
  stages: FlowStage[]
}

type PersistedState = {
  cases: MobileCase[]
  captures: CaptureItem[]
  flowRuns: FlowRun[]
}

type HealthPayload = {
  status?: string
  checks?: Record<string, boolean>
}

const STORAGE_KEY = 'logicos-mobile-preview-state-v2'

const DEFAULT_CASES: MobileCase[] = [
  {
    id: 'permit-bridge',
    title: 'PermitBridge',
    lane: 'PL service line',
    summary: 'Municipal permit intake, routing, and record closure with PuddleJumper as the runtime contract.',
    nextAction: 'Tighten hearing packet checklist for Gardner and sync the exact filing trail into VAULT.',
    color: '#4a6741',
    updatedAt: '12m ago',
    connections: ['PuddleJumper', 'VAULT', 'Google Drive'],
    docket: [
      { id: 'pb-1', text: 'Review intake form language for residential additions', done: false },
      { id: 'pb-2', text: 'Confirm board posting notice is attached before routing', done: false },
      { id: 'pb-3', text: 'Seal signed decision bundle in Archieve', done: true },
    ],
    notes: [
      'LogicOS should feel like the field desk. PuddleJumper still owns auth, routing, records, and runtime health.',
      'Operators need one obvious path: capture here, verify there, never wonder which host is canonical for backend state.',
    ],
    files: ['hearing-checklist.docx', 'notice-template.md', 'sealed-decision.pdf'],
  },
  {
    id: 'field-ops',
    title: '2nd Worcester Field Ops',
    lane: 'campaign',
    summary: 'Daily capture lane for canvassing notes, ad hoc assignments, and quick follow-ups from the road.',
    nextAction: 'Route walk-list changes and volunteer notes into a single afternoon brief.',
    color: '#7a3329',
    updatedAt: '48m ago',
    connections: ['Google Drive', 'Gmail', 'Calendar'],
    docket: [
      { id: 'fo-1', text: 'Consolidate precinct 2 walk notes', done: false },
      { id: 'fo-2', text: 'Draft thank-you email to new volunteers', done: false },
      { id: 'fo-3', text: 'Mark completed door knock packet in Drive', done: true },
    ],
    notes: [
      'Use quick capture for anything that starts as a voice-note-level fact.',
      'Cases exist to group work, not to slow it down.',
    ],
    files: ['walk-list-precinct-2.csv', 'volunteer-brief.md'],
  },
  {
    id: 'ops-runtime',
    title: 'PublicLogic Ops',
    lane: 'internal',
    summary: 'Internal lane for release checks, connector state, and system-contract clarifications across LogicOS and PJ.',
    nextAction: 'Keep the mobile story clean: field capture in LogicOS, runtime authority in PJ.',
    color: '#3a4350',
    updatedAt: '2h ago',
    connections: ['PuddleJumper', 'VAULT', 'Logic Commons', 'Google Drive'],
    docket: [
      { id: 'ops-1', text: 'Publish updated mobile route demo', done: false },
      { id: 'ops-2', text: 'Link runtime contract from PJ landing', done: false },
      { id: 'ops-3', text: 'Verify sitemap includes mobile route', done: true },
    ],
    notes: [
      'Do not make LogicOS and PJ argue about who owns operations. LogicOS is the field workspace; PJ is the backend runtime and operator console.',
    ],
    files: ['runtime-contract.md', 'mobile-route-copy.txt'],
  },
]

const DEFAULT_CAPTURES: CaptureItem[] = [
  {
    id: 'capture-1',
    text: 'Citizen asked whether hearing packet can be filed digitally; route to PermitBridge checklist.',
    caseId: 'permit-bridge',
    destination: 'vault',
    createdAt: '9m ago',
  },
  {
    id: 'capture-2',
    text: 'Volunteer follow-up needs a cleaner map handoff for precinct 2.',
    caseId: 'field-ops',
    destination: 'inbox',
    createdAt: '28m ago',
  },
]

const DEFAULT_FLOW_RUNS: FlowRun[] = [
  {
    id: 'flow-1',
    caseId: 'permit-bridge',
    sourceText: 'Citizen asked whether hearing packet can be filed digitally; route to PermitBridge checklist.',
    destination: 'vault',
    createdAt: '9m ago',
    route: 'POST /api/vault/intake',
    verifyPath: 'GET /health',
    drivePath: 'POST /api/google/drive/v3/files',
    driveSummary: 'Prepared Drive folder handoff for the permit record bundle.',
    stages: [
      { id: 'capture', label: 'Capture', detail: 'Operator note entered from the field desk in LogicOS.', state: 'done' },
      { id: 'runtime', label: 'PuddleJumper', detail: 'Session-backed handoff routed through the canonical intake contract.', state: 'done' },
      { id: 'vault', label: 'VAULT', detail: 'Record lane prepared for retention, approvals, and chain-of-custody.', state: 'active' },
      { id: 'verify', label: 'Verify', detail: 'Health and record surfaces stay available for operator confirmation.', state: 'queued' },
    ],
  },
  {
    id: 'flow-2',
    caseId: 'field-ops',
    sourceText: 'Volunteer follow-up needs a cleaner map handoff for precinct 2.',
    destination: 'inbox',
    createdAt: '28m ago',
    route: 'POST /logicos/inbox',
    verifyPath: 'Open Today queue',
    drivePath: 'POST /api/google/upload/drive/v3/files',
    driveSummary: 'Ready to attach revised walk sheet to the case Drive lane.',
    stages: [
      { id: 'capture', label: 'Capture', detail: 'Quick note captured into the active case from mobile.', state: 'done' },
      { id: 'queue', label: 'Inbox', detail: 'Follow-up task created for the case docket and morning pull.', state: 'active' },
      { id: 'drive', label: 'Drive', detail: 'Supporting file upload can be sent through the PJ Google proxy.', state: 'queued' },
      { id: 'close', label: 'Close', detail: 'Mark done when the map handoff lands in the case packet.', state: 'queued' },
    ],
  },
]

const CONNECTION_DETAILS = [
  { label: 'PuddleJumper', detail: 'Auth, runtime health, and API contract', href: pjUrl('/pj') },
  { label: 'VAULT', detail: 'Records intake and durable case trail', href: '/track' },
  { label: 'Google Drive', detail: 'Document storage through PJ proxy routes', href: '/mobile/google-drive' },
] as const

const AI_PROMPTS = [
  'Turn this field note into a clean task list for today.',
  'Draft a permit follow-up email with the right municipal tone.',
  'Summarize what LogicOS sends to PuddleJumper and what PJ owns.',
]

function loadInitialState(): PersistedState {
  if (typeof window === 'undefined') {
    return { cases: DEFAULT_CASES, captures: DEFAULT_CAPTURES, flowRuns: DEFAULT_FLOW_RUNS }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { cases: DEFAULT_CASES, captures: DEFAULT_CAPTURES, flowRuns: DEFAULT_FLOW_RUNS }
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      cases: Array.isArray(parsed.cases) ? parsed.cases : DEFAULT_CASES,
      captures: Array.isArray(parsed.captures) ? parsed.captures : DEFAULT_CAPTURES,
      flowRuns: Array.isArray(parsed.flowRuns) ? parsed.flowRuns : DEFAULT_FLOW_RUNS,
    }
  } catch {
    return { cases: DEFAULT_CASES, captures: DEFAULT_CAPTURES, flowRuns: DEFAULT_FLOW_RUNS }
  }
}

function countOpenTasks(items: CaseTask[]) {
  return items.filter((item) => !item.done).length
}

function runtimeTone(state: RuntimeState) {
  if (state === 'ok') return 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10'
  if (state === 'degraded') return 'text-amber-200 border-amber-300/30 bg-amber-300/10'
  if (state === 'offline') return 'text-rose-200 border-rose-300/30 bg-rose-300/10'
  return 'text-[#b9b1a7] border-white/10 bg-white/5'
}

function stageTone(state: FlowStageState) {
  if (state === 'done') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
  if (state === 'active') return 'border-[#d4a574]/30 bg-[#d4a574]/10 text-[#f1ece3]'
  return 'border-white/10 bg-black/10 text-[#b9b1a7]'
}

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0b0d] text-[#e8e6e1] [color-scheme:dark]">
      <div className="mx-auto flex min-h-screen max-w-[480px] items-stretch md:min-h-0 md:max-w-5xl md:items-center md:justify-center md:px-6 md:py-8">
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden border-white/10 bg-[#0a0b0d] md:min-h-[880px] md:max-w-[412px] md:rounded-[40px] md:border md:shadow-[0_0_0_10px_#1a1c1f,0_40px_120px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,165,116,0.08),transparent_32%),radial-gradient(circle_at_bottom,rgba(143,166,142,0.08),transparent_28%)]" />
          <div className="relative flex h-full flex-col">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur ${className}`}>
      {children}
    </section>
  )
}

function FlowReceipt({ flow }: { flow: FlowRun }) {
  return (
    <SectionCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Latest flow receipt</p>
          <h3 className="mt-1 text-lg font-semibold text-[#f1ece3]">{flow.destination === 'vault' ? 'LogicOS -> PJ -> VAULT' : 'LogicOS -> case inbox'}</h3>
          <p className="mt-2 text-sm leading-6 text-[#c7c0b7]">{flow.sourceText}</p>
        </div>
        <div className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#b9b1a7]">{flow.createdAt}</div>
      </div>
      <div className="mt-4 grid gap-2">
        {flow.stages.map((stage) => (
          <div key={stage.id} className={`rounded-2xl border px-3 py-3 ${stageTone(stage.state)}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{stage.label}</p>
              <span className="text-[10px] uppercase tracking-[0.16em]">{stage.state}</span>
            </div>
            <p className="mt-1.5 text-xs leading-5 opacity-85">{stage.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 text-xs text-[#b9b1a7]">
        <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5">
          <span className="text-[#9e978d]">Route</span>
          <code className="mt-1 block text-[#f1ece3]">{flow.route}</code>
        </div>
        {flow.drivePath ? (
          <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5">
            <span className="text-[#9e978d]">Google handoff</span>
            <code className="mt-1 block text-[#f1ece3]">{flow.drivePath}</code>
            <p className="mt-1 text-[#b9b1a7]">{flow.driveSummary}</p>
          </div>
        ) : null}
        <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5">
          <span className="text-[#9e978d]">Verify</span>
          <code className="mt-1 block text-[#f1ece3]">{flow.verifyPath}</code>
        </div>
      </div>
    </SectionCard>
  )
}

export function LogicOSMobilePage() {
  const initialState = useMemo(() => loadInitialState(), [])
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('today')
  const [caseTab, setCaseTab] = useState<CaseTab>('overview')
  const [cases, setCases] = useState<MobileCase[]>(initialState.cases)
  const [captures, setCaptures] = useState<CaptureItem[]>(initialState.captures)
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>(initialState.flowRuns)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [captureDraft, setCaptureDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [aiDraft, setAiDraft] = useState(AI_PROMPTS[0])
  const [runtimeState, setRuntimeState] = useState<RuntimeState>('loading')
  const [runtimeSummary, setRuntimeSummary] = useState('Checking PuddleJumper runtime')

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cases, captures, flowRuns }))
  }, [cases, captures, flowRuns])

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 4000)

    const run = async () => {
      try {
        const response = await fetch(pjUrl('/health'), { signal: controller.signal })
        if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
        const body = await response.json() as HealthPayload
        const checks = Object.values(body.checks ?? {})
        const passedChecks = checks.filter(Boolean).length
        setRuntimeState(body.status === 'ok' ? 'ok' : 'degraded')
        setRuntimeSummary(
          body.status === 'ok'
            ? `PuddleJumper live · ${passedChecks || 0} checks green`
            : `PuddleJumper reachable · ${passedChecks || 0} checks green`
        )
      } catch {
        setRuntimeState('offline')
        setRuntimeSummary('Runtime probe unavailable from this browser session')
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    void run()

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  const selectedCase = cases.find((item) => item.id === selectedCaseId) ?? null
  const activeCase = selectedCase ?? cases[0]
  const openTasks = useMemo(
    () => cases.flatMap((item) => item.docket.filter((task) => !task.done).map((task) => ({ caseId: item.id, caseTitle: item.title, ...task }))),
    [cases],
  )
  const latestFlow = flowRuns[0] ?? null
  const selectedCaseFlow = selectedCase ? flowRuns.find((flow) => flow.caseId === selectedCase.id) ?? null : null

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []

    const caseMatches = cases
      .filter((item) =>
        [item.title, item.lane, item.summary, item.nextAction].some((value) => value.toLowerCase().includes(query))
      )
      .map((item) => ({ id: `case-${item.id}`, kind: 'Case', title: item.title, detail: item.summary, caseId: item.id }))

    const taskMatches = cases.flatMap((item) =>
      item.docket
        .filter((task) => task.text.toLowerCase().includes(query))
        .map((task) => ({ id: `task-${task.id}`, kind: 'Task', title: task.text, detail: item.title, caseId: item.id }))
    )

    const noteMatches = cases.flatMap((item) =>
      item.notes
        .filter((note) => note.toLowerCase().includes(query))
        .map((note, index) => ({ id: `note-${item.id}-${index}`, kind: 'Note', title: note, detail: item.title, caseId: item.id }))
    )

    const flowMatches = flowRuns
      .filter((flow) =>
        [flow.sourceText, flow.route, flow.driveSummary].some((value) => value.toLowerCase().includes(query))
      )
      .map((flow) => ({ id: flow.id, kind: 'Flow', title: flow.route, detail: flow.sourceText, caseId: flow.caseId }))

    return [...caseMatches, ...taskMatches, ...noteMatches, ...flowMatches].slice(0, 12)
  }, [cases, flowRuns, searchQuery])

  const handleOpenCase = (caseId: string) => {
    setSelectedCaseId(caseId)
    setCaseTab('overview')
  }

  const handleCapture = (destination: 'vault' | 'inbox') => {
    const text = captureDraft.trim()
    if (!text) return

    const createdAt = 'Just now'
    const nextCapture: CaptureItem = {
      id: `capture-${Date.now()}`,
      text,
      caseId: activeCase.id,
      destination,
      createdAt,
    }

    const nextFlow: FlowRun = {
      id: `flow-${Date.now()}`,
      caseId: activeCase.id,
      sourceText: text,
      destination,
      createdAt,
      route: destination === 'vault' ? 'POST /api/vault/intake' : 'POST /logicos/inbox',
      verifyPath: destination === 'vault' ? 'GET /health + case record status' : 'Open Today queue',
      drivePath: activeCase.connections.includes('Google Drive')
        ? destination === 'vault'
          ? 'POST /api/google/drive/v3/files'
          : 'POST /api/google/upload/drive/v3/files'
        : null,
      driveSummary: activeCase.connections.includes('Google Drive')
        ? destination === 'vault'
          ? 'Prepare a Drive folder so the record packet can land with the case.'
          : 'Attach a supporting document through the PJ Google upload proxy.'
        : 'No Drive connector on this case.',
      stages: destination === 'vault'
        ? [
          { id: 'capture', label: 'Capture', detail: 'Field note created in LogicOS and tagged to the active case.', state: 'done' },
          { id: 'runtime', label: 'PuddleJumper', detail: 'Operator handoff moves through the canonical intake route with session-backed auth.', state: 'done' },
          { id: 'vault', label: 'VAULT', detail: 'Case packet is ready for record creation, approvals, and retention handling.', state: 'active' },
          { id: 'verify', label: 'Verify', detail: 'Use health and record surfaces to confirm the handoff stayed coherent.', state: 'queued' },
        ]
        : [
          { id: 'capture', label: 'Capture', detail: 'Field note created in LogicOS without leaving the mobile desk.', state: 'done' },
          { id: 'queue', label: 'Inbox', detail: 'Task added to the active case so it is visible in Today and case work.', state: 'active' },
          { id: 'drive', label: 'Drive', detail: 'Optional supporting file can be uploaded through the Google proxy lane.', state: activeCase.connections.includes('Google Drive') ? 'queued' : 'done' },
          { id: 'close', label: 'Close', detail: 'Complete the work after the follow-up lands in the case packet.', state: 'queued' },
        ],
    }

    setCaptures((current) => [nextCapture, ...current])
    setFlowRuns((current) => [nextFlow, ...current])

    if (destination === 'vault') {
      setCases((current) =>
        current.map((item) => item.id === activeCase.id
          ? {
            ...item,
            notes: [`Sent to VAULT: ${text}`, ...item.notes],
            updatedAt: createdAt,
          }
          : item)
      )
    } else {
      setCases((current) =>
        current.map((item) => item.id === activeCase.id
          ? {
            ...item,
            docket: [{ id: `task-${Date.now()}`, text, done: false }, ...item.docket],
            updatedAt: createdAt,
          }
          : item)
      )
    }

    setCaptureDraft('')
  }

  const toggleTask = (caseId: string, taskId: string) => {
    setCases((current) =>
      current.map((item) =>
        item.id === caseId
          ? {
            ...item,
            docket: item.docket.map((task) => task.id === taskId ? { ...task, done: !task.done } : task),
            updatedAt: 'Just now',
          }
          : item
      )
    )
  }

  const addCaseNote = () => {
    const text = aiDraft.trim()
    if (!selectedCase || !text) return
    setCases((current) =>
      current.map((item) =>
        item.id === selectedCase.id
          ? { ...item, notes: [text, ...item.notes], updatedAt: 'Just now' }
          : item
      )
    )
    setAiDraft('Summarize today’s field work into a clean note.')
  }

  return (
    <MobileShell>
      <div className="flex items-center justify-between px-6 pb-2 pt-3 text-[12px] font-medium tracking-[0.14em] text-[#c7c0b7] uppercase">
        <span>logicOS mobile</span>
        <span>field workspace</span>
      </div>

      <div className="border-b border-white/10 px-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-serif text-[2rem] tracking-[-0.03em] text-[#f1ece3]">logic<span className="italic text-[#d4a574]">OS</span></div>
            <p className="mt-1 max-w-[18rem] text-sm leading-6 text-[#c7c0b7]">
              Mobile-first field capture, with PuddleJumper holding auth, routing, and backend truth.
            </p>
          </div>
          <a
            href="/start"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-[#e8e6e1] transition hover:border-[#d4a574]/40 hover:text-[#d4a574]"
          >
            manual
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="mt-4 flex items-center gap-3 text-[11px] text-[#b9b1a7]">
          <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${runtimeTone(runtimeState)}`}>
            {runtimeState === 'offline' ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            <span>{runtimeSummary}</span>
          </div>
          <span>{openTasks.length} open items</span>
        </div>
      </div>

      {selectedCase ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/10 px-5 py-3">
            <button
              onClick={() => setSelectedCaseId(null)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#c7c0b7] transition hover:border-white/20 hover:text-[#f1ece3]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              all cases
            </button>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">{selectedCase.lane}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#f1ece3]">{selectedCase.title}</h1>
                <p className="mt-2 text-sm leading-6 text-[#c7c0b7]">{selectedCase.summary}</p>
              </div>
              <div className="mt-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#b9b1a7]">
                {selectedCase.updatedAt}
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-auto pb-1">
              {(['overview', 'docket', 'notes', 'files'] as CaseTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCaseTab(tab)}
                  className={`rounded-full border px-3 py-1.5 text-xs capitalize transition ${
                    caseTab === tab
                      ? 'border-[#d4a574]/40 bg-[#d4a574]/12 text-[#f1ece3]'
                      : 'border-white/10 text-[#b9b1a7] hover:text-[#f1ece3]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
            {caseTab === 'overview' ? (
              <>
                <SectionCard className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Next action</p>
                  <p className="mt-2 text-sm leading-6 text-[#f1ece3]">{selectedCase.nextAction}</p>
                </SectionCard>
                {selectedCaseFlow ? <FlowReceipt flow={selectedCaseFlow} /> : null}
                <SectionCard className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">System contract</p>
                  <div className="mt-3 space-y-3 text-sm text-[#d6d0c8]">
                    <div className="flex items-start gap-3">
                      <Inbox className="mt-0.5 h-4 w-4 text-[#d4a574]" />
                      <p>Capture starts in LogicOS so field work feels immediate and low-friction.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Database className="mt-0.5 h-4 w-4 text-[#d4a574]" />
                      <p>PuddleJumper receives the runtime handoff through <code className="rounded bg-black/20 px-1 py-0.5 text-xs">POST /api/vault/intake</code>.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Lock className="mt-0.5 h-4 w-4 text-[#d4a574]" />
                      <p>VAULT and Archieve carry the durable record trail, approvals, and verification surfaces.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Cloud className="mt-0.5 h-4 w-4 text-[#d4a574]" />
                      <p>Google Drive stays proxied through PJ so tokens never land in the browser. <a href="/mobile/google-drive" className="underline underline-offset-4">Open the Drive surface</a>.</p>
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {caseTab === 'docket' ? (
              <SectionCard className="p-3">
                <div className="space-y-2">
                  {selectedCase.docket.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(selectedCase.id, task.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-left transition hover:border-white/15"
                    >
                      {task.done ? (
                        <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-300" />
                      ) : (
                        <div className="h-4.5 w-4.5 shrink-0 rounded-full border border-white/25" />
                      )}
                      <span className={`text-sm ${task.done ? 'text-[#9e978d] line-through' : 'text-[#f1ece3]'}`}>{task.text}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {caseTab === 'notes' ? (
              <>
                <SectionCard className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Add note</p>
                  <textarea
                    value={aiDraft}
                    onChange={(event) => setAiDraft(event.target.value)}
                    className="mt-3 min-h-[110px] w-full rounded-[18px] border border-white/10 bg-black/15 px-4 py-3 text-sm text-[#f1ece3] outline-none transition placeholder:text-[#7f786f] focus:border-[#d4a574]/40"
                    placeholder="Write the next useful note..."
                  />
                  <button
                    onClick={addCaseNote}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#d4a574]/30 bg-[#d4a574]/12 px-3 py-1.5 text-xs text-[#f1ece3] transition hover:border-[#d4a574]/50"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#d4a574]" />
                    save note
                  </button>
                </SectionCard>
                <div className="space-y-3">
                  {selectedCase.notes.map((note, index) => (
                    <SectionCard key={`${selectedCase.id}-note-${index}`} className="p-4">
                      <p className="text-sm leading-6 text-[#d6d0c8]">{note}</p>
                    </SectionCard>
                  ))}
                </div>
              </>
            ) : null}

            {caseTab === 'files' ? (
              <div className="space-y-3">
                <SectionCard className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Google Drive surface</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#f1ece3]">Drive is part of the case flow, not a random extra page.</h3>
                  <p className="mt-2 text-sm leading-6 text-[#c7c0b7]">
                    LogicOS starts the save, PuddleJumper owns the connector auth, and Google only sees the proxied server-side call.
                  </p>
                  <a
                    href="/mobile/google-drive"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#d4a574]/30 bg-[#d4a574]/12 px-3 py-1.5 text-xs text-[#f1ece3] transition hover:border-[#d4a574]/50"
                  >
                    Open Google Drive page
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#d4a574]" />
                  </a>
                </SectionCard>
                {selectedCase.files.map((file) => (
                  <SectionCard key={file} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4.5 w-4.5 text-[#d4a574]" />
                      <div>
                        <p className="text-sm text-[#f1ece3]">{file}</p>
                        <p className="text-xs text-[#9e978d]">Open through connected storage</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#9e978d]" />
                  </SectionCard>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
            {primaryTab === 'today' ? (
              <>
                <SectionCard className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Quick capture</p>
                      <h2 className="mt-1 text-lg font-semibold text-[#f1ece3]">Catch the thing before it disappears.</h2>
                    </div>
                    <div className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#b9b1a7]">
                      {activeCase.title}
                    </div>
                  </div>
                  <textarea
                    value={captureDraft}
                    onChange={(event) => setCaptureDraft(event.target.value)}
                    className="mt-4 min-h-[116px] w-full rounded-[18px] border border-white/10 bg-black/15 px-4 py-3 text-sm text-[#f1ece3] outline-none transition placeholder:text-[#7f786f] focus:border-[#d4a574]/40"
                    placeholder="Capture what happened, what changed, or what needs follow-up."
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleCapture('inbox')}
                      className="flex-1 rounded-full border border-white/10 px-3 py-2 text-sm text-[#f1ece3] transition hover:border-white/20"
                    >
                      Queue in inbox
                    </button>
                    <button
                      onClick={() => handleCapture('vault')}
                      className="flex-1 rounded-full border border-[#d4a574]/30 bg-[#d4a574]/12 px-3 py-2 text-sm text-[#f1ece3] transition hover:border-[#d4a574]/50"
                    >
                      Send to VAULT
                    </button>
                  </div>
                </SectionCard>

                {latestFlow ? <FlowReceipt flow={latestFlow} /> : null}

                <SectionCard className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Today&apos;s pull</p>
                  <div className="mt-3 space-y-2">
                    {openTasks.slice(0, 4).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleOpenCase(task.caseId)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-left transition hover:border-white/15"
                      >
                        <div>
                          <div className="text-sm text-[#f1ece3]">{task.text}</div>
                          <div className="mt-1 text-xs text-[#9e978d]">{task.caseTitle}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#9e978d]" />
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Connected lanes</p>
                  <div className="mt-3 space-y-2">
                    {CONNECTION_DETAILS.map(({ label, detail, href }) => (
                      <a key={label} href={href} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-3 py-3 transition hover:border-white/15">
                        <div>
                          <p className="text-sm text-[#f1ece3]">{label}</p>
                          <p className="text-xs text-[#9e978d]">{detail}</p>
                        </div>
                        <ArrowUpRight className="h-4.5 w-4.5 text-[#d4a574]" />
                      </a>
                    ))}
                  </div>
                </SectionCard>
              </>
            ) : null}

            {primaryTab === 'cases' ? (
              <div className="space-y-3">
                {cases.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleOpenCase(item.id)}
                    className="w-full rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-white/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-10 w-1 rounded-full" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">{item.lane}</p>
                          <h2 className="mt-1 text-lg font-semibold text-[#f1ece3]">{item.title}</h2>
                          <p className="mt-2 text-sm leading-6 text-[#c7c0b7]">{item.summary}</p>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#9e978d]" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#b9b1a7]">
                        {countOpenTasks(item.docket)} open tasks
                      </span>
                      {item.connections.map((connection) => (
                        <span key={`${item.id}-${connection}`} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#b9b1a7]">
                          {connection}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {primaryTab === 'search' ? (
              <>
                <SectionCard className="p-4">
                  <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/15 px-4 py-3">
                    <Search className="h-4.5 w-4.5 text-[#9e978d]" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full bg-transparent text-sm text-[#f1ece3] outline-none placeholder:text-[#7f786f]"
                      placeholder="Search cases, tasks, notes, and flow receipts"
                    />
                  </label>
                </SectionCard>

                <div className="space-y-3">
                  {(searchQuery ? searchResults : flowRuns).map((result) => (
                    'destination' in result ? (
                      <FlowReceipt key={result.id} flow={result} />
                    ) : (
                      <button
                        key={result.id}
                        onClick={() => handleOpenCase(result.caseId)}
                        className="w-full rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-white/20"
                      >
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">{result.kind}</p>
                        <p className="mt-2 text-sm leading-6 text-[#f1ece3]">{result.title}</p>
                        <p className="mt-2 text-xs text-[#9e978d]">{result.detail}</p>
                      </button>
                    )
                  ))}
                </div>
              </>
            ) : null}

            {primaryTab === 'ai' ? (
              <>
                <SectionCard className="p-4">
                  <div className="flex items-start gap-3">
                    <Bot className="mt-1 h-5 w-5 text-[#d4a574]" />
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">AI lane</p>
                      <h2 className="mt-1 text-lg font-semibold text-[#f1ece3]">Keep the assistant inside the actual operating model.</h2>
                      <p className="mt-2 text-sm leading-6 text-[#c7c0b7]">
                        Draft from field notes here, but keep the system facts straight: LogicOS captures, PJ authenticates and routes, VAULT stores the durable record.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Suggested prompts</p>
                  <div className="mt-3 space-y-2">
                    {AI_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setAiDraft(prompt)}
                        className="w-full rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-left text-sm text-[#d6d0c8] transition hover:border-white/15"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Working draft</p>
                  <textarea
                    value={aiDraft}
                    onChange={(event) => setAiDraft(event.target.value)}
                    className="mt-3 min-h-[132px] w-full rounded-[18px] border border-white/10 bg-black/15 px-4 py-3 text-sm text-[#f1ece3] outline-none transition placeholder:text-[#7f786f] focus:border-[#d4a574]/40"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setSelectedCaseId(activeCase.id)}
                      className="flex-1 rounded-full border border-white/10 px-3 py-2 text-sm text-[#f1ece3] transition hover:border-white/20"
                    >
                      Open case
                    </button>
                    <button
                      onClick={() => handleOpenCase(activeCase.id)}
                      className="flex-1 rounded-full border border-[#d4a574]/30 bg-[#d4a574]/12 px-3 py-2 text-sm text-[#f1ece3] transition hover:border-[#d4a574]/50"
                    >
                      Move into notes
                    </button>
                  </div>
                </SectionCard>
              </>
            ) : null}
          </div>

          <div className="border-t border-white/10 bg-black/20 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'today', label: 'Today', icon: Inbox },
                { key: 'cases', label: 'Cases', icon: Folder },
                { key: 'search', label: 'Search', icon: Search },
                { key: 'ai', label: 'AI', icon: Command },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPrimaryTab(key as PrimaryTab)}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition ${
                    primaryTab === key
                      ? 'bg-white/8 text-[#f1ece3]'
                      : 'text-[#9e978d] hover:text-[#f1ece3]'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </MobileShell>
  )
}

export default LogicOSMobilePage
