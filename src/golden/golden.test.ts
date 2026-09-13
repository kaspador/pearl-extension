// Golden-master regression test. fixtures.json was recorded from the exact
// 1.3.1 build that shipped to the Chrome Web Store, BEFORE any fix or library
// upgrade. If anything here fails, a change altered which addresses a seed
// derives, which key signs, how the vault opens, or what a transaction pays —
// any of which can make a wallet look empty or send funds somewhere else.
import { describe, it, expect } from 'vitest';
import * as btc from '@scure/btc-signer';
import F from './fixtures.json';
import {
  mnemonicToHDKey, deriveAddress, getPrivateKey, privateKeyToAddress, parsePrivateKey, isValidMnemonic,
} from '@/pearl/wallet';
import { taprootOutputKey, pubkeyToTaprootAddress, decodeBech32m } from '@/pearl/address';
import { openWithPassword, type SealedBox } from '@/pearl/crypto';
import { hdSigner, importedSigner, buildAndSignTx, buildPnsTransferTx, buildCompoundTx } from '@/pearl/transaction';
import { buildPaymentUri, parsePaymentUri, type PearlNetwork } from '@/pearl/network';
import { bytesToHex, hexToBytes } from '@/pearl/bytes';
import type { ScannedUtxo } from '@/pearl/hdwallet';

const M12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const M24 = 'legal winner thank year wave sausage worth useful legal winner thank yellow legal winner thank year wave sausage worth useful legal winner thank title';
const V2  = 'prl1z24t4e2jkuq5j5y2y34sv2ll7me37ammy5ea2k2qasqt6qus86myqdr45j3';
const KEY = '3333333333333333333333333333333333333333333333333333333333333333';

const outputsOf = (hex: string) => {
  const tx = btc.Transaction.fromRaw(hexToBytes(hex), { allowUnknownOutputs: true });
  return Array.from({ length: tx.outputsLength }, (_, i) => {
    const o = tx.getOutput(i);
    return { script: bytesToHex(o.script!), amount: String(o.amount) };
  });
};
const pack = (b: { txid: string; hex: string; feeGrains: bigint; changeGrains: bigint; inputCount: number }) =>
  ({ txid: b.txid, fee: String(b.feeGrains), change: String(b.changeGrains), inputs: b.inputCount, outputs: outputsOf(b.hex) });

describe('golden: key derivation is unchanged', () => {
  it('derives the same 48 addresses, pubkeys and private keys', async () => {
    const hds = { m12: await mnemonicToHDKey(M12), m24: await mnemonicToHDKey(M24) };
    for (const r of F.addresses as Array<{ m: 'm12' | 'm24'; d: { coinType: number; account: number }; chain: 0 | 1; i: number; net: PearlNetwork; address: string; publicKey: string; path: string; priv: string }>) {
      const a = deriveAddress(hds[r.m], r.chain, r.i, r.net, r.d);
      expect({ address: a.address, publicKey: a.publicKey, path: a.path }).toEqual({ address: r.address, publicKey: r.publicKey, path: r.path });
      expect(bytesToHex(getPrivateKey(hds[r.m], r.chain, r.i, r.net, r.d))).toBe(r.priv);
    }
  });

  it('validates mnemonics the same way', () => {
    expect({ m12: isValidMnemonic(M12), m24: isValidMnemonic(M24), bad: isValidMnemonic('abandon abandon') }).toEqual(F.mnemonicValid);
  });
});

