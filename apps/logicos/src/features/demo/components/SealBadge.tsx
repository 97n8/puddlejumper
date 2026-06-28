import { ShieldCheck } from 'lucide-react';

interface SealBadgeProps {
  seal: string;
  size?: 'sm' | 'md';
}

export function SealBadge({ seal, size = 'md' }: SealBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-[#E8F2EB] text-[#2C5F2D] rounded-md font-mono ${
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
      title={`SEAL verified: ${seal} — SHA-256 cryptographic proof of case completion`}
    >
      <ShieldCheck className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {seal}
    </span>
  );
}
