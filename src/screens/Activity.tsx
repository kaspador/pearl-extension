// Activity tab — the wallet's transaction history for the selected account.
// Moved out of the dashboard into its own bottom-nav tab.

import { useEffect, useState } from 'react';
import { getCache, refreshWallet } from '@/state/walletState';
import { grainsToPearl } from '@/pearl/network';
import { fmtUsd, timeAgo } from '@/ui/format';
import { SendIcon, ReceiveIcon } from '@/ui/icons';
import type { TxClickArgs } from '@/screens/Dashboard';

export function Activity({ onOpenTx }: { onOpenTx: (args: TxClickArgs) => void }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    refreshWallet().then(() => setTick(t => t + 1));
    const id = window.setInterval(() => refreshWallet().then(() => setTick(t => t + 1)), 30_000);
    return () => clearInterval(id);
  }, []);

  const c = getCache();
  const recent = c.txs;
  void tick;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div className="text-sm font-semibold text-pearl-200 tracking-tight">Activity</div>
        {c.lastSync > 0 && (
          <span className="text-[10px] text-pearl-600">synced {timeAgo(Math.floor(c.lastSync / 1000))}</span>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">
        {recent.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-1 text-pearl-600">
            <span className="icon-badge w-10 h-10 mb-1"><ReceiveIcon size={18} /></span>
            <div className="text-sm font-medium text-pearl-500">{c.scan ? 'No activity yet' : 'Loading…'}</div>
            {c.scan && <div className="text-xs text-pearl-700">Your transactions will show up here.</div>}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {recent.map(tx => {
              const pearlAmt = Math.abs(grainsToPearl(BigInt(Math.round(tx.net))));
              const sign  = tx.direction === 'in' ? '+' : tx.direction === 'out' ? '−' : '';
              const txUsd = c.priceUsd != null ? pearlAmt * c.priceUsd : null;
              const badge = tx.direction === 'in' ? 'badge-in' : tx.direction === 'out' ? 'badge-out' : 'badge-self';
              const amtColor =
                tx.direction === 'in'  ? 'text-emerald-700 dark:text-emerald-400'
              : tx.direction === 'out' ? 'text-pearl-200'
              :                          'text-pearl-400';
              return (
                <li key={tx.txid}>
                  <button
                    onClick={() => onOpenTx({ txid: tx.txid, net: tx.net, direction: tx.direction, time: tx.time, blockHeight: tx.blockHeight })}
                    className="tap w-full flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-ink-800"
                  >
                    <span className={`icon-badge ${badge} w-9 h-9 shrink-0`}>
                      {tx.direction === 'out' ? <SendIcon size={15} /> : <ReceiveIcon size={15} />}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-sm font-semibold text-pearl-200">
                        {tx.direction === 'in' ? 'Received' : tx.direction === 'out' ? 'Sent' : 'Self'}
                      </div>
                      {tx.confirmed ? (
                        <div className="text-[11px] text-pearl-600 truncate">{tx.time ? timeAgo(tx.time) : 'confirmed'}</div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-mono text-sm font-medium tabular-nums ${amtColor}`}>
                        {sign}{pearlAmt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })}
                      </div>
                      {txUsd != null && (
                        <div className="font-mono text-[10px] text-pearl-600 tabular-nums">{sign}${fmtUsd(txUsd)}</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
