// Reveal + copy the private key of the selected account. For an imported
// account this is its single key; for an HD account it's the key of the
// account's primary (receive #0) address — shown with a note that the recovery
// phrase, not this key, backs up every address.

import { useEffect, useState } from 'react';
import { exportCurrentPrivateKey } from '@/state/accounts';
import { loadMeta, selectedAccount, type AccountDescriptor } from '@/storage/vault';
import { shortAddr } from '@/ui/format';
import { toast } from '@/ui/Toast';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { CopyIcon } from '@/ui/icons';

export function ExportKey({ onBack }: { onBack: () => void }) {
  const [acc, setAcc]           = useState<AccountDescriptor | null>(null);
  const [data, setData]         = useState<{ address: string; hex: string } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [err, setErr]           = useState('');

  useEffect(() => {
    (async () => {
      setAcc(await selectedAccount());
      try {
        const meta = await loadMeta();
        setData(await exportCurrentPrivateKey(meta?.network ?? 'mainnet'));
      } catch (e) { setErr((e as Error).message); }
    })();
  }, []);

  async function copy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.hex);
    toast('Private key copied');
  }

  const isHd = acc?.type === 'hd';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScreenHeader title="Export private key" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {err ? (
          <div className="text-sm text-rose-700 dark:text-rose-400">{err}</div>
        ) : !data ? (
          <div className="text-sm text-pearl-600">Loading…</div>
        ) : (
          <>
            <div className="bg-ink-900 border border-ink-700 rounded-xl p-3">
              <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">{acc?.label}</div>
              <div className="text-xs font-mono text-pearl-400 mt-0.5 truncate" title={data.address}>{shortAddr(data.address, 14, 10)}</div>
            </div>

            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
              Anyone with this key can spend this account&apos;s funds. Never share it or paste it into a website.
            </p>

            <div className="relative">
              <div className={`bg-ink-900 border border-ink-700 rounded-xl p-3 font-mono text-xs break-all leading-relaxed text-pearl-200 ${revealed ? '' : 'blur-sm select-none'}`}>
                {data.hex}
              </div>
              {!revealed && (
                <button
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 flex items-center justify-center text-sm font-medium text-pearl-200 bg-ink-950/40 rounded-xl"
                >
                  Tap to reveal
                </button>
              )}
            </div>

            {revealed && (
              <button onClick={copy} className="rounded-lg border border-ink-700 hover:bg-ink-800 py-2 text-xs text-pearl-300 flex items-center justify-center gap-1.5">
                <CopyIcon size={14} /> Copy private key (hex)
              </button>
            )}

            {isHd && (
              <p className="text-[11px] text-pearl-600 leading-relaxed">
                This is the key for this account&apos;s main address only. Your recovery phrase backs up every address in the account — use <span className="text-pearl-400">View recovery phrase</span> for a full backup.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
