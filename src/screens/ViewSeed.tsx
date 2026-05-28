// Reveal the 12-word phrase inside the popup. Re-prompts the password —
// the in-memory HD key would let us derive addresses but NOT reverse back
// to the mnemonic, so we decrypt the sealed box fresh.
//
// Words are shown blurred behind a click-to-reveal overlay so a casual
// over-the-shoulder glance can't grab them.

import { useState } from 'react';
import { unlockMnemonic } from '@/storage/vault';
import { toast } from '@/ui/Toast';

export function ViewSeed({ onBack }: { onBack: () => void }) {
  const [pw, setPw]         = useState('');
  const [busy, setBusy]     = useState(false);
  const [words, setWords]   = useState<string[] | null>(null);
  const [revealed, setRev]  = useState(false);

  async function reveal() {
    if (!pw || busy) return;
    setBusy(true);
    try {
      const m = await unlockMnemonic(pw);
      if (!m) { toast('Wrong password'); return; }
      setWords(m.split(' '));
      setRev(false);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-700">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-200 text-sm">←</button>
        <h1 className="text-base font-semibold text-pearl-200">Recovery phrase</h1>
      </header>

      {!words ? (
        <div className="p-5 flex flex-col gap-3 flex-1">
          <p className="text-xs text-pearl-500 leading-relaxed">
            Enter your password to reveal the 12 words. Make sure no-one is looking
            at your screen.
          </p>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600">Password</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') reveal(); }}
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
              autoFocus
            />
          </label>
          <button
            disabled={busy || !pw}
            onClick={reveal}
            className="pearl-btn rounded-xl py-2.5 text-sm mt-auto"
          >
            {busy ? 'Decrypting…' : 'Reveal phrase'}
          </button>
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3 flex-1">
          <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
            <strong>These 12 words ARE your wallet.</strong> Anyone who sees them can take your PEARL.
          </p>

          <div className="relative">
            <div className={`grid grid-cols-3 gap-1.5 transition ${revealed ? '' : 'blur-sm select-none pointer-events-none'}`}>
              {words.map((w, i) => (
                <div key={i} className="bg-ink-900 border border-ink-700 rounded-lg px-2 py-1.5 text-xs font-mono flex items-center gap-1.5">
                  <span className="text-pearl-700 text-[10px] tabular-nums w-4 text-right">{i + 1}.</span>
                  <span className="text-pearl-200 truncate">{w}</span>
                </div>
              ))}
            </div>
            {!revealed && (
              <button
                onClick={() => setRev(true)}
                className="absolute inset-0 flex items-center justify-center text-sm text-pearl-200 hover:text-pearl-300 bg-ink-900/60 rounded-lg backdrop-blur-sm"
              >
                Click to reveal
              </button>
            )}
          </div>

          <div className="flex gap-2 mt-auto">
            <button
              onClick={() => { setWords(null); setPw(''); setRev(false); }}
              className="flex-1 rounded-xl py-2 text-xs border border-ink-700 text-pearl-300 hover:bg-ink-800"
            >
              Hide
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(words.join(' '));
                toast('Phrase copied');
              }}
              className="flex-1 rounded-xl py-2 text-xs border border-ink-700 text-pearl-300 hover:bg-ink-800"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
