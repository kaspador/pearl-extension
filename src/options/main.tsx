import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import bannerUrl from '@/assets/banner.png';

// Full-window setup flow — used when the popup needs more real estate.
// Specifically:
//   • Create new wallet  → display 12-word seed (popup too small / screenshot-prone)
//   • View seed phrase   → re-prompted from Settings
//   • Verify seed        → drag-into-slot game on first creation
//
// TODO (next turn): wire CreateWallet / VerifySeed / ViewSeed screens.

function OptionsApp() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl overflow-hidden border border-ink-700 mb-8">
          <img src={bannerUrl} alt="Pearl Wallet" className="w-full block" />
        </div>

        <h1 className="text-3xl font-semibold text-pearl-200">Pearl Wallet — Setup</h1>
        <p className="text-sm text-pearl-500 mt-2 max-w-2xl leading-relaxed">
          The full-window flow lives here: create new wallet (with 12-word seed
          phrase), import existing wallet, and view / verify your recovery
          phrase later.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-pearl-600">Step 1</div>
            <div className="text-base font-semibold text-pearl-200 mt-1">Create new wallet</div>
            <div className="text-xs text-pearl-500 mt-2 leading-relaxed">
              We&apos;ll generate a 12-word seed phrase on this device. You write it
              down on paper. Losing it means losing the wallet — no support, no recovery.
            </div>
            <button disabled className="pearl-btn mt-4 w-full rounded-xl py-2.5 text-sm">
              Start (next turn)
            </button>
          </div>

          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-pearl-600">Or</div>
            <div className="text-base font-semibold text-pearl-200 mt-1">Import existing</div>
            <div className="text-xs text-pearl-500 mt-2 leading-relaxed">
              Paste your 12 words to restore an existing Pearl wallet on this
              device. Encrypted with your password — never sent anywhere.
            </div>
            <button disabled className="rounded-xl py-2.5 text-sm mt-4 w-full border border-ink-700 text-pearl-300">
              Import (next turn)
            </button>
          </div>
        </div>

        <p className="text-[11px] text-pearl-700 mt-10 text-center">
          Pearl Wallet beta · v0.1.0 · community-built, non-custodial
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
