// Coins that hold .pns names must not be spent by ordinary wallet actions.
// 1.3.1 had no such guard: a send picked coins largest-first and a
// consolidation swept everything, so either could move a name away.
import { describe, it, expect } from 'vitest';
import * as btc from '@scure/btc-signer';
import { mnemonicToHDKey, deriveAddress } from './wallet';
import { hdSigner, buildAndSignTx, buildCompoundTx, buildPnsTransferTx } from './transaction';
import { decodeBech32m } from './address';
import { bytesToHex, hexToBytes } from './bytes';
import type { ScannedUtxo } from './hdwallet';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const DERIV = { coinType: 808276, account: 0 };
const key = (u: ScannedUtxo) => u.txid + ':' + u.vout;

async function setup() {
  const hd = await mnemonicToHDKey(MNEMONIC);
  const signer = hdSigner(hd, 'mainnet', DERIV);
  const owner = deriveAddress(hd, 0, 0, 'mainnet', DERIV).address;
  const change = deriveAddress(hd, 1, 0, 'mainnet', DERIV).address;
  const other = deriveAddress(hd, 0, 9, 'mainnet', DERIV).address;
  const coin = (c: string, value: bigint, vout = 0): ScannedUtxo =>
    ({ txid: c.repeat(64), vout, value, blockHeight: 1, address: owner, chain: 0, index: 0 });
  return { signer, owner, change, other, coin };
}

// Accept either byte order for the input txid.
function spentKeys(tx: btc.Transaction): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < tx.inputsLength; i++) {
    const inp = tx.getInput(i);
    s.add(bytesToHex(inp.txid!) + ':' + inp.index);
    s.add(bytesToHex(Uint8Array.from([...inp.txid!].reverse())) + ':' + inp.index);
  }
  return s;
}
const parse = (hex: string) => btc.Transaction.fromRaw(hexToBytes(hex), { allowUnknownOutputs: true });
const scriptOf = (addr: string) => {
  const d = decodeBech32m(addr)!;
  return bytesToHex(Uint8Array.from([0x51, 0x20, ...d.witnessProgram]));
};

describe('send never spends a name coin', () => {
  it('skips the largest coin when it holds a name', async () => {
    const { signer, owner, other, coin } = await setup();
    const name = coin('a', 10_000_000n);          // largest-first would pick this
    const plain = coin('b', 2_000_000n);
    const built = buildAndSignTx({
      signer, network: 'mainnet', recipient: other, amount: 1_000_000n,
      utxos: [name, plain], feeRate: 2n, changeAddress: owner, protectedOutpoints: new Set([key(name)]),
    });
    const spent = spentKeys(parse(built.hex));
    expect(spent.has(key(name))).toBe(false);
    expect(spent.has(key(plain))).toBe(true);
  });

  it('refuses rather than touch a name coin when the rest is not enough', async () => {
    const { signer, owner, other, coin } = await setup();
    const name = coin('a', 10_000_000n);
    const plain = coin('b', 100_000n);
    expect(() => buildAndSignTx({
      signer, network: 'mainnet', recipient: other, amount: 1_000_000n,
      utxos: [name, plain], feeRate: 2n, changeAddress: owner, protectedOutpoints: new Set([key(name)]),
    })).toThrow(/Insufficient funds.*holding \.pns names/);
  });
});

describe('consolidation leaves name coins alone', () => {
  it('sweeps only the plain coins', async () => {
    const { signer, owner, coin } = await setup();
    const name = coin('a', 600n);
    const p1 = coin('b', 300_000n), p2 = coin('c', 400_000n);
    const built = buildCompoundTx({
      signer, network: 'mainnet', utxos: [name, p1, p2], destination: owner, feeRate: 2n,
      protectedOutpoints: new Set([key(name)]),
    });
    expect(built.inputCount).toBe(2);
    expect(spentKeys(parse(built.hex)).has(key(name))).toBe(false);
  });

  it('reports nothing to consolidate when only one plain coin remains', async () => {
    const { signer, owner, coin } = await setup();
    const name = coin('a', 600n), p1 = coin('b', 300_000n);
    expect(() => buildCompoundTx({
      signer, network: 'mainnet', utxos: [name, p1], destination: owner, feeRate: 2n,
      protectedOutpoints: new Set([key(name)]),
    })).toThrow(/nothing to consolidate/);
  });
});

describe('name transfer', () => {
  it('does not use a different name coin to pay the fee', async () => {
    const { signer, change, other, coin } = await setup();
    const moving = coin('a', 600n);
    const otherName = coin('b', 5_000_000n);      // biggest coin, but it holds a name
    const plain = coin('c', 200_000n);
    const built = buildPnsTransferTx({
      signer, network: 'mainnet', recipient: other, inscriptionUtxo: moving,
      feeUtxos: [moving, otherName, plain], feeRate: 2n, changeAddress: change,
      protectedOutpoints: new Set([key(moving), key(otherName)]),
    });
    const spent = spentKeys(parse(built.hex));
    expect(spent.has(key(moving))).toBe(true);
    expect(spent.has(key(otherName))).toBe(false);
    expect(spent.has(key(plain))).toBe(true);
  });

  it('splits a large name coin: small carrier to the recipient at output 0, the rest back as change', async () => {
    const { signer, change, other, coin } = await setup();
    const fat = coin('d', 250_000_000n);          // 2.5 PEARL sitting on a name
    const built = buildPnsTransferTx({
      signer, network: 'mainnet', recipient: other, inscriptionUtxo: fat,
      feeUtxos: [fat], feeRate: 2n, changeAddress: change,
    });
    const tx = parse(built.hex);
    expect(tx.inputsLength).toBe(1);
    expect(tx.outputsLength).toBe(2);
    expect(bytesToHex(tx.getOutput(0).script!)).toBe(scriptOf(other));    // the name's first sat lands here
    expect(tx.getOutput(0).amount).toBe(10_000n);
    expect(bytesToHex(tx.getOutput(1).script!)).toBe(scriptOf(change));
    expect(tx.getOutput(0).amount! + tx.getOutput(1).amount! + built.feeGrains).toBe(fat.value);
  });

  it('keeps an ordinary registration coin as a single output', async () => {
    const { signer, change, other, coin } = await setup();
    const small = coin('e', 50_000n);
    const tx = parse(buildPnsTransferTx({
      signer, network: 'mainnet', recipient: other, inscriptionUtxo: small,
      feeUtxos: [small], feeRate: 2n, changeAddress: change,
    }).hex);
    expect(tx.outputsLength).toBe(1);
  });
});
