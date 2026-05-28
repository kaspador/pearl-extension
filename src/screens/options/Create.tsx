// Three-step create flow: show 12-word phrase → verify (3 random positions)
// → set password → save encrypted vault.

import { useMemo, useState } from 'react';
import { generateWalletMnemonic } from '@/pearl/wallet';
import { createWallet } from '@/storage/vault';
import { unlock as sessionUnlock } from '@/state/session';
import { toast } from '@/ui/Toast';

type Step = 'show' | 'verify' | 'password' | 'done';

export function Create({ onDone }: { onDone: () => void }) {
  // Generate once. If the user reloads, they get a new phrase — that's fine,
  // they haven't saved anything yet.
  const mnemonic = useMemo(() => generateWalletMnemonic(), []);
  const words    = mnemonic.split(' ');

  const [step, setStep]     = useState<Step>('show');
  const [confirmed, setOk]  = useState(false);
  const [password, setPw]   = useState('');
  const [confirm,  setCf]   = useState('');
  const [busy, setBusy]     = useState(false);

  // For the verify step: pick 3 random word positions (1-indexed for display).
  const verifyPositions = useMemo(() => {
    const all = Array.from({ length: 12 }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, 3).sort((a, b) => a - b);
  }, []);
  const [verifyInputs, setVerify] = useState<Record<number, string>>({});
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
      setStep('done');
    } catch (e) {
      toast((e as Error).message);
    } finally { setBusy(false); }
  }

  if (step === 'show') {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-pearl-200">Your 12-word recovery phrase</h1>
        <p className="text-sm text-pearl-500 mt-2 leading-relaxed max-w-2xl">
          Write these down on paper and store somewhere safe. <strong className="text-rose-700 dark:text-rose-300">If you lose this phrase, your funds are gone forever — there is no support team, no central server, no backup.</strong>
        </p>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl">
          {words.map((w, i) => (
            <div key={i} className="bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono flex items-center gap-2">
              <span className="text-pearl-700 text-[10px] tabular-nums w-5 text-right">{i + 1}.</span>
              <span className="text-pearl-200">{w}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-2 max-w-2xl">
          <input
            type="checkbox"
            id="ack"
            checked={confirmed}
            onChange={(e) => setOk(e.target.checked)}
            className="mt-1"
          />
          <label htmlFor="ack" className="text-xs text-pearl-500 leading-relaxed">
            I&apos;ve written these 12 words down somewhere safe. I understand that losing
            them means losing access to my wallet.
          </label>
        </div>

        <button
          disabled={!confirmed}
          onClick={() => setStep('verify')}
          className="pearl-btn mt-6 rounded-xl py-2.5 px-5 text-sm"
        >
          I&apos;ve saved them — continue
        </button>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-pearl-200">Verify your phrase</h1>
        <p className="text-sm text-pearl-500 mt-2 leading-relaxed max-w-2xl">
          Fill in these {verifyPositions.length} words from the phrase you just wrote down.
        </p>

        <div className="mt-6 grid sm:grid-cols-3 gap-3 max-w-2xl">
          {verifyPositions.map(i => (
            <label key={i} className="block">
              <span className="text-[10px] uppercase tracking-wider text-pearl-600">Word #{i + 1}</span>
              <input
                value={verifyInputs[i] ?? ''}
                onChange={(e) => setVerify({ ...verifyInputs, [i]: e.target.value })}
                className="mt-1 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-pearl-700"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => setStep('show')} className="rounded-xl py-2.5 px-4 text-sm border border-ink-700 text-pearl-300 hover:bg-ink-800">
            ← Back to phrase
          </button>
          <button
            disabled={!verifyValid}
            onClick={() => setStep('password')}
            className="pearl-btn rounded-xl py-2.5 px-5 text-sm"
          >
            {verifyValid ? 'Continue' : 'Fill all 3 to continue'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-pearl-200">Set a password</h1>
        <p className="text-sm text-pearl-500 mt-2 leading-relaxed">
          The password encrypts the wallet on this browser. You&apos;ll enter it every time
          you unlock.
        </p>

        <label className="block mt-6">
          <span className="text-[10px] uppercase tracking-wider text-pearl-600">Password (8+ chars)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPw(e.target.value)}
            className="mt-1 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-pearl-700"
            autoFocus
          />
        </label>
        <label className="block mt-3">
          <span className="text-[10px] uppercase tracking-wider text-pearl-600">Confirm</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setCf(e.target.value)}
            className="mt-1 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-pearl-700"
          />
        </label>

        <button
          disabled={busy || password.length < 8 || password !== confirm}
          onClick={finish}
          className="pearl-btn mt-6 rounded-xl py-2.5 px-5 text-sm"
        >
          {busy ? 'Encrypting…' : 'Create wallet'}
        </button>
      </div>
    );
  }

  // step === 'done'
  return (
    <div className="text-center max-w-md mx-auto py-12">
      <div className="text-4xl mb-4">✓</div>
      <h1 className="text-xl font-semibold text-pearl-200">Wallet created</h1>
      <p className="text-sm text-pearl-500 mt-2 leading-relaxed">
        Click the Pearl toolbar icon to open the wallet. You&apos;re already unlocked
        for this session.
      </p>
      <button onClick={onDone} className="pearl-btn mt-6 rounded-xl py-2.5 px-5 text-sm">
        Close this page
      </button>
    </div>
  );
}
