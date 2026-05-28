// Pearl network constants. Ported from pearlchain-mobile/src/pearl/network.ts.

export type PearlNetwork = 'mainnet' | 'testnet';

export const PEARL_NETWORKS = {
  mainnet: { name: 'mainnet' as const, hrp: 'prl',  coinType: 808276 },
  testnet: { name: 'testnet' as const, hrp: 'tprl', coinType: 1      },
} as const;

export type NetworkParams = (typeof PEARL_NETWORKS)[PearlNetwork];

export function getNetwork(n: PearlNetwork = 'mainnet'): NetworkParams { return PEARL_NETWORKS[n]; }

export const GRAIN_PER_PEARL = 100_000_000n;
export const DUST_LIMIT      = 546n;

export function pearlToGrains(pearl: number): bigint { return BigInt(Math.round(pearl * 1e8)); }
export function grainsToPearl(grains: bigint): number { return Number(grains) / 1e8; }

export function formatPearl(grains: bigint, decimals = 8): string {
  return grainsToPearl(grains).toLocaleString('en-US', {
    minimumFractionDigits: 0, maximumFractionDigits: decimals,
  });
}

export interface PaymentRequest { address: string; amount?: number; label?: string; message?: string }

export function buildPaymentUri(address: string, opts: { amount?: number; label?: string; message?: string } = {}): string {
  const parts: string[] = [];
  if (opts.amount && opts.amount > 0) parts.push(`amount=${encodeURIComponent(String(opts.amount))}`);
  if (opts.label)   parts.push(`label=${encodeURIComponent(opts.label)}`);
  if (opts.message) parts.push(`message=${encodeURIComponent(opts.message)}`);
  return `pearl:${address}${parts.length ? `?${parts.join('&')}` : ''}`;
}

export function parsePaymentUri(input: string): PaymentRequest | null {
  let s = (input ?? '').trim();
  if (!s) return null;
  if (s.toLowerCase().startsWith('pearl:')) s = s.slice(6);
  let address = s;
  let query = '';
  const q = s.indexOf('?');
  if (q !== -1) { address = s.slice(0, q); query = s.slice(q + 1); }
  const out: PaymentRequest = { address: address.trim() };
  if (query) {
    for (const part of query.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      const key = (eq < 0 ? part : part.slice(0, eq)).toLowerCase();
      const raw = eq < 0 ? '' : part.slice(eq + 1).replace(/\+/g, ' ');
      let val = raw;
      try { val = decodeURIComponent(raw); } catch { /* keep raw */ }
      if (key === 'amount') { const n = parseFloat(val); if (Number.isFinite(n) && n > 0) out.amount = n; }
      else if (key === 'label')   out.label   = val;
      else if (key === 'message') out.message = val;
    }
  }
  return out;
}
