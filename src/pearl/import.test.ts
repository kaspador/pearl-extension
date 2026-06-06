import { describe, it, expect } from 'vitest';
import { mnemonicToHDKey, deriveAddress } from './wallet';
import { detectDerivation, type ScanFn } from './import';
import type { ScanResult } from '@/api/client';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Build a mock scan that reports `used` + a balance ONLY for the addresses that
// belong to a chosen target derivation.
function scanFavouring(usedAddrs: Set<string>): ScanFn {
  return async (addresses: string[]): Promise<ScanResult[]> =>
    addresses.map((address) => ({
      address,
      used: usedAddrs.has(address),
      balance: usedAddrs.has(address) ? '500000000' : '0',
      utxos: [],
    }));
}

describe('detectDerivation', () => {
  it('picks the derivation that actually has activity', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const target = { coinType: 0, account: 1 };
    const targetAddrs = new Set(
      Array.from({ length: 5 }, (_, i) => deriveAddress(hd, 0, i, 'mainnet', target).address),
    );
    const d = await detectDerivation(hd, 'mainnet', scanFavouring(targetAddrs));
    expect(d.coinType).toBe(0);
    expect(d.account).toBe(1);
    expect(d.used).toBe(true);
  });

  it('falls back to the standard derivation (808276 / account 0) when nothing has activity', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const d = await detectDerivation(hd, 'mainnet', scanFavouring(new Set()));
    expect(d.coinType).toBe(808276);
    expect(d.account).toBe(0);
    expect(d.used).toBe(false);
  });
});
