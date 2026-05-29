import { useState } from 'react';
import { MOCK_PROCESS_DEFS, PROCESS_STAGES, MOCK_STAGE_RULES, MOCK_CASES } from '../data/mockData';
import { StageRail } from './StageRail';
import { ChevronDown, ChevronRight, Scale, AlertOctagon } from 'lucide-react';

export function ProcessDefinitions() {
  const [expandedProc, setExpandedProc] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedProc(prev => prev === id ? null : id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#1A1D16]">Process Definitions</h1>
        <p className="text-sm text-[#7A7870] mt-1">7 governed processes · All stage rules enforced server-side by GovernanceEngine</p>
      </div>

      <div className="space-y-3">
        {MOCK_PROCESS_DEFS.map(proc => {
          const stages = PROCESS_STAGES[proc.id] || [];
          const rules = MOCK_STAGE_RULES.filter(r => stages.some(s => s.id === r.stageId));
          const hardStopStages = stages.filter(s => s.isHardStop);
          const casesOpen = MOCK_CASES.filter(c => c.procId === proc.id && c.status !== 'CLOSED' && c.status !== 'WITHDRAWN').length;
          const casesTotal = MOCK_CASES.filter(c => c.procId === proc.id).length;
          const isExpanded = expandedProc === proc.id;

          return (
            <div key={proc.id} className="bg-white border border-[#DDD8CE] rounded-lg overflow-hidden">
              <button
                onClick={() => toggle(proc.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-[#F5F2EC]/50 transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-[#7A7870] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#7A7870] shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[#1A1D16]">{proc.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#E8F2EB] text-[#2C5F2D]">{proc.category}</span>
                    {proc.authority !== 'Internal' && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#FBF5E6] text-[#B8911E] flex items-center gap-1">
                        <Scale className="w-3 h-3" /> {proc.authority}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7A7870] mt-0.5">{proc.description}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-[#7A7870]">
                  <div className="text-center">
                    <p className="text-lg text-[#1A1D16]">{proc.stageCount}</p>
                    <p>stages</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg text-[#1A1D16]">{hardStopStages.length}</p>
                    <p>hard stops</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg text-[#1A1D16]">{casesOpen}/{casesTotal}</p>
                    <p>open/total</p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-[#DDD8CE] p-4 space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <label className="text-[10px] text-[#7A7870] uppercase tracking-wider">Process ID</label>
                      <p className="font-mono text-xs text-[#1A1D16] mt-0.5">{proc.id}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#7A7870] uppercase tracking-wider">Default Due Days</label>
                      <p className="text-xs text-[#1A1D16] mt-0.5">{proc.defaultDueDays} business days</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#7A7870] uppercase tracking-wider">SEAL at Stage</label>
                      <p className="text-xs text-[#1A1D16] mt-0.5">Stage {proc.sealAtStage} of {proc.stageCount}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#7A7870] uppercase tracking-wider">Status</label>
                      <p className="text-xs mt-0.5"><span className="px-1.5 py-0.5 rounded bg-[#E8F2EB] text-[#2C5F2D]">{proc.active ? 'Active' : 'Inactive'}</span></p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs text-[#7A7870] uppercase tracking-wider mb-3">Stage Pipeline</h4>
                    <div className="overflow-x-auto">
                      <StageRail stages={stages} currentStage={0} />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs text-[#7A7870] uppercase tracking-wider mb-3">Stage Details</h4>
                    <div className="border border-[#DDD8CE] rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="bg-[#F5F2EC] text-left text-[10px] text-[#7A7870] uppercase tracking-wider">
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Required Role</th>
                            <th className="px-3 py-2">Hard Stop</th>
                            <th className="px-3 py-2">MGL Citation</th>
                            <th className="px-3 py-2">ARCHIEVE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DDD8CE]">
                          {stages.map(stage => (
                            <tr key={stage.id} className={stage.isHardStop ? 'bg-[#FDEFEA]/30' : ''}>
                              <td className="px-3 py-2 text-xs text-[#7A7870]">{stage.seq}</td>
                              <td className="px-3 py-2 text-xs text-[#1A1D16]">{stage.displayLabel}</td>
                              <td className="px-3 py-2 text-xs text-[#7A7870]">{stage.requiredRole || 'Any'}</td>
                              <td className="px-3 py-2">
                                {stage.isHardStop && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FDEFEA] text-[#B84020] flex items-center gap-1 w-fit">
                                    <AlertOctagon className="w-3 h-3" /> Yes
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-[10px] text-[#B8911E]">{stage.mglCitation || '—'}</td>
                              <td className="px-3 py-2 text-xs text-[#7A7870]">{stage.archieveOnEnter ? 'Yes' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {rules.length > 0 && (
                    <div>
                      <h4 className="text-xs text-[#7A7870] uppercase tracking-wider mb-3">Governance Rules ({rules.length})</h4>
                      <div className="space-y-2">
                        {rules.map(rule => (
                          <div key={rule.id} className={`border rounded-lg p-3 ${rule.isHardStop ? 'border-[#B84020]/20 bg-[#FDEFEA]/20' : 'border-[#DDD8CE]'}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] text-[#7A7870]">{rule.id}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[#7A7870]">{rule.ruleType}</span>
                              {rule.isHardStop && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FDEFEA] text-[#B84020]">Hard Stop</span>}
                              {rule.mglCitation && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FBF5E6] text-[#B8911E]">{rule.mglCitation}</span>}
                            </div>
                            <p className="text-xs text-[#1A1D16] mt-1">{rule.errorMessage}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
