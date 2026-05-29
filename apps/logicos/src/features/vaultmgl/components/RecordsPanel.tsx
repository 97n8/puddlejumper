import { useState } from 'react'
import { CheckCircle, XCircle, Clock, CalendarBlank, Plus } from '@phosphor-icons/react'
import type { GeneratedTownData } from '../data/generator'

interface RecordsPanelProps {
  townData: GeneratedTownData
  defaultTab?: 'prr' | 'meetings' | 'compliance'
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function RecordsPanel({ townData, defaultTab = 'prr' }: RecordsPanelProps) {
  const [tab, setTab] = useState<'prr' | 'meetings' | 'compliance'>(defaultTab)
  const [meetings, setMeetings] = useState(townData.meetings)
  const [showNewPRR, setShowNewPRR] = useState(false)

  const prrCases = townData.cases.filter(c => c.procId === 'proc_prr')
  const boards = ['Board of Selectmen', 'Planning Board', 'Finance Committee', 'Board of Health', 'Conservation Commission']

  function postMeeting(id: string) {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, posted: true } : m))
  }

  return (
    <div className="p-6">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#DDD8CE' }}>
        {([
          { key: 'prr', label: 'Public Records' },
          { key: 'meetings', label: 'Meeting Records' },
          { key: 'compliance', label: 'Board Compliance' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm transition"
            style={{
              fontWeight: tab === t.key ? 600 : 400,
              borderBottom: tab === t.key ? '2px solid #2C5F2D' : '2px solid transparent',
              color: tab === t.key ? '#2C5F2D' : '#7A7870',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Public Records (PRR) ──────────────────────────────────────────── */}
      {tab === 'prr' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold" style={{ color: '#1A1D16' }}>Public Records Requests</h2>
              <p className="text-xs mt-0.5" style={{ color: '#7A7870' }}>MGL c.66 §10 — 10 business day statutory response window</p>
            </div>
            <button
              onClick={() => setShowNewPRR(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#2C5F2D', color: '#fff' }}
            >
              <Plus size={14} />
              New Request
            </button>
          </div>

          {showNewPRR && (
            <div className="rounded-xl border p-5" style={{ borderColor: '#97BC62', backgroundColor: '#E8F2EB' }}>
              <p className="text-sm font-medium mb-2" style={{ color: '#2C5F2D' }}>
                To submit a new Public Records Request, use the <strong>Forms</strong> panel.
              </p>
              <button onClick={() => setShowNewPRR(false)} className="text-xs" style={{ color: '#7A7870' }}>Dismiss</button>
            </div>
          )}

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F5F1E8', borderBottom: '1px solid #DDD8CE' }}>
                    <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#7A7870' }}>Subject</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium hidden md:table-cell" style={{ color: '#7A7870' }}>Requestor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#7A7870' }}>Submitted</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#7A7870' }}>Days Elapsed</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#7A7870' }}>Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#7A7870' }}>Clock</th>
                  </tr>
                </thead>
                <tbody>
                  {prrCases.map(cas => {
                    const elapsed = daysSince(cas.openedAt)
                    const remaining = 10 - elapsed
                    const overdue = remaining < 0 && cas.status !== 'CLOSED'
                    return (
                      <tr key={cas.id} className="border-t" style={{ borderColor: '#DDD8CE' }}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm truncate max-w-[200px]" style={{ color: '#1A1D16' }}>{cas.subject}</div>
                          <div className="text-xs font-mono" style={{ color: '#7A7870' }}>{cas.id}</div>
                        </td>
                        <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: '#7A7870' }}>
                          {cas.fields.requestor ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#7A7870' }}>{formatDate(cas.openedAt)}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: elapsed > 8 ? '#B84020' : '#1A1D16' }}>
                          {elapsed}d
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: cas.status === 'ACTIVE' ? '#E8F2EB' : cas.status === 'CLOSED' ? '#F0F0EE' : '#FDEFEA',
                              color: cas.status === 'ACTIVE' ? '#2C5F2D' : cas.status === 'CLOSED' ? '#7A7870' : '#B84020',
                            }}
                          >
                            {cas.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {cas.status === 'CLOSED' ? (
                            <span className="flex items-center gap-1 text-xs" style={{ color: '#97BC62' }}>
                              <CheckCircle size={12} />
                              Closed
                            </span>
                          ) : overdue ? (
                            <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#B84020' }}>
                              <XCircle size={12} />
                              {Math.abs(remaining)}d over
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs" style={{ color: remaining <= 2 ? '#B8911E' : '#2C5F2D' }}>
                              <Clock size={12} />
                              {remaining}d left
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {prrCases.length === 0 && (
              <div className="py-10 text-center text-sm" style={{ color: '#7A7870' }}>No PRR cases found</div>
            )}
          </div>
        </div>
      )}

      {/* ── Meeting Records ───────────────────────────────────────────────── */}
      {tab === 'meetings' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold" style={{ color: '#1A1D16' }}>Meeting Records</h2>
            <p className="text-xs mt-0.5" style={{ color: '#7A7870' }}>MGL c.30A §20 — 48-hour posting requirement</p>
          </div>

          <div className="space-y-3">
            {meetings.map(mtg => {
              const isPast = new Date(mtg.date) < new Date()
              const daysLeft = daysUntil(mtg.date)
              const postingAtRisk = !mtg.posted && daysLeft <= 2 && !isPast

              return (
                <div
                  key={mtg.id}
                  className="rounded-xl border p-4"
                  style={{ borderColor: postingAtRisk ? '#B8911E' : '#DDD8CE', backgroundColor: '#fff' }}
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div>
                      <div className="font-semibold text-sm" style={{ color: '#1A1D16' }}>{mtg.board}</div>
                      <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: '#7A7870' }}>
                        <span className="flex items-center gap-1">
                          <CalendarBlank size={12} />
                          {formatDate(mtg.date)} at {mtg.time}
                        </span>
                        <span>{mtg.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {mtg.posted ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#E8F2EB', color: '#2C5F2D' }}>
                          <CheckCircle size={12} />
                          Posted
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FDEFEA', color: '#B84020' }}>
                            <XCircle size={12} />
                            Not Posted
                          </span>
                          {!isPast && (
                            <button
                              onClick={() => postMeeting(mtg.id)}
                              className="text-xs px-2 py-1 rounded-lg font-medium"
                              style={{ backgroundColor: '#2C5F2D', color: '#fff' }}
                            >
                              Post Agenda
                            </button>
                          )}
                        </>
                      )}
                      {isPast && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F0F0EE', color: '#7A7870' }}>Past</span>
                      )}
                    </div>
                  </div>

                  {postingAtRisk && (
                    <div className="text-xs px-3 py-2 rounded-lg mb-2" style={{ backgroundColor: '#FBF5E6', color: '#B8911E' }}>
                      ⚠ OML posting window expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — post immediately
                    </div>
                  )}

                  {mtg.agendaItems.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium mb-1" style={{ color: '#7A7870' }}>Agenda Items</div>
                      <ol className="list-decimal list-inside space-y-0.5">
                        {mtg.agendaItems.map((item, i) => (
                          <li key={i} className="text-xs" style={{ color: '#1A1D16' }}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Board Compliance ──────────────────────────────────────────────── */}
      {tab === 'compliance' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold" style={{ color: '#1A1D16' }}>Board Compliance</h2>
            <p className="text-xs mt-0.5" style={{ color: '#7A7870' }}>OML compliance status for active boards</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {boards.map((board, i) => {
              const boardMeetings = meetings.filter(m => m.board === board)
              const lastMeeting = boardMeetings.filter(m => new Date(m.date) < new Date()).pop()
              const nextMeeting = boardMeetings.find(m => new Date(m.date) > new Date())
              const postedCount = boardMeetings.filter(m => m.posted).length
              const complianceOk = postedCount === boardMeetings.length || boardMeetings.length === 0
              const vacancies = i % 3 === 0 ? 1 : 0

              return (
                <div key={board} className="rounded-xl border p-4" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-sm" style={{ color: '#1A1D16' }}>{board}</div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: complianceOk ? '#E8F2EB' : '#FDEFEA', color: complianceOk ? '#2C5F2D' : '#B84020' }}
                    >
                      {complianceOk ? 'Compliant' : 'Review'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs" style={{ color: '#7A7870' }}>
                    {vacancies > 0 && (
                      <div style={{ color: '#B8911E' }}>⚠ {vacancies} vacancy</div>
                    )}
                    {lastMeeting && <div>Last meeting: {formatDate(lastMeeting.date)}</div>}
                    {nextMeeting && <div>Next: {formatDate(nextMeeting.date)} at {nextMeeting.time}</div>}
                    <div>OML posting: {postedCount}/{boardMeetings.length} meetings posted</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
