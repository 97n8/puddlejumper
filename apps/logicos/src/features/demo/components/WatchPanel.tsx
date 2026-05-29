import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import type { WatchFlag } from '../data/mockData';

interface WatchPanelProps {
  flags: WatchFlag[];
  onFlagAction?: (flag: WatchFlag) => void;
}

const LEVEL_CONFIG = {
  critical: { bg: 'bg-[#FDEFEA]', border: 'border-[#B84020]/30', icon: AlertTriangle, iconColor: 'text-[#B84020]', badge: 'bg-[#B84020] text-white' },
  urgent: { bg: 'bg-[#FBF5E6]', border: 'border-[#B8911E]/30', icon: AlertTriangle, iconColor: 'text-[#B8911E]', badge: 'bg-[#B8911E] text-white' },
  warn: { bg: 'bg-[#F5F1E8]', border: 'border-[#DDD8CE]', icon: AlertCircle, iconColor: 'text-[#B8911E]', badge: 'bg-[#97BC62] text-white' },
  info: { bg: 'bg-[#E8F2EB]', border: 'border-[#2C5F2D]/20', icon: Info, iconColor: 'text-[#2C5F2D]', badge: 'bg-[#2C5F2D] text-white' },
};

export function WatchPanel({ flags, onFlagAction }: WatchPanelProps) {
  const activeFlags = flags.filter(f => !f.resolvedAt);
  const grouped = {
    critical: activeFlags.filter(f => f.level === 'critical'),
    urgent: activeFlags.filter(f => f.level === 'urgent'),
    warn: activeFlags.filter(f => f.level === 'warn'),
    info: activeFlags.filter(f => f.level === 'info'),
  };

  if (activeFlags.length === 0) {
    return (
      <div className="p-6 text-center text-[#7A7870]">
        <p className="text-sm">All clear — no flags at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(['critical', 'urgent', 'warn', 'info'] as const).map(level =>
        grouped[level].map(flag => {
          const config = LEVEL_CONFIG[level];
          const Icon = config.icon;
          return (
            <div key={flag.id} className={`${config.bg} border ${config.border} rounded-lg p-3`}>
              <div className="flex items-start gap-2.5">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${config.badge}`}>{level}</span>
                    <h4 className="text-sm truncate text-[#1A1D16]">{flag.title}</h4>
                  </div>
                  <p className="text-xs text-[#7A7870] mt-1 leading-relaxed">{flag.body}</p>
                  {flag.action && (
                    <button
                      onClick={() => onFlagAction?.(flag)}
                      className="mt-2 text-xs text-[#2C5F2D] hover:underline flex items-center gap-0.5"
                    >
                      {flag.action} <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
