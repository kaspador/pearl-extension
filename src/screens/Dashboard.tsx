// Main wallet screen. Account switcher + gradient balance hero with an
// integrated receive chip, two action tiles, and a PRL/USD price chart.
// Transaction history lives in the Activity tab; Settings in the bottom nav.

import { useEffect, useState } from 'react';
import { lock } from '@/state/session';
import { getCache, refreshWallet } from '@/state/walletState';
import { formatPearl } from '@/pearl/network';
import { shortAddr, fmtUsd, timeAgo } from '@/ui/format';
import { toast } from '@/ui/Toast';
import { AccountSwitcher } from '@/ui/AccountSwitcher';
import { PriceChart } from '@/ui/PriceChart';
import { LockIcon, SendIcon, ReceiveIcon, CopyIcon, QrIcon, RefreshIcon } from '@/ui/icons';

export interface TxClickArgs {
  txid:        string;
  net:         number;
  direction:   'in' | 'out' | 'self';
  time:        number | null;
  blockHeight: number | null;
}

interface DashboardProps {
  onSend:        () => void;
  onReceive:     () => void;
  onLocked:      () => void;
  onAddAccount:  () => void;
}

export function Dashboard({ onSend, onReceive, onLocked, onAddAccount }: DashboardProps) {
  const [tick, setTick]             = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshWallet().then(() => setTick(t => t + 1));
    const id = window.setInterval(() => refreshWallet().then(() => setTick(t => t + 1)), 30_000);
    return () => clearInterval(id);
  }, []);

  async function manualRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try { await refreshWallet(); setTick(t => t + 1); }
    finally { setRefreshing(false); }
  }

  // Re-scan for the freshly-selected account, then re-render.
  async function onAccountChanged() {
    setRefreshing(true);
    try { await refreshWallet(); setTick(t => t + 1); }
    finally { setRefreshing(false); }
  }

  const c = getCache();
  const pearl   = c.scan ? formatPearl(c.scan.balance, 8) : '—';
  const usd     = c.scan && c.priceUsd != null ? Number(c.scan.balance) / 1e8 * c.priceUsd : null;
  const address = c.scan?.receiveAddress ?? '';

  async function lockNow() { await lock(); onLocked(); }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast('Address copied');
  }

  void tick;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header: account switcher + lock */}
      <header className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <AccountSwitcher onChanged={onAccountChanged} onAddAccount={onAddAccount} />
        <button onClick={lockNow} className="icon-badge tap w-9 h-9 hover:text-pearl-200" aria-label="Lock wallet">
          <LockIcon size={17} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Balance hero */}
        <section className="px-4 pt-2 shrink-0">
          <div className="hero-card px-5 pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.14em] text-pearl-600 font-semibold">Total balance</div>
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
              <span className="text-[30px] leading-none font-semibold font-mono text-pearl-200 tabular-nums tracking-tight truncate">{pearl}</span>
              <span className="text-sm text-pearl-500 font-medium">PEARL</span>
            </div>
            <div className="mt-1.5 text-sm text-pearl-500 font-medium">
              {usd != null ? `≈ $${fmtUsd(usd)}` : c.scan ? '' : 'Loading…'}
            </div>

            {/* Receive address chip */}
            <div className="mt-4 pt-3 border-t border-ink-700/70 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-pearl-600 font-semibold shrink-0">Receive</span>
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
            disabled={!c.scan || c.scan.balance === 0n}
            className="pearl-card tap flex flex-col items-center gap-1.5 py-3 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <span className="icon-badge w-9 h-9 text-pearl-200" style={{ backgroundColor: 'color-mix(in srgb, var(--color-pearl-700) 22%, transparent)' }}>
              <SendIcon size={17} />
            </span>
            <span className="text-xs font-semibold text-pearl-300">Send</span>
          </button>
          <button onClick={onReceive} className="pearl-card tap flex flex-col items-center gap-1.5 py-3">
            <span className="icon-badge badge-in w-9 h-9"><ReceiveIcon size={17} /></span>
            <span className="text-xs font-semibold text-pearl-300">Receive</span>
          </button>
        </div>

        {/* Price chart */}
        <section className="px-4 pt-3 pb-4">
          <PriceChart priceUsd={c.priceUsd ?? null} />
          {c.lastSync > 0 && (
            <div className="text-[10px] text-pearl-600 text-center mt-2">synced {timeAgo(Math.floor(c.lastSync / 1000))}</div>
          )}
        </section>
      </div>
    </div>
  );
}
