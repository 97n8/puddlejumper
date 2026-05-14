import { Wifi, WifiOff, Command } from 'lucide-react';

interface MastheadProps {
  online: boolean;
  onCommandClick: () => void;
}

export function Masthead({ online, onCommandClick }: MastheadProps) {
  return (
    <div className="h-11 bg-gradient-to-b from-gray-900 to-gray-800 border-b border-gray-700 flex items-center justify-between px-4 text-white text-sm">
      <div className="flex items-center gap-2">
        <div>
          <div className="font-semibold leading-none">PublicLogic</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mt-1">logicOS mobile</div>
        </div>
      </div>

      <button
        onClick={onCommandClick}
        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
        aria-label="Open command palette"
      >
        <Command className="w-3 h-3" />
        <span className="text-xs">K</span>
      </button>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {online ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" aria-hidden="true" />
              <span className="sr-only">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" aria-hidden="true" />
              <span className="sr-only">Offline</span>
            </>
          )}
        </div>
        <div className="text-xs text-gray-400" aria-hidden="true">
          {new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}
