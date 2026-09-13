// Create-wallet flow — runs inside the popup (NOT a new tab). Three steps:
//   1. Show 12-word phrase (3×4 grid) with a confirm checkbox
//   2. Verify 3 random word positions
//   3. Set password
// Closing the popup mid-flow loses progress, which we accept — the user
// hasn't saved anything to disk until the password step completes.

import { useMemo, useState } from 'react';
import { generateWalletMnemonic } from '@/pearl/wallet';
import { createWallet } from '@/storage/vault';
import { unlock as sessionUnlock } from '@/state/session';
import { toast } from '@/ui/Toast';
import { ChevronLeftIcon, CopyIcon } from '@/ui/icons';
import { PwMatch } from '@/ui/PwMatch';

type Step = 'show' | 'verify' | 'password';

interface Props {
  onBack: () => void;     // back from step 1 → onboarding
  onDone: () => void;     // → dashboard after vault created
}

export function Create({ onBack, onDone }: Props) {
  // Phrase length is the user's choice (12 = 128-bit, 24 = 256-bit). Regenerated
  // when the length changes; nothing touches disk until the password step.
  const [count, setCount]    = useState<12 | 24>(12);
  const mnemonic = useMemo(() => generateWalletMnemonic(count), [count]);
  const words    = mnemonic.split(' ');

  const [step, setStep]      = useState<Step>('show');
  const [confirmed, setOk]   = useState(false);
  const [password, setPw]    = useState('');
  const [confirm,  setCf]    = useState('');
  const [busy, setBusy]      = useState(false);

  // Pick 3 random word positions to verify on step 2. Reshuffles with the phrase.
  const verifyPositions = useMemo(() => {
    const all = Array.from({ length: words.length }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, 3).sort((a, b) => a - b);
  }, [mnemonic]);
  const [verifyInputs, setVerify] = useState<Record<number, string>>({});

  function chooseCount(n: 12 | 24) {
    if (n === count) return;
    setCount(n);          // regenerates the phrase
    setVerify({});        // old answers no longer apply
    setOk(false);         // re-confirm the new phrase
  }
  const verifyValid = verifyPositions.every(
    i => (verifyInputs[i] ?? '').trim().toLowerCase() === words[i],
  );

  async function finish() {
    if (password.length < 8) { toast('Password must be 8+ characters'); return; }
    if (password !== confirm) { toast('Passwords don’t match'); return; }
    setBusy(true);
    try {
      await createWallet({ mnemonic, password });
      await sessionUnlock(mnemonic);
      toast('Wallet created');
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally { setBusy(false); }
  }

  function header(title: string, stepN: number, onUp: () => void) {
    return (
      <header className="flex items-center gap-2 px-3 pt-3 pb-2.5 border-b border-ink-700 shrink-0">
        <button onClick={onUp} className="icon-badge tap w-8 h-8 hover:text-pearl-200 shrink-0" aria-label="Back">
          <ChevronLeftIcon size={18} />
        </button>
        <h1 className="text-sm font-semibold text-pearl-200 flex-1 truncate">{title}</h1>
        <span className="text-[11px] text-pearl-600 font-mono tabular-nums">{stepN} / 3</span>
      </header>
    );
  }

  if (step === 'show') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {header('Recovery phrase', 1, onBack)}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
          {/* 12 / 24 word choice */}
          <div className="flex items-center justify-center gap-1.5">
            {([12, 24] as const).map(n => (
              <button
                key={n}
                onClick={() => chooseCount(n)}
                className={`seg tap rounded-lg px-4 py-1.5 text-xs ${count === n ? 'seg-on' : ''}`}
              >{n} words</button>
            ))}
          </div>

          <p className="text-xs text-pearl-600 leading-relaxed">
            Write these {words.length} words down on paper. <span className="text-rose-700 dark:text-rose-300 font-semibold">Lose them and the wallet is gone — no support, no backup.</span>
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            {words.map((w, i) => (
              <div key={i} className="bg-ink-900 border border-ink-700 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                <span className="text-pearl-700 text-[10px] tabular-nums w-4 text-right font-medium">{i + 1}.</span>
                <span className="text-pearl-200 text-sm font-mono truncate">{w}</span>
              </div>
            ))}
          </div>

          <button
            onClick={async () => {
              await navigator.clipboard.writeText(mnemonic);
              toast('Phrase copied — paste it into a password manager');
            }}
            className="rounded-lg border border-ink-700 hover:bg-ink-800 py-2 text-xs text-pearl-300 flex items-center justify-center gap-1.5"
          >
            <CopyIcon size={14} /> Copy {words.length}-word phrase
          </button>

          <label className="flex items-start gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setOk(e.target.checked)}
              className="mt-1 shrink-0"
            />
            <span className="text-xs text-pearl-500 leading-relaxed">
              I&apos;ve saved these {words.length} words somewhere safe.
            </span>
          </label>
        </div>
        <div className="px-4 pt-2 pb-4 border-t border-ink-700 shrink-0">
          <button
            disabled={!confirmed}
            onClick={() => setStep('verify')}
            className="pearl-btn rounded-xl py-3 text-sm w-full"
          >Continue</button>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {header('Verify phrase', 2, () => setStep('show'))}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
          <p className="text-xs text-pearl-600 leading-relaxed">
            Type 3 specific words from the phrase you just wrote down.
          </p>

          <div className="flex flex-col gap-2.5 mt-1">
            {verifyPositions.map(i => (
              <label key={i} className="block">
                <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">
                  Word #{i + 1}
                </span>
                <input
                  value={verifyInputs[i] ?? ''}
                  onChange={(e) => setVerify({ ...verifyInputs, [i]: e.target.value })}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
                />
              </label>
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-4 border-t border-ink-700 shrink-0">
          <button
            disabled={!verifyValid}
            onClick={() => setStep('password')}
            className="pearl-btn rounded-xl py-3 text-sm w-full"
          >
            {verifyValid ? 'Continue' : 'Fill all 3 words'}
          </button>
        </div>
      </div>
    );
  }

  // step === 'password'
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {header('Set a password', 3, () => setStep('verify'))}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        <p className="text-xs text-pearl-600 leading-relaxed">
          The password encrypts the wallet on this browser. You&apos;ll enter it
          each time you unlock.
        </p>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">
            Password (8+ chars)
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPw(e.target.value)}
            className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">
            Confirm
          </span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setCf(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') finish(); }}
            className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
          />
        </label>
        <PwMatch password={password} confirm={confirm} />
      </div>
      <div className="px-4 pt-2 pb-4 border-t border-ink-700 shrink-0">
        <button
          disabled={busy || password.length < 8 || password !== confirm}
          onClick={finish}
          className="pearl-btn rounded-xl py-3 text-sm w-full"
        >
          {busy ? 'Encrypting…' : 'Create wallet'}
        </button>
      </div>
    </div>
  );
}
