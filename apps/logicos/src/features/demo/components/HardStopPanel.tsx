import { useState } from 'react';
import { AlertOctagon, Scale, FileText } from 'lucide-react';
import type { HardStopEvent } from '../data/mockData';

interface HardStopPanelProps {
  hardStop: HardStopEvent;
  onResolve?: (note: string) => void;
}

export function HardStopPanel({ hardStop, onResolve }: HardStopPanelProps) {
  const [note, setNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = () => {
    if (note.length >= 20 && onResolve) {
      setResolving(true);
      setTimeout(() => {
        onResolve(note);
        setResolving(false);
      }, 600);
    }
  };

  return (
    <div className="border-l-4 border-[#B84020] bg-[#FDEFEA] rounded-r-lg p-4">
      <div className="flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-[#B84020] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-[#B84020] flex items-center gap-2">
            Hard Stop: {hardStop.ruleName}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-[#7A7870]">
            <Scale className="w-3 h-3" />
            <span>{hardStop.mglCitation}</span>
            <span>·</span>
            <FileText className="w-3 h-3" />
            <span>ARCHIEVE: {hardStop.archieveRef}</span>
            <span>·</span>
            <span>Triggered {new Date(hardStop.triggeredAt).toLocaleString()}</span>
          </div>
          <p className="text-sm text-[#1A1D16] mt-2 leading-relaxed">
            {hardStop.errorMessage}
          </p>

          {!hardStop.resolvedAt && (
            <div className="mt-4 space-y-2">
              <label className="text-sm text-[#7A7870]">Resolution Note (min 20 characters)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border border-[#DDD8CE] rounded-md p-2.5 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]/30 focus:border-[#2C5F2D]"
                rows={3}
                placeholder="Document how the hard stop condition was resolved..."
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#7A7870]">{note.length}/20 minimum</span>
                <button
                  onClick={handleResolve}
                  disabled={note.length < 20 || resolving}
                  className="px-4 py-2 text-sm bg-[#2C5F2D] text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#234d24] transition-colors"
                >
                  {resolving ? 'Resolving...' : 'Resolve Hard Stop'}
                </button>
              </div>
            </div>
          )}

          {hardStop.resolvedAt && (
            <div className="mt-3 bg-[#E8F2EB] rounded-md p-3 text-sm">
              <span className="text-[#2C5F2D]">Resolved</span>
              <span className="text-[#7A7870]"> by {hardStop.resolvedBy} on {new Date(hardStop.resolvedAt).toLocaleDateString()}</span>
              <p className="text-[#1A1D16] mt-1">{hardStop.resolutionNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
