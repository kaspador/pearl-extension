// Cached wallet scan + price + fee snapshot. Held in-memory only — refreshed
// every popup open (and on demand). Mirrors mobile's walletState.

import type { WalletScan } from '@/pearl/hdwallet';
import { getHD } from './session';
import { scanCurrentAccount } from './accounts';
import { getStats, getPrice, getWalletHistory, pnsOwnedByStrict } from '@/api/client';
import { resolveProtectedCoins } from './protectedCoins';
import type { AddressTx } from '@/api/client';
import { loadMeta, selectedAccount, type AccountDescriptor } from '@/storage/vault';

interface CacheState {
  scan:     WalletScan | null;
  account:  AccountDescriptor | null;
  priceUsd: number | null;
  feeRate:  number | null;
  txs:      AddressTx[];
  lastSync: number;            // ms
  syncErr:  string | null;
  // Coins holding .pns names ("txid:vout"), excluded from sends and sweeps.
  protectedOutpoints: Set<string>;
  // False when the name index could not be fully checked on the last refresh.
  namesVerified: boolean;
}

const cache: CacheState = {
  scan: null, account: null, priceUsd: null, feeRate: null, txs: [], lastSync: 0, syncErr: null,
  protectedOutpoints: new Set(), namesVerified: false,
};

export function getCache(): CacheState { return cache; }

export async function refreshWallet(): Promise<void> {
  const hd = getHD();
  if (!hd) return;
  const meta = await loadMeta();
  const network = meta?.network ?? 'mainnet';
  try {
    cache.account = await selectedAccount();
    const [scan, stats, price] = await Promise.all([
      scanCurrentAccount(network),
      getStats(),
      getPrice(),
    ]);
    // Resolve name coins BEFORE publishing the scan, so no screen ever sees
    // coins without knowing which of them are protected.
    const prot = cache.account
      ? await resolveProtectedCoins(cache.account.id, scan.utxos.map(u => u.address), pnsOwnedByStrict)
      : { outpoints: new Set<string>(), verified: false };
    cache.protectedOutpoints = prot.outpoints;
    cache.namesVerified      = prot.verified;
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
  cache.scan = null; cache.account = null; cache.priceUsd = null; cache.feeRate = null;
  cache.txs = []; cache.lastSync = 0; cache.syncErr = null;
  cache.protectedOutpoints = new Set(); cache.namesVerified = false;
}
