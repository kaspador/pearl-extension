// Welcome screen — first thing users see after install.
// Mirrors mobile onboarding tone: brand mark, one-line value prop,
// two primary paths (create / import), tiny safety footnote.
//
// "Create new wallet" opens the full-window options page because the popup
// is too cramped + screenshot-prone for showing a 12-word seed phrase.
// "Import" stays in the popup — pasting is fine here.
//
// TODO (next turn): wire actual create/import flows.

import logoUrl from '@/assets/logo.png';

export function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <img src={logoUrl} alt="Pearl" className="w-20 h-20 rounded-2xl" />
        <div>
          <h1 className="text-xl font-semibold text-pearl-200">Pearl Wallet</h1>
          <p className="text-xs text-pearl-500 mt-1.5 max-w-[260px] mx-auto leading-relaxed">
            Self-custodial wallet for the Pearl blockchain — a Proof-of-Useful-Work network.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="pearl-btn rounded-xl py-2.5 text-sm"
        >
          Create new wallet
        </button>
        <button
          onClick={onDone}
          className="rounded-xl py-2.5 text-sm border border-ink-700 hover:bg-ink-800 text-pearl-300"
        >
          Import 12-word phrase
        </button>
      </div>

      <p className="text-[10px] text-pearl-700 text-center leading-relaxed mt-4">
        Beta · use small balances only · keys never leave your device
      </p>
    </div>
  );
}
