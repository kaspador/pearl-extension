// Receive: BIP-21 QR (with optional amount), full address with copy.

import { useState, useEffect } from 'react';
import { getCache } from '@/state/walletState';
import { pnsForAddress } from '@/api/client';
import { buildPaymentUri } from '@/pearl/network';
import { Qr } from '@/ui/Qr';
import { fmtUsd } from '@/ui/format';
import { toast } from '@/ui/Toast';
import { ScreenHeader } from '@/ui/ScreenHeader';

export function Receive({ onBack }: { onBack: () => void }) {
  const c = getCache();
  const address = c.scan?.receiveAddress ?? '';
  const [amount, setAmount] = useState('');
  const [pnsName, setPnsName] = useState<string | null>(null);

  // Show the .pns name that points at this address, if any.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    pnsForAddress(address).then(n => { if (!cancelled) setPnsName(n); });
    return () => { cancelled = true; };
  }, [address]);
  // Normalise comma → dot so European-locale users can type "0,01" too.
  const normalised = amount.replace(',', '.');
  const num = parseFloat(normalised);
  const validAmount = Number.isFinite(num) && num > 0;
  const uri = address
    ? buildPaymentUri(address, { amount: validAmount ? num : undefined })
    : '';
  const usdRequested = validAmount && c.priceUsd != null ? num * c.priceUsd : null;

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast('Address copied');
  }

  async function copyUri() {
    if (!uri) return;
    await navigator.clipboard.writeText(uri);
    toast('Payment URI copied');
  }

  return (
    <div className="flex-1 flex flex-col">
      <ScreenHeader title="Receive PEARL" onBack={onBack} />

      <div className="p-5 flex flex-col items-center gap-4 flex-1">
        {address ? (
          <Qr value={uri || address} size={200} />
        ) : (
          <div className="w-[200px] h-[200px] bg-ink-800 rounded-lg animate-pulse" />
        )}

        {pnsName ? (
          <button
            onClick={() => { navigator.clipboard.writeText(`${pnsName}.pns`); toast('Name copied'); }}
            className="text-sm font-semibold text-emerald-700 dark:text-emerald-400"
            title="Copy your .pns name"
          >
            {pnsName}.pns
          </button>
        ) : (
          <a href="https://pearlchain.live/pns" target="_blank" rel="noopener noreferrer"
             className="text-xs text-pearl-600 hover:text-pearl-400 underline decoration-pearl-700">
            Get a .pns name →
          </a>
        )}

        <button
          onClick={copyAddress}
          className="font-mono text-xs text-pearl-300 hover:text-pearl-200 text-center break-all max-w-[300px] leading-tight px-2"
          title="Copy address"
        >
          {address || '—'}
        </button>

        <label className="block w-full max-w-[280px]">
          <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Request amount (optional)</span>
          <div className="mt-1 flex">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              inputMode="decimal"
              className="flex-1 bg-ink-900 border border-ink-700 rounded-l-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
            />
            <span className="px-3 py-2 bg-ink-800 border border-ink-700 rounded-r-lg text-sm text-pearl-400">PEARL</span>
          </div>
          {usdRequested != null && (
            <div className="text-xs text-pearl-500 mt-1 text-right font-mono">
              ≈ ${fmtUsd(usdRequested)}
            </div>
          )}
        </label>

        {validAmount && (
          <button
            onClick={copyUri}
            className="text-xs text-pearl-500 hover:text-pearl-200 underline decoration-pearl-700"
          >
            Copy payment URI
          </button>
        )}
      </div>
    </div>
  );
}
