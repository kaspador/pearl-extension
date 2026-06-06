// Bottom navigation for the three primary screens. Shown only on dashboard /
// activity / settings; pushed screens (send, receive, etc.) hide it.

import { WalletIcon, ActivityIcon, SettingsIcon } from '@/ui/icons';

export type Tab = 'dashboard' | 'activity' | 'settings';

const TABS: { id: Tab; label: string; Icon: (p: { size?: number }) => React.ReactElement }[] = [
  { id: 'dashboard', label: 'Wallet',   Icon: WalletIcon },
  { id: 'activity',  label: 'Activity', Icon: ActivityIcon },
  { id: 'settings',  label: 'Settings', Icon: SettingsIcon },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="shrink-0 border-t border-ink-700 bg-ink-950 flex">
      {TABS.map(({ id, label, Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${on ? 'text-pearl-200' : 'text-pearl-600 hover:text-pearl-400'}`}
            aria-label={label}
            aria-current={on ? 'page' : undefined}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
