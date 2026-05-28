// Transaction detail — opened by tapping a row in the activity list.
//
// Layout: fixed header on top, scrollable content middle, pinned
// "View on Explorer" CTA on bottom. The CTA NEVER scrolls off — the
// content area scrolls inside its flex region.

import { useEffect, useState } from 'react';
import { getTx, type TxDetail as TxDetailDto, getBaseUrl } from '@/api/client';
import { formatPearl, grainsToPearl } from '@/pearl/network';
import { getCache } from '@/state/walletState';
import { shortAddr } from '@/ui/format';
import { toast } from '@/ui/Toast';

interface Props {
  txid:      string;
  net:       number;
  direction: 'in' | 'out' | 'self';
  time:      number | null;
  blockHeight: number | null;
  onBack:    () => void;
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function TxDetail({ txid, net, direction, time, blockHeight, onBack }: Props) {
  const [detail, setDetail]   = useState<TxDetailDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getTx(txid);
      if (!cancelled) { setDetail(d); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [txid]);

  const c       = getCache();
  const priceUsd = c.priceUsd ?? null;
  const out     = direction === 'out';
  const self    = direction === 'self';
  const magnitude = BigInt(Math.abs(Math.round(net)));
  const pearlAmt = grainsToPearl(magnitude);
  const usd     = priceUsd != null ? pearlAmt * priceUsd : null;

  const block   = detail?.blockHeight ?? blockHeight;
  const blockTime = detail?.blockTime ?? time;
  const confs   = detail?.confirmations ?? null;
  const fee     = detail?.fee ?? null;

  const label  = detail?.isCoinbase ? 'Mined' : self ? 'Self-transfer' : out ? 'Sent' : 'Received';
  const sign   = self ? '' : out ? '−' : '+';
  const dirColor = self
    ? 'text-pearl-400'
    : out ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400';

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
  }

  function openExplorer() {
    const url = `${getBaseUrl()}/explorer/tx/${txid}`;
    chrome.tabs.create({ url });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-ink-700 shrink-0">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-200 text-sm">←</button>
        <h1 className="text-base font-semibold text-pearl-200">Transaction</h1>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {/* Amount header */}
        <div className="text-center py-2">
          <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">{label}</div>
          <div className={`text-2xl font-semibold font-mono mt-1 ${dirColor}`}>
            {sign}{formatPearl(magnitude, 8)} <span className="text-sm text-pearl-600 font-normal">PEARL</span>
          </div>
          {usd != null && (
            <div className="text-xs text-pearl-600 font-mono mt-0.5">
              ≈ ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>

        {/* Status / block / date / fee */}
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-3 space-y-2 text-xs">
          <Row label="Status" value={
            confs == null ? (block ? 'Confirmed' : 'Pending')
            : confs > 0   ? `Confirmed · ${confs.toLocaleString()} conf`
            : 'Pending'
          } emerald={!!(block || (confs ?? 0) > 0)} />
          {block != null     && <Row label="Block" value={`#${block.toLocaleString()}`} />}
          {blockTime != null && <Row label="Date"  value={fmtDate(blockTime)} />}
          {out && fee != null && (
            <Row label="Network fee" value={`${formatPearl(BigInt(fee), 8)} PEARL`} />
          )}
          {loading && <div className="text-[11px] text-pearl-600">loading details…</div>}
        </div>

        {/* Inputs / outputs */}
        {detail && (detail.vin.length > 0 || detail.vout.length > 0) && (
          <div className="bg-ink-900 border border-ink-700 rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold mb-2">
              Inputs ({detail.vin.length})
            </div>
            <div className="space-y-1.5 mb-3">
              {detail.vin.map((v, i) => (
                <div key={`in${i}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-pearl-400 truncate">
                    {v.isCoinbase ? 'Coinbase (newly minted)' : shortAddr(v.address ?? '—', 12, 6)}
                  </span>
                  <span className="font-mono text-rose-700 dark:text-rose-400 shrink-0">
                    {v.value != null ? `−${formatPearl(BigInt(v.value), 4)}` : '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold mb-2">
              Outputs ({detail.vout.length})
            </div>
            <div className="space-y-1.5">
              {detail.vout.map((v) => (
                <div key={`out${v.n}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-pearl-400 truncate">
                    {shortAddr(v.address ?? '—', 12, 6)}
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
                    +{formatPearl(BigInt(v.value), 4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TXID — shortened so it sits on one line, full hex copied on click */}
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">Transaction ID</div>
            <button
              onClick={() => copy(txid, 'Transaction ID')}
              className="text-[11px] text-pearl-500 hover:text-pearl-200 underline decoration-pearl-700"
            >
              Copy
            </button>
          </div>
          <div className="font-mono text-xs text-pearl-300 truncate">
            {txid.slice(0, 16)}…{txid.slice(-12)}
          </div>
        </div>
      </div>

      {/* Pinned CTA — never scrolls off */}
      <div className="px-4 pt-2 pb-4 border-t border-ink-700 shrink-0">
        <button onClick={openExplorer} className="pearl-btn rounded-xl py-3 text-sm w-full">
          View on Explorer ↗
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, emerald }: { label: string; value: string; emerald?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-pearl-600">{label}</span>
      <span className={`font-mono text-right ${emerald ? 'text-emerald-700 dark:text-emerald-400' : 'text-pearl-200'}`}>{value}</span>
    </div>
  );
}
