// Shared sub-screen header: chevron-left back button + centered title.
// Used by every screen except the Dashboard so headers are pixel-consistent.

import type { ReactNode } from 'react';
import { ChevronLeftIcon } from './icons';

export function ScreenHeader({ title, onBack, right }: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-2 px-3 pt-3 pb-2.5 border-b border-ink-700 shrink-0">
      <button
        onClick={onBack}
        className="icon-badge tap w-8 h-8 hover:text-pearl-200 shrink-0"
        aria-label="Back"
      >
        <ChevronLeftIcon size={18} />
      </button>
      <h1 className="text-sm font-semibold text-pearl-200 flex-1 truncate">{title}</h1>
      {right}
    </header>
  );
}
