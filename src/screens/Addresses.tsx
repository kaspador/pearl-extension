// All derived addresses + Compound. Mirrors mobile's app/addresses.tsx —
// tap any address to copy, single Compound button sweeps every UTXO into
// the primary receive address.

import { useEffect, useState } from 'react';
import { getCache, refreshWallet } from '@/state/walletState';
import { getHD } from '@/state/session';
import { deriveAddress } from '@/pearl/wallet';
import { formatPearl } from '@/pearl/network';
import { buildCompoundTx } from '@/pearl/transaction';
import { broadcastTx } from '@/api/client';
import { loadMeta } from '@/storage/vault';
import { shortAddr } from '@/ui/format';
import { toast } from '@/ui/Toast';

interface AddrRow {
  address: string;
  chain: 0 | 1;
  index: number;
  used: boolean;
  balance: bigint;
}

export function Addresses({ onBack }: { onBack: () => void }) {
  const [tick, setTick]   = useState(0);
  const [busy, setBusy]   = useState(false);
  const [confirm, setCf]  = useState(false);

  useEffect(() => {
    refreshWallet().then(() => setTick(t => t + 1));
  }, []);

  const c = getCache();
  const scan = c.scan;
  const utxoCount = scan?.utxos.length ?? 0;
  const funded = (scan?.addresses ?? []).filter(a => a.balance > 0n);
  const canCompound = utxoCount >= 2;

  // Show used addresses + the next-receive marker (skip the long tail of
  // unused gap-limit slots that nobody cares about).
  const visible: AddrRow[] = (scan?.addresses ?? []).filter(a =>
    a.used || a.balance > 0n || (a.chain === 0 && a.address === scan?.receiveAddress),
  );

  async function doCopy(addr: string) {
    await navigator.clipboard.writeText(addr);
    toast('Address copied');
  }

  async function doCompound() {
    if (!scan) return;
    const hd = getHD();
    if (!hd) return;
    setBusy(true);
    try {
      const meta    = await loadMeta();
      const network = meta?.network ?? 'mainnet';
      const dest    = deriveAddress(hd, 0, 0, network).address;
      const feeRate = BigInt(c.feeRate ?? 1);
      const built   = buildCompoundTx({ hd, network, utxos: scan.utxos, destination: dest, feeRate });
      const res     = await broadcastTx(built.hex);
      if (res.error || !res.txid) {
        toast(res.error ?? 'Compound failed');
      } else {
        toast(`Swept ${built.inputCount} outputs`);
        setCf(false);
        await refreshWallet();
        setTick(t => t + 1);
      }
    } catch (e) {
      toast((e as Error).message);
    } finally { setBusy(false); }
  }

  void tick;

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-700">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-200 text-sm">←</button>
        <h1 className="text-base font-semibold text-pearl-200">Addresses</h1>
      </header>

      <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
        {/* Summary */}
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-4 text-center">
          <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Total across all addresses</div>
          <div className="text-2xl font-semibold font-mono text-pearl-200 mt-1 leading-tight">
            {scan ? formatPearl(scan.balance, 8) : '—'} <span className="text-xs text-pearl-600 font-normal">PEARL</span>
          </div>
          <div className="text-xs text-pearl-600 mt-1">
            {funded.length} funded · {utxoCount} unspent output{utxoCount === 1 ? '' : 's'}
          </div>
        </div>

        {/* Compound */}
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-3">
          <div className="text-sm font-semibold text-pearl-200">Compound</div>
          <div className="text-xs text-pearl-600 mt-1 leading-relaxed">
            {utxoCount < 2
              ? 'Nothing to consolidate — funds are already in one output.'
              : 'Sweep every unspent output into your primary address. Cheaper, simpler future sends.'}
          </div>
          {confirm ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={doCompound}
                disabled={busy}
                className="pearl-btn flex-1 rounded-lg py-2 text-sm"
              >{busy ? 'Sweeping…' : 'Confirm'}</button>
              <button
                onClick={() => setCf(false)}
                disabled={busy}
                className="flex-1 rounded-lg py-2 text-sm border border-ink-700 text-pearl-300 hover:bg-ink-800"
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setCf(true)}
              disabled={!canCompound || busy}
              className="pearl-btn mt-3 w-full rounded-lg py-2 text-sm"
            >Compound {utxoCount > 1 ? `${utxoCount} outputs` : ''}</button>
          )}
        </div>

        {/* Address list */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold mb-2 px-1">
            Your addresses
          </div>
          <div className="bg-ink-900 border border-ink-700 rounded-xl divide-y divide-ink-700 overflow-hidden">
            {visible.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-pearl-600">
                {scan ? 'No used addresses yet.' : 'Loading…'}
              </div>
            ) : visible.map((a) => (
              <button
                key={a.address}
                onClick={() => doCopy(a.address)}
                className="w-full px-3 py-2.5 text-left hover:bg-ink-800 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-pearl-500 bg-ink-800 px-1.5 py-0.5 rounded">
                    {a.chain === 0 ? 'receive' : 'change'} #{a.index}
                  </span>
                  {a.address === scan?.receiveAddress && (
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      next receive
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-pearl-400 truncate">{shortAddr(a.address, 14, 8)}</span>
                  <span className={`font-mono text-xs font-semibold shrink-0 ${a.balance > 0n ? 'text-pearl-200' : 'text-pearl-700'}`}>
                    {formatPearl(a.balance, 4)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-pearl-600 leading-relaxed text-center">
          Tap an address to copy it. Balance always reflects every address —
          even ones created by other wallets using the same recovery phrase.
        </p>
      </div>
    </div>
  );
}
