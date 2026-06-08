// Backend dispatcher. The user can point the wallet at any pearlchain.live
// mirror OR any Blockbook v2 indexer; we sniff which protocol it speaks on
// first contact and route every subsequent call to the matching adapter.
//
// Public surface mirrors the per-adapter functions — components import from
// here and never touch blockbook.ts / pearlchain.ts directly.

import * as bb from './blockbook';
import * as pc from './pearlchain';
import type {
  AddressData, AddressTx, ExplorerStats, PriceData, PricePoint, ScanResult, TxDetail, UtxoDto,
} from './types';

export type { ScanResult, AddressTx, ExplorerStats, PriceData, PricePoint, TxDetail, UtxoDto, AddressData };

export type BackendMode = 'pearlchain' | 'blockbook';

const DEFAULT_BASE = 'https://pearlchain.live';

let _baseUrl: string = DEFAULT_BASE;
let _mode:    BackendMode = 'pearlchain';

export function getBaseUrl(): string { return _baseUrl; }
export function getBackendMode(): BackendMode { return _mode; }

export function setBackend(baseUrl: string, mode: BackendMode): void {
  _baseUrl = baseUrl.replace(/\/+$/, '');
  _mode = mode;
}

// Detect which backend a URL speaks. Returns null on total failure.
export async function detectBackend(rawUrl: string): Promise<{ url: string; mode: BackendMode } | null> {
  const url = rawUrl.trim().replace(/\/+$/, '');
  if (!url) return null;

  const [pearlR, bbR] = await Promise.allSettled([
    fetch(`${url}/api/explorer/stats`, { cache: 'no-store' }),
    fetch(`${url}/api/v2/`,            { cache: 'no-store' }),
  ]);
  if (pearlR.status === 'fulfilled' && pearlR.value.ok) return { url, mode: 'pearlchain' };
  if (bbR.status    === 'fulfilled' && bbR.value.ok)    return { url, mode: 'blockbook'  };
  return null;
}

// ── Dispatchers ──────────────────────────────────────────────────────────────
const base = () => _baseUrl;

export const getStats          = (): Promise<ExplorerStats | null> => _mode === 'blockbook' ? bb.getStats(base()) : pc.getStats(base());
export const getUtxos          = (addr: string): Promise<UtxoDto[]> => _mode === 'blockbook' ? bb.getUtxos(base(), addr) : pc.getUtxos(base(), addr);
export const scanAddresses     = (addrs: string[]): Promise<ScanResult[]> => _mode === 'blockbook' ? bb.scanAddresses(base(), addrs) : pc.scanAddresses(base(), addrs);
export const getAddress        = (addr: string, page = 0): Promise<AddressData | null> => _mode === 'blockbook' ? bb.getAddress(base(), addr, page) : pc.getAddress(base(), addr, page);
export const getWalletHistory  = (addrs: string[]): Promise<AddressTx[] | null> => _mode === 'blockbook' ? bb.getWalletHistory(base(), addrs) : pc.getWalletHistory(base(), addrs);
export const getPrice          = (): Promise<PriceData | null> => _mode === 'blockbook' ? bb.getPrice() : pc.getPrice(base());
// Price history is a pearlchain-only feature (Blockbook has no equivalent) — the chart hides when empty.
export const getPriceHistory   = (range = '7d'): Promise<PricePoint[]> => _mode === 'blockbook' ? Promise.resolve([]) : pc.getPriceHistory(base(), range);
// .pns resolution — pearlchain-only (Blockbook has no name service).
export const resolvePns        = (name: string): Promise<string | null> => _mode === 'blockbook' ? Promise.resolve(null) : pc.resolvePns(base(), name);
export const pnsForAddress     = (addr: string): Promise<string | null> => _mode === 'blockbook' ? Promise.resolve(null) : pc.pnsForAddress(base(), addr);
export const getTx             = (txid: string): Promise<TxDetail | null> => _mode === 'blockbook' ? bb.getTx(base(), txid) : pc.getTx(base(), txid);
export const broadcastTx       = (hex: string): Promise<{ txid?: string; error?: string }> => _mode === 'blockbook' ? bb.broadcastTx(base(), hex) : pc.broadcastTx(base(), hex);
