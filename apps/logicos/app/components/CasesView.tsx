import { Star, ChevronRight } from 'lucide-react';
import type { Case } from '../types';

interface CasesViewProps {
  cases: Case[];
  onOpenCase: (caseId: string) => void;
}

export function CasesView({ cases, onOpenCase }: CasesViewProps) {
  const sortedCases = [...cases].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.lastOpened - a.lastOpened;
  });

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <div className="p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Work</h2>
          <p className="text-sm text-gray-500 mt-1">Cases, workspaces, and active threads</p>
        </div>

        {sortedCases.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No cases yet</p>
        ) : (
          <div className="space-y-2">
            {sortedCases.map((caseItem) => (
              <button
                key={caseItem.id}
                onClick={() => onOpenCase(caseItem.id)}
                className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-1 h-12 rounded-full shrink-0"
                    style={{ backgroundColor: caseItem.color }}
                    aria-hidden="true"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">
                        {caseItem.name}
                      </h3>
                      {caseItem.pinned && (
                        <Star
                          className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0"
                          aria-label="Pinned"
                        />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{caseItem.kicker}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(caseItem.lastOpened).toLocaleDateString()}
                    </p>
                  </div>

                  <ChevronRight
                    className="w-5 h-5 text-gray-400 group-hover:text-blue-600 shrink-0 transition-colors"
                    aria-hidden="true"
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
