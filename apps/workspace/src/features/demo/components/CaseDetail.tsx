import { useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Shield, Clock, MessageSquare, GitBranch, ShieldCheck, UserCheck, Send } from 'lucide-react';
import { MOCK_CASES, MOCK_MEMBERS, getArchieveForCase, getHardStopsForCase, getStagesForCase, getNotesForCase, getTransitionsForCase, getProcessDef, type CaseNote } from '../data/mockData';
import { StageRail } from './StageRail';
import { SealBadge } from './SealBadge';
import { HardStopPanel } from './HardStopPanel';
import { ProofChain } from './ProofChain';

interface CaseDetailProps {
  caseId: string;
  onBack: () => void;
}

export function CaseDetail({ caseId, onBack }: CaseDetailProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'proof' | 'notes' | 'transitions'>('details');
  const [advancing, setAdvancing] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [sealVerify, setSealVerify] = useState<{ checked: boolean; valid: boolean } | null>(null);

  const cas = MOCK_CASES.find(c => c.id === caseId);
  if (!cas) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#7A7870]">Case not found.</p>
        <button onClick={onBack} className="mt-4 text-[#2C5F2D] hover:underline text-sm">Back to Case Desk</button>
      </div>
    );
  }

  const stages = getStagesForCase(cas.procId);
  const archieve = getArchieveForCase(cas.id);
  const hardStops = getHardStopsForCase(cas.id).filter(h => !h.resolvedAt);
  const caseNotes = [...getNotesForCase(cas.id), ...notes].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const transitions = getTransitionsForCase(cas.id);
  const procDef = getProcessDef(cas.procId);
  const isBlocked = cas.status === 'BLOCKED';
  const isOverdue = new Date(cas.dueAt) < new Date() && cas.status !== 'CLOSED';
  const currentStageDef = stages.find(s => s.seq === cas.currentStage);
  const hasActiveHardStops = hardStops.length > 0;
  const currentStageIsHardStop = currentStageDef?.isHardStop ?? false;
  const canAdvance = cas.status === 'ACTIVE' && !hasActiveHardStops && !currentStageIsHardStop;

  const handleAdvance = () => {
    if (isBlocked) return;
    setAdvancing(true);
    setTimeout(() => setAdvancing(false), 1000);
  };

  const handleAddNote = () => {
    if (newNote.trim().length < 5) return;
    setNotes(prev => [...prev, {
      id: `note_new_${Date.now()}`,
      caseId: cas.id,
      authorId: 'user_nate',
      authorName: 'Nate Sullivan',
      authorRole: 'admin',
      content: newNote.trim(),
      timestamp: new Date().toISOString(),
      isSystem: false,
    }]);
    setNewNote('');
  };

  const handleVerifySeal = () => {
    setSealVerify({ checked: true, valid: true });
  };

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[#7A7870] hover:text-[#2C5F2D]">
        <ArrowLeft className="w-4 h-4" /> Back to Case Desk
      </button>

      {/* Header card */}
      <div className="bg-white border border-[#DDD8CE] rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono text-[#1A1D16]">{cas.id}</h1>
              {cas.seal && <SealBadge seal={cas.seal} />}
              <span className={`text-xs px-2 py-0.5 rounded ${isBlocked ? 'bg-[#FDEFEA] text-[#B84020]' : cas.status === 'CLOSED' ? 'bg-gray-100 text-gray-500' : 'bg-[#E8F2EB] text-[#2C5F2D]'}`}>{cas.status}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${cas.risk === 'high' ? 'bg-[#FDEFEA] text-[#B84020]' : cas.risk === 'medium' ? 'bg-[#FBF5E6] text-[#B8911E]' : 'bg-[#E8F2EB] text-[#2C5F2D]'}`}>{cas.risk} risk</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-[#7A7870]">{cas.source}</span>
            </div>
            <p className="text-sm text-[#7A7870] mt-1">{cas.procName} · {cas.subject}</p>
            {procDef && (
              <p className="text-[10px] text-[#B8911E] mt-0.5">{procDef.authority} · {procDef.defaultDueDays} day deadline · SEAL at stage {procDef.sealAtStage}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-[#7A7870] flex-wrap">
              <span>Opened {new Date(cas.openedAt).toLocaleDateString()}</span>
              <span className={isOverdue ? 'text-[#B84020]' : ''}>
                {isOverdue ? 'OVERDUE — ' : ''}Due {new Date(cas.dueAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                <button onClick={() => setShowAssign(!showAssign)} className="hover:text-[#2C5F2D] hover:underline">
                  {cas.handler}
                </button>
              </span>
              <span>{cas.department}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {canAdvance && (
              <button
                onClick={handleAdvance}
                disabled={advancing}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2C5F2D] text-white rounded-lg text-sm hover:bg-[#234d24] transition-colors disabled:opacity-50"
              >
                {advancing ? 'Advancing...' : 'Advance Stage'} <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {cas.seal && (
              <button
                onClick={handleVerifySeal}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#DDD8CE] text-xs text-[#7A7870] rounded-lg hover:border-[#2C5F2D] hover:text-[#2C5F2D] transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Verify SEAL
              </button>
            )}
          </div>
        </div>

        {sealVerify && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${sealVerify.valid ? 'bg-[#E8F2EB] text-[#2C5F2D]' : 'bg-[#FDEFEA] text-[#B84020]'}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {sealVerify.valid ? (
                <span>SEAL verified — record integrity confirmed. Stored: {cas.seal} · Computed: {cas.seal} · Match: true</span>
              ) : (
                <span>SEAL verification FAILED — record may have been tampered with.</span>
              )}
            </div>
          </div>
        )}

        {showAssign && (
          <div className="mt-4 p-3 border border-[#DDD8CE] rounded-lg bg-[#F5F2EC]">
            <label className="text-xs text-[#7A7870]">Reassign Handler</label>
            <div className="flex gap-2 mt-1">
              <select className="flex-1 border border-[#DDD8CE] rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30">
                {MOCK_MEMBERS.filter(m => m.active).map(m => (
                  <option key={m.id} value={m.userId}>{m.userName} — {m.roleDisplay} ({m.department})</option>
                ))}
              </select>
              <button onClick={() => setShowAssign(false)} className="px-4 py-2 bg-[#2C5F2D] text-white rounded-md text-sm hover:bg-[#234d24]">Assign</button>
            </div>
          </div>
        )}

        {currentStageDef && (
          <div className="mt-4 p-3 bg-[#F5F2EC] rounded-lg text-xs text-[#7A7870] flex items-center gap-4 flex-wrap">
            <span>Current: <span className="text-[#1A1D16]">{currentStageDef.displayLabel}</span> (stage {currentStageDef.seq}/{stages.length})</span>
            {currentStageDef.requiredRole && <span>Required role: <span className="text-[#2C5F2D]">{currentStageDef.requiredRole}</span></span>}
            {currentStageDef.mglCitation && <span className="text-[#B8911E]">{currentStageDef.mglCitation}</span>}
            {currentStageDef.isHardStop && <span className="text-[#B84020]">Hard Stop Stage</span>}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[#DDD8CE] overflow-x-auto">
          <StageRail stages={stages} currentStage={cas.currentStage} isBlocked={isBlocked} />
        </div>
      </div>

      {/* Hard Stops */}
      {hardStops.length > 0 && (
        <div className="space-y-3">
          {hardStops.map(hs => (
            <HardStopPanel key={hs.id} hardStop={hs} onResolve={(_note) => { /* demo: resolve not wired */ }} />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F5F2EC] p-1 rounded-lg w-fit overflow-x-auto">
        {([
          { key: 'details' as const, label: 'Details', icon: FileText },
          { key: 'notes' as const, label: `Notes (${caseNotes.length})`, icon: MessageSquare },
          { key: 'transitions' as const, label: `Transitions (${transitions.length})`, icon: GitBranch },
          { key: 'proof' as const, label: `Proof Chain (${archieve.length})`, icon: Shield },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors whitespace-nowrap ${
              activeTab === tab.key ? 'bg-white shadow-sm text-[#1A1D16]' : 'text-[#7A7870] hover:text-[#1A1D16]'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {activeTab === 'details' && (
        <div className="bg-white border border-[#DDD8CE] rounded-lg p-5">
          <h3 className="text-[#1A1D16] mb-4">Case Fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(cas.fields).map(([key, value]) => (
              <div key={key} className={value.includes('\n') ? 'md:col-span-2' : ''}>
                <label className="text-[10px] text-[#7A7870] uppercase tracking-wider">{key.replace(/_/g, ' ')}</label>
                <p className="text-sm text-[#1A1D16] mt-0.5 whitespace-pre-wrap">{value}</p>
              </div>
            ))}
          </div>
          {cas.blockedReason && (
            <div className="mt-4 pt-4 border-t border-[#DDD8CE]">
              <label className="text-[10px] text-[#B84020] uppercase tracking-wider">Block Reason</label>
              <p className="text-sm text-[#1A1D16] mt-0.5">{cas.blockedReason}</p>
              {cas.blockedSince && (
                <p className="text-xs text-[#7A7870] mt-1">Blocked since {new Date(cas.blockedSince).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div className="bg-white border border-[#DDD8CE] rounded-lg p-5 space-y-4">
          <h3 className="text-[#1A1D16]">Case Notes & Activity</h3>

          {caseNotes.length === 0 ? (
            <p className="text-sm text-[#7A7870] py-4">No notes yet.</p>
          ) : (
            <div className="space-y-3">
              {caseNotes.map(note => (
                <div key={note.id} className={`p-3 rounded-lg ${note.isSystem ? 'bg-[#F5F2EC]' : 'bg-white border border-[#DDD8CE]'}`}>
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                      note.isSystem ? 'bg-gray-200 text-[#7A7870]' : 'bg-[#E8F2EB] text-[#2C5F2D]'
                    }`}>
                      {note.isSystem ? 'S' : note.authorName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-[#1A1D16]">{note.authorName}</span>
                    <span className="text-[#7A7870]">· {note.authorRole}</span>
                    <span className="text-[#7A7870] ml-auto">{new Date(note.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-[#1A1D16] mt-2 leading-relaxed">{note.content}</p>
                </div>
              ))}
            </div>
          )}

          {cas.status !== 'CLOSED' && (
            <div className="pt-3 border-t border-[#DDD8CE]">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="w-full border border-[#DDD8CE] rounded-lg p-3 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddNote}
                  disabled={newNote.trim().length < 5}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2C5F2D] text-white rounded-lg text-sm hover:bg-[#234d24] disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" /> Add Note
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transitions tab */}
      {activeTab === 'transitions' && (
        <div className="bg-white border border-[#DDD8CE] rounded-lg p-5">
          <h3 className="text-[#1A1D16] mb-4">Stage Transitions</h3>
          {transitions.length === 0 ? (
            <p className="text-sm text-[#7A7870] py-4">No transitions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-[#F5F2EC] text-left text-[10px] text-[#7A7870] uppercase tracking-wider">
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">To</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Rules Satisfied</th>
                    <th className="px-3 py-2">ARCHIEVE</th>
                    <th className="px-3 py-2">SEAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD8CE]">
                  {transitions.map(t => {
                    const fromStage = stages.find(s => s.seq === t.fromStage);
                    const toStage = stages.find(s => s.seq === t.toStage);
                    return (
                      <tr key={t.id}>
                        <td className="px-3 py-2 text-xs text-[#7A7870]">{new Date(t.timestamp).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-[#7A7870]">{fromStage?.displayLabel || `Stage ${t.fromStage}`}</td>
                        <td className="px-3 py-2 text-xs text-[#1A1D16]">{toStage?.displayLabel || `Stage ${t.toStage}`}</td>
                        <td className="px-3 py-2 text-xs text-[#7A7870]">{t.actorRole}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {t.rulesSatisfied.map(r => (
                              <span key={r} className="text-[10px] bg-[#E8F2EB] text-[#2C5F2D] px-1.5 py-0.5 rounded">{r}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-[#7A7870]">{t.archieveRef}</td>
                        <td className="px-3 py-2">{t.seal && <SealBadge seal={t.seal} size="sm" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Proof chain tab */}
      {activeTab === 'proof' && (
        <div className="bg-white border border-[#DDD8CE] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-[#1A1D16]">ARCHIEVE Proof Chain</h3>
            <div className="flex items-center gap-2 text-xs text-[#7A7870]">
              <Clock className="w-3 h-3" />
              <span>Append-only · Immutable · Trigger-protected</span>
            </div>
          </div>
          <ProofChain entries={archieve} />
        </div>
      )}
    </div>
  );
}
