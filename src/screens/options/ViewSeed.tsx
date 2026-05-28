// Reveal the 12-word phrase. Always re-prompts the password — the in-memory
// HD key would be enough to derive addresses but NOT to reverse back to the
// mnemonic, so we read & decrypt the sealed box fresh each time.

import { useState } from 'react';
import { unlockMnemonic } from '@/storage/vault';
import { toast } from '@/ui/Toast';

export function ViewSeed() {
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

  if (!words) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-pearl-200">View recovery phrase</h1>
        <p className="text-sm text-pearl-500 mt-2 leading-relaxed">
          Enter your password to reveal the 12 words. Make sure no-one is looking at your screen.
        </p>

        <label className="block mt-6">
          <span className="text-[10px] uppercase tracking-wider text-pearl-600">Password</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') reveal(); }}
            className="mt-1 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-pearl-700"
            autoFocus
          />
        </label>
        <button
          disabled={busy || !pw}
          onClick={reveal}
          className="pearl-btn mt-4 rounded-xl py-2.5 px-5 text-sm"
        >
          {busy ? 'Decrypting…' : 'Reveal phrase'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-pearl-200">Your recovery phrase</h1>
      <p className="text-sm text-pearl-500 mt-2 leading-relaxed max-w-2xl">
        These 12 words ARE your wallet. Anyone with them can take your PEARL — keep them
        offline and private.
      </p>

      <div className="relative mt-6 max-w-2xl">
        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 transition ${revealed ? '' : 'blur-sm select-none'}`}>
          {words.map((w, i) => (
            <div key={i} className="bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono flex items-center gap-2">
              <span className="text-pearl-700 text-[10px] tabular-nums w-5 text-right">{i + 1}.</span>
              <span className="text-pearl-200">{w}</span>
            </div>
          ))}
        </div>
        {!revealed && (
          <button
            onClick={() => setRev(true)}
            className="absolute inset-0 flex items-center justify-center text-sm text-pearl-300 hover:text-pearl-200 bg-ink-900/70 rounded-2xl"
          >
            Click to reveal
          </button>
        )}
      </div>

      <div className="mt-6 flex gap-3 max-w-2xl">
        <button
          onClick={() => { setWords(null); setPw(''); setRev(false); }}
          className="rounded-xl py-2.5 px-4 text-sm border border-ink-700 text-pearl-300 hover:bg-ink-800"
        >
          Hide
        </button>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(words.join(' '));
            toast('Phrase copied');
          }}
          className="rounded-xl py-2.5 px-4 text-sm border border-ink-700 text-pearl-300 hover:bg-ink-800"
        >
          Copy to clipboard
        </button>
      </div>
    </div>
  );
}
