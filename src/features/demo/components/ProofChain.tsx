import { FileCheck, ShieldCheck, AlertTriangle } from 'lucide-react';
import { SealBadge } from './SealBadge';
import { MOCK_MEMBERS } from '../data/mockData';
import type { ArchieveEntry } from '../data/mockData';

interface ProofChainProps {
  entries: ArchieveEntry[];
}

function resolveActorName(actorId: string | null): string {
  if (!actorId) return 'System';
  const member = MOCK_MEMBERS.find(m => m.userId === actorId);
  return member ? member.userName : actorId;
}

const ROLE_LABELS: Record<string, string> = {
  public_intake: 'Public Intake',
  clerk: 'Town Clerk',
  dept_head: 'Dept Head',
  staff: 'Staff',
  admin: 'Administrator',
  accountant: 'Town Accountant',
  procurement_officer: 'Procurement Officer',
  governance_operator: 'Governance Operator',
  system: 'System',
};

export function ProofChain({ entries }: ProofChainProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-[#7A7870] py-4">No ARCHIEVE entries yet.</p>;
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => {
        const actorName = resolveActorName(entry.actorId);
        const roleLabel = ROLE_LABELS[entry.actorRole] || entry.actorRole;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                entry.stage === -1
                  ? 'bg-[#FDEFEA] text-[#B84020]'
                  : entry.seal
                  ? 'bg-[#E8F2EB] text-[#2C5F2D]'
                  : 'bg-[#FBF5E6] text-[#B8911E]'
              }`}>
                {entry.stage === -1 ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : entry.seal ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <FileCheck className="w-4 h-4" />
                )}
              </div>
              {i < entries.length - 1 && <div className="w-px flex-1 bg-[#DDD8CE] min-h-[24px]" />}
            </div>

            {/* Content */}
            <div className="pb-4 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-[#7A7870]">{entry.id}</span>
                {entry.seal && <SealBadge seal={entry.seal} size="sm" />}
              </div>
              <p className="text-sm mt-0.5">
                {entry.stage === -1 ? (
                  <span className="text-[#B84020]">Hard Stop Event</span>
                ) : (
                  <span className="text-[#1A1D16]">Stage {entry.stage}</span>
                )}
                <span className="text-[#7A7870]"> — {roleLabel}</span>
              </p>
              <div className="flex items-center gap-3 text-[11px] text-[#7A7870] mt-1 flex-wrap">
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                <span>by <span className="text-[#1A1D16]">{actorName}</span></span>
              </div>
              <div className="mt-1.5 bg-[#F5F1E8] rounded px-2 py-1 font-mono text-[10px] text-[#7A7870] inline-block">
                SHA-256: {entry.payloadHash.substring(0, 16)}...{entry.payloadHash.substring(entry.payloadHash.length - 8)}
              </div>
              {entry.ruleRef.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {entry.ruleRef.map(r => (
                    <span key={r} className="text-[10px] bg-[#E8F2EB] text-[#2C5F2D] px-1.5 py-0.5 rounded">{r}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
