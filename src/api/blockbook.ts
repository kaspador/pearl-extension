// Blockbook v2 adapter. Trezor's open-source Bitcoin-fork indexer; the Pearl
// instance lives at https://blockbook.pearlresearch.ai (no auth).
// Ported from pearlchain-mobile/src/api/blockbook.ts unchanged in behaviour.

import type {
  AddressData, AddressTx, ExplorerStats, PriceData, ScanResult, TxDetail,
  TxVin, TxVout, UtxoDto,
} from './types';

interface BBInfo {
  blockbook?: { coin?: string; bestHeight?: number; inSync?: boolean; mempoolSize?: number };
  backend?:   { chain?: string; blocks?: number; difficulty?: string; subversion?: string };
}
interface BBTxInput  {
  txid?: string; vout?: number; n?: number;
  addresses?: string[]; isAddress?: boolean;
  value?: string; coinbase?: string;
}
interface BBTxOutput { value: string; n: number; addresses?: string[]; isAddress?: boolean; hex?: string }
interface BBTx {
  txid: string; vin: BBTxInput[]; vout: BBTxOutput[];
  blockHash?: string; blockHeight?: number; confirmations?: number; blockTime?: number;
  size?: number; vsize?: number; fees?: string;
}
interface BBAddress {
  address: string; balance?: string;
  totalReceived?: string; totalSent?: string;
  unconfirmedBalance?: string; unconfirmedTxs?: number;
  txs?: number; transactions?: BBTx[]; txids?: string[];
  page?: number; totalPages?: number; itemsOnPage?: number;
}
interface BBUtxo { txid: string; vout: number; value: string; height?: number; confirmations: number }

