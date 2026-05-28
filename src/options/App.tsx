// Options page = full-window flow. Only one purpose now: the new-wallet
// create flow (which needs more real estate than the popup for showing the
// 12 words). View-seed lives in the popup.

import { useEffect, useState } from 'react';
import bannerUrl from '@/assets/banner.png';
import { hasWallet } from '@/storage/vault';
import { Create }    from '@/screens/options/Create';
import { ToastHost } from '@/ui/Toast';

export function OptionsApp() {
  const [route, setRoute] = useState<'loading' | 'create' | 'exists'>('loading');

  useEffect(() => { (async () => {
    setRoute((await hasWallet()) ? 'exists' : 'create');
  })(); }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl overflow-hidden border border-ink-700 mb-8">
          <img src={bannerUrl} alt="Pearl Wallet" className="w-full block" />
        </div>

        {route === 'loading' && (
          <div className="text-sm text-pearl-600 text-center py-12">Loading…</div>
        )}

        {route === 'create' && (
          <Create onDone={() => window.close()} />
        )}

        {route === 'exists' && (
          <div className="max-w-md py-8">
            <h1 className="text-2xl font-semibold text-pearl-200">Wallet already exists</h1>
            <p className="text-sm text-pearl-500 mt-3 leading-relaxed">
              You already have a Pearl Wallet on this browser. Click the Pearl icon
              in the toolbar to open it. Use Settings → View 12-word phrase if
              you need to back it up.
            </p>
            <button
              onClick={() => window.close()}
              className="pearl-btn mt-6 rounded-xl py-2.5 px-5 text-sm"
            >
              Close this page
            </button>
          </div>
        )}

        <p className="text-xs text-pearl-600 mt-10 text-center">
          Pearl Wallet beta · v0.1.0 · community-built, non-custodial
        </p>
      </div>
      <ToastHost />
    </div>
  );
}
