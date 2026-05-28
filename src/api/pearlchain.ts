// Adapter for pearlchain.live's explorer API. Ported from the mobile wallet's
// pearlchain code paths (formerly src/api/explorer.ts pre-blockbook split).
//
// Endpoints we hit:
//   GET  /api/explorer/stats
//   GET  /api/explorer/address/:addr/utxos
//   POST /api/explorer/scan-addresses     { addresses: [...] }
//   GET  /api/explorer/address/:addr?page=N
//   POST /api/explorer/wallet-history     { addresses: [...] }
//   GET  /api/explorer/price
//   GET  /api/explorer/tx/:txid
//   POST /api/explorer/broadcast          { hex: '…' }

import type {
  AddressData, AddressTx, ExplorerStats, PriceData, ScanResult, TxDetail, UtxoDto,
} from './types';

async function timedFetch(url: string, opts: RequestInit = {}, ms = 12_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { cache: 'no-store', ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

export async function getStats(baseUrl: string): Promise<ExplorerStats | null> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/stats`);
    if (!r.ok) return null;
    return (await r.json()) as ExplorerStats;
  } catch { return null; }
}

export async function getUtxos(baseUrl: string, addr: string): Promise<UtxoDto[]> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/address/${encodeURIComponent(addr)}/utxos`);
    if (!r.ok) return [];
    const d = await r.json() as { utxos?: UtxoDto[] };
    return d.utxos ?? [];
  } catch { return []; }
}

export async function scanAddresses(baseUrl: string, addresses: string[]): Promise<ScanResult[]> {
  if (addresses.length === 0) return [];
  try {
    const r = await fetch(`${baseUrl}/api/explorer/scan-addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses }),
    });
    if (!r.ok) return addresses.map(a => ({ address: a, used: false, balance: '0', utxos: [] }));
    const d = await r.json() as { results?: ScanResult[] };
    return d.results ?? [];
  } catch {
    return addresses.map(a => ({ address: a, used: false, balance: '0', utxos: [] }));
  }
}

export async function getAddress(baseUrl: string, addr: string, page = 0): Promise<AddressData | null> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/address/${encodeURIComponent(addr)}?page=${page}`);
    if (!r.ok) return null;
    return (await r.json()) as AddressData;
  } catch { return null; }
}

export async function getWalletHistory(baseUrl: string, addresses: string[]): Promise<AddressTx[] | null> {
  if (addresses.length === 0) return [];
  try {
    const r = await fetch(`${baseUrl}/api/explorer/wallet-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses }),
    });
    if (!r.ok) return null;
    const d = await r.json() as { transactions?: AddressTx[] };
    return d.transactions ?? [];
  } catch { return null; }
}

export async function getPrice(baseUrl: string): Promise<PriceData | null> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/price`);
    if (!r.ok) return null;
    const d = await r.json() as PriceData;
    return d;
  } catch { return null; }
}

export async function getTx(baseUrl: string, txid: string): Promise<TxDetail | null> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/tx/${encodeURIComponent(txid)}`);
    if (!r.ok) return null;
    return (await r.json()) as TxDetail;
  } catch { return null; }
}

export async function broadcastTx(baseUrl: string, hex: string): Promise<{ txid?: string; error?: string }> {
  try {
    const r = await fetch(`${baseUrl}/api/explorer/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hex }),
    });
    const text = await r.text();
    let data: { txid?: string; error?: string } | null = null;
    try { data = text ? JSON.parse(text) : null; } catch {
      return { error: `Network/gateway error (HTTP ${r.status}). Your tx may have been sent — check the explorer before retrying.` };
    }
    if (!r.ok) return { error: data?.error ?? `Broadcast failed (HTTP ${r.status}).` };
    if (data?.txid) return { txid: data.txid };
    return { error: data?.error ?? 'Broadcast failed (no txid).' };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