describe('golden: keys and addresses are unchanged', () => {
  it('imports hex and WIF keys to the same addresses', () => {
    expect({
      hexMain: privateKeyToAddress(parsePrivateKey(KEY), 'mainnet'),
      hexTest: privateKeyToAddress(parsePrivateKey(KEY), 'testnet'),
      wif:     privateKeyToAddress(parsePrivateKey('KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn'), 'mainnet'),
    }).toEqual(F.keyImport);
  });

  it('computes the same Taproot tweak', () => {
    const x = hexToBytes('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
    expect({ outputKey: bytesToHex(taprootOutputKey(x)), address: pubkeyToTaprootAddress(x, 'mainnet') }).toEqual(F.taproot);
  });

  it('decodes a witness-v2 address the same way', () => {
    const d = decodeBech32m(V2)!;
    expect({ ...d, witnessProgram: bytesToHex(d.witnessProgram) }).toEqual(F.decode.v2);
  });
});

describe('golden: vaults sealed by 1.3.1 still open', () => {
  it('opens the password-sealed master mnemonic', () => {
    expect(openWithPassword(F.vault.box as SealedBox, F.vault.password)).toBe(F.vault.plaintext);
  });
  it('rejects the wrong password', () => {
    expect(openWithPassword(F.vault.box as SealedBox, 'wrong')).toBeNull();
  });
  it('opens a mnemonic-keyed box (imported keys / extra seeds)', () => {
    const k = F.vault.mnemonicKeyed;
    expect(openWithPassword(k.box as SealedBox, k.key)).toBe(k.plaintext);
  });
});

describe('golden: transactions pay exactly the same', () => {
  const u = (c: string, vout: number, value: bigint, address: string, chain: 0 | 1, index: number): ScannedUtxo =>
    ({ txid: c.repeat(64), vout, value, blockHeight: 1, address, chain, index });

  it('send, witness-v2 send, consolidation, single-output name transfer, imported-key send', async () => {
    const hd = await mnemonicToHDKey(M12);
    const D = { coinType: 808276, account: 0 };
    const signer = hdSigner(hd, 'mainnet', D);
    const own0 = deriveAddress(hd, 0, 0, 'mainnet', D).address;
    const own3 = deriveAddress(hd, 0, 3, 'mainnet', D).address;
    const chg0 = deriveAddress(hd, 1, 0, 'mainnet', D).address;
    const recip = deriveAddress(hd, 0, 12, 'mainnet', D).address;
    const utxos = [u('1', 0, 250_000n, own0, 0, 0), u('2', 3, 90_000n, own3, 0, 3), u('3', 1, 40_000n, chg0, 1, 0)];

    expect(pack(buildAndSignTx({ signer, network: 'mainnet', recipient: recip, amount: 120_000n, utxos, feeRate: 3n, changeAddress: chg0 }))).toEqual(F.tx.send1);
    expect(pack(buildAndSignTx({ signer, network: 'mainnet', recipient: V2, amount: 15_000n, utxos, feeRate: 2n, changeAddress: chg0 }))).toEqual(F.tx.sendV2);
    expect(pack(buildCompoundTx({ signer, network: 'mainnet', utxos, destination: own0, feeRate: 2n }))).toEqual(F.tx.compound);
    const insc = u('4', 0, 50_000n, own0, 0, 0);
    expect(pack(buildPnsTransferTx({ signer, network: 'mainnet', recipient: recip, inscriptionUtxo: insc, feeUtxos: [insc], feeRate: 2n, changeAddress: chg0 }))).toEqual(F.tx.pnsSingle);

    const priv = parsePrivateKey(KEY);
    const impAddr = privateKeyToAddress(priv, 'mainnet');
    expect(pack(buildAndSignTx({ signer: importedSigner(priv, 'mainnet'), network: 'mainnet', recipient: recip, amount: 10_000n, utxos: [u('5', 2, 80_000n, impAddr, 0, 0)], feeRate: 2n, changeAddress: impAddr }))).toEqual(F.tx.importedSend);
  });
});

describe('golden: payment URIs are unchanged', () => {
  it('builds and parses the same way', async () => {
    const hd = await mnemonicToHDKey(M12);
    const recip = deriveAddress(hd, 0, 12, 'mainnet', { coinType: 808276, account: 0 }).address;
    expect(buildPaymentUri(recip, { amount: 1.5, label: 'a b', message: 'x&y' })).toBe(F.uri.built);
    expect(parsePaymentUri(`pearl:${recip}?amount=1.5&label=a%20b&message=x%26y`)).toEqual(F.uri.parsed);
  });
});
