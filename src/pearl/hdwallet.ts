// HD wallet multi-address scanning. Mirrors mobile but takes the api scan
// function as an arg so the explorer dispatcher stays loose-coupled.

import type { HDKey } from '@scure/bip32';
import { deriveAddress } from './wallet';
import type { PearlNetwork } from './network';
import { scanAddresses, type ScanResult } from '@/api/client';

const GAP_LIMIT = 20;
const MAX_INDEX = 500;

export interface ScannedUtxo {
  txid: string; vout: number; value: bigint; blockHeight: number;
  address: string; chain: 0 | 1; index: number;
}

export interface AddressInfo {
  address: string; chain: 0 | 1; index: number; used: boolean; balance: bigint;
}

export interface WalletScan {
  balance:           bigint;
  utxos:             ScannedUtxo[];
  addresses:         AddressInfo[];
  receiveAddress:    string;
  receiveIndex:      number;
  nextChangeAddress: string;
  nextChangeIndex:   number;
}

async function scanChain(
  hd: HDKey, chain: 0 | 1, network: PearlNetwork,
): Promise<{ addresses: AddressInfo[]; utxos: ScannedUtxo[] }> {
  const addresses: AddressInfo[] = [];
  const utxos: ScannedUtxo[] = [];
  let index = 0;
  let consecutiveUnused = 0;

  while (consecutiveUnused < GAP_LIMIT && index < MAX_INDEX) {
    const window = Array.from({ length: GAP_LIMIT }, (_, i) =>
      deriveAddress(hd, chain, index + i, network),
    );
    const results: ScanResult[] = await scanAddresses(window.map(w => w.address));
    const byAddr = new Map(results.map(r => [r.address, r]));
    for (const w of window) {
      const r    = byAddr.get(w.address);
      const used = r?.used ?? false;
      addresses.push({
        address: w.address, chain, index: w.index, used,
        balance: BigInt(r?.balance ?? '0'),
      });
      for (const u of r?.utxos ?? []) {
        utxos.push({
          txid: u.txid, vout: u.vout, value: BigInt(u.value),
          blockHeight: u.blockHeight, address: w.address, chain, index: w.index,
        });
      }
      consecutiveUnused = used ? 0 : consecutiveUnused + 1;
    }
    index += GAP_LIMIT;
  }
  return { addresses, utxos };
}

export async function scanWallet(hd: HDKey, network: PearlNetwork = 'mainnet'): Promise<WalletScan> {
  const [ext, chg] = await Promise.all([scanChain(hd, 0, network), scanChain(hd, 1, network)]);
  const addresses = [...ext.addresses, ...chg.addresses];
  const utxos     = [...ext.utxos, ...chg.utxos];
  const balance   = utxos.reduce((s, u) => s + u.value, 0n);
  const firstUnusedExt = ext.addresses.find(a => !a.used) ?? ext.addresses[0];
  const firstUnusedChg = chg.addresses.find(a => !a.used) ?? chg.addresses[0];
  return {
    balance, utxos, addresses,
    receiveAddress:    firstUnusedExt?.address ?? '',
    receiveIndex:      firstUnusedExt?.index ?? 0,
    nextChangeAddress: firstUnusedChg?.address ?? '',
    nextChangeIndex:   firstUnusedChg?.index ?? 0,
  };
}
