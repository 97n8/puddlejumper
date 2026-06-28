import { useTown } from '../data/townContext';
import { MODULE_LABELS } from '../data/towns';
import { FISCAL_SNAPSHOTS, formatCurrency } from '../data/fiscalIntel';
import { ORG_POSITIONS } from '../data/orgPositions';
import { Activity, AlertTriangle, CheckCircle, Clock, DollarSign, FileCheck, Landmark, Server, Shield, Users, XCircle, TrendingUp, Zap } from 'lucide-react';

export function LogicDash() {
  const { currentTown, setCurrentTown, allTowns } = useTown();
  const t = currentTown;
  const fiscal = FISCAL_SNAPSHOTS[t.slug];
  const positions = ORG_POSITIONS[t.slug] || [];

  const healthColor = { healthy: 'text-[#2C5F2D]', degraded: 'text-[#B8911E]', down: 'text-[#B84020]' }[t.health.pjStatus];
  const healthBg = { healthy: 'bg-[#E8F2EB]', degraded: 'bg-[#FBF5E6]', down: 'bg-[#FDEFEA]' }[t.health.pjStatus];
  const healthIcon = { healthy: CheckCircle, degraded: AlertTriangle, down: XCircle }[t.health.pjStatus];
  const HealthIcon = healthIcon;

  const totalOpen = allTowns.filter(t => t.active).reduce((a, t) => a + t.stats.casesOpen, 0);
  const totalSealed = allTowns.filter(t => t.active).reduce((a, t) => a + t.stats.sealedThisMonth, 0);
  const totalAlerts = allTowns.filter(t => t.active).reduce((a, t) => a + t.stats.watchAlerts, 0);
  const activeTowns = allTowns.filter(t => t.active && t.stats.complianceScore > 0);
  const avgCompliance = activeTowns.length > 0 ? Math.round(activeTowns.reduce((a, t) => a + t.stats.complianceScore, 0) / activeTowns.length) : 0;

  const statCards = [
    { label: 'Open Cases', value: t.stats.casesOpen, icon: Activity, color: 'text-[#2C5F2D]', bg: 'bg-[#E8F2EB]' },
    { label: 'This Month', value: t.stats.casesThisMonth, icon: TrendingUp, color: 'text-[#97BC62]', bg: 'bg-[#F0F7E4]' },
    { label: 'Sealed', value: t.stats.sealedThisMonth, icon: Shield, color: 'text-[#2C5F2D]', bg: 'bg-[#E8F2EB]' },
    { label: 'Overdue', value: t.stats.overdueCount, icon: Clock, color: t.stats.overdueCount > 0 ? 'text-[#B84020]' : 'text-[#7A7870]', bg: t.stats.overdueCount > 0 ? 'bg-[#FDEFEA]' : 'bg-gray-100' },
    { label: 'Watch Alerts', value: t.stats.watchAlerts, icon: AlertTriangle, color: t.stats.watchAlerts > 0 ? 'text-[#B8911E]' : 'text-[#7A7870]', bg: t.stats.watchAlerts > 0 ? 'bg-[#FBF5E6]' : 'bg-gray-100' },
    { label: 'Compliance', value: `${t.stats.complianceScore}%`, icon: FileCheck, color: t.stats.complianceScore >= 90 ? 'text-[#2C5F2D]' : 'text-[#B8911E]', bg: t.stats.complianceScore >= 90 ? 'bg-[#E8F2EB]' : 'bg-[#FBF5E6]' },
    { label: 'Avg Resolution', value: `${t.stats.avgResolutionDays}d`, icon: Zap, color: 'text-[#97BC62]', bg: 'bg-[#F0F7E4]' },
    { label: 'Active Staff', value: t.stats.staffActive, icon: Users, color: 'text-[#7A7870]', bg: 'bg-gray-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[#1A1D16]">LogicDash</h1>
          <p className="text-sm text-[#7A7870] mt-1">
            VAULT environment overview · {t.name} · {t.county} County, {t.state} · Pop. {t.population.toLocaleString()}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${healthBg}`}>
          <HealthIcon className={`w-4 h-4 ${healthColor}`} />
          <span className={`text-sm ${healthColor}`}>PJ {t.health.pjStatus}</span>
          <span className="text-[10px] text-[#7A7870]">v{t.health.version}</span>
        </div>
      </div>

      {/* Fleet overview */}
      <div className="bg-white border border-[#DDD8CE] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[#1A1D16] flex items-center gap-2">
            <Server className="w-4 h-4 text-[#7A7870]" />
            Fleet Overview
          </h3>
          <span className="text-[10px] text-[#7A7870]">{allTowns.filter(t => t.active).length} active / {allTowns.length} total environments</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-[#F5F2EC] rounded-lg">
            <p className="text-2xl text-[#1A1D16]">{totalOpen}</p>
            <p className="text-[10px] text-[#7A7870]">Total open cases</p>
          </div>
          <div className="text-center p-3 bg-[#F5F2EC] rounded-lg">
            <p className="text-2xl text-[#2C5F2D]">{totalSealed}</p>
            <p className="text-[10px] text-[#7A7870]">Sealed this month</p>
          </div>
          <div className="text-center p-3 bg-[#F5F2EC] rounded-lg">
            <p className="text-2xl text-[#B8911E]">{totalAlerts}</p>
            <p className="text-[10px] text-[#7A7870]">Watch alerts</p>
          </div>
          <div className="text-center p-3 bg-[#F5F2EC] rounded-lg">
            <p className="text-2xl text-[#97BC62]">{avgCompliance}%</p>
            <p className="text-[10px] text-[#7A7870]">Avg compliance</p>
          </div>
        </div>
      </div>

      {/* Town stat cards */}
      <div>
        <h3 className="text-xs text-[#7A7870] uppercase tracking-wider mb-3">{t.name} — Key Metrics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(card => (
            <div key={card.label} className="bg-white border border-[#DDD8CE] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl text-[#1A1D16]">{card.value}</p>
              <p className="text-[10px] text-[#7A7870] mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FiscalIntel */}
      {fiscal && (
        <div className="bg-white border border-[#DDD8CE] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#2C5F2D]" />
              <h3 className="text-[#1A1D16]">FiscalIntel — FY{fiscal.fiscalYear}</h3>
            </div>
            <span className="text-[10px] text-[#7A7870]">DLS data · {new Date(fiscal.computedAt).toLocaleDateString()}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#F5F2EC] rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-[#2C5F2D]" />
                <span className="text-[10px] text-[#7A7870]">Operating Budget</span>
              </div>
              <p className="text-lg text-[#1A1D16]">{formatCurrency(fiscal.metrics.operatingBudget)}</p>
            </div>
            <div className="p-3 bg-[#F5F2EC] rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5 text-[#2C5F2D]" />
                <span className="text-[10px] text-[#7A7870]">Stabilization</span>
              </div>
              <p className="text-lg text-[#1A1D16]">{formatCurrency(fiscal.metrics.stabilizationBalance)}</p>
              <p className="text-[10px] text-[#97BC62]">{(fiscal.metrics.reserveRatio * 100).toFixed(1)}% of budget</p>
            </div>
            <div className="p-3 bg-[#F5F2EC] rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-[#97BC62]" />
                <span className="text-[10px] text-[#7A7870]">Free Cash</span>
              </div>
              <p className="text-lg text-[#1A1D16]">{formatCurrency(fiscal.metrics.freeCash)}</p>
              <p className={`text-[10px] ${fiscal.metrics.freeCashRatio >= 0.05 ? 'text-[#97BC62]' : 'text-[#B8911E]'}`}>{(fiscal.metrics.freeCashRatio * 100).toFixed(1)}% of budget</p>
            </div>
            <div className="p-3 bg-[#F5F2EC] rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#7A7870]" />
                <span className="text-[10px] text-[#7A7870]">Total Levy</span>
              </div>
              <p className="text-lg text-[#1A1D16]">{formatCurrency(fiscal.metrics.totalLevy)}</p>
            </div>
          </div>
          {fiscal.riskFlags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {fiscal.riskFlags.map((rf, i) => (
                <span key={i} className={`text-[10px] px-2 py-1 rounded ${rf.severity === 'high' ? 'bg-[#FDEFEA] text-[#B84020]' : rf.severity === 'medium' ? 'bg-[#FBF5E6] text-[#B8911E]' : 'bg-gray-100 text-[#7A7870]'}`}>
                  {rf.code}: {rf.actual}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modules + Environment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#DDD8CE] rounded-lg p-4">
          <h3 className="text-[#1A1D16] mb-3">Active VAULT Modules ({t.modules.length})</h3>
          <div className="space-y-1.5">
            {t.modules.map(mod => (
              <div key={mod} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#F5F2EC]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#97BC62]" />
                  <span className="text-sm text-[#1A1D16]">{MODULE_LABELS[mod] || mod}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8F2EB] text-[#2C5F2D]">deployed</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#7A7870] mt-3 pt-2 border-t border-[#DDD8CE]">
            Plan: <span className="text-[#1A1D16]">{t.plan}</span> · Endpoint: <span className="font-mono">{t.pjEndpoint}</span>
          </p>
        </div>

        <div className="bg-white border border-[#DDD8CE] rounded-lg p-4">
          <h3 className="text-[#1A1D16] mb-3">Environment Health</h3>
          <div className="space-y-3">
            {[
              { label: 'PuddleJumper Status', value: <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${healthBg}`}><HealthIcon className={`w-3.5 h-3.5 ${healthColor}`} /><span className={`text-sm ${healthColor}`}>{t.health.pjStatus}</span></div> },
              { label: 'Version', value: <span className="text-sm font-mono text-[#1A1D16]">v{t.health.version}</span> },
              { label: 'Last Deploy', value: <span className="text-sm text-[#1A1D16]">{new Date(t.health.lastDeploy).toLocaleDateString()}</span> },
              { label: 'Database Size', value: <span className="text-sm font-mono text-[#1A1D16]">{t.health.dbSize}</span> },
              { label: 'Last Sync', value: <span className="text-sm text-[#1A1D16]">{new Date(t.lastSync).toLocaleString()}</span> },
              { label: 'Staff Positions', value: <span className="text-sm text-[#1A1D16]">{positions.length} ({positions.filter(p => p.employmentStatus === 'active').length} active)</span> },
              { label: 'Onboarded', value: <span className="text-sm text-[#1A1D16]">{new Date(t.onboardedAt).toLocaleDateString()}</span> },
            ].map((row, i) => (
              <div key={i} className={`flex items-center justify-between py-2 ${i < 6 ? 'border-b border-[#DDD8CE]' : ''}`}>
                <span className="text-sm text-[#7A7870]">{row.label}</span>
                {row.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All towns table */}
      <div className="bg-white border border-[#DDD8CE] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#DDD8CE]">
          <h3 className="text-[#1A1D16]">All Environments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#F5F2EC] text-left text-[10px] text-[#7A7870] uppercase tracking-wider">
                <th className="px-4 py-2">Town</th>
                <th className="px-4 py-2">County</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Modules</th>
                <th className="px-4 py-2">Open Cases</th>
                <th className="px-4 py-2">Compliance</th>
                <th className="px-4 py-2">PJ Status</th>
                <th className="px-4 py-2">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD8CE]">
              {allTowns.map(town => {
                const isCurrent = town.id === currentTown.id;
                const hc = { healthy: 'text-[#2C5F2D] bg-[#E8F2EB]', degraded: 'text-[#B8911E] bg-[#FBF5E6]', down: 'text-[#B84020] bg-[#FDEFEA]' }[town.health.pjStatus];
                return (
                  <tr
                    key={town.id}
                    className={`cursor-pointer hover:bg-[#F5F2EC]/50 ${isCurrent ? 'bg-[#E8F2EB]/30' : ''}`}
                    onClick={() => setCurrentTown(town)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${town.active ? 'bg-[#97BC62]' : 'bg-gray-300'}`} />
                        <span className={`text-sm ${isCurrent ? 'text-[#2C5F2D]' : 'text-[#1A1D16]'}`}>{town.name}</span>
                        {isCurrent && <span className="text-[8px] px-1 py-0.5 bg-[#2C5F2D] text-white rounded">CURRENT</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#7A7870]">{town.county}</td>
                    <td className="px-4 py-2.5"><span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[#7A7870]">{town.plan}</span></td>
                    <td className="px-4 py-2.5 text-xs text-[#7A7870]">{town.modules.length}</td>
                    <td className="px-4 py-2.5 text-sm text-[#1A1D16]">{town.stats.casesOpen}</td>
                    <td className="px-4 py-2.5">
                      {town.stats.complianceScore > 0 ? (
                        <span className={`text-sm ${town.stats.complianceScore >= 90 ? 'text-[#2C5F2D]' : 'text-[#B8911E]'}`}>{town.stats.complianceScore}%</span>
                      ) : <span className="text-xs text-[#7A7870]">—</span>}
                    </td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded ${hc}`}>{town.health.pjStatus}</span></td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#7A7870]">v{town.health.version}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center text-[10px] text-[#7A7870] py-2">
        LogicDash · VAULT Framework-as-a-Standard™ · Polymorphic × PublicLogic · "One system, not multiple products."
      </div>
    </div>
  );
}
