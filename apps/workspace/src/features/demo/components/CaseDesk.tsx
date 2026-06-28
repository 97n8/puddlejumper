import { useState, useMemo } from 'react';
import { AlertOctagon, Clock, CheckCircle2, BarChart3, Search, Plus, X } from 'lucide-react';
import { MOCK_CASES, MOCK_PROCESS_DEFS, MOCK_MEMBERS, type Case } from '../data/mockData';
import { SealBadge } from './SealBadge';

interface CaseDeskProps {
  onSelectCase: (id: string) => void;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-[#E8F2EB] text-[#2C5F2D]',
  BLOCKED: 'bg-[#FDEFEA] text-[#B84020]',
  CLOSED: 'bg-gray-100 text-gray-500',
  WITHDRAWN: 'bg-gray-100 text-gray-400',
};

const RISK_BADGE: Record<string, string> = {
  low: 'bg-[#E8F2EB] text-[#2C5F2D]',
  medium: 'bg-[#FBF5E6] text-[#B8911E]',
  high: 'bg-[#FDEFEA] text-[#B84020]',
};

export function CaseDesk({ onSelectCase }: CaseDeskProps) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortBy, setSortBy] = useState<'due' | 'opened' | 'stage'>('due');

  const cases = MOCK_CASES;
  const openCases = cases.filter(c => c.status !== 'CLOSED' && c.status !== 'WITHDRAWN');
  const blocked = openCases.filter(c => c.status === 'BLOCKED');
  const dueSoon = openCases.filter(c => {
    const due = new Date(c.dueAt);
    const now = new Date();
    const hours = (due.getTime() - now.getTime()) / 3600000;
    return hours > 0 && hours < 48 && c.status !== 'BLOCKED';
  });
  const onTrack = openCases.filter(c => c.status === 'ACTIVE' && !dueSoon.includes(c));

  const isOverdue = (c: Case) => new Date(c.dueAt) < new Date() && c.status !== 'CLOSED';

  const filtered = useMemo(() => {
    let result = [...cases];
    if (statusFilter !== 'ALL') result = result.filter(c => c.status === statusFilter);
    if (moduleFilter !== 'ALL') result = result.filter(c => c.procId === moduleFilter);
    if (riskFilter !== 'ALL') result = result.filter(c => c.risk === riskFilter);
    if (overdueOnly) result = result.filter(c => isOverdue(c));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.id.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q) || c.procName.toLowerCase().includes(q) || c.handler.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortBy === 'due') return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (sortBy === 'opened') return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
      return b.currentStage - a.currentStage;
    });
    return result;
  }, [cases, statusFilter, moduleFilter, riskFilter, overdueOnly, searchQuery, sortBy]);

  const activeFilters = [statusFilter !== 'ALL', moduleFilter !== 'ALL', riskFilter !== 'ALL', overdueOnly].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter('ALL');
    setModuleFilter('ALL');
    setRiskFilter('ALL');
    setOverdueOnly(false);
    setSearchQuery('');
  };

  const uniqueProcs = [...new Set(cases.map(c => c.procId))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[#1A1D16]">Case Desk</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2C5F2D] text-white rounded-lg text-sm hover:bg-[#234d24] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Case
        </button>
      </div>

      {/* Stat bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Open', value: openCases.length, icon: BarChart3, color: 'text-[#2C5F2D]', bg: 'bg-[#E8F2EB]', filter: () => { setStatusFilter('ALL'); setOverdueOnly(false); } },
          { label: 'Blocked', value: blocked.length, icon: AlertOctagon, color: 'text-[#B84020]', bg: 'bg-[#FDEFEA]', filter: () => setStatusFilter('BLOCKED') },
          { label: 'Due Within 48h', value: dueSoon.length, icon: Clock, color: 'text-[#B8911E]', bg: 'bg-[#FBF5E6]', filter: () => {} },
          { label: 'On Track', value: onTrack.length, icon: CheckCircle2, color: 'text-[#2C5F2D]', bg: 'bg-[#E8F2EB]', filter: () => setStatusFilter('ACTIVE') },
        ].map(stat => (
          <button key={stat.label} onClick={stat.filter} className="bg-white border border-[#DDD8CE] rounded-lg p-4 flex items-center gap-3 text-left hover:border-[#2C5F2D]/30 transition-colors">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl text-[#1A1D16]">{stat.value}</p>
              <p className="text-xs text-[#7A7870]">{stat.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7870]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cases, subjects, handlers..."
            className="w-full pl-9 pr-3 py-2 border border-[#DDD8CE] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30"
          />
        </div>

        <div className="flex items-center gap-1">
          {['ALL', 'ACTIVE', 'BLOCKED', 'CLOSED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${statusFilter === s ? 'bg-[#2C5F2D] text-white' : 'bg-white border border-[#DDD8CE] text-[#7A7870] hover:border-[#2C5F2D]'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md text-xs border border-[#DDD8CE] bg-white text-[#7A7870] focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30"
        >
          <option value="ALL">All Processes</option>
          {uniqueProcs.map(p => {
            const def = MOCK_PROCESS_DEFS.find(d => d.id === p);
            return <option key={p} value={p}>{def?.name || p}</option>;
          })}
        </select>

        <select
          value={riskFilter}
          onChange={e => setRiskFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md text-xs border border-[#DDD8CE] bg-white text-[#7A7870] focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30"
        >
          <option value="ALL">All Risk</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <button
          onClick={() => setOverdueOnly(!overdueOnly)}
          className={`px-3 py-1.5 rounded-md text-xs transition-colors ${overdueOnly ? 'bg-[#B84020] text-white' : 'bg-white border border-[#DDD8CE] text-[#7A7870] hover:border-[#B84020]'}`}
        >
          Overdue
        </button>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'due' | 'opened' | 'stage')}
          className="px-3 py-1.5 rounded-md text-xs border border-[#DDD8CE] bg-white text-[#7A7870] focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30"
        >
          <option value="due">Sort: Due Date</option>
          <option value="opened">Sort: Newest</option>
          <option value="stage">Sort: Stage</option>
        </select>

        {activeFilters > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-[#B84020] hover:underline">
            <X className="w-3 h-3" /> Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <p className="text-xs text-[#7A7870]">{filtered.length} case{filtered.length !== 1 ? 's' : ''} found</p>

      {/* Case table */}
      <div className="bg-white border border-[#DDD8CE] rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-[#F5F2EC] text-left text-[10px] text-[#7A7870] uppercase tracking-wider">
              <th className="px-4 py-3">Case ID</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Process</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Handler</th>
              <th className="px-4 py-3">Dept</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDD8CE]">
            {filtered.map(c => (
              <tr
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                className={`cursor-pointer hover:bg-[#F5F2EC]/50 transition-colors ${c.status === 'BLOCKED' ? 'border-l-4 border-l-[#B84020]' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-[#2C5F2D]">{c.id}</span>
                  {c.seal && <div className="mt-0.5"><SealBadge seal={c.seal} size="sm" /></div>}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1D16] max-w-[200px] truncate">{c.subject}</td>
                <td className="px-4 py-3 text-xs text-[#7A7870]">{c.procName}</td>
                <td className="px-4 py-3 text-xs text-[#7A7870]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2C5F2D] rounded-full" style={{ width: `${(c.currentStage / c.totalStages) * 100}%` }} />
                    </div>
                    <span>{c.currentStage}/{c.totalStages}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded ${RISK_BADGE[c.risk]}`}>{c.risk}</span>
                </td>
                <td className={`px-4 py-3 text-xs ${isOverdue(c) ? 'text-[#B84020]' : 'text-[#7A7870]'}`}>
                  {isOverdue(c) && <span className="mr-1">!</span>}{new Date(c.dueAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-xs text-[#7A7870]">{c.handler}</td>
                <td className="px-4 py-3 text-xs text-[#7A7870]">{c.department}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-[#7A7870]">No cases match your filters.</div>
        )}
      </div>

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-[#1A1D16] mb-4">Create Staff Case</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-[#7A7870]">Process Type</label>
                <select className="w-full border border-[#DDD8CE] rounded-md px-3 py-2 text-sm mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30">
                  {MOCK_PROCESS_DEFS.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-[#7A7870]">Subject</label>
                <input type="text" className="w-full border border-[#DDD8CE] rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30" placeholder="Brief description of the case" />
              </div>
              <div>
                <label className="text-sm text-[#7A7870]">Assign To</label>
                <select className="w-full border border-[#DDD8CE] rounded-md px-3 py-2 text-sm mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30">
                  {MOCK_MEMBERS.filter(m => m.active).map(m => <option key={m.id} value={m.userId}>{m.userName} — {m.roleDisplay}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-[#7A7870]">Notes</label>
                <textarea className="w-full border border-[#DDD8CE] rounded-md px-3 py-2 text-sm mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30" rows={3} placeholder="Initial case notes..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-[#7A7870] hover:text-[#1A1D16]">Cancel</button>
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm bg-[#2C5F2D] text-white rounded-lg hover:bg-[#234d24]">Create Case</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
