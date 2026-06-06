// Smart derivation detection for imported seeds.
//
// A 12/24-word phrase from another wallet may not live at our standard path
// (Pearl coin type, account 0'). Rather than import "successfully" but show an
// empty balance, we probe a small set of candidate derivations, scan their
// first few addresses for on-chain activity, and pick the one that actually has
// funds/history. Pearl is Taproot-only (BIP-86, purpose 86'), so we only vary
// the coin type and account index.

import type { HDKey } from '@scure/bip32';
import { deriveAddress, defaultDerivation, type Derivation } from './wallet';
import { type PearlNetwork, getNetwork } from './network';
import { scanAddresses, type ScanResult } from '@/api/client';

const PROBE_ACCOUNTS = [0, 1, 2];   // account indices to try
const PROBE_DEPTH    = 5;           // first N receive addresses per candidate

export interface DetectedDerivation extends Derivation {
  used:    boolean;   // any of the probed addresses showed activity
  balance: bigint;    // summed balance across the probed addresses
}

export type ScanFn = (addresses: string[]) => Promise<ScanResult[]>;

export async function detectDerivation(
  hd: HDKey,
  network: PearlNetwork = 'mainnet',
  scan: ScanFn = scanAddresses,
): Promise<DetectedDerivation> {
  // Pearl's coin type first (the standard) then Bitcoin's 0 (some wallets reuse
  // it). De-duped in case the network's coin type is already 0 (testnet=1).
  const coinTypes = [...new Set([getNetwork(network).coinType, 0])];
  const candidates: Derivation[] = [];
  for (const coinType of coinTypes) {
    for (const account of PROBE_ACCOUNTS) candidates.push({ coinType, account });
  }

  // Derive every probe address up front and scan them in ONE batch call.
  const perCandidate = candidates.map((deriv) => ({
    deriv,
    addrs: Array.from({ length: PROBE_DEPTH }, (_, i) => deriveAddress(hd, 0, i, network, deriv).address),
  }));
  const results = await scan(perCandidate.flatMap((c) => c.addrs));
  const byAddr = new Map(results.map((r) => [r.address, r]));

  let best: DetectedDerivation | null = null;
  for (const c of perCandidate) {
    let used = false;
    let balance = 0n;
    for (const a of c.addrs) {
      const r = byAddr.get(a);
      if (r?.used) used = true;
      balance += BigInt(r?.balance ?? '0');
    }
    const scored: DetectedDerivation = { ...c.deriv, used, balance };
    // Prefer activity over none, then higher balance. Ties keep the earlier
    // candidate, so the standard (Pearl coin type, account 0) wins by default.
    if (!best || (scored.used && !best.used) || (scored.used === best.used && scored.balance > best.balance)) {
      best = scored;
    }
  }

  return best ?? { ...defaultDerivation(network), used: false, balance: 0n };
}