async function timedFetch(url: string, opts: RequestInit = {}, ms = 12_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { cache: 'no-store', ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

function num(v: string | number | undefined | null): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const x = Number(v); return Number.isFinite(x) ? x : 0;
}

export async function getStats(baseUrl: string): Promise<ExplorerStats | null> {
  try {
    const [infoR, feeR] = await Promise.allSettled([
      timedFetch(`${baseUrl}/api/v2/`),
      timedFetch(`${baseUrl}/api/v2/estimatefee/2`),
    ]);
    if (infoR.status !== 'fulfilled' || !infoR.value.ok) return null;
    const info = (await infoR.value.json()) as BBInfo;
    let recommendedFee: number | null = null;
    if (feeR.status === 'fulfilled' && feeR.value.ok) {
      try {
        const d = (await feeR.value.json()) as { result?: string };
        if (d.result) {
          const satVb = parseFloat(d.result) * 1e8 / 1000;
          if (Number.isFinite(satVb) && satVb > 0) recommendedFee = Math.max(1, Math.round(satVb));
        }
      } catch { /* ignore */ }
    }
    return {
      blockHeight: info.backend?.blocks ?? info.blockbook?.bestHeight ?? null,
      networkHashPs: null,
      difficulty: info.backend?.difficulty != null ? Number(info.backend.difficulty) : null,
      recommendedFee, mempoolMinFee: null, mintedPct: null,
    };
  } catch { return null; }
}

export async function getUtxos(baseUrl: string, addr: string): Promise<UtxoDto[]> {
  try {
    const r = await timedFetch(`${baseUrl}/api/v2/utxo/${encodeURIComponent(addr)}`);
    if (!r.ok) return [];
    const list = (await r.json()) as BBUtxo[];
    return list.map((u) => ({ txid: u.txid, vout: u.vout, value: u.value, blockHeight: u.height ?? 0 }));
  } catch { return []; }
}

export async function scanAddresses(baseUrl: string, addresses: string[]): Promise<ScanResult[]> {
  if (addresses.length === 0) return [];
  const probes = await Promise.allSettled(addresses.map(async (addr) => {
    const r = await timedFetch(`${baseUrl}/api/v2/address/${encodeURIComponent(addr)}?details=basic`);
    if (!r.ok) return null;
    return (await r.json()) as BBAddress;
  }));
  return Promise.all(addresses.map(async (addr, i) => {
    const p = probes[i];
    const meta = p.status === 'fulfilled' ? p.value : null;
    const used = !!meta && (meta.txs ?? 0) > 0;
    const balance = meta ? num(meta.balance) : 0;
    const utxos = used ? await getUtxos(baseUrl, addr) : [];
    return { address: addr, used, balance: String(balance), utxos };
  }));
}

function netForAddrs(tx: BBTx, addrSet: Set<string>): { received: number; sent: number } {
  let received = 0, sent = 0;
  for (const o of tx.vout ?? []) if (o.addresses?.some((a) => addrSet.has(a))) received += num(o.value);
  for (const i of tx.vin  ?? []) if (i.addresses?.some((a) => addrSet.has(a))) sent     += num(i.value);
  return { received, sent };
}

function txToAddressTx(tx: BBTx, addrSet: Set<string>): AddressTx {
  const { received, sent } = netForAddrs(tx, addrSet);
  const net = received - sent;
  return {
    txid: tx.txid,
    time: tx.blockTime ?? null,
    blockHeight: tx.blockHeight ?? null,
    confirmed: (tx.confirmations ?? 0) > 0,
    received, sent, net,
    direction: net > 0 ? 'in' : net < 0 ? 'out' : 'self',
  };
}

export async function getAddress(baseUrl: string, addr: string, page = 0): Promise<AddressData | null> {
  try {
    const url = `${baseUrl}/api/v2/address/${encodeURIComponent(addr)}?details=txs&page=${page + 1}&pageSize=50`;
    const r = await timedFetch(url);
    if (!r.ok) return null;
    const d = (await r.json()) as BBAddress;
    const addrSet = new Set([addr]);
    const transactions = (d.transactions ?? []).map((t) => txToAddressTx(t, addrSet));
    return {
      address: d.address, balance: num(d.balance),
      txTotal: d.txs ?? transactions.length,
      utxoCount: 0, firstTime: null, lastTime: transactions[0]?.time ?? null,
      page, pageSize: 50, transactions,
    };
  } catch { return null; }
}

export async function getTx(baseUrl: string, txid: string): Promise<TxDetail | null> {
  try {
    const r = await timedFetch(`${baseUrl}/api/v2/tx/${encodeURIComponent(txid)}`);
    if (!r.ok) return null;
    const tx = (await r.json()) as BBTx;
    const isCoinbase = (tx.vin ?? []).some((v) => v.coinbase != null);
    const vin:  TxVin[]  = (tx.vin  ?? []).map((v) => ({ isCoinbase: v.coinbase != null, address: v.addresses?.[0] ?? null, value: v.value != null ? num(v.value) : null }));
    const vout: TxVout[] = (tx.vout ?? []).map((v) => ({ n: v.n, address: v.addresses?.[0] ?? null, value: num(v.value) }));
    return {
      txid: tx.txid,
      blockHeight: tx.blockHeight ?? null,
      blockTime: tx.blockTime ?? null,
      confirmations: tx.confirmations ?? null,
      fee: tx.fees != null ? num(tx.fees) : null,
      isCoinbase, vin, vout,
    };
  } catch { return null; }
}

export async function broadcastTx(baseUrl: string, hex: string): Promise<{ txid?: string; error?: string }> {
  try {
    const r = await fetch(`${baseUrl}/api/v2/sendtx/`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: hex,
    });
    const text = await r.text();
    let data: { result?: string; error?: { message?: string } | string } | null = null;
    try { data = text ? JSON.parse(text) : null; } catch {
      return { error: `Network/gateway error (HTTP ${r.status}). Your transaction may or may not have been sent — check the explorer before retrying.` };
    }
    const errMsg = (data?.error && typeof data.error === 'object') ? data.error.message
                  : typeof data?.error === 'string' ? data.error : undefined;
    if (!r.ok) return { error: errMsg ?? `Broadcast failed (HTTP ${r.status}).` };
    if (data?.result) return { txid: data.result };
    return { error: errMsg ?? 'Broadcast failed (no txid).' };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function getPrice(): Promise<PriceData | null> { return null; }

export async function getWalletHistory(baseUrl: string, addresses: string[]): Promise<AddressTx[] | null> {
  if (addresses.length === 0) return [];
  try {
    const results = await Promise.allSettled(addresses.map(async (addr) => {
      const r = await timedFetch(`${baseUrl}/api/v2/address/${encodeURIComponent(addr)}?details=txs&page=1&pageSize=25`);
      if (!r.ok) return null;
      return (await r.json()) as BBAddress;
    }));
    const seen = new Map<string, BBTx>();
    for (const res of results) {
      if (res.status !== 'fulfilled' || !res.value) continue;
      for (const tx of res.value.transactions ?? []) if (!seen.has(tx.txid)) seen.set(tx.txid, tx);
    }
    const addrSet = new Set(addresses);
    return Array.from(seen.values())
      .sort((a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0))
      .slice(0, 50)
      .map((tx) => txToAddressTx(tx, addrSet));
  } catch { return null; }
}
