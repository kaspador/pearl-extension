// Adapter for pearlchain.live's explorer API. Endpoint paths mirror the
// mobile wallet's adapter (e:\VIBE\pearlchain-mobile\src\api\explorer.ts) —
// straying from those will silently return 0 balance / 404, which is
// exactly the bug we hit on v0.1.1.
//
// Endpoints we hit:
//   GET  /api/explorer/stats
//   GET  /api/explorer/utxos/:addr
//   POST /api/explorer/scan               { addresses: [...] }
//   GET  /api/explorer/address/:addr?page=N
//   POST /api/explorer/wallet-history     { addresses: [...] }
//   GET  /api/explorer/price
//   GET  /api/explorer/tx/:txid
//   POST /api/explorer/broadcast          { hex: '…' }

import type {
  AddressData, AddressTx, ExplorerStats, PriceData, PricePoint, ScanResult, TxDetail, UtxoDto,
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
    const r = await timedFetch(`${baseUrl}/api/explorer/utxos/${encodeURIComponent(addr)}`);
    if (!r.ok) return [];
    const d = await r.json() as { utxos?: UtxoDto[] };
    return d.utxos ?? [];
  } catch { return []; }
}

export async function scanAddresses(baseUrl: string, addresses: string[]): Promise<ScanResult[]> {
  if (addresses.length === 0) return [];
  try {
    // 15s timeout (scan is heavier than the per-address probe). Mobile uses
    // the same.
    const r = await timedFetch(`${baseUrl}/api/explorer/scan`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ addresses }),
    }, 15_000);
    if (!r.ok) return [];
    const d = await r.json() as { results?: ScanResult[] };
    return d.results ?? [];
  } catch {
    return [];
  }
}

export async function getAddress(baseUrl: string, addr: string, page = 0): Promise<AddressData | null> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/address/${encodeURIComponent(addr)}?page=${page}`);
    if (!r.ok) return null;
    return (await r.json()) as AddressData;
  } catch { return null; }
}

export async function getWalletHistory(baseUrl: string, addresses: string[], page = 0): Promise<AddressTx[] | null> {
  if (addresses.length === 0) return [];
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/wallet-history`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ addresses, page }),
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

export async function getPriceHistory(baseUrl: string, range = '7d'): Promise<PricePoint[]> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/price-history?range=${encodeURIComponent(range)}`);
    if (!r.ok) return [];
    const d = await r.json() as { points?: PricePoint[] };
    return d.points ?? [];
  } catch { return []; }
}

// Resolve a .pns name → address (null if unregistered/invalid).
export async function resolvePns(baseUrl: string, name: string): Promise<string | null> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/pns?name=${encodeURIComponent(name)}`);
    if (!r.ok) return null;
    const d = await r.json() as { found?: boolean; address?: string };
    return d.found && d.address ? d.address : null;
  } catch { return null; }
}

// Reverse: the .pns name that resolves to this address (for the Receive screen).
export async function pnsForAddress(baseUrl: string, address: string): Promise<string | null> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/pns?address=${encodeURIComponent(address)}`);
    if (!r.ok) return null;
    const d = await r.json() as { names?: { name: string; resolvesHere?: boolean }[] };
    const hit = d.names?.find(n => n.resolvesHere) ?? d.names?.[0];
    return hit?.name ?? null;
  } catch { return null; }
}

export interface OwnedPnsName {
  name:      string;
  inscTxid:  string;   // the coin (txid:vout) that carries the name — spent to transfer
  inscVout:  number;
}

// Every .pns name OWNED by an address (i.e. this address holds the inscription
// UTXO), with the coin reference needed to build a transfer. Names that merely
// resolve here but are owned elsewhere are excluded.
export async function pnsOwnedBy(baseUrl: string, address: string): Promise<OwnedPnsName[]> {
  try {
    const r = await timedFetch(`${baseUrl}/api/explorer/pns?address=${encodeURIComponent(address)}`);
    if (!r.ok) return [];
    const d = await r.json() as { names?: { name: string; owned?: boolean; inscTxid?: string; inscVout?: number }[] };
    return (d.names ?? [])
      .filter(n => n.owned && n.inscTxid != null && n.inscVout != null)
      .map(n => ({ name: n.name, inscTxid: n.inscTxid!, inscVout: n.inscVout! }));
  } catch { return []; }
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
