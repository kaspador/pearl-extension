// Cached wallet scan + price + fee snapshot. Held in-memory only — refreshed
// every popup open (and on demand). Mirrors mobile's walletState.

import type { WalletScan } from '@/pearl/hdwallet';
import { scanWallet } from '@/pearl/hdwallet';
import { getHD } from './session';
import { getStats, getPrice, getWalletHistory } from '@/api/client';
import type { AddressTx } from '@/api/client';
import { loadMeta } from '@/storage/vault';

interface CacheState {
  scan:     WalletScan | null;
  priceUsd: number | null;
  feeRate:  number | null;
  txs:      AddressTx[];
  lastSync: number;            // ms
  syncErr:  string | null;
}

const cache: CacheState = {
  scan: null, priceUsd: null, feeRate: null, txs: [], lastSync: 0, syncErr: null,
};

export function getCache(): CacheState { return cache; }

export async function refreshWallet(): Promise<void> {
  const hd = getHD();
  if (!hd) return;
  const meta = await loadMeta();
  const network = meta?.network ?? 'mainnet';
  try {
    const [scan, stats, price] = await Promise.all([
      scanWallet(hd, network),
      getStats(),
      getPrice(),
    ]);
    cache.scan     = scan;
    cache.priceUsd = price?.price ?? null;
    cache.feeRate  = stats?.recommendedFee ?? null;
    const addrs    = scan.addresses.map(a => a.address);
    const hist     = await getWalletHistory(addrs);
    if (hist) cache.txs = hist;
    cache.lastSync = Date.now();
    cache.syncErr  = null;
  } catch (e) {
    cache.syncErr  = (e as Error).message;
  }
}

export function clearCache(): void {
  cache.scan = null; cache.priceUsd = null; cache.feeRate = null;
  cache.txs = []; cache.lastSync = 0; cache.syncErr = null;
}
