// Add a new account to the wallet: either the next HD account derived from the
// existing seed (MetaMask "Create account") or an imported single private key
// (hex or WIF). The imported key is sealed with the master mnemonic, so the
// wallet must be unlocked (it always is when this screen is reachable).

import { useMemo, useState } from 'react';
import { addHdAccount, importPrivateKeyAccount } from '@/storage/vault';
import { parsePrivateKey } from '@/pearl/wallet';
import { getMnemonic } from '@/state/session';
import { refreshWallet } from '@/state/walletState';
import { toast } from '@/ui/Toast';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { PlusIcon, KeyIcon } from '@/ui/icons';

export function AddAccount({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [mode, setMode]       = useState<'menu' | 'import'>('menu');
  const [label, setLabel]     = useState('');
  const [keyInput, setKey]    = useState('');
  const [busy, setBusy]       = useState(false);

  const keyValid = useMemo(() => {
    if (!keyInput.trim()) return false;
    try { parsePrivateKey(keyInput); return true; } catch { return false; }
  }, [keyInput]);

  async function createHd() {
    setBusy(true);
    try {
      await addHdAccount(label.trim() || undefined);
      await refreshWallet();
      toast('Account added');
      onDone();
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  }

  async function doImport() {
    const mnemonic = getMnemonic();
    if (!mnemonic) { toast('Unlock the wallet first'); return; }
    setBusy(true);
    try {
      await importPrivateKeyAccount({ keyInput: keyInput.trim(), mnemonic, label: label.trim() || undefined });
      await refreshWallet();
      toast('Private key imported');
      onDone();
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScreenHeader title={mode === 'import' ? 'Import private key' : 'Add account'} onBack={() => mode === 'import' ? setMode('menu') : onBack()} />

      {mode === 'menu' ? (
        <div className="p-4 flex flex-col gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Name (optional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Savings"
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm text-pearl-200 focus:outline-none focus:border-pearl-700"
            />
          </label>

          <button
            onClick={createHd}
            disabled={busy}
            className="pearl-card tap flex items-center gap-3 p-4 text-left disabled:opacity-50"
          >
            <span className="icon-badge w-9 h-9 text-pearl-200 shrink-0"><PlusIcon size={18} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-pearl-200">Create a new account</span>
              <span className="block text-xs text-pearl-600">A fresh address from your existing recovery phrase.</span>
            </span>
          </button>

          <button
            onClick={() => setMode('import')}
            disabled={busy}
            className="pearl-card tap flex items-center gap-3 p-4 text-left disabled:opacity-50"
          >
            <span className="icon-badge w-9 h-9 text-pearl-200 shrink-0"><KeyIcon size={18} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-pearl-200">Import a private key</span>
              <span className="block text-xs text-pearl-600">Add an existing key (hex or WIF) as its own account.</span>
            </span>
          </button>
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3 flex-1">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Name (optional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Cold key"
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm text-pearl-200 focus:outline-none focus:border-pearl-700"
            />
          </label>

          <label className="block flex-1 flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Private key</span>
            <textarea
              value={keyInput}
              onChange={(e) => setKey(e.target.value)}
              placeholder="64-character hex or WIF"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-xs font-mono text-pearl-200 focus:outline-none focus:border-pearl-700 resize-none h-20"
            />
            {keyInput.trim() && !keyValid && (
              <span className="text-xs text-rose-700 dark:text-rose-400 mt-1">Not a valid private key (hex or WIF).</span>
            )}
          </label>

          <p className="text-[11px] text-pearl-600 leading-relaxed">
            The key is encrypted on your device with your wallet. Anyone with it can spend the funds — never share it.
          </p>

          <button
            disabled={busy || !keyValid}
            onClick={doImport}
            className="pearl-btn rounded-xl py-3 text-sm mt-auto"
          >
            {busy ? 'Importing…' : 'Import key'}
          </button>
        </div>
      )}
    </div>
  );
}
