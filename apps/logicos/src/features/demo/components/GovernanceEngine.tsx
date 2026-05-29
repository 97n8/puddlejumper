import { MOCK_STAGE_RULES, PROCESS_STAGES, MOCK_HARD_STOPS, MOCK_CASES } from '../data/mockData';
import { Shield, AlertOctagon, Scale, FileCheck, Lock, Server, Database } from 'lucide-react';

export function GovernanceEngine() {
  const totalRules = MOCK_STAGE_RULES.length;
  const hardStopRules = MOCK_STAGE_RULES.filter(r => r.isHardStop).length;
  const activeHardStops = MOCK_HARD_STOPS.filter(h => !h.resolvedAt).length;
  const totalStages = Object.values(PROCESS_STAGES).reduce((acc, s) => acc + s.length, 0);
  const hardStopStages = Object.values(PROCESS_STAGES).reduce((acc, s) => acc + s.filter(st => st.isHardStop).length, 0);
  const sealedCases = MOCK_CASES.filter(c => c.seal).length;

  const ruleTypes = [
    { type: 'required_field', label: 'Required Field', desc: 'A field must have a specific value before advancing', count: MOCK_STAGE_RULES.filter(r => r.ruleType === 'required_field').length },
    { type: 'role_check', label: 'Role Check', desc: 'Actor must hold a specific org role', count: MOCK_STAGE_RULES.filter(r => r.ruleType === 'role_check').length },
    { type: 'threshold', label: 'Threshold', desc: 'Numeric value must meet or exceed a threshold', count: MOCK_STAGE_RULES.filter(r => r.ruleType === 'threshold').length },
    { type: 'time_elapsed', label: 'Time Elapsed', desc: 'Minimum time must pass before advancement', count: MOCK_STAGE_RULES.filter(r => r.ruleType === 'time_elapsed').length },
    { type: 'document_required', label: 'Document Required', desc: 'A document must be attached to the case', count: MOCK_STAGE_RULES.filter(r => r.ruleType === 'document_required').length },
    { type: 'vote_required', label: 'Vote Required', desc: 'A vote record must exist with required majority', count: MOCK_STAGE_RULES.filter(r => r.ruleType === 'vote_required').length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#1A1D16]">Governance Engine</h1>
        <p className="text-sm text-[#7A7870] mt-1">Server-side rule enforcement · ARCHIEVE append-only · SEAL cryptographic proof</p>
      </div>

      {/* Invariant banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#E8F2EB] border border-[#2C5F2D]/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-[#2C5F2D]" />
            <h4 className="text-sm text-[#2C5F2D]">Server Enforces</h4>
          </div>
          <p className="text-xs text-[#7A7870]">GovernanceEngine runs on PuddleJumper only. Browser displays results. No rule evaluation in the browser. No hard stop logic in the frontend.</p>
        </div>
        <div className="bg-[#FBF5E6] border border-[#B8911E]/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-[#B8911E]" />
            <h4 className="text-sm text-[#B8911E]">ARCHIEVE Immutable</h4>
          </div>
          <p className="text-xs text-[#7A7870]">No UPDATE or DELETE ever issued against archieve_entries. SQLite triggers enforce immutability. Application layer doubles enforcement.</p>
        </div>
        <div className="bg-[#FDEFEA] border border-[#B84020]/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-[#B84020]" />
            <h4 className="text-sm text-[#B84020]">SEAL Server Only</h4>
          </div>
          <p className="text-xs text-[#7A7870]">generateSeal() is never called from a route handler directly. SHA-256 of case payload. Format: SL-&#123;8 hex chars&#125;. Never exposed as public endpoint.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Rules', value: totalRules, icon: Scale },
          { label: 'Hard Stop Rules', value: hardStopRules, icon: AlertOctagon },
          { label: 'Active Hard Stops', value: activeHardStops, icon: AlertOctagon },
          { label: 'Process Stages', value: totalStages, icon: FileCheck },
          { label: 'Hard Stop Stages', value: hardStopStages, icon: Lock },
          { label: 'SEALs Issued', value: sealedCases, icon: Shield },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-[#DDD8CE] rounded-lg p-3 text-center">
            <stat.icon className="w-4 h-4 text-[#7A7870] mx-auto mb-1" />
            <p className="text-xl text-[#1A1D16]">{stat.value}</p>
            <p className="text-[10px] text-[#7A7870]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Rule types */}
      <div className="bg-white border border-[#DDD8CE] rounded-lg p-5">
        <h3 className="text-[#1A1D16] mb-4">Rule Types (6 evaluators)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ruleTypes.map(rt => (
            <div key={rt.type} className="border border-[#DDD8CE] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#7A7870]">{rt.type}</span>
                <span className="text-xs text-[#1A1D16]">{rt.count}</span>
              </div>
              <h4 className="text-sm text-[#1A1D16] mt-1">{rt.label}</h4>
              <p className="text-xs text-[#7A7870] mt-0.5">{rt.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* All rules table */}
      <div className="bg-white border border-[#DDD8CE] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#DDD8CE]">
          <h3 className="text-[#1A1D16]">All Stage Rules</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-[#F5F2EC] text-left text-[10px] text-[#7A7870] uppercase tracking-wider">
                <th className="px-4 py-2">Rule ID</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Error Message</th>
                <th className="px-4 py-2">Citation</th>
                <th className="px-4 py-2">Hard Stop</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD8CE]">
              {MOCK_STAGE_RULES.map(rule => {
                const stage = Object.values(PROCESS_STAGES).flat().find(s => s.id === rule.stageId);
                return (
                  <tr key={rule.id} className={rule.isHardStop ? 'bg-[#FDEFEA]/20' : ''}>
                    <td className="px-4 py-2 font-mono text-[10px] text-[#7A7870]">{rule.id}</td>
                    <td className="px-4 py-2 text-xs text-[#1A1D16]">{stage?.displayLabel || rule.stageId}</td>
                    <td className="px-4 py-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[#7A7870]">{rule.ruleType}</span></td>
                    <td className="px-4 py-2 text-xs text-[#7A7870] max-w-[250px] truncate">{rule.errorMessage}</td>
                    <td className="px-4 py-2 text-[10px] text-[#B8911E]">{rule.mglCitation || '—'}</td>
                    <td className="px-4 py-2">
                      {rule.isHardStop && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FDEFEA] text-[#B84020]">Yes</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEAL format */}
      <div className="bg-white border border-[#DDD8CE] rounded-lg p-5">
        <h3 className="text-[#1A1D16] mb-3">SEAL Implementation</h3>
        <div className="bg-[#1A1D16] rounded-lg p-4 font-mono text-xs text-[#E8F2EB] overflow-x-auto space-y-1">
          <p className="text-[#7A7870]">{'// SEAL generation — SHA-256 of composite key'}</p>
          <p><span className="text-[#B8911E]">const</span> payload = <span className="text-amber-300">{"`${caseId}:${payloadHash}:${archieveId}:${timestamp}`"}</span>;</p>
          <p><span className="text-[#B8911E]">const</span> hash = <span className="text-[#2C5F2D]">SHA256</span>(payload);</p>
          <p><span className="text-[#B8911E]">const</span> seal = <span className="text-amber-300">{"`SL-${hash.slice(0, 8).toUpperCase()}`"}</span>;</p>
          <p className="text-[#7A7870]">{'// Example: SL-A3F8C12B'}</p>
          <p className="text-[#7A7870]">{'// Verification: recompute from stored payload_hash and compare'}</p>
        </div>
      </div>

      {/* Engine flow */}
      <div className="bg-white border border-[#DDD8CE] rounded-lg p-5">
        <h3 className="text-[#1A1D16] mb-4">Advance Flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: 'PATCH /api/cases/:id/advance', color: 'bg-[#E8F2EB] text-[#2C5F2D]' },
            { label: 'Load case + stage def', color: 'bg-gray-100 text-[#7A7870]' },
            { label: 'Evaluate all rules', color: 'bg-[#FBF5E6] text-[#B8911E]' },
            { label: 'Hard stop?', color: 'bg-[#FDEFEA] text-[#B84020]' },
            { label: 'Execute transition', color: 'bg-[#E8F2EB] text-[#2C5F2D]' },
            { label: 'Write ARCHIEVE', color: 'bg-[#FBF5E6] text-[#B8911E]' },
            { label: 'Generate SEAL?', color: 'bg-[#E8F2EB] text-[#2C5F2D]' },
            { label: 'Return result', color: 'bg-gray-100 text-[#7A7870]' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded ${step.color}`}>{step.label}</span>
              {i < 7 && <span className="text-[#7A7870]">&rarr;</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
