// Receive: large QR (BIP-21 with optional amount), full address with copy.

import { useState } from 'react';
import { getCache } from '@/state/walletState';
import { buildPaymentUri } from '@/pearl/network';
import { Qr } from '@/ui/Qr';
import { toast } from '@/ui/Toast';

export function Receive({ onBack }: { onBack: () => void }) {
  const c = getCache();
  const address = c.scan?.receiveAddress ?? '';
  const [amount, setAmount] = useState('');
  const num = parseFloat(amount);
  const uri = address
    ? buildPaymentUri(address, { amount: Number.isFinite(num) && num > 0 ? num : undefined })
    : '';

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
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-800">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-200 text-xs">←</button>
        <h1 className="text-sm font-semibold">Receive PEARL</h1>
      </header>

      <div className="p-5 flex flex-col items-center gap-4 flex-1">
        {address ? (
          <Qr value={uri || address} size={192} />
        ) : (
          <div className="w-48 h-48 bg-ink-800 rounded-lg animate-pulse" />
        )}

        <button
          onClick={copyAddress}
          className="font-mono text-[11px] text-pearl-300 hover:text-pearl-200 text-center break-all max-w-[300px] leading-tight"
          title="Copy address"
        >
          {address || '—'}
        </button>

        <label className="block w-full max-w-[260px]">
          <span className="text-[10px] uppercase tracking-wider text-pearl-600">Request amount (optional)</span>
          <div className="mt-1 flex">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              inputMode="decimal"
              className="flex-1 bg-ink-800 border border-ink-700 rounded-l-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-pearl-700"
            />
            <span className="px-3 py-2 bg-ink-700 border border-ink-700 rounded-r-lg text-xs">PEARL</span>
          </div>
        </label>

        {amount && Number.isFinite(num) && num > 0 && (
          <button
            onClick={copyUri}
            className="text-[10px] text-pearl-500 hover:text-pearl-200 underline decoration-pearl-800"
          >
            Copy payment URI
          </button>
        )}
      </div>
    </div>
  );
}
