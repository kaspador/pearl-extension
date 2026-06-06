// Header dropdown to switch between accounts (HD + imported), MetaMask-style.
// Selecting an account persists it in the vault and asks the parent to refresh
// the wallet view. "Add / import account" routes to the AddAccount screen.

import { useEffect, useRef, useState } from 'react';
import { listAccounts, selectAccount, selectedAccount, type AccountDescriptor } from '@/storage/vault';
import { ChevronDownIcon, CheckIcon, PlusIcon } from '@/ui/icons';
import { shortAddr } from '@/ui/format';

export function AccountSwitcher({ onChanged, onAddAccount }: { onChanged: () => void; onAddAccount: () => void }) {
  const [open, setOpen]         = useState(false);
  const [accounts, setAccounts] = useState<AccountDescriptor[]>([]);
  const [current, setCurrent]   = useState<AccountDescriptor | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setAccounts(await listAccounts());
    setCurrent(await selectedAccount());
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function pick(id: string) {
    await selectAccount(id);
    setOpen(false);
    await load();
    onChanged();
  }

  function subLabel(a: AccountDescriptor): string {
    return a.type === 'imported' ? `${shortAddr(a.address, 8, 6)} · imported` : `account #${a.account}`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-ink-800 max-w-[170px]"
        aria-label="Switch account"
      >
        <span className="text-sm font-semibold text-pearl-200 truncate">{current?.label ?? 'Account'}</span>
        <ChevronDownIcon size={14} className="text-pearl-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-56 bg-ink-900 border border-ink-700 rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => pick(a.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-ink-800"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-pearl-200 truncate">{a.label}</span>
                  <span className="block text-[10px] font-mono text-pearl-600 truncate">{subLabel(a)}</span>
                </span>
                {current?.id === a.id && <CheckIcon size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setOpen(false); onAddAccount(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-ink-700 text-pearl-300 hover:bg-ink-800"
          >
            <PlusIcon size={15} /> <span className="text-sm font-medium">Add / import account</span>
          </button>
        </div>
      )}
    </div>
  );
}
