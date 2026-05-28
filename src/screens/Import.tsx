// Import an existing 12-word phrase, then set a password.
//
// UX wins vs a single textarea:
//   - 12 numbered slots make order explicit
//   - Each word checked against BIP-39 wordlist live (red dot if not)
//   - Space/Enter advances to next field
//   - Pasting anywhere fills all 12 (handles "word1 word2 …" and quoted)
//   - Backspace on an empty field jumps to the previous field
//
// Final mnemonic checksum is validated with isValidMnemonic before we let
// the user continue.

import { useMemo, useRef, useState } from 'react';
import { wordlist } from '@scure/bip39/wordlists/english';
import { isValidMnemonic } from '@/pearl/wallet';
import { createWallet } from '@/storage/vault';
import { unlock as sessionUnlock } from '@/state/session';
import { toast } from '@/ui/Toast';

const WORD_COUNT = 12;

export function Import({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [step, setStep]       = useState<'phrase' | 'password'>('phrase');
  const [words, setWords]     = useState<string[]>(() => Array(WORD_COUNT).fill(''));
  const [password, setPw]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy]       = useState(false);

  // Refs let us focus/blur slots programmatically.
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const lowered = useMemo(() => words.map(w => w.trim().toLowerCase()), [words]);

  // Per-word validity against the BIP-39 wordlist (loose — exact match only,
  // and we only flag once a word has 3+ chars so users don't see red mid-type).
  const wordValid: boolean[] = lowered.map(w => !w || w.length < 3 || wordlist.includes(w));

  const allFilled = lowered.every(w => w.length > 0);
  const phrase    = lowered.join(' ');
  const phraseValid = allFilled && isValidMnemonic(phrase);

  function setWord(i: number, value: string) {
    const next = [...words];
    next[i] = value;
    setWords(next);
  }

  // Distribute a pasted "word1 word2 ..." string across slots starting at `from`.
  function handlePaste(from: number, text: string) {
    const parts = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;  // single word — let default paste handle it
    const next = [...words];
    for (let i = 0; i < parts.length && from + i < WORD_COUNT; i++) {
      next[from + i] = parts[i];
    }
    setWords(next);
    // Focus next empty slot (or last)
    const lastIdx = Math.min(from + parts.length, WORD_COUNT - 1);
    setTimeout(() => refs.current[lastIdx]?.focus(), 0);
    return true;
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (i < WORD_COUNT - 1) refs.current[i + 1]?.focus();
    } else if (e.key === 'Backspace' && words[i] === '' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart ?? 0) === 0 && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && (e.currentTarget.selectionStart ?? 0) === words[i].length && i < WORD_COUNT - 1) {
      refs.current[i + 1]?.focus();
    }
  }

  async function finish() {
    if (password.length < 8) { toast('Password must be 8+ characters'); return; }
    if (password !== confirm) { toast('Passwords don’t match'); return; }
    setBusy(true);
    try {
      await createWallet({ mnemonic: phrase, password });
      await sessionUnlock(phrase);
      toast('Wallet imported');
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-700">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-200 text-sm">←</button>
        <h1 className="text-base font-semibold text-pearl-200">Import wallet</h1>
      </header>

      {step === 'phrase' ? (
        <div className="p-4 flex flex-col gap-3 flex-1">
          <p className="text-xs text-pearl-600 leading-relaxed">
            Type one word per slot. Press <kbd className="px-1 rounded bg-ink-800 border border-ink-700 text-pearl-400">space</kbd> to advance.
            Or paste the full phrase into any slot — we&apos;ll distribute it.
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: WORD_COUNT }, (_, i) => {
              const valid = wordValid[i];
              return (
                <label key={i} className="block relative">
                  <span className="absolute left-2 top-2 text-[10px] tabular-nums text-pearl-600 pointer-events-none font-medium">
                    {i + 1}.
                  </span>
                  <input
                    ref={(el) => { refs.current[i] = el; }}
                    value={words[i]}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/\s/.test(v)) {
                        if (!handlePaste(i, v)) setWord(i, v.trim());
                      } else {
                        setWord(i, v);
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text');
                      if (handlePaste(i, text)) e.preventDefault();
                    }}
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
            <div className="text-xs text-rose-700 dark:text-rose-400 mt-1">
              The phrase doesn&apos;t check out. Double-check word order and spelling.
            </div>
          )}

          <button
            disabled={!phraseValid}
            onClick={() => setStep('password')}
            className="pearl-btn rounded-xl py-3 text-sm mt-auto"
          >
            {phraseValid ? 'Continue' : allFilled ? 'Invalid phrase' : 'Enter all 12 words'}
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
              type="password"
              value={password}
              onChange={(e) => setPw(e.target.value)}
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Confirm</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
            />
          </label>
          <button
            disabled={busy || password.length < 8 || password !== confirm}
            onClick={finish}
            className="pearl-btn rounded-xl py-3 text-sm mt-auto"
          >
            {busy ? 'Encrypting…' : 'Import wallet'}
          </button>
        </div>
      )}
    </div>
  );
}
