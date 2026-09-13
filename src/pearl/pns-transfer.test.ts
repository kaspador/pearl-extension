import { describe, it, expect } from 'vitest';
import * as btc from '@scure/btc-signer';
import { mnemonicToHDKey, deriveAddress } from './wallet';
import { hdSigner, buildPnsTransferTx } from './transaction';
import { decodeBech32m } from './address';
import { bytesToHex, hexToBytes } from './bytes';
import type { ScannedUtxo } from './hdwallet';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const DERIV = { coinType: 808276, account: 0 };

// The locking script the indexer compares against — Taproot v1 (OP_1 PUSH32).
function taprootScript(address: string): Uint8Array {
  const d = decodeBech32m(address)!;
  const s = new Uint8Array(34);
  s[0] = 0x51; s[1] = 0x20; s.set(d.witnessProgram, 2);
  return s;
}
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

// The indexer's rule (indexer/pns.ts handleTransfer): new owner = vout[1] if it
// exists, else vout[0]. This is the property a correct transfer MUST satisfy.
function indexerNewOwnerIdx(tx: btc.Transaction): number {
  return tx.outputsLength > 1 ? 1 : 0;
}

function inputSpendsInscription(tx: btc.Transaction, insc: ScannedUtxo): boolean {
  for (let i = 0; i < tx.inputsLength; i++) {
    const t = tx.getInput(i).txid!;
    const fwd = bytesToHex(t);
    const rev = bytesToHex(Uint8Array.from([...t].reverse()));
    if ((fwd === insc.txid || rev === insc.txid) && tx.getInput(i).index === insc.vout) return true;
  }
  return false;
}

function allSigned(tx: btc.Transaction): boolean {
  for (let i = 0; i < tx.inputsLength; i++) {
    const w = tx.getInput(i).finalScriptWitness;
    if (!w || w.length === 0) return false;
  }
  return true;
}

describe('buildPnsTransferTx', () => {
  it('single-output (fat coin): recipient at the indexer-read index, inscription spent, signed', async () => {
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

    expect(tx.outputsLength).toBe(1);                              // single output
    const idx = indexerNewOwnerIdx(tx);
    expect(idx).toBe(0);
    expect(eq(tx.getOutput(idx)!.script!, taprootScript(recipient))).toBe(true);  // indexer assigns → recipient
    expect(inputSpendsInscription(tx, insc)).toBe(true);          // the name's coin is spent
    expect(allSigned(tx)).toBe(true);
  });

  it('with-change (tiny coin): recipient at vout[1] (NOT the change addr), inscription spent, signed', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const signer = hdSigner(hd, 'mainnet', DERIV);
    const owner = deriveAddress(hd, 0, 0, 'mainnet', DERIV).address;
    const changeAddr = deriveAddress(hd, 1, 0, 'mainnet', DERIV).address;
    const recipient = deriveAddress(hd, 0, 9, 'mainnet', DERIV).address;
    // Tiny inscription coin can't cover its own fee → needs a funding coin → 2 outputs.
    const insc: ScannedUtxo = { txid: 'b'.repeat(64), vout: 1, value: 600n, blockHeight: 1, address: owner, chain: 0, index: 0 };
    const fee: ScannedUtxo = { txid: 'c'.repeat(64), vout: 0, value: 100_000n, blockHeight: 1, address: owner, chain: 0, index: 0 };

    const built = buildPnsTransferTx({
      signer, network: 'mainnet', recipient, inscriptionUtxo: insc,
      feeUtxos: [insc, fee], feeRate: 2n, changeAddress: changeAddr,
    });
    const tx = btc.Transaction.fromRaw(hexToBytes(built.hex), { allowUnknownOutputs: true });

    expect(tx.outputsLength).toBe(2);
    const idx = indexerNewOwnerIdx(tx);
    expect(idx).toBe(1);
    // The recipient MUST be at the index the indexer reads — NOT the change address.
    expect(eq(tx.getOutput(idx)!.script!, taprootScript(recipient))).toBe(true);
    expect(eq(tx.getOutput(0)!.script!, taprootScript(changeAddr))).toBe(true);
    expect(eq(tx.getOutput(idx)!.script!, taprootScript(changeAddr))).toBe(false);  // guard against the trap
    expect(inputSpendsInscription(tx, insc)).toBe(true);
    expect(allSigned(tx)).toBe(true);
  });
});
