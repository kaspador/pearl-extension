// Main wallet screen. Gradient balance hero with an integrated receive chip,
// two tactile action tiles, and an activity list with tinted directional
// icon badges. Activity scrolls when it overflows.

import { useEffect, useState } from 'react';
import { lock } from '@/state/session';
import { getCache, refreshWallet } from '@/state/walletState';
import { formatPearl, grainsToPearl } from '@/pearl/network';
import { shortAddr, fmtUsd, timeAgo } from '@/ui/format';
import { toast } from '@/ui/Toast';
import {
  SettingsIcon, LockIcon, SendIcon, ReceiveIcon, CopyIcon, QrIcon, RefreshIcon,
} from '@/ui/icons';

export interface TxClickArgs {
  txid:        string;
  net:         number;
  direction:   'in' | 'out' | 'self';
  time:        number | null;
  blockHeight: number | null;
}

interface DashboardProps {
  onSend:     () => void;
  onReceive:  () => void;
  onSettings: () => void;
  onLocked:   () => void;
  onOpenTx:   (args: TxClickArgs) => void;
}

export function Dashboard({ onSend, onReceive, onSettings, onLocked, onOpenTx }: DashboardProps) {
  const [tick, setTick]         = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshWallet().then(() => setTick(t => t + 1));
    const id = window.setInterval(() => {
      refreshWallet().then(() => setTick(t => t + 1));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  async function manualRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try { await refreshWallet(); setTick(t => t + 1); }
    finally { setRefreshing(false); }
  }

  const c = getCache();
  const pearl    = c.scan ? formatPearl(c.scan.balance, 8) : '—';
  const usd      = c.scan && c.priceUsd != null
    ? Number(c.scan.balance) / 1e8 * c.priceUsd : null;
  const address  = c.scan?.receiveAddress ?? '';
  const recent   = c.txs;
  const noFunds  = !c.scan || c.scan.balance === 0n;

  async function lockNow() { await lock(); onLocked(); }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast('Address copied');
  }

  void tick;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <header className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={onSettings}
          className="icon-badge tap w-9 h-9 hover:text-pearl-200"
          aria-label="Settings"
        >
          <SettingsIcon size={18} />
        </button>
        <div className="text-sm font-semibold text-pearl-200 tracking-tight">Pearl Wallet</div>
        <button
          onClick={lockNow}
          className="icon-badge tap w-9 h-9 hover:text-pearl-200"
          aria-label="Lock wallet"
        >
          <LockIcon size={17} />
        </button>
      </header>

      {/* Balance hero */}
      <section className="px-4 pt-2 shrink-0">
        <div className="hero-card px-5 pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.14em] text-pearl-600 font-semibold">
              Total balance
            </div>
            <button
              onClick={manualRefresh}
              disabled={refreshing}
              className="icon-badge tap w-7 h-7 hover:text-pearl-200"
              aria-label="Refresh balance"
              title="Refresh"
            >
              <RefreshIcon size={13} className={refreshing ? 'spin' : ''} />
            </button>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] leading-none font-semibold font-mono text-pearl-200 tabular-nums tracking-tight truncate">
              {pearl}
            </span>
            <span className="text-sm text-pearl-500 font-medium">PEARL</span>
          </div>
          <div className="mt-1.5 text-sm text-pearl-500 font-medium">
            {usd != null ? `≈ $${fmtUsd(usd)}` : c.scan ? '' : 'Loading…'}
          </div>

          {/* Receive address chip */}
          <div className="mt-4 pt-3 border-t border-ink-700/70 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-pearl-600 font-semibold shrink-0">
              Receive
            </span>
            <span className="font-mono text-xs text-pearl-400 truncate flex-1" title={address || ''}>
              {address ? shortAddr(address, 12, 8) : '—'}
            </span>
            <button onClick={copyAddress} className="icon-badge tap w-7 h-7 hover:text-pearl-200" aria-label="Copy address">
              <CopyIcon size={13} />
            </button>
            <button onClick={onReceive} className="icon-badge tap w-7 h-7 hover:text-pearl-200" aria-label="Show QR code">
              <QrIcon size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* Action tiles */}
      <div className="px-4 pt-3 grid grid-cols-2 gap-2.5 shrink-0">
        <button
          onClick={onSend}
          disabled={noFunds}
          className="pearl-card tap flex flex-col items-center gap-1.5 py-3 disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <span className="icon-badge w-9 h-9 text-pearl-200" style={{ backgroundColor: 'color-mix(in srgb, var(--color-pearl-700) 22%, transparent)' }}>
            <SendIcon size={17} />
          </span>
          <span className="text-xs font-semibold text-pearl-300">Send</span>
        </button>
        <button
          onClick={onReceive}
          className="pearl-card tap flex flex-col items-center gap-1.5 py-3"
        >
          <span className="icon-badge badge-in w-9 h-9">
            <ReceiveIcon size={17} />
          </span>
          <span className="text-xs font-semibold text-pearl-300">Receive</span>
        </button>
      </div>

      {/* Activity */}
      <section className="px-4 pt-4 pb-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2 px-1 shrink-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-pearl-600 font-semibold">
            Activity
          </div>
          {c.lastSync > 0 && (
            <span className="text-[10px] text-pearl-600">
              synced {timeAgo(Math.floor(c.lastSync / 1000))}
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {recent.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-1 text-pearl-600">
              <span className="icon-badge w-10 h-10 mb-1"><ReceiveIcon size={18} /></span>
              <div className="text-sm font-medium text-pearl-500">
                {c.scan ? 'No activity yet' : 'Loading…'}
              </div>
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
                      onClick={() => onOpenTx({
                        txid: tx.txid, net: tx.net, direction: tx.direction,
                        time: tx.time, blockHeight: tx.blockHeight,
                      })}
                      className="tap w-full flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-ink-800"
                    >
                      <span className={`icon-badge ${badge} w-9 h-9 shrink-0`}>
                        {tx.direction === 'out'
                          ? <SendIcon size={15} />
                          : <ReceiveIcon size={15} />}
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="text-sm font-semibold text-pearl-200">
                          {tx.direction === 'in' ? 'Received' : tx.direction === 'out' ? 'Sent' : 'Self'}
                        </div>
                        {tx.confirmed ? (
                          <div className="text-[11px] text-pearl-600 truncate">
                            {tx.time ? timeAgo(tx.time) : 'confirmed'}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-mono text-sm font-medium tabular-nums ${amtColor}`}>
                          {sign}{pearlAmt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })}
                        </div>
                        {txUsd != null && (
                          <div className="font-mono text-[10px] text-pearl-600 tabular-nums">
                            {sign}${fmtUsd(txUsd)}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
