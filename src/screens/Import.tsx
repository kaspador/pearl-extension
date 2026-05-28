// Paste a 12-word seed, set a password, create the encrypted vault.
// Validation order: mnemonic checksum → password length → match → save.

import { useState } from 'react';
import { isValidMnemonic } from '@/pearl/wallet';
import { createWallet } from '@/storage/vault';
import { unlock as sessionUnlock } from '@/state/session';
import { toast } from '@/ui/Toast';

export function Import({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [step, setStep]         = useState<'phrase' | 'password'>('phrase');
  const [phrase, setPhrase]     = useState('');
  const [password, setPw]       = useState('');
  const [confirm, setConfirm]   = useState('');
  const [busy, setBusy]         = useState(false);

  const cleaned = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
  const phraseValid = cleaned.split(' ').length === 12 && isValidMnemonic(cleaned);

  async function finish() {
    if (password.length < 8) { toast('Password must be 8+ characters'); return; }
    if (password !== confirm) { toast('Passwords don’t match'); return; }
    setBusy(true);
    try {
      await createWallet({ mnemonic: cleaned, password });
      await sessionUnlock(cleaned);
      toast('Wallet imported');
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-800">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-200 text-xs">←</button>
        <h1 className="text-sm font-semibold">Import wallet</h1>
      </header>

      {step === 'phrase' ? (
        <div className="p-5 flex flex-col gap-4 flex-1">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-pearl-600">12-word recovery phrase</span>
            <textarea
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="word1 word2 word3 …"
              rows={4}
              className="mt-1 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-pearl-700 resize-none"
              autoFocus
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
          </label>
          <p className="text-[10px] text-pearl-700 leading-relaxed">
            Paste the 12 words separated by spaces. Order matters. Lower-case is fine.
          </p>
          <button
            disabled={!phraseValid}
            onClick={() => setStep('password')}
            className="pearl-btn rounded-xl py-2.5 text-sm mt-auto"
          >
            {phraseValid ? 'Continue' : 'Enter a valid 12-word phrase'}
          </button>
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-4 flex-1">
          <p className="text-xs text-pearl-500 leading-relaxed">
            Set a password to encrypt this wallet on your device. You&apos;ll enter it each time you unlock.
          </p>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-pearl-600">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPw(e.target.value)}
              className="mt-1 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-pearl-700"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-pearl-600">Confirm</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-pearl-700"
            />
          </label>
          <button
            disabled={busy || password.length < 8 || password !== confirm}
            onClick={finish}
            className="pearl-btn rounded-xl py-2.5 text-sm mt-auto"
          >
            {busy ? 'Encrypting…' : 'Import wallet'}
          </button>
        </div>
      )}
    </div>
  );
}
