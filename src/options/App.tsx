// Options page = full-window flow. Decides on mount:
//   • No wallet yet   → Create flow (generate seed, verify, set password)
//   • Wallet exists   → View seed flow (re-prompt password to reveal)

import { useEffect, useState } from 'react';
import bannerUrl from '@/assets/banner.png';
import { hasWallet } from '@/storage/vault';
import { Create }    from '@/screens/options/Create';
import { ViewSeed }  from '@/screens/options/ViewSeed';
import { ToastHost } from '@/ui/Toast';

export function OptionsApp() {
  const [route, setRoute] = useState<'loading' | 'create' | 'view'>('loading');

  useEffect(() => { (async () => {
    setRoute((await hasWallet()) ? 'view' : 'create');
  })(); }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl overflow-hidden border border-ink-700 mb-8">
          <img src={bannerUrl} alt="Pearl Wallet" className="w-full block" />
        </div>

        {route === 'loading' && (
          <div className="text-xs text-pearl-600 text-center py-12">Loading…</div>
        )}

        {route === 'create' && (
          <Create onDone={() => window.close()} />
        )}

        {route === 'view' && (
          <ViewSeed />
        )}

        <p className="text-[11px] text-pearl-700 mt-10 text-center">
          Pearl Wallet beta · v0.1.0 · community-built, non-custodial
        </p>
      </div>
      <ToastHost />
    </div>
  );
}
