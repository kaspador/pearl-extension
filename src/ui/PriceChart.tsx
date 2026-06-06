// Compact PRL/USD price sparkline for the dashboard. Ports the explorer's
// price spark: fetches the 7-day hourly series and draws a filled line, with
// the current price and the period change. Hides itself when there's no data
// (e.g. Blockbook backend, or a fresh deploy with no snapshots yet).

import { useEffect, useState } from 'react';
import { getPriceHistory, type PricePoint } from '@/api/client';
import { fmtUsd } from '@/ui/format';

export function PriceChart({ priceUsd }: { priceUsd: number | null }) {
  const [points, setPoints] = useState<PricePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPriceHistory('7d').then((p) => { if (!cancelled) setPoints(p); });
    return () => { cancelled = true; };
  }, []);

  if (points !== null && points.length < 2) return null;        // no series → hide
  const loading = points === null;

  let body: React.ReactNode = null;
  let changePct: number | null = null;
  let up = true;

  if (!loading && points) {
    const closes = points.map((p) => p.close);
    const first  = closes[0];
    const last   = closes[closes.length - 1];
    changePct = first > 0 ? ((last - first) / first) * 100 : null;
    up = (changePct ?? 0) >= 0;

    const W = 300, H = 56, PAD = 3;
    const min = Math.min(...closes), max = Math.max(...closes);
    const range = max - min || 1;
    const n = closes.length;
    const x = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);
    const y = (v: number) => PAD + (1 - (v - min) / range) * (H - 2 * PAD);
    const line = closes.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${line} L${x(n - 1).toFixed(1)},${(H - PAD).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD).toFixed(1)} Z`;
    const stroke = up ? 'rgb(16 185 129)' : 'rgb(244 63 94)';   // emerald / rose

    body = (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-14 block" aria-hidden="true">
        <defs>
          <linearGradient id="pricefill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pricefill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <div className="pearl-card px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-pearl-600 font-semibold">PRL / USD · 7D</div>
        <div className="flex items-center gap-2">
          {priceUsd != null && (
            <span className="text-xs font-mono text-pearl-300">${fmtUsd(priceUsd)}</span>
          )}
          {changePct != null && (
            <span className={`text-[11px] font-mono font-semibold ${up ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {up ? '+' : ''}{changePct.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      {loading ? <div className="h-14 animate-pulse rounded-lg bg-ink-800" /> : body}
    </div>
  );
}
