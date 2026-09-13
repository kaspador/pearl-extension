// Recipient-safety regression tests.
//
// 1.3.1 accepted witness versions 2-16 at any program length 2-40, and built
// the payment with btc-signer's unknown-output guard switched off. On Pearl only
// v1 (Taproot) and v2 (P2MR, BIP 360) exist, both 32 bytes. Everything else is
// either anyone-can-spend (v3-v16: any miner can take it) or unspendable (a
// wrong-length v2). These tests pin the fix at BOTH layers: the UI validator
// and the transaction builder itself.
import { describe, it, expect } from 'vitest';
import { bech32m } from '@scure/base';
import { isValidAddress, decodeBech32m, encodeBech32m, isPayableWitnessProgram } from './address';
import { mnemonicToHDKey, deriveAddress } from './wallet';
import { hdSigner, buildAndSignTx } from './transaction';
import type { ScannedUtxo } from './hdwallet';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const DERIV = { coinType: 808276, account: 0 };
const REAL_V2 = 'prl1z24t4e2jkuq5j5y2y34sv2ll7me37ammy5ea2k2qasqt6qus86myqdr45j3';   // on-chain, block 75520

const prog = (len: number) => new Uint8Array(len).fill(7);
const addr = (hrp: string, ver: number, len: number) => encodeBech32m(hrp, ver, prog(len));

describe('isPayableWitnessProgram', () => {
  it('allows exactly Taproot and P2MR at 32 bytes', () => {
    expect(isPayableWitnessProgram(1, 32)).toBe(true);
    expect(isPayableWitnessProgram(2, 32)).toBe(true);
  });
  it.each([
    [0, 20], [0, 32], [1, 20], [2, 20], [2, 40], [3, 32], [15, 32], [16, 32],
  ])('rejects witness v%i with a %i-byte program', (v, len) => {
    expect(isPayableWitnessProgram(v, len)).toBe(false);
  });
});

describe('isValidAddress (UI gate)', () => {
  it('accepts a Taproot address and a real on-chain P2MR address', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    expect(isValidAddress(deriveAddress(hd, 0, 0, 'mainnet', DERIV).address)).toBe(true);
    expect(isValidAddress(REAL_V2)).toBe(true);
  });

  it.each([
    ['v3, anyone-can-spend', addr('prl', 3, 32)],
    ['v16, anyone-can-spend', addr('prl', 16, 32)],
    ['v2 with a 20-byte program, unspendable', addr('prl', 2, 20)],
    ['v1 with a 20-byte program', addr('prl', 1, 20)],
  ])('rejects %s', (_label, a) => {
    expect(decodeBech32m(a)).not.toBeNull();     // well-formed bech32m...
    expect(isValidAddress(a)).toBe(false);        // ...but not payable on Pearl
  });

  it('rejects addresses from other networks', () => {
    expect(isValidAddress(addr('bc', 1, 32))).toBe(false);     // Bitcoin Taproot
    expect(isValidAddress(addr('tprl', 1, 32))).toBe(false);   // Pearl testnet on mainnet
    expect(isValidAddress(addr('tprl', 1, 32), 'testnet')).toBe(true);
  });

  it('accepts an all-uppercase address but rejects mixed case (BIP-173)', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const a = deriveAddress(hd, 0, 0, 'mainnet', DERIV).address;
    expect(isValidAddress(a.toUpperCase())).toBe(true);
    const mixed = a.slice(0, 10) + a.slice(10, 12).toUpperCase() + a.slice(12);
    expect(isValidAddress(mixed)).toBe(false);
  });

  it('rejects a non-canonical encoding with non-zero padding bits', () => {
    const words = [1, ...bech32m.toWords(prog(32))];
    words[words.length - 1] |= 1;                 // set a padding bit, keep a valid checksum
    const bad = bech32m.encode('prl', words, 90);
    expect(decodeBech32m(bad)).toBeNull();
    expect(isValidAddress(bad)).toBe(false);
  });

  it('rejects garbage', () => {
    for (const s of ['', 'prl1', 'hello', 'prl1pqqqq', 'x'.repeat(200)]) expect(isValidAddress(s)).toBe(false);
  });
});

describe('buildAndSignTx refuses unsafe recipients even when the UI is bypassed', () => {
  const setup = async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const owner = deriveAddress(hd, 0, 0, 'mainnet', DERIV).address;
    const utxo: ScannedUtxo = { txid: 'e'.repeat(64), vout: 0, value: 200_000n, blockHeight: 1, address: owner, chain: 0, index: 0 };
    const send = (recipient: string) => buildAndSignTx({
      signer: hdSigner(hd, 'mainnet', DERIV), network: 'mainnet', recipient,
      amount: 10_000n, utxos: [utxo], feeRate: 2n, changeAddress: owner,
    });
    return { send };
  };

  it.each([
    ['witness v3', () => addr('prl', 3, 32), /unsupported address type/i],
    ['witness v16', () => addr('prl', 16, 32), /unsupported address type/i],
    ['a 20-byte v2 program', () => addr('prl', 2, 20), /unsupported address type/i],
    ['a Bitcoin address', () => addr('bc', 1, 32), /different network/i],
    ['a testnet address', () => addr('tprl', 1, 32), /different network/i],
  ])('throws for %s', async (_label, make, msg) => {
    const { send } = await setup();
    expect(() => send(make())).toThrow(msg);
  });

  it('still pays a real P2MR address', async () => {
    const { send } = await setup();
    expect(send(REAL_V2).txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
