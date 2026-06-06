import { describe, it, expect } from 'vitest';
import { mnemonicToHDKey, deriveAddress, privateKeyToAddress, parsePrivateKey } from './wallet';
import { hdSigner, importedSigner } from './transaction';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('hdSigner', () => {
  it('returns the key that controls a derived address (verified by re-derivation)', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const deriv = { coinType: 808276, account: 1 };
    const signer = hdSigner(hd, 'mainnet', deriv);
    const a = deriveAddress(hd, 0, 4, 'mainnet', deriv);
    const key = signer.keyForUtxo({ address: a.address, chain: 0, index: 4 });
    expect(privateKeyToAddress(key, 'mainnet')).toBe(a.address);
  });

  it('recovers the right key even when chain/index hint is wrong (address fallback)', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const deriv = { coinType: 808276, account: 0 };
    const signer = hdSigner(hd, 'mainnet', deriv);
    const a = deriveAddress(hd, 1, 2, 'mainnet', deriv);   // change chain, index 2
    // Pass a deliberately wrong hint (chain 0 / index 0) — must still resolve.
    const key = signer.keyForUtxo({ address: a.address, chain: 0, index: 0 });
    expect(privateKeyToAddress(key, 'mainnet')).toBe(a.address);
  });

  it('throws for an address it does not control', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const signer = hdSigner(hd, 'mainnet', { coinType: 808276, account: 0 });
    // An address from a DIFFERENT account is not owned by this signer.
    const foreign = deriveAddress(hd, 0, 0, 'mainnet', { coinType: 0, account: 9 }).address;
    expect(() => signer.keyForUtxo({ address: foreign, chain: 0, index: 0 })).toThrow();
  });
});

describe('importedSigner', () => {
  const HEX = '2222222222222222222222222222222222222222222222222222222222222222';

  it('signs for its one address and rejects all others', () => {
    const priv = parsePrivateKey(HEX);
    const addr = privateKeyToAddress(priv, 'mainnet');
    const signer = importedSigner(priv, 'mainnet');
    expect(privateKeyToAddress(signer.keyForUtxo({ address: addr, chain: 0, index: 0 }), 'mainnet')).toBe(addr);
    expect(() => signer.keyForUtxo({ address: 'prl1pxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', chain: 0, index: 0 })).toThrow();
  });
});
