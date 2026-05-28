// Backend toggle, auto-lock, view seed (opens options page), delete wallet.

import { useEffect, useState } from 'react';
import { loadMeta, updateMeta, clearWallet, type WalletMeta } from '@/storage/vault';
import { detectBackend, setBackend, type BackendMode } from '@/api/client';
import { lock } from '@/state/session';
import { clearCache } from '@/state/walletState';
import { toast } from '@/ui/Toast';

const DEFAULT_BACKEND = 'https://pearlchain.live';

export function Settings({ onBack, onLocked }: { onBack: () => void; onLocked: () => void }) {
  const [meta, setMeta]       = useState<WalletMeta | null>(null);
  const [url,  setUrl]        = useState('');
  const [busy, setBusy]       = useState(false);
  const [confirmDel, setDel]  = useState(false);

  useEffect(() => { (async () => {
    const m = await loadMeta();
    setMeta(m);
    setUrl(m?.explorerUrl ?? DEFAULT_BACKEND);
  })(); }, []);

  async function saveBackend() {
    setBusy(true);
    try {
      const res = await detectBackend(url || DEFAULT_BACKEND);
      if (!res) { toast('Could not reach that URL'); return; }
      setBackend(res.url, res.mode);
      const updated = await updateMeta({ explorerUrl: res.url, explorerMode: res.mode });
      setMeta(updated);
      toast(`Connected (${res.mode})`);
    } finally { setBusy(false); }
  }

  async function setAutoLock(mins: number) {
    const updated = await updateMeta({ autoLockMins: mins });
    setMeta(updated);
  }

  async function deleteWallet() {
    await clearWallet();
    clearCache();
    lock();
    onLocked();
  }

  const currentMode: BackendMode = meta?.explorerMode ?? 'pearlchain';
  const autoLockMins = meta?.autoLockMins ?? 5;

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-800">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-200 text-xs">←</button>
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>

      <div className="p-5 flex flex-col gap-6 flex-1 text-xs overflow-y-auto">

        <section>
          <div className="text-[10px] uppercase tracking-wider text-pearl-600 mb-2">Backend</div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={DEFAULT_BACKEND}
            spellCheck={false}
            className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-pearl-700"
          />
          <div className="text-[10px] text-pearl-700 mt-1">
            Current: <span className="font-mono">{currentMode === 'blockbook' ? 'Blockbook v2' : 'pearlchain.live'}</span>
          </div>
          <button
            disabled={busy}
            onClick={saveBackend}
            className="mt-2 w-full rounded-lg py-1.5 text-xs border border-ink-700 hover:bg-ink-800 text-pearl-300"
          >
            {busy ? 'Detecting…' : 'Save'}
          </button>
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-wider text-pearl-600 mb-2">Auto-lock</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'Off',  v: -1 },
              { label: '5m',   v: 5  },
              { label: '15m',  v: 15 },
              { label: '60m',  v: 60 },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setAutoLock(opt.v)}
                className={`rounded-lg py-1.5 text-[11px] border ${
                  autoLockMins === opt.v
                    ? 'border-pearl-500 text-pearl-200 bg-ink-800'
                    : 'border-ink-700 text-pearl-500 hover:bg-ink-800'
                }`}
              >{opt.label}</button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-wider text-pearl-600 mb-2">Wallet</div>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="w-full text-left rounded-lg py-2 px-3 text-xs border border-ink-700 hover:bg-ink-800 text-pearl-300"
          >
            View 12-word phrase
          </button>
          <button
            onClick={() => { lock(); onLocked(); }}
            className="mt-2 w-full text-left rounded-lg py-2 px-3 text-xs border border-ink-700 hover:bg-ink-800 text-pearl-300"
          >
            Lock now
          </button>
          {confirmDel ? (
            <div className="mt-2 rounded-lg p-3 border border-rose-500/40 bg-rose-500/10">
              <p className="text-[11px] text-rose-300 leading-relaxed">
                This erases the encrypted wallet from this browser. Make sure you have your 12-word phrase backed up.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={deleteWallet}
                  className="flex-1 rounded-lg py-1.5 text-xs bg-rose-500 text-ink-950 font-medium"
                >Confirm delete</button>
                <button
                  onClick={() => setDel(false)}
                  className="flex-1 rounded-lg py-1.5 text-xs border border-ink-700 text-pearl-300"
                >Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDel(true)}
              className="mt-2 w-full text-left rounded-lg py-2 px-3 text-xs border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
            >
              Delete wallet
            </button>
          )}
        </section>

        <section className="mt-auto pt-3 border-t border-ink-800 text-[10px] text-pearl-700">
          Pearl Wallet beta · v0.1.0
        </section>
      </div>
    </div>
  );
}
