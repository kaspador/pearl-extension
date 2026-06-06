// Import an existing 12- or 24-word phrase, then set a password.
//
// On finish we probe several derivations (coin type × account) and pick the one
// with on-chain activity, so a seed from another wallet that doesn't use our
// standard path still shows the right balance instead of importing "empty".
//
// UX wins vs a single textarea:
//   - numbered slots make order explicit; 12/24 toggle
//   - each word checked against BIP-39 wordlist live
//   - Space/Enter advances; pasting anywhere fills all slots
//   - checksum validated before continuing

import { useMemo, useRef, useState } from 'react';
import { wordlist } from '@scure/bip39/wordlists/english';
import { isValidMnemonic, mnemonicToHDKey } from '@/pearl/wallet';
import { detectDerivation } from '@/pearl/import';
import { scanAddresses } from '@/api/client';
import { createWallet } from '@/storage/vault';
import { unlock as sessionUnlock } from '@/state/session';
import { toast } from '@/ui/Toast';
import { ScreenHeader } from '@/ui/ScreenHeader';

export function Import({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [count, setCount]     = useState<12 | 24>(12);
  const [step, setStep]       = useState<'phrase' | 'password'>('phrase');
  const [words, setWords]     = useState<string[]>(() => Array(24).fill(''));
  const [password, setPw]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy]       = useState(false);
  const [busyLabel, setBusyLabel] = useState('');

  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const active  = words.slice(0, count);
  const lowered = useMemo(() => active.map(w => w.trim().toLowerCase()), [active]);
  const wordValid: boolean[] = lowered.map(w => !w || w.length < 3 || wordlist.includes(w));
  const allFilled = lowered.every(w => w.length > 0);
  const phrase    = lowered.join(' ');
  const phraseValid = allFilled && isValidMnemonic(phrase);

  function setWord(i: number, value: string) {
    const next = [...words];
    next[i] = value;
    setWords(next);
  }

  // Distribute a pasted phrase across slots. If 24 words are pasted while in
  // 12-word mode, auto-switch to 24.
  function handlePaste(from: number, text: string) {
    const parts = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;
    if (parts.length > 12 && count === 12) setCount(24);
    const next = [...words];
    for (let i = 0; i < parts.length && from + i < 24; i++) next[from + i] = parts[i];
    setWords(next);
    const lastIdx = Math.min(from + parts.length, 23);
    setTimeout(() => refs.current[lastIdx]?.focus(), 0);
    return true;
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (i < count - 1) refs.current[i + 1]?.focus();
    } else if (e.key === 'Backspace' && words[i] === '' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart ?? 0) === 0 && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && (e.currentTarget.selectionStart ?? 0) === words[i].length && i < count - 1) {
      refs.current[i + 1]?.focus();
    }
  }

  async function finish() {
    if (password.length < 8) { toast('Password must be 8+ characters'); return; }
    if (password !== confirm) { toast('Passwords don’t match'); return; }
    setBusy(true);
    try {
      const network = 'mainnet';
      // Smart path detection — find where this seed actually has funds.
      setBusyLabel('Scanning for your accounts…');
      let derivation;
      try {
        const hd = await mnemonicToHDKey(phrase);
        const d  = await detectDerivation(hd, network, scanAddresses);
        derivation = { coinType: d.coinType, account: d.account };
      } catch { /* offline / scan failed — fall back to the standard path */ }

      setBusyLabel('Encrypting…');
      await createWallet({ mnemonic: phrase, password, network, derivation });
      await sessionUnlock(phrase);
      toast('Wallet imported');
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally { setBusy(false); setBusyLabel(''); }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScreenHeader title="Import wallet" onBack={onBack} />

      {step === 'phrase' ? (
        <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
          {/* 12 / 24 toggle */}
          <div className="flex items-center justify-center gap-1.5 shrink-0">
            {([12, 24] as const).map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`seg tap rounded-lg px-4 py-1.5 text-xs ${count === n ? 'seg-on' : ''}`}
              >{n} words</button>
            ))}
          </div>

          <p className="text-xs text-pearl-600 leading-relaxed shrink-0">
            Type one word per slot, or paste the full phrase into any slot — we&apos;ll distribute it.
          </p>

          <div className="grid grid-cols-3 gap-1.5 overflow-y-auto">
            {Array.from({ length: count }, (_, i) => {
              const valid = wordValid[i];
              return (
                <label key={i} className="block relative">
                  <span className="absolute left-2 top-2 text-[10px] tabular-nums text-pearl-600 pointer-events-none font-medium">{i + 1}.</span>
                  <input
                    ref={(el) => { refs.current[i] = el; }}
                    value={words[i]}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/\s/.test(v)) { if (!handlePaste(i, v)) setWord(i, v.trim()); }
                      else setWord(i, v);
                    }}
                    onPaste={(e) => { const text = e.clipboardData.getData('text'); if (handlePaste(i, text)) e.preventDefault(); }}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    autoFocus={i === 0}
                    className={`w-full bg-ink-900 border rounded-lg pl-7 pr-2 py-2 text-sm font-mono text-pearl-200 focus:outline-none ${
                      valid ? 'border-ink-700 focus:border-pearl-700' : 'border-rose-500/60 focus:border-rose-500'
                    }`}
                  />
                </label>
              );
            })}
          </div>

          {allFilled && !phraseValid && (
            <div className="text-xs text-rose-700 dark:text-rose-400 mt-1 shrink-0">
              The phrase doesn&apos;t check out. Double-check word order and spelling.
            </div>
          )}

          <button
            disabled={!phraseValid}
            onClick={() => setStep('password')}
            className="pearl-btn rounded-xl py-3 text-sm mt-auto shrink-0"
          >
            {phraseValid ? 'Continue' : allFilled ? 'Invalid phrase' : `Enter all ${count} words`}
          </button>
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-4 flex-1">
          <p className="text-sm text-pearl-500 leading-relaxed">
            Set a password to encrypt this wallet on your device. You&apos;ll enter it each time you unlock.
          </p>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Password</span>
            <input
              type="password" value={password} onChange={(e) => setPw(e.target.value)}
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Confirm</span>
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
            />
          </label>
          <button
            disabled={busy || password.length < 8 || password !== confirm}
            onClick={finish}
            className="pearl-btn rounded-xl py-3 text-sm mt-auto"
          >
            {busy ? (busyLabel || 'Working…') : 'Import wallet'}
          </button>
        </div>
      )}
    </div>
  );
}
