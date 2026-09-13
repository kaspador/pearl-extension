// Coins that carry .pns names must never be spent by an ordinary Send, a
// consolidation, or as fee for a different name's transfer. Spending one moves
// the name to wherever its first sat lands: the recipient, the change output,
// or nowhere useful. Every Bitcoin ordinals wallet had to learn this; so did
// several large Pearl wallets, whose sweeps dragged premium names along.
//
// Which coins carry names comes from the pearlchain.live name index. That can
// fail, so the result distinguishes "verified" from "best effort":
//   verified    every address was checked; the set is authoritative and saved
//   unverified  at least one lookup failed; we use the last saved set plus
//               whatever did succeed, and the UI warns the user

import type { OwnedPnsName } from '@/api/pearlchain';

export type NameLookup = (address: string) => Promise<OwnedPnsName[] | null>;

export interface ProtectedCoins {
  outpoints: Set<string>;   // "txid:vout"
  verified:  boolean;
}

const STORAGE_PREFIX = 'pearlchain.protectedCoins.';
const MAX_PARALLEL   = 6;

export const outpointKey = (u: { txid: string; vout: number }): string => `${u.txid}:${u.vout}`;

function storage(): chrome.storage.LocalStorageArea | null {
  return (globalThis as { chrome?: typeof chrome }).chrome?.storage?.local ?? null;
}

async function loadSaved(accountId: string): Promise<Set<string>> {
  const s = storage();
  if (!s) return new Set();
  const key = STORAGE_PREFIX + accountId;
  return new Promise(resolve => {
    s.get([key], (r) => {
      const arr = r?.[key];
      resolve(new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []));
    });
  });
}

async function save(accountId: string, set: Set<string>): Promise<void> {
  const s = storage();
  if (!s) return;
  const key = STORAGE_PREFIX + accountId;
  await new Promise<void>(resolve => s.set({ [key]: [...set] }, () => resolve()));
}

/**
 * Work out which of this account's coins carry names.
 * `addresses` should be every address that currently holds a coin.
 */
export async function resolveProtectedCoins(
  accountId: string,
  addresses: string[],
  lookup: NameLookup,
): Promise<ProtectedCoins> {
  const unique = [...new Set(addresses)];
  const found = new Set<string>();
  let failed = false;

  for (let i = 0; i < unique.length; i += MAX_PARALLEL) {
    const batch = unique.slice(i, i + MAX_PARALLEL);
    const results = await Promise.all(batch.map(a => lookup(a).catch(() => null)));
    for (const r of results) {
      if (r === null) { failed = true; continue; }
      for (const n of r) found.add(outpointKey({ txid: n.inscTxid, vout: n.inscVout }));
    }
  }

  if (!failed) {
    await save(accountId, found);
    return { outpoints: found, verified: true };
  }

  // Degraded: never forget a name we already knew about just because the index
  // is unreachable right now.
  const saved = await loadSaved(accountId);
  for (const k of found) saved.add(k);
  return { outpoints: saved, verified: false };
}

/** Sum of the value held in protected coins, so screens can show spendable balance. */
export function protectedValue(
  utxos: Array<{ txid: string; vout: number; value: bigint }>,
  outpoints: ReadonlySet<string>,
): bigint {
  return utxos.reduce((s, u) => (outpoints.has(outpointKey(u)) ? s + u.value : s), 0n);
}
