// All derived addresses + Compound. Layout matches mobile's
// app/addresses.tsx but split for the 360x580 popup: the summary and
// Compound card stay fixed at top, the address list scrolls underneath.

import { useEffect, useState } from 'react';
import { getCache, refreshWallet } from '@/state/walletState';
import { buildCurrentSigner } from '@/state/accounts';
import { formatPearl, grainsToPearl } from '@/pearl/network';
import { buildCompoundTx } from '@/pearl/transaction';
import { broadcastTx } from '@/api/client';
import { loadMeta } from '@/storage/vault';
import { shortAddr, fmtUsd } from '@/ui/format';
import { toast } from '@/ui/Toast';
import { ScreenHeader } from '@/ui/ScreenHeader';

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
  // Name coins are left out of a consolidation, so only count the others.
  const utxoCount = (scan?.utxos ?? []).filter(u => !c.protectedOutpoints.has(`${u.txid}:${u.vout}`)).length;
  const funded = (scan?.addresses ?? []).filter(a => a.balance > 0n);
  const canCompound = utxoCount >= 2;
  const priceUsd = c.priceUsd ?? null;
  const totalUsd = scan && priceUsd != null ? grainsToPearl(scan.balance) * priceUsd : null;

  const visible: AddrRow[] = (scan?.addresses ?? []).filter(a =>
    a.used || a.balance > 0n || (a.chain === 0 && a.address === scan?.receiveAddress),
  );

  async function doCopy(addr: string) {
    await navigator.clipboard.writeText(addr);
    toast('Address copied');
  }

  async function doCompound() {
    if (!scan) return;
    setBusy(true);
    try {
      const meta    = await loadMeta();
      const network = meta?.network ?? 'mainnet';
      const signer  = await buildCurrentSigner(network);
      const dest    = scan.receiveAddress;   // consolidate into the current account's receive address
      const feeRate = BigInt(c.feeRate ?? 1);
      const built   = buildCompoundTx({ signer, network, utxos: scan.utxos, protectedOutpoints: c.protectedOutpoints, destination: dest, feeRate });
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
    <div className="flex-1 flex flex-col min-h-0">
      <ScreenHeader title="Addresses" onBack={onBack} />

      {/* Fixed top: summary + compound */}
      <div className="px-4 pt-4 pb-3 shrink-0 flex flex-col gap-3 border-b border-ink-700">
        {/* Summary */}
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-pearl-600 font-semibold">Total across all addresses</div>
          <div className="text-xl font-semibold font-mono text-pearl-200 mt-1 leading-tight">
            {scan ? formatPearl(scan.balance, 8) : '—'} <span className="text-xs text-pearl-600 font-normal">PEARL</span>
          </div>
          {totalUsd != null && (
            <div className="text-xs text-pearl-600 font-mono">≈ ${fmtUsd(totalUsd)}</div>
          )}
          <div className="text-[11px] text-pearl-600 mt-0.5">
            {funded.length} funded · {utxoCount} unspent output{utxoCount === 1 ? '' : 's'}
          </div>
        </div>

        {/* Compound — compact */}
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-3">
          {confirm ? (
            <>
              <div className="text-xs text-pearl-500 leading-relaxed mb-2">
                Sweep {utxoCount} unspent outputs into your primary address. One fee.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCf(false)}
                  disabled={busy}
                  className="flex-1 rounded-lg py-2 text-sm border border-ink-700 text-pearl-300 hover:bg-ink-800"
                >Cancel</button>
                <button
                  onClick={doCompound}
                  disabled={busy}
                  className="pearl-btn flex-1 rounded-lg py-2 text-sm"
                >{busy ? 'Sweeping…' : 'Confirm'}</button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-pearl-200">Compound</div>
                <div className="text-[11px] text-pearl-600 truncate">
                  {utxoCount < 2 ? 'Already in one output' : `Sweep ${utxoCount} into one`}
                </div>
              </div>
              <button
                onClick={() => setCf(true)}
                disabled={!canCompound || busy}
                className="pearl-btn rounded-lg px-4 py-2 text-sm shrink-0"
              >Compound</button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable address list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold mb-2 px-1 flex items-center justify-between">
          <span>Your addresses</span>
          <span className="text-pearl-600">{visible.length}</span>
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
              <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                <div className="text-right shrink-0">
                  <div className={`font-mono text-xs font-semibold ${a.balance > 0n ? 'text-pearl-200' : 'text-pearl-700'}`}>
                    {formatPearl(a.balance, 4)}
                  </div>
                  {a.balance > 0n && priceUsd != null && (
                    <div className="font-mono text-[10px] text-pearl-600">
                      ${fmtUsd(grainsToPearl(a.balance) * priceUsd)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-pearl-600 leading-relaxed text-center mt-3 px-2">
          Tap an address to copy.
        </p>
      </div>
    </div>
  );
}
