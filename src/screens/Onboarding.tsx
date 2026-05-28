// Welcome screen — first thing users see after install.

import logoUrl from '@/assets/logo.png';

export function Onboarding({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
        <img src={logoUrl} alt="Pearl Wallet" className="w-20 h-20 rounded-2xl" />
        <div>
          <h1 className="text-lg font-semibold text-pearl-200">Pearl Wallet</h1>
          <p className="text-sm text-pearl-600 mt-1">pearlchain.live</p>
          <p className="text-xs text-pearl-500 mt-3 max-w-[260px] mx-auto leading-relaxed">
            Self-custodial wallet for the Pearl blockchain — a Proof-of-Useful-Work network.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="pearl-btn rounded-xl py-3 text-sm"
        >
          Create new wallet
        </button>
        <button
          onClick={onImport}
          className="rounded-xl py-3 text-sm border border-ink-700 hover:bg-ink-800 text-pearl-300"
        >
          Import 12-word phrase
        </button>
      </div>

      <p className="text-[11px] text-pearl-600 text-center leading-relaxed mt-4">
        Beta · use small balances only · keys never leave your device
      </p>
    </div>
  );
}
