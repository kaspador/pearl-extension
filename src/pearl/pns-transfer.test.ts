import { describe, it, expect } from 'vitest';
import * as btc from '@scure/btc-signer';
import { mnemonicToHDKey, deriveAddress } from './wallet';
import { hdSigner, buildPnsTransferTx } from './transaction';
import { decodeBech32m, encodeBech32m } from './address';
import { bytesToHex, hexToBytes } from './bytes';
import type { ScannedUtxo } from './hdwallet';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const DERIV = { coinType: 808276, account: 0 };

function taprootScript(address: string): Uint8Array {
  const d = decodeBech32m(address)!;
  const s = new Uint8Array(34);
  s[0] = 0x51; s[1] = 0x20; s.set(d.witnessProgram, 2);
  return s;
}
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

function inputIndexOf(tx: btc.Transaction, insc: ScannedUtxo): number {
  for (let i = 0; i < tx.inputsLength; i++) {
    const t = tx.getInput(i).txid!;
    const fwd = bytesToHex(t);
    const rev = bytesToHex(Uint8Array.from([...t].reverse()));
    if ((fwd === insc.txid || rev === insc.txid) && tx.getInput(i).index === insc.vout) return i;
  }
  return -1;
}

// The rule the pearlchain.live indexer applies (indexer/pns.ts
// inscriptionOutputIndex): the name rides the FIRST sat of its coin. Its offset
// is the sum of the input values before it, and it lands in the output whose
// value range contains that offset.
function satFlowOwnerIndex(tx: btc.Transaction, inscInput: number): number {
  let offset = 0n;
  for (let i = 0; i < inscInput; i++) offset += tx.getInput(i).witnessUtxo!.amount;
  let acc = 0n;
  for (let i = 0; i < tx.outputsLength; i++) {
    const v = tx.getOutput(i).amount!;
    if (offset < acc + v) return i;
    acc += v;
  }
  return -1;
}

function allSigned(tx: btc.Transaction): boolean {
  for (let i = 0; i < tx.inputsLength; i++) {
    const w = tx.getInput(i).finalScriptWitness;
    if (!w || w.length === 0) return false;
  }
  return true;
}

describe('buildPnsTransferTx', () => {
  it('single output (coin covers its own fee): the name lands on the recipient', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const signer = hdSigner(hd, 'mainnet', DERIV);
    const owner = deriveAddress(hd, 0, 0, 'mainnet', DERIV).address;
    const recipient = deriveAddress(hd, 0, 9, 'mainnet', DERIV).address;
    const insc: ScannedUtxo = { txid: 'a'.repeat(64), vout: 0, value: 50_000n, blockHeight: 1, address: owner, chain: 0, index: 0 };

    const built = buildPnsTransferTx({
      signer, network: 'mainnet', recipient, inscriptionUtxo: insc,
      feeUtxos: [insc], feeRate: 2n, changeAddress: owner,
    });
    const tx = btc.Transaction.fromRaw(hexToBytes(built.hex), { allowUnknownOutputs: true });

    expect(tx.outputsLength).toBe(1);
    const inIdx = inputIndexOf(tx, insc);
    expect(inIdx).toBe(0);
    const owns = satFlowOwnerIndex(tx, inIdx);
    expect(eq(tx.getOutput(owns)!.script!, taprootScript(recipient))).toBe(true);
    expect(allSigned(tx)).toBe(true);
  });

  it('with change (tiny coin needs a funding coin): the name lands on the recipient, NOT the change', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const signer = hdSigner(hd, 'mainnet', DERIV);
    const owner = deriveAddress(hd, 0, 0, 'mainnet', DERIV).address;
    const changeAddr = deriveAddress(hd, 1, 0, 'mainnet', DERIV).address;
    const recipient = deriveAddress(hd, 0, 9, 'mainnet', DERIV).address;
    const insc: ScannedUtxo = { txid: 'b'.repeat(64), vout: 1, value: 600n, blockHeight: 1, address: owner, chain: 0, index: 0 };
    const fee: ScannedUtxo = { txid: 'c'.repeat(64), vout: 0, value: 100_000n, blockHeight: 1, address: owner, chain: 0, index: 0 };

    const built = buildPnsTransferTx({
      signer, network: 'mainnet', recipient, inscriptionUtxo: insc,
      feeUtxos: [insc, fee], feeRate: 2n, changeAddress: changeAddr,
    });
    const tx = btc.Transaction.fromRaw(hexToBytes(built.hex), { allowUnknownOutputs: true });

    expect(tx.outputsLength).toBe(2);
    const inIdx = inputIndexOf(tx, insc);
    expect(inIdx).toBe(0);                                         // name coin is always spent first
    const owns = satFlowOwnerIndex(tx, inIdx);
    expect(owns).toBe(0);
    expect(eq(tx.getOutput(owns)!.script!, taprootScript(recipient))).toBe(true);
    expect(eq(tx.getOutput(owns)!.script!, taprootScript(changeAddr))).toBe(false);   // the 1.3.1 trap
    expect(eq(tx.getOutput(1)!.script!, taprootScript(changeAddr))).toBe(true);
    expect(allSigned(tx)).toBe(true);
  });

  it('refuses a recipient that is not a Taproot address on this network', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const signer = hdSigner(hd, 'mainnet', DERIV);
    const owner = deriveAddress(hd, 0, 0, 'mainnet', DERIV).address;
    const insc: ScannedUtxo = { txid: 'd'.repeat(64), vout: 0, value: 50_000n, blockHeight: 1, address: owner, chain: 0, index: 0 };
    const run = (recipient: string) => buildPnsTransferTx({
      signer, network: 'mainnet', recipient, inscriptionUtxo: insc, feeUtxos: [insc], feeRate: 2n, changeAddress: owner,
    });
    const p32 = new Uint8Array(32).fill(9);
    expect(() => run(encodeBech32m('prl', 2, p32))).toThrow(/standard Pearl address/);
    expect(() => run(encodeBech32m('bc', 1, p32))).toThrow(/this network/);
  });
});
