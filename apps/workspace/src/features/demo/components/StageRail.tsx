import { Check, Circle, Lock, AlertOctagon } from 'lucide-react';
import type { ProcessStage } from '../data/mockData';

interface StageRailProps {
  stages: ProcessStage[];
  currentStage: number;
  isBlocked?: boolean;
}

export function StageRail({ stages, currentStage, isBlocked }: StageRailProps) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-3">
      {stages.map((stage, i) => {
        const seq = stage.seq;
        const isDone = seq < currentStage;
        const isCurrent = seq === currentStage;
        const isPending = seq > currentStage;
        const isCurrentHardStop = stage.isHardStop && isCurrent && isBlocked;
        const isFutureHardStop = stage.isHardStop && isPending;

        return (
          <div key={stage.id} className="flex items-center">
            <div className="flex flex-col items-center min-w-[80px]" title={stage.mglCitation || undefined}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                  isDone
                    ? 'bg-[#2C5F2D] text-white'
                    : isCurrentHardStop
                    ? 'bg-[#B84020] text-white animate-pulse'
                    : isCurrent
                    ? 'bg-[#97BC62] text-white ring-2 ring-[#97BC62]/30 ring-offset-2'
                    : isFutureHardStop
                    ? 'bg-[#FBF5E6] text-[#B8911E] border-2 border-dashed border-[#B8911E]'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isDone ? (
                  <Check className="w-4 h-4" />
                ) : isCurrentHardStop ? (
                  <Lock className="w-4 h-4" />
                ) : isFutureHardStop ? (
                  <AlertOctagon className="w-3.5 h-3.5" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
              <span className={`text-[11px] mt-1.5 text-center leading-tight max-w-[80px] ${
                isCurrentHardStop ? 'text-[#B84020]' : isCurrent ? 'text-[#1A1D16]' : isDone ? 'text-[#2C5F2D]' : 'text-[#7A7870]'
              }`}>
                {stage.displayLabel}
              </span>
              {stage.isHardStop && (
                <span className={`text-[8px] uppercase tracking-wider mt-0.5 ${
                  isCurrentHardStop ? 'text-[#B84020]' : isDone ? 'text-[#2C5F2D]' : 'text-[#B8911E]'
                }`}>
                  {isCurrentHardStop ? 'BLOCKED' : isDone ? 'CLEARED' : 'HARD STOP'}
                </span>
              )}
              {stage.mglCitation && (
                <span className="text-[8px] text-[#7A7870] mt-0.5">{stage.mglCitation}</span>
              )}
            </div>
            {i < stages.length - 1 && (
              <div className={`h-0.5 w-6 mt-[-24px] ${isDone ? 'bg-[#2C5F2D]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
