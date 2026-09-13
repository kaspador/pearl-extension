import { describe, it, expect } from 'vitest';
import * as btc from '@scure/btc-signer';
import { mnemonicToHDKey, deriveAddress } from './wallet';
import { hdSigner, buildAndSignTx } from './transaction';
import { isValidAddress, decodeBech32m } from './address';
import { hexToBytes, bytesToHex } from './bytes';
import type { ScannedUtxo } from './hdwallet';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const DERIV = { coinType: 808276, account: 0 };

// A real, on-chain Pearl witness-v2 address (block 75520).
const V2 = 'prl1z24t4e2jkuq5j5y2y34sv2ll7me37ammy5ea2k2qasqt6qus86myqdr45j3';

const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

// Expected pay-to-witness-v2 script: OP_2 PUSH(len) <program>.
function expectedV2Script(addr: string): Uint8Array {
  const d = decodeBech32m(addr)!;
  const s = new Uint8Array(2 + d.witnessProgram.length);
  s[0] = 0x50 + d.witnessVersion;   // 0x52 for v2
  s[1] = d.witnessProgram.length;
  s.set(d.witnessProgram, 2);
  return s;
}

describe('send to witness-v2 (prl1z…) recipient', () => {
  it('isValidAddress now accepts a real v2 address', () => {
    expect(decodeBech32m(V2)?.witnessVersion).toBe(2);
    expect(isValidAddress(V2)).toBe(true);
  });

  it('builds a correct OP_2 output to the v2 recipient and signs', async () => {
    const hd = await mnemonicToHDKey(MNEMONIC);
    const signer = hdSigner(hd, 'mainnet', DERIV);
    const owner = deriveAddress(hd, 0, 0, 'mainnet', DERIV).address;          // v1 input/change
    const utxo: ScannedUtxo = { txid: 'd'.repeat(64), vout: 0, value: 100_000n, blockHeight: 1, address: owner, chain: 0, index: 0 };

    const built = buildAndSignTx({
      signer, network: 'mainnet', recipient: V2, amount: 10_000n,
      utxos: [utxo], feeRate: 2n, changeAddress: owner,
    });
    const tx = btc.Transaction.fromRaw(hexToBytes(built.hex), { allowUnknownOutputs: true });

    // Recipient output = OP_2 PUSH32 <program>, correct amount.
    const expScript = expectedV2Script(V2);
    expect(expScript[0]).toBe(0x52);                       // OP_2 — sanity
    expect(eq(tx.getOutput(0)!.script!, expScript)).toBe(true);
    expect(tx.getOutput(0)!.amount).toBe(10_000n);

    // Inputs all signed (no empty witness).
    for (let i = 0; i < tx.inputsLength; i++) {
      const w = tx.getInput(i).finalScriptWitness;
      expect(w && w.length > 0).toBeTruthy();
    }
    // Change (if any) still goes to our own v1 Taproot address (OP_1).
    if (tx.outputsLength > 1) expect(bytesToHex(tx.getOutput(1)!.script!).startsWith('5120')).toBe(true);
  });
});
