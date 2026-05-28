// Password prompt — shown when a vault exists but the session is locked.

import { useState, useRef, useEffect } from 'react';
import { unlockMnemonic } from '@/storage/vault';
import { unlock as sessionUnlock } from '@/state/session';
import { toast } from '@/ui/Toast';
import logoUrl from '@/assets/logo.png';

export function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [pw, setPw]     = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function tryUnlock() {
    if (!pw || busy) return;
    setBusy(true);
    try {
      const mnemonic = await unlockMnemonic(pw);
      if (!mnemonic) { toast('Wrong password'); return; }
      await sessionUnlock(mnemonic);
      onUnlocked();
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <img src={logoUrl} alt="Pearl Wallet" className="w-16 h-16 rounded-2xl" />
        <div className="text-center">
          <h1 className="text-base font-semibold text-pearl-200 leading-tight">
            Welcome back to Pearl Wallet
          </h1>
          <p className="text-xs text-pearl-600 mt-1.5">pearlchain.live</p>
        </div>
        <input
          ref={inputRef}
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
          placeholder="Password"
          className="w-full max-w-[280px] bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-center text-pearl-200"
        />
      </div>
      <button
        disabled={!pw || busy}
        onClick={tryUnlock}
        className="pearl-btn rounded-xl py-3 text-sm"
      >
        {busy ? 'Decrypting…' : 'Unlock'}
      </button>
    </div>
  );
}
