// Send flow: paste address + amount + fee, review, sign & broadcast.

import { useState } from 'react';
import { isValidAddress } from '@/pearl/address';
import { parsePaymentUri, formatPearl, pearlToGrains } from '@/pearl/network';
import { buildAndSignTx } from '@/pearl/transaction';
import { broadcastTx } from '@/api/client';
import { getCache, refreshWallet } from '@/state/walletState';
import { getHD } from '@/state/session';
import { loadMeta } from '@/storage/vault';
import { shortAddr } from '@/ui/format';
import { toast } from '@/ui/Toast';

type Step = 'form' | 'review' | 'broadcast';

interface FeeTier { label: string; mult: number }
const TIERS: FeeTier[] = [
  { label: 'Economic', mult: 0.8 },
  { label: 'Standard', mult: 1.0 },
  { label: 'Priority', mult: 1.5 },
];

export function Send({ onBack, onSent }: { onBack: () => void; onSent: (txid: string) => void }) {
  const [step, setStep]         = useState<Step>('form');
  const [recipient, setRecip]   = useState('');
  const [amount, setAmount]     = useState('');
  const [tierIdx, setTierIdx]   = useState(1);
  const [busy, setBusy]         = useState(false);

  function onPasteRecipient(v: string) {
    const parsed = parsePaymentUri(v);
    if (parsed) {
      setRecip(parsed.address);
      if (parsed.amount && !amount) setAmount(String(parsed.amount));
    } else {
      setRecip(v);
    }
  }

  const c = getCache();
  const addrValid = isValidAddress(recipient.trim());
  const num = parseFloat(amount);
  const amountValid = Number.isFinite(num) && num > 0;
  const amountGrains = amountValid ? pearlToGrains(num) : 0n;
  const balance = c.scan?.balance ?? 0n;
  const hasFunds = amountValid && amountGrains <= balance;

  const baseFeeRate = BigInt(c.feeRate ?? 1);
  const feeRate     = BigInt(Math.max(1, Math.round(Number(baseFeeRate) * TIERS[tierIdx].mult)));

  async function doSend() {
    const hd = getHD();
    if (!hd || !c.scan) return;
    setBusy(true);
    try {
      const meta = await loadMeta();
      const network = meta?.network ?? 'mainnet';
      const tx = buildAndSignTx({
        hd, network,
        recipient: recipient.trim(),
        amount: amountGrains,
        utxos: c.scan.utxos,
        feeRate,
        changeAddress: c.scan.nextChangeAddress || c.scan.receiveAddress,
      });
      setStep('broadcast');
      const res = await broadcastTx(tx.hex);
      if (res.txid) {
        toast('Sent!');
        await refreshWallet();
        onSent(res.txid);
      } else {
        toast(res.error ?? 'Broadcast failed');
        setStep('review');
      }
    } catch (e) {
      toast((e as Error).message);
      setStep('review');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-700">
        <button onClick={() => step === 'form' ? onBack() : setStep('form')} className="text-pearl-500 hover:text-pearl-200 text-sm">←</button>
        <h1 className="text-base font-semibold text-pearl-200">Send PEARL</h1>
      </header>

      {step === 'form' && (
        <div className="p-5 flex flex-col gap-4 flex-1">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Recipient</span>
            <input
              value={recipient}
              onChange={(e) => onPasteRecipient(e.target.value)}
              placeholder="prl1p… or pearl: URI"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
            />
            {recipient && !addrValid && <div className="text-xs text-rose-700 dark:text-rose-400 mt-1">Invalid Pearl address</div>}
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold flex justify-between items-center">
              <span>Amount</span>
              <button
                onClick={() => c.scan && setAmount(formatPearl(c.scan.balance, 8).replace(/,/g, ''))}
                className="text-[11px] text-pearl-500 hover:text-pearl-200 underline decoration-pearl-700"
              >MAX</button>
            </span>
            <div className="mt-1 flex">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
                className="flex-1 bg-ink-900 border border-ink-700 rounded-l-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
              />
              <span className="px-3 py-2.5 bg-ink-800 border border-ink-700 rounded-r-lg text-sm text-pearl-400">PEARL</span>
            </div>
            <div className="text-xs text-pearl-600 mt-1">
              Balance: {c.scan ? formatPearl(c.scan.balance, 4) : '—'}
            </div>
            {amountValid && !hasFunds && <div className="text-xs text-rose-700 dark:text-rose-400 mt-1">Insufficient balance</div>}
          </label>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-pearl-600 mb-1.5 font-semibold">Fee</div>
            <div className="grid grid-cols-3 gap-2">
              {TIERS.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setTierIdx(i)}
                  className={`rounded-lg py-2 text-xs border ${
                    i === tierIdx
                      ? 'border-pearl-500 text-pearl-200 bg-ink-800'
                      : 'border-ink-700 text-pearl-500 hover:bg-ink-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {c.feeRate != null && (
              <div className="text-xs text-pearl-600 mt-1">≈ {String(feeRate)} grains/vB</div>
            )}
          </div>

          <button
            disabled={!addrValid || !hasFunds}
            onClick={() => setStep('review')}
            className="pearl-btn rounded-xl py-3 text-sm mt-auto"
          >
            Review &amp; send
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="p-5 flex flex-col gap-4 flex-1">
          <div className="bg-ink-900 border border-ink-700 rounded-xl p-4 space-y-3 text-sm">
            <Row label="To"     value={shortAddr(recipient.trim(), 14, 8)} mono />
            <Row label="Amount" value={`${formatPearl(amountGrains, 8)} PEARL`} />
            <Row label="Fee"    value={`${String(feeRate)} grains/vB (${TIERS[tierIdx].label})`} />
          </div>
          <p className="text-xs text-pearl-600 leading-relaxed">
            Pearl transactions are final once mined (~3 min). Double-check the address.
          </p>
          <button
            disabled={busy}
            onClick={doSend}
            className="pearl-btn rounded-xl py-3 text-sm mt-auto"
          >
            {busy ? 'Signing…' : 'Sign & broadcast'}
          </button>
        </div>
      )}

      {step === 'broadcast' && (
        <div className="p-5 flex-1 flex items-center justify-center text-sm text-pearl-500">
          Broadcasting…
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-pearl-600 text-[11px] uppercase tracking-wider font-semibold shrink-0 pt-0.5">{label}</span>
      <span className={`text-pearl-200 text-right ${mono ? 'font-mono' : ''} break-all`}>{value}</span>
    </div>
  );
}
