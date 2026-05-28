import { useState } from 'react'
import { ArrowLeft, Seal, Warning, CheckCircle, Clock, CaretRight } from '@phosphor-icons/react'
import type { GeneratedTownData, MglCase } from '../data/generator'
import { MGL_PROCESSES } from '../data/mglProcesses'

interface CaseDeskProps {
  townData: GeneratedTownData
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: '#E8F2EB', color: '#2C5F2D' },
  BLOCKED: { bg: '#FDEFEA', color: '#B84020' },
  CLOSED: { bg: '#F0F0EE', color: '#7A7870' },
  WITHDRAWN: { bg: '#F0F0EE', color: '#7A7870' },
}

const _RISK_STYLE: Record<string, string> = {
  low: '#97BC62',
  medium: '#B8911E',
  high: '#B84020',
}

const PROC_FILTER_LABELS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'proc_prr', label: 'PRR' },
  { key: 'proc_permit', label: 'Permits' },
  { key: 'proc_oml', label: 'Board' },
  { key: 'proc_apwarrant', label: 'Finance' },
  { key: 'proc_procurement', label: 'Procurement' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(cas: MglCase): boolean {
  if (cas.status === 'CLOSED' || cas.status === 'WITHDRAWN') return false
  return new Date(cas.dueAt) < new Date()
}

// ── Stage Rail ─────────────────────────────────────────────────────────────
function StageRail({ cas }: { cas: MglCase }) {
  const proc = MGL_PROCESSES.find(p => p.id === cas.procId)
  if (!proc) return null

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {proc.stages.map(stage => {
        const done = stage.seq < cas.currentStage
        const active = stage.seq === cas.currentStage
        const blocked = active && cas.status === 'BLOCKED'
        return (
          <div key={stage.seq} className="flex items-center gap-1 shrink-0">
            <div
              className="flex flex-col items-center"
              style={{ minWidth: 64 }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1"
                style={{
                  backgroundColor: blocked ? '#B84020' : done ? '#2C5F2D' : active ? '#97BC62' : '#DDD8CE',
                  color: done || active || blocked ? '#fff' : '#7A7870',
                }}
              >
                {done ? '✓' : stage.seq}
              </div>
              <div className="text-[10px] text-center leading-tight" style={{ color: active ? '#1A1D16' : '#7A7870' }}>
                {stage.name}
              </div>
            </div>
            {stage.seq < proc.stageCount && (
              <div className="w-6 h-0.5 shrink-0 mb-4" style={{ backgroundColor: done ? '#2C5F2D' : '#DDD8CE' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Case Detail ────────────────────────────────────────────────────────────
function CaseDetail({ cas, onBack }: { cas: MglCase; onBack: () => void }) {
  const [tab, setTab] = useState<'details' | 'proof' | 'transitions'>('details')
  const [currentStage, setCurrentStage] = useState(cas.currentStage)
  const proc = MGL_PROCESSES.find(p => p.id === cas.procId)
  const stage = proc?.stages.find(s => s.seq === currentStage)
  const canAdvance = cas.status === 'ACTIVE' && currentStage < (proc?.stageCount ?? 0)

  function advanceStage() {
    if (canAdvance) setCurrentStage(s => s + 1)
  }

  const displayCase = { ...cas, currentStage }

  return (
    <div className="p-6 space-y-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
        style={{ color: '#7A7870' }}
      >
        <ArrowLeft size={16} />
        Back to Case Desk
      </button>

      {/* Header */}
      <div className="rounded-xl border p-5" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
        <div className="flex flex-wrap items-start gap-3 mb-2">
          <span className="font-mono text-sm font-bold" style={{ color: '#7A7870' }}>{displayCase.id}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: STATUS_STYLE[displayCase.status].bg, color: STATUS_STYLE[displayCase.status].color }}
          >
            {displayCase.status}
          </span>
          {displayCase.seal && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#E8F2EB', color: '#2C5F2D' }}>
              <Seal size={12} />
              SEALED
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold mb-1" style={{ color: '#1A1D16' }}>{displayCase.subject}</h2>
        <div className="text-sm" style={{ color: '#7A7870' }}>
          {displayCase.procName} · Handler: {displayCase.handler} · Opened {formatDate(displayCase.openedAt)} · Due {formatDate(displayCase.dueAt)}
        </div>

        {/* Stage Rail */}
        <div className="mt-4">
          <StageRail cas={displayCase} />
        </div>

        {/* Hard stop */}
        {displayCase.status === 'BLOCKED' && displayCase.blockedReason && (
          <div className="mt-4 rounded-lg border p-4" style={{ borderColor: '#B84020', backgroundColor: '#FDEFEA' }}>
            <div className="flex items-center gap-2 font-semibold text-sm mb-1" style={{ color: '#B84020' }}>
              <Warning size={16} />
              Hard Stop — Blocked
            </div>
            <p className="text-sm" style={{ color: '#7A7870' }}>{displayCase.blockedReason}</p>
            {stage?.mglCitation && (
              <p className="text-xs mt-1 font-mono" style={{ color: '#B84020' }}>{stage.mglCitation}</p>
            )}
          </div>
        )}

        {/* Advance */}
        {canAdvance && (
          <div className="mt-4">
            <button
              onClick={advanceStage}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#2C5F2D', color: '#fff' }}
            >
              Advance to Next Stage →
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
        <div className="flex border-b" style={{ borderColor: '#DDD8CE' }}>
          {(['details', 'proof', 'transitions'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm capitalize transition"
              style={{
                fontWeight: tab === t ? 600 : 400,
                borderBottom: tab === t ? '2px solid #2C5F2D' : '2px solid transparent',
                color: tab === t ? '#2C5F2D' : '#7A7870',
              }}
            >
              {t === 'proof' ? 'Proof Chain' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === 'details' && (
            <div className="space-y-3">
              {Object.entries(displayCase.fields).map(([k, v]) => (
                <div key={k} className="flex gap-4 text-sm">
                  <span className="capitalize font-medium w-32 shrink-0" style={{ color: '#7A7870' }}>{k}</span>
                  <span style={{ color: '#1A1D16' }}>{v}</span>
                </div>
              ))}
              {Object.keys(displayCase.fields).length === 0 && (
                <p className="text-sm" style={{ color: '#7A7870' }}>No additional fields recorded.</p>
              )}
            </div>
          )}
          {tab === 'proof' && (
            <div className="space-y-3">
              {proc?.stages.filter(s => s.archieveOnEnter && s.seq <= displayCase.currentStage).map(s => (
                <div key={s.seq} className="rounded-lg p-3 font-mono text-xs" style={{ backgroundColor: '#F5F1E8' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle size={14} style={{ color: '#2C5F2D' }} />
                    <span className="font-semibold" style={{ color: '#1A1D16' }}>ARCHIEVE — Stage {s.seq}: {s.name}</span>
                  </div>
                  <div style={{ color: '#7A7870' }}>
                    Hash: {displayCase.id}-S{s.seq}-{Math.abs(displayCase.id.charCodeAt(5) ^ s.seq * 7).toString(16).padStart(8, '0')}
                  </div>
                  {s.mglCitation && <div style={{ color: '#2C5F2D' }}>Citation: {s.mglCitation}</div>}
                </div>
              ))}
              {displayCase.seal && (
                <div className="rounded-lg p-3 font-mono text-xs" style={{ backgroundColor: '#E8F2EB' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Seal size={14} style={{ color: '#2C5F2D' }} />
                    <span className="font-semibold" style={{ color: '#2C5F2D' }}>SEAL APPLIED</span>
                  </div>
                  <div style={{ color: '#7A7870' }}>{displayCase.seal}</div>
                </div>
              )}
            </div>
          )}
          {tab === 'transitions' && (
            <div className="space-y-2">
              {proc?.stages.filter(s => s.seq <= displayCase.currentStage).map(s => (
                <div key={s.seq} className="flex items-center gap-3 text-sm py-2 border-b last:border-0" style={{ borderColor: '#DDD8CE' }}>
                  <Clock size={14} style={{ color: '#7A7870' }} />
                  <span className="font-mono text-xs" style={{ color: '#7A7870' }}>
                    {formatDate(new Date(Date.now() - (displayCase.currentStage - s.seq) * 86400000 * 2).toISOString())}
                  </span>
                  <span style={{ color: '#1A1D16' }}>Stage {s.seq}: {s.displayLabel}</span>
                  {s.isHardStop && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FDEFEA', color: '#B84020' }}>Hard Stop</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Case Desk (main view) ─────────────────────────────────────────────────
export function CaseDesk({ townData }: CaseDeskProps) {
  const [procFilter, setProcFilter] = useState('ALL')
  const [selectedCase, setSelectedCase] = useState<MglCase | null>(null)
  const { cases } = townData

  if (selectedCase) {
    return <CaseDetail cas={selectedCase} onBack={() => setSelectedCase(null)} />
  }

  const filtered = procFilter === 'ALL' ? cases : cases.filter(c => c.procId === procFilter)

  const active = cases.filter(c => c.status === 'ACTIVE').length
  const blocked = cases.filter(c => c.status === 'BLOCKED').length
  const overdue = cases.filter(isOverdue).length
  const sealed = cases.filter(c => c.seal !== null).length

  return (
    <div className="p-6 space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active', value: active, color: '#2C5F2D' },
          { label: 'Blocked', value: blocked, color: '#B84020' },
          { label: 'Overdue', value: overdue, color: overdue > 0 ? '#B84020' : '#7A7870' },
          { label: 'Sealed', value: sealed, color: '#97BC62' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border p-3 text-center" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#7A7870' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        {PROC_FILTER_LABELS.map(f => (
          <button
            key={f.key}
            onClick={() => setProcFilter(f.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition"
            style={{
              backgroundColor: procFilter === f.key ? '#2C5F2D' : '#fff',
              color: procFilter === f.key ? '#fff' : '#7A7870',
              border: `1px solid ${procFilter === f.key ? '#2C5F2D' : '#DDD8CE'}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Case table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F1E8', borderBottom: '1px solid #DDD8CE' }}>
                <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#7A7870' }}>Case ID</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#7A7870' }}>Subject</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs hidden md:table-cell" style={{ color: '#7A7870' }}>Process</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs hidden sm:table-cell" style={{ color: '#7A7870' }}>Stage</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#7A7870' }}>Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs hidden lg:table-cell" style={{ color: '#7A7870' }}>Due</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(cas => {
                const overdueCase = isOverdue(cas)
                return (
                  <tr
                    key={cas.id}
                    className="border-t cursor-pointer hover:bg-[#F9F7F2] transition-colors"
                    style={{ borderColor: '#DDD8CE' }}
                    onClick={() => setSelectedCase(cas)}
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#7A7870' }}>{cas.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[200px]" style={{ color: '#1A1D16' }}>{cas.subject}</div>
                      <div className="text-xs" style={{ color: '#7A7870' }}>{cas.department}</div>
                    </td>
                    <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: '#7A7870' }}>{cas.procName}</td>
                    <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: '#7A7870' }}>
                      {cas.currentStage} / {cas.totalStages}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: STATUS_STYLE[cas.status].bg, color: STATUS_STYLE[cas.status].color }}
                        >
                          {cas.status}
                        </span>
                        {cas.seal && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#E8F2EB', color: '#2C5F2D' }}>
                            <Seal size={10} />
                            SEAL
                          </span>
                        )}
                        {overdueCase && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#FDEFEA', color: '#B84020' }}>
                            OVERDUE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs hidden lg:table-cell" style={{ color: overdueCase ? '#B84020' : '#7A7870' }}>
                      {formatDate(cas.dueAt)}
                    </td>
                    <td className="px-4 py-3">
                      <CaretRight size={16} style={{ color: '#7A7870' }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm" style={{ color: '#7A7870' }}>No cases found</div>
        )}
      </div>
    </div>
  )
}
