// Send flow: paste address + amount + fee, review, sign & broadcast.

import { useState } from 'react';
import { isValidAddress } from '@/pearl/address';
import { parsePaymentUri, formatPearl, pearlToGrains } from '@/pearl/network';
import { buildAndSignTx } from '@/pearl/transaction';
import { broadcastTx } from '@/api/client';
import { getCache, refreshWallet } from '@/state/walletState';
import { getHD } from '@/state/session';
import { loadMeta } from '@/storage/vault';
import { toast } from '@/ui/Toast';

type Step = 'form' | 'review' | 'broadcast';

interface FeeTier { label: string; mult: number }
const TIERS: FeeTier[] = [
  { label: 'Economic', mult: 0.8 },
  { label: 'Standard', mult: 1.0 },
  { label: 'Priority', mult: 1.5 },
];

// Pearl Taproot tx vbyte estimate. Matches the formula in pearl/transaction.ts
// (58·inputs + 43·outputs + 11). For the fee preview we assume the common
// case: 1 input + 2 outputs (recipient + change) = 155 vB.
const PREVIEW_VBYTES = 58n + 43n * 2n + 11n;  // 155

// Sanitise free-form amount input. Accepts both `,` and `.` as decimal
// separators (European locale users typed "0,01" and the parse failed),
// strips anything else, and caps at 8 decimal places (PEARL grain
// precision — anything past that is lost when we convert to grains).
function sanitiseAmount(raw: string): string {
  // Normalise the decimal separator to `.`
  let s = raw.replace(',', '.');
  // Strip everything that isn't a digit or a dot
  s = s.replace(/[^\d.]/g, '');
  // Collapse multiple dots to the first one
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    // Cap fractional digits at 8
    const [whole, frac = ''] = s.split('.');
    s = whole + '.' + frac.slice(0, 8);
    // Strip trailing dot if no fractional digits (allows mid-edit "1.")
    if (s.endsWith('.') && frac.length === 0) {
      // Keep the dot so the user can keep typing
    }
  }
  return s;
}

// Parse the sanitised string into a number. Empty / dot-only → NaN.
function parseAmount(s: string): number {
  if (!s || s === '.') return NaN;
  return parseFloat(s);
}

interface SendProps {
  onBack:     () => void;
  onSent:     (txid: string) => void;
  onPickContact: () => void;
  initialRecipient?: string;
  initialAmount?:    string;
}

export function Send({ onBack, onSent, onPickContact, initialRecipient, initialAmount }: SendProps) {
  const [step, setStep]         = useState<Step>('form');
  const [recipient, setRecip]   = useState(initialRecipient ?? '');
  const [amount, setAmount]     = useState(() => sanitiseAmount(initialAmount ?? ''));
  const [tierIdx, setTierIdx]   = useState(1);
  const [busy, setBusy]         = useState(false);

  function onPasteRecipient(v: string) {
    const parsed = parsePaymentUri(v);
    if (parsed) {
      setRecip(parsed.address);
      if (parsed.amount && !amount) setAmount(sanitiseAmount(String(parsed.amount)));
    } else {
      setRecip(v);
    }
  }

  const c = getCache();
  const addrValid = isValidAddress(recipient.trim());
  const num = parseAmount(amount);
  const amountValid = Number.isFinite(num) && num > 0;
  const amountGrains = amountValid ? pearlToGrains(num) : 0n;
  const balance = c.scan?.balance ?? 0n;
  const hasFunds = amountValid && amountGrains <= balance;

  const baseFeeRate = BigInt(c.feeRate ?? 1);

  function rateFor(i: number): bigint {
    return BigInt(Math.max(1, Math.round(Number(baseFeeRate) * TIERS[i].mult)));
  }
  function estFeeGrains(i: number): bigint {
    return rateFor(i) * PREVIEW_VBYTES;
  }

  const feeRate     = rateFor(tierIdx);
  const feeEst      = estFeeGrains(tierIdx);

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
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-700 shrink-0">
        <button onClick={() => step === 'form' ? onBack() : setStep('form')} className="text-pearl-500 hover:text-pearl-200 text-sm">←</button>
        <h1 className="text-base font-semibold text-pearl-200">Send PEARL</h1>
      </header>

      {step === 'form' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold flex justify-between items-center">
              <span>Recipient</span>
              <button
                onClick={onPickContact}
                className="text-[11px] text-pearl-500 hover:text-pearl-200 underline decoration-pearl-700"
                type="button"
              >From contacts</button>
            </span>
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
                onClick={() => c.scan && setAmount(sanitiseAmount(formatPearl(c.scan.balance, 8).replace(/,/g, '')))}
                className="text-[11px] text-pearl-500 hover:text-pearl-200 underline decoration-pearl-700"
                type="button"
              >MAX</button>
            </span>
            <div className="mt-1 flex">
              <input
                value={amount}
                onChange={(e) => setAmount(sanitiseAmount(e.target.value))}
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
              {TIERS.map((t, i) => {
                const est = estFeeGrains(i);
                return (
                  <button
                    key={t.label}
                    onClick={() => setTierIdx(i)}
                    className={`rounded-lg py-2 px-2 text-xs border flex flex-col items-center gap-0.5 ${
                      i === tierIdx
                        ? 'border-pearl-300 dark:border-pearl-500 text-pearl-200 bg-ink-800 font-medium'
                        : 'border-ink-700 text-pearl-500 hover:bg-ink-800'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className="font-mono text-[10px] text-pearl-500">
                      ~{formatPearl(est, 8)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-pearl-600 mt-1.5 flex justify-between">
              <span>{String(feeRate)} grains/vB</span>
              <span>Est. fee: <span className="text-pearl-400 font-mono">{formatPearl(feeEst, 8)} PEARL</span></span>
            </div>
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
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
            <div className="bg-ink-900 border border-ink-700 rounded-xl p-4 space-y-3 text-sm">
              {/* Full address — wraps onto multiple lines, monospace, full hex. */}
              <div>
                <div className="text-pearl-600 text-[11px] uppercase tracking-wider font-semibold mb-1">To</div>
                <div className="font-mono text-xs text-pearl-200 break-all leading-relaxed">
                  {recipient.trim()}
                </div>
              </div>
              <Row label="Amount"      value={`${formatPearl(amountGrains, 8)} PEARL`} />
              <Row label="Network fee" value={`~${formatPearl(feeEst, 8)} PEARL (${TIERS[tierIdx].label})`} />
              <Row label="Fee rate"    value={`${String(feeRate)} grains/vB`} mono />
            </div>
            <p className="text-xs text-pearl-600 leading-relaxed">
              Pearl transactions are final once mined (~3 min). Double-check the address above before signing.
            </p>
          </div>
          <div className="px-5 pt-2 pb-4 border-t border-ink-700 shrink-0">
            <button
              disabled={busy}
              onClick={doSend}
              className="pearl-btn rounded-xl py-3 text-sm w-full"
            >
              {busy ? 'Signing…' : 'Sign & broadcast'}
            </button>
          </div>
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
