// Backend, appearance, auto-lock, wallet management. Visual structure
// mirrors mobile's settings/index.tsx — each section is a single bordered
// card with rows separated by dividers, label + hint per row, chevron on
// nav rows, distinct danger styling for Delete wallet.

import { useEffect, useState, type ReactNode } from 'react';
import { loadMeta, updateMeta, clearWallet, unlockMnemonic, type WalletMeta } from '@/storage/vault';
import { detectBackend, setBackend, type BackendMode } from '@/api/client';
import { lock } from '@/state/session';
import { clearCache } from '@/state/walletState';
import { applyTheme, loadTheme, saveTheme, type ThemeMode } from '@/state/theme';
import { toast } from '@/ui/Toast';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ChevronRightIcon } from '@/ui/icons';

const DEFAULT_BACKEND = 'https://pearlchain.live';

interface SettingsProps {
  onBack:       () => void;
  onLocked:     () => void;
  onDeleted:    () => void;   // wallet wiped → route to onboarding, not unlock
  onViewSeed:   () => void;
  onExportKey:  () => void;
  onAddresses:  () => void;
  onContacts:   () => void;
  onNames:      () => void;
}

export function Settings({ onBack, onLocked, onDeleted, onViewSeed, onExportKey, onAddresses, onContacts, onNames }: SettingsProps) {
  const [meta, setMeta]       = useState<WalletMeta | null>(null);
  const [url,  setUrl]        = useState('');
  const [busy, setBusy]       = useState(false);
  const [confirmDel, setDel]  = useState(false);
  const [delPw, setDelPw]     = useState('');
  const [theme, setTheme]     = useState<ThemeMode>('system');
  const [editBackend, setEdit] = useState(false);

  useEffect(() => { (async () => {
    const m = await loadMeta();
    setMeta(m);
    setUrl(m?.explorerUrl ?? DEFAULT_BACKEND);
    setTheme(await loadTheme());
  })(); }, []);

  async function setThemeMode(mode: ThemeMode) {
    setTheme(mode);
    await saveTheme(mode);
    applyTheme(mode);
  }

  async function saveBackend() {
    setBusy(true);
    try {
      const res = await detectBackend(url || DEFAULT_BACKEND);
      if (!res) { toast('Could not reach that URL'); return; }
      setBackend(res.url, res.mode);
      const updated = await updateMeta({ explorerUrl: res.url, explorerMode: res.mode });
      setMeta(updated);
      setEdit(false);
      toast(`Connected (${res.mode})`);
    } finally { setBusy(false); }
  }

  async function setAutoLock(mins: number) {
    const updated = await updateMeta({ autoLockMins: mins });
    setMeta(updated);
  }

  async function deleteWallet() {
    if (busy) return;
    setBusy(true);
    try {
      // Require the password — deleting wipes the encrypted seed from this browser.
      const ok = await unlockMnemonic(delPw);
      if (!ok) { toast('Wrong password'); return; }
      await clearWallet();
      clearCache();
      await lock();
      onDeleted();   // no wallet remains → onboarding, not the unlock prompt
    } finally { setBusy(false); }
  }

  const currentMode: BackendMode = meta?.explorerMode ?? 'pearlchain';
  const autoLockMins = meta?.autoLockMins ?? 5;
  const autoLockHint =
    autoLockMins === -1 ? 'Never auto-lock'
  : autoLockMins === 0  ? 'Lock immediately on close'
  :                       `After ${autoLockMins} minutes`;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScreenHeader title="Settings" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">

        <Section title="Backend">
          {editBackend ? (
            <div className="p-3 flex flex-col gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={DEFAULT_BACKEND}
                spellCheck={false}
                className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEdit(false); setUrl(meta?.explorerUrl ?? DEFAULT_BACKEND); }}
                  className="flex-1 rounded-lg py-2 text-sm border border-ink-700 text-pearl-300 hover:bg-ink-800"
                >Cancel</button>
                <button
                  disabled={busy}
                  onClick={saveBackend}
                  className="pearl-btn flex-1 rounded-lg py-2 text-sm"
                >{busy ? 'Detecting…' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <Row
              label="Explorer node"
              hint={(meta?.explorerUrl ?? DEFAULT_BACKEND).replace(/^https?:\/\//, '')}
              badge={currentMode === 'blockbook' ? 'Blockbook' : 'pearlchain'}
              onClick={() => setEdit(true)}
            />
          )}
        </Section>

        <Section title="Appearance">
          <div className="p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { label: 'Light',  v: 'light'  },
                { label: 'Dark',   v: 'dark'   },
                { label: 'System', v: 'system' },
              ] as { label: string; v: ThemeMode }[]).map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setThemeMode(opt.v)}
                  className={`seg tap rounded-lg py-2 text-xs ${theme === opt.v ? 'seg-on' : ''}`}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Auto-lock" hint={autoLockHint}>
          <div className="p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Off', v: -1 },
                { label: '5m',  v: 5  },
                { label: '15m', v: 15 },
                { label: '60m', v: 60 },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setAutoLock(opt.v)}
                  className={`seg tap rounded-lg py-2 text-xs ${autoLockMins === opt.v ? 'seg-on' : ''}`}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Wallet">
          <Row label="My .pns names"        hint="View & transfer your names" onClick={onNames} />
          <Row label="Addresses & Compound" hint="HD list + UTXO sweep" onClick={onAddresses} />
          <Row label="Address book"        hint="Saved contacts"        onClick={onContacts}  />
          <Row label="View recovery phrase" hint="Reveal your seed words" onClick={onViewSeed}  />
          <Row label="Export private key"   hint="For the selected account" onClick={onExportKey} />
          <Row label="Lock wallet"          hint="Forget the session"
               onClick={async () => { await lock(); onLocked(); }} />
        </Section>

        <Section title="Manage">
          {confirmDel ? (
            <div className="p-3 bg-rose-500/5">
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                This erases the encrypted wallet from this browser. Make sure your recovery phrase is backed up. Enter your password to confirm.
              </p>
              <input
                type="password"
                value={delPw}
                onChange={(e) => setDelPw(e.target.value)}
                placeholder="Password"
                autoFocus
                className="mt-2 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-rose-500/60 text-pearl-200"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setDel(false); setDelPw(''); }}
                  className="flex-1 rounded-lg py-2 text-sm border border-ink-700 text-pearl-300 hover:bg-ink-800"
                >Cancel</button>
                <button
                  onClick={deleteWallet}
                  disabled={busy || !delPw}
                  className="flex-1 rounded-lg py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white font-medium disabled:opacity-50"
                >{busy ? 'Checking…' : 'Confirm delete'}</button>
              </div>
            </div>
          ) : (
            <Row label="Delete wallet" hint="Wipes the encrypted seed from this browser"
                 danger onClick={() => setDel(true)} />
          )}
        </Section>

        <div className="text-[11px] text-pearl-600 text-center py-2">
          Pearl Wallet beta · v1.3.0
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between px-1 mb-1.5">
        <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">{title}</div>
        {hint && <div className="text-[11px] text-pearl-600">{hint}</div>}
      </div>
      <div className="bg-ink-900 border border-ink-700 rounded-xl divide-y divide-ink-700 overflow-hidden">
        {children}
      </div>
    </section>
  );
}

interface RowProps {
  label:  string;
  hint?:  string;
  badge?: string;
  danger?: boolean;
  onClick: () => void;
}

function Row({ label, hint, badge, danger, onClick }: RowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ink-800 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${danger ? 'text-rose-700 dark:text-rose-400' : 'text-pearl-200'}`}>
          {label}
        </div>
        {hint && (
          <div className={`text-[11px] mt-0.5 truncate ${danger ? 'text-rose-700/70 dark:text-rose-400/70' : 'text-pearl-600'}`}>
            {hint}
          </div>
        )}
      </div>
      {badge && (
        <span className="text-[10px] uppercase tracking-wider font-semibold text-pearl-500 bg-ink-800 border border-ink-700 px-1.5 py-0.5 rounded shrink-0">
          {badge}
        </span>
      )}
      <ChevronRightIcon size={16} className="text-pearl-600 shrink-0" />
    </button>
  );
}
