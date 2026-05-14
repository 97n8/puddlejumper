import { Home, Briefcase, Settings as SettingsIcon } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'today', label: 'Home', icon: Home },
    { id: 'cases', label: 'Work', icon: Briefcase },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  return (
    <nav
      className="h-16 bg-gray-900 border-t border-gray-700 flex items-center justify-around px-4"
      role="tablist"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded transition-colors ${
              isActive
                ? 'text-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span className="text-xs">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
