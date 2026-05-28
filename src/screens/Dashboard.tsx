// Main wallet screen. Layout mirrors the mobile wallet's main screen.

import { useEffect, useState } from 'react';
import { lock } from '@/state/session';
import { getCache, refreshWallet } from '@/state/walletState';
import { formatPearl, grainsToPearl } from '@/pearl/network';
import { shortAddr, fmtUsd, timeAgo } from '@/ui/format';
import { toast } from '@/ui/Toast';

interface DashboardProps {
  onSend:     () => void;
  onReceive:  () => void;
  onSettings: () => void;
  onLocked:   () => void;
}

export function Dashboard({ onSend, onReceive, onSettings, onLocked }: DashboardProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Refresh on mount and then every 30s while the popup is open.
    refreshWallet().then(() => setTick(t => t + 1));
    const id = window.setInterval(() => {
      refreshWallet().then(() => setTick(t => t + 1));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const c = getCache();
  const pearl    = c.scan ? formatPearl(c.scan.balance, 8) : '—';
  const usd      = c.scan && c.priceUsd != null
    ? Number(c.scan.balance) / 1e8 * c.priceUsd : null;
  const address  = c.scan?.receiveAddress ?? '';
  const recent   = c.txs.slice(0, 5);

  function lockNow() {
    lock();
    onLocked();
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast('Address copied');
  }

  // unused mount tick — keeps re-render predictable
  void tick;

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-ink-800">
        <button onClick={onSettings} className="text-pearl-500 hover:text-pearl-200 text-base p-1 -m-1" aria-label="Settings">⚙</button>
        <div className="text-[10px] uppercase tracking-wider text-pearl-700">Pearl Wallet</div>
        <button onClick={lockNow} className="text-pearl-500 hover:text-pearl-200 text-sm p-1 -m-1" aria-label="Lock">🔒</button>
      </header>

      <section className="px-5 pt-5 pb-3 text-center">
        <div className="text-[10px] uppercase tracking-wider text-pearl-600">Balance</div>
        <div className="text-3xl font-semibold mt-1 font-mono text-pearl-200">
          {pearl} <span className="text-base font-normal text-pearl-600">PEARL</span>
        </div>
        <div className="text-xs text-pearl-600 mt-0.5">≈ ${fmtUsd(usd)}</div>
      </section>

      <div className="mx-5 mb-4 bg-ink-900 border border-ink-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-pearl-700 shrink-0">Receive</span>
        <span className="font-mono text-xs text-pearl-300 truncate flex-1" title={address || ''}>
          {address ? shortAddr(address, 10, 6) : '—'}
        </span>
        <button onClick={copyAddress} className="text-pearl-500 hover:text-pearl-200 text-xs shrink-0" aria-label="Copy address">⧉</button>
        <button onClick={onReceive} className="text-pearl-500 hover:text-pearl-200 text-xs shrink-0" aria-label="Show QR">▦</button>
      </div>

      <div className="px-5 grid grid-cols-2 gap-3 mb-5">
        <button onClick={onSend} className="pearl-btn rounded-xl py-2.5 text-sm" disabled={!c.scan || c.scan.balance === 0n}>↑ Send</button>
        <button onClick={onReceive} className="rounded-xl py-2.5 text-sm border border-ink-700 hover:bg-ink-800 text-pearl-300">↓ Receive</button>
      </div>

      <section className="px-5 pb-4 flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-pearl-600">Recent activity</div>
          {c.lastSync > 0 && (
            <span className="text-[10px] text-pearl-700">
              synced {timeAgo(Math.floor(c.lastSync / 1000))}
            </span>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="text-xs text-pearl-700 py-8 text-center">
            {c.scan ? 'No activity yet.' : 'Loading…'}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {recent.map(tx => {
              // Both backends return tx amounts in grains (smallest unit).
              // Convert to PEARL for display.
              const pearlAmt = Math.abs(grainsToPearl(BigInt(Math.round(tx.net))));
              const sign = tx.direction === 'in' ? '+' : tx.direction === 'out' ? '−' : '';
              return (
                <li key={tx.txid} className="flex items-center justify-between text-xs">
                  <div>
                    <div className={
                      tx.direction === 'in'  ? 'text-emerald-700 dark:text-emerald-400'
                    : tx.direction === 'out' ? 'text-rose-700 dark:text-rose-400'
                    :                          'text-pearl-400'
                    }>
                      {tx.direction === 'in' ? '↓ Received' : tx.direction === 'out' ? '↑ Sent' : '↔ Self'}
                    </div>
                    <div className="text-[10px] text-pearl-700">{tx.time ? timeAgo(tx.time) : (tx.confirmed ? '' : 'pending')}</div>
                  </div>
                  <div className="font-mono text-pearl-200">
                    {sign}{pearlAmt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} <span className="text-[10px] text-pearl-600">PEARL</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
