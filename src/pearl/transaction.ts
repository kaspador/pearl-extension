// Taproot key-path send. Mirrors mobile transaction.ts but Buffer-free.

import * as btc from '@scure/btc-signer';
import { secp256k1 } from '@noble/curves/secp256k1';
import { type HDKey } from '@scure/bip32';
import { decodeBech32m, isPayableWitnessProgram } from './address';
import { deriveAddress, getPrivateKey, toXOnlyPubkey, privateKeyToAddress, defaultDerivation, type Derivation } from './wallet';
import { type PearlNetwork, DUST_LIMIT, getNetwork } from './network';
import type { ScannedUtxo } from './hdwallet';
import { bytesToHex } from './bytes';

const PEARL_NET: typeof btc.NETWORK         = { ...btc.NETWORK, bech32: 'prl'  };
const PEARL_NET_TESTNET: typeof btc.NETWORK = { ...btc.NETWORK, bech32: 'tprl' };

export interface BuiltTx {
  hex:          string;
  txid:         string;
  feeGrains:    bigint;
  changeGrains: bigint;
  inputCount:   number;
}

function addressToTaprootScript(address: string): Uint8Array {
  const d = decodeBech32m(address);
  if (!d || d.witnessVersion !== 1 || d.witnessProgram.length !== 32) {
    throw new Error('Invalid Pearl Taproot address');
  }
  const s = new Uint8Array(34);
  s[0] = 0x51;
  s[1] = 0x20;
  s.set(d.witnessProgram, 2);
  return s;
}

// Output script to PAY a recipient of any SegWit version: OP_<v> <program>.
// For v1 this is identical to addressToTaprootScript (OP_1 PUSH32). We need it
// for v2 (prl1z…) recipients, which @scure/btc-signer's addOutputAddress refuses
// ("Unknown witness program"). Inputs/change still go through the v1-only path —
// the wallet only ever spends its own Taproot coins.
// Re-validates network AND output type on its own, so a caller that skipped
// the UI check still cannot build a payment to another chain or to an
// anyone-can-spend witness version.
function recipientOutputScript(address: string, network: PearlNetwork): Uint8Array {
  const d = decodeBech32m(address);
  if (!d) throw new Error('Invalid Pearl address');
  if (d.hrp !== getNetwork(network).hrp) {
    throw new Error(`That address belongs to a different network (${d.hrp}), not Pearl ${network}.`);
  }
  const v = d.witnessVersion;
  const prog = d.witnessProgram;
  if (!isPayableWitnessProgram(v, prog.length)) {
    throw new Error(`Refusing to pay an unsupported address type (witness v${v}, ${prog.length}-byte program). Funds sent there could be lost or taken.`);
  }
  const s = new Uint8Array(2 + prog.length);
  s[0] = 0x50 + v;        // OP_1 … OP_16
  s[1] = prog.length;     // direct push (program ≤ 40 ≤ 75 bytes)
  s.set(prog, 2);
  return s;
}

function witnessVersionOf(address: string): number {
  return decodeBech32m(address)?.witnessVersion ?? 1;
}

function estVbytes(nIn: number, nOut: number): bigint {
  return BigInt(58 * nIn + 43 * nOut + 11);
}

function selectUtxos(
  utxos: ScannedUtxo[], amount: bigint, feeRate: bigint,
): { picked: ScannedUtxo[]; total: bigint; estFee: bigint } {
  const sorted = [...utxos].sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0));
  const picked: ScannedUtxo[] = [];
  let total = 0n;
  for (const u of sorted) {
    picked.push(u);
    total += u.value;
    const estFee = estVbytes(picked.length, 2) * feeRate;
    if (total >= amount + estFee) return { picked, total, estFee };
  }
  return { picked, total, estFee: estVbytes(picked.length, 2) * feeRate };
}

const ADDR_SEARCH_MAX = 500;

// A signer resolves the private key that OWNS a given UTXO. Two implementations:
// an HD account (derives within one BIP-86 sub-tree) and an imported single key.
// In both cases the address is verified to belong to the account before a key is
// returned — never sign for a coin we can't prove we control.
export interface AccountSigner {
  keyForUtxo(u: { address: string; chain: 0 | 1; index: number }): Uint8Array;
}

// HD account signer. We can't blindly trust u.chain/u.index — if the send flow
// tagged a UTXO with the wrong path the derived key won't match the Taproot
// output and btc-signer emits an EMPTY witness (node rejects: "witness program
// passed empty witness"). So we verify the recorded path derives this exact
// address, and if not, find the real path by matching across both chains.
export function hdSigner(hd: HDKey, network: PearlNetwork, deriv?: Derivation): AccountSigner {
  const d = deriv ?? defaultDerivation(network);
  return {
    keyForUtxo(u) {
      if (deriveAddress(hd, u.chain, u.index, network, d).address === u.address) {
        return getPrivateKey(hd, u.chain, u.index, network, d);
      }
      for (const chain of [0, 1] as const) {
        for (let i = 0; i < ADDR_SEARCH_MAX; i++) {
          if (deriveAddress(hd, chain, i, network, d).address === u.address) {
            return getPrivateKey(hd, chain, i, network, d);
          }
        }
      }
      throw new Error(`No signing key found for UTXO address ${u.address} — cannot sign.`);
    },
  };
}

// Imported single-key signer. Controls exactly one address.
export function importedSigner(priv: Uint8Array, network: PearlNetwork): AccountSigner {
  const owned = privateKeyToAddress(priv, network);
  return {
    keyForUtxo(u) {
      if (u.address !== owned) {
        throw new Error(`Imported account does not control ${u.address} — cannot sign.`);
      }
      return priv;
    },
  };
}

interface PreparedInput { u: ScannedUtxo; priv: Uint8Array; xOnly: Uint8Array; script: Uint8Array; }

// Pre-sign verification (hardening). BEFORE building/signing anything, prove every
// selected input is (a) a well-formed Pearl Taproot address and (b) actually OWNED
// by this account (the signer returns a key only after verifying ownership). The
// locking script is ALWAYS re-derived locally from that address — we never trust a
// script that came from the backend. Fail fast rather than spend a coin we don't
// control or hand the node an unsignable transaction.
function prepareInputs(signer: AccountSigner, utxos: ScannedUtxo[]): PreparedInput[] {
  return utxos.map((u) => {
    const script = addressToTaprootScript(u.address);   // validates the address
    const priv   = signer.keyForUtxo(u);                 // asserts we own it (throws if not)
    const xOnly  = toXOnlyPubkey(secp256k1.getPublicKey(priv, true));
    return { u, priv, xOnly, script };
  });
}

function signWithAll(tx: btc.Transaction, keys: Uint8Array[]) {
  for (const k of keys) {
    try { tx.sign(k); } catch { /* key matches no input — skip */ }
  }
}

// Safety net: never broadcast a transaction with an unsigned (empty-witness)
// input. Catches any residual key/path mismatch before it hits the node.
function assertAllSigned(tx: btc.Transaction) {
  for (let i = 0; i < tx.inputsLength; i++) {
    const w = tx.getInput(i).finalScriptWitness;
    if (!w || w.length === 0) {
      throw new Error(`Could not sign input #${i} — refusing to broadcast an unsigned transaction.`);
    }
  }
}

export interface SendArgs {
  signer:       AccountSigner;
  network:      PearlNetwork;
  recipient:    string;
  amount:       bigint;
  utxos:        ScannedUtxo[];
  feeRate:      bigint;
  changeAddress: string;
}

export function buildAndSignTx(args: SendArgs): BuiltTx {
  const NET = args.network === 'testnet' ? PEARL_NET_TESTNET : PEARL_NET;
  const { picked, total, estFee } = selectUtxos(args.utxos, args.amount, args.feeRate);
  if (total < args.amount + estFee) {
    throw new Error(`Insufficient funds: have ${total} grains, need ${args.amount + estFee} (incl. fee).`);
  }
  const prepared = prepareInputs(args.signer, picked);   // verify ALL before building
  // A non-v1 recipient (e.g. v2 prl1z…) is a "non-standard" output to btc-signer,
  // so it must be built by hand and the standard-output guard relaxed — but ONLY
  // because of the recipient; inputs and change remain strict v1 Taproot.
  // Validate the recipient before building anything: throws on a foreign
  // network or an unpayable witness version.
  const recipScript = recipientOutputScript(args.recipient, args.network);
  const recipVer = witnessVersionOf(args.recipient);
  // Only P2MR (v2) is unknown to btc-signer, so relax its guard for v2 alone.
  const tx = new btc.Transaction({ allowUnknownOutputs: recipVer === 2 });
  const keyByHex = new Map<string, Uint8Array>();
  for (const p of prepared) {
    keyByHex.set(bytesToHex(p.priv), p.priv);
    tx.addInput({
      txid: p.u.txid, index: p.u.vout,
      witnessUtxo: { script: p.script, amount: p.u.value },
      tapInternalKey: p.xOnly,
    });
  }
  if (recipVer === 1) tx.addOutputAddress(args.recipient, args.amount, NET);
  else                tx.addOutput({ script: recipScript, amount: args.amount });

  let change = total - args.amount - estFee;
  let feeGrains = estFee;
  if (change > DUST_LIMIT) {
    tx.addOutputAddress(args.changeAddress, change, NET);
  } else {
    feeGrains = total - args.amount;
    change    = 0n;
  }

  signWithAll(tx, [...keyByHex.values()]);
  tx.finalize();
  assertAllSigned(tx);

  return {
    hex:          bytesToHex(tx.extract()),
    txid:         tx.id,
    feeGrains,
    changeGrains: change,
    inputCount:   picked.length,
  };
}

export interface PnsTransferArgs {
  signer:          AccountSigner;
  network:         PearlNetwork;
  recipient:       string;        // resolved Pearl address of the new owner
  inscriptionUtxo: ScannedUtxo;   // the coin that carries the name — MUST be spent
  feeUtxos:        ScannedUtxo[]; // other spendable coins (excludes the inscription) for fees
  feeRate:         bigint;
  changeAddress:   string;
}

// Transfer a .pns name by spending its inscription UTXO to the recipient.
//
// The indexer assigns the new owner to `vout[1]` when the tx has ≥2 outputs,
// else to `vout[0]` (see indexer/pns.ts handleTransfer). So output ORDER is
// consensus-critical here: a normal send (recipient@0, change@1) would hand the
// name to the CHANGE address. We therefore:
//   • single output  → recipient@0           (the inscription coin minus fee)
//   • with change     → change@0, recipient@1 (recipient always at the read index)
export function buildPnsTransferTx(args: PnsTransferArgs): BuiltTx {
  // Names are held and indexed on Taproot outputs. Refuse anything else with a
  // clear message instead of btc-signer's "Unknown witness program".
  {
    const d = decodeBech32m(args.recipient);
    if (!d || d.hrp !== getNetwork(args.network).hrp) {
      throw new Error('Enter a Pearl address on this network to receive the name.');
    }
    if (d.witnessVersion !== 1 || d.witnessProgram.length !== 32) {
      throw new Error('Names can only be sent to a standard Pearl address (prl1p…).');
    }
  }
  const NET = args.network === 'testnet' ? PEARL_NET_TESTNET : PEARL_NET;
  const insc = args.inscriptionUtxo;

  // Prefer the simplest, cheapest shape: spend ONLY the inscription coin into a
  // single output to the recipient. Works whenever the coin covers fee + dust.
  const feeSingle = estVbytes(1, 1) * args.feeRate;
  if (insc.value - feeSingle > DUST_LIMIT) {
    const prepared = prepareInputs(args.signer, [insc]);
    const tx = new btc.Transaction({ allowUnknownOutputs: false });
    const keyByHex = new Map<string, Uint8Array>();
    for (const p of prepared) {
      keyByHex.set(bytesToHex(p.priv), p.priv);
      tx.addInput({ txid: p.u.txid, index: p.u.vout, witnessUtxo: { script: p.script, amount: p.u.value }, tapInternalKey: p.xOnly });
    }
    tx.addOutputAddress(args.recipient, insc.value - feeSingle, NET);  // vout[0] = recipient
    signWithAll(tx, [...keyByHex.values()]);
    tx.finalize();
    assertAllSigned(tx);
    return { hex: bytesToHex(tx.extract()), txid: tx.id, feeGrains: feeSingle, changeGrains: 0n, inputCount: 1 };
  }

  // Inscription coin is too small to also pay the fee → pull in extra coins and
  // emit recipient@0 + change@1. The inscription coin is ALWAYS input 0, so the
  // name's first sat lands in output 0, the recipient. This is the sat-flow
  // rule the pearlchain.live indexer applies. (1.3.1 emitted change@0 +
  // recipient@1 for an older indexer rule, which under sat-flow sends the name
  // back to the sender's own change address.) The recipient gets a minimal
  // carrier amount; the name follows the sat, not the value.
  const RECIP_AMT = DUST_LIMIT + 1n;
  const others = args.feeUtxos.filter(u => !(u.txid === insc.txid && u.vout === insc.vout));
  const picked: ScannedUtxo[] = [insc];
  let total = insc.value;
  let fee = estVbytes(picked.length, 2) * args.feeRate;
  for (const u of [...others].sort((a, b) => (b.value > a.value ? 1 : -1))) {
    if (total >= RECIP_AMT + fee + DUST_LIMIT) break;       // enough for recipient + fee + a non-dust change
    picked.push(u);
    total += u.value;
    fee = estVbytes(picked.length, 2) * args.feeRate;
  }
  if (total < RECIP_AMT + fee) {
    throw new Error('Not enough balance to cover the transfer fee. Add a little PEARL to this account and retry.');
  }

  const prepared = prepareInputs(args.signer, picked);
  const tx = new btc.Transaction({ allowUnknownOutputs: false });
  const keyByHex = new Map<string, Uint8Array>();
  for (const p of prepared) {
    keyByHex.set(bytesToHex(p.priv), p.priv);
    tx.addInput({ txid: p.u.txid, index: p.u.vout, witnessUtxo: { script: p.script, amount: p.u.value }, tapInternalKey: p.xOnly });
  }

  let change = total - RECIP_AMT - fee;
  let feeGrains = fee;
  if (change > DUST_LIMIT) {
    tx.addOutputAddress(args.recipient, RECIP_AMT, NET);      // vout[0] = recipient, carries the name's sat
    tx.addOutputAddress(args.changeAddress, change, NET);     // vout[1] = change (sender)
  } else {
    // No room for change → single output to recipient (vout[0]); fee absorbs the rest.
    tx.addOutputAddress(args.recipient, total - feeGrains, NET);
    feeGrains = total - (total - feeGrains);
    change = 0n;
  }

  signWithAll(tx, [...keyByHex.values()]);
  tx.finalize();
  assertAllSigned(tx);
  return { hex: bytesToHex(tx.extract()), txid: tx.id, feeGrains, changeGrains: change, inputCount: picked.length };
}

export interface CompoundArgs {
  signer:      AccountSigner;
  network:     PearlNetwork;
  utxos:       ScannedUtxo[];   // everything spendable
  destination: string;          // where to consolidate (typically receive #0)
  feeRate:     bigint;
}

// Sweep ALL UTXOs into a single output at `destination`. Useful when funds
// are scattered across many derived addresses (e.g. change from a wallet
// that rotates addresses). One network fee, one input set, one output.
export function buildCompoundTx(args: CompoundArgs): BuiltTx {
  const NET = args.network === 'testnet' ? PEARL_NET_TESTNET : PEARL_NET;

  if (args.utxos.length === 0) throw new Error('Nothing to compound.');
  if (args.utxos.length === 1) throw new Error('Only one UTXO — nothing to consolidate.');

  const total  = args.utxos.reduce((s, u) => s + u.value, 0n);
  const fee    = estVbytes(args.utxos.length, 1) * args.feeRate;
  const output = total - fee;
  if (output <= DUST_LIMIT) {
    throw new Error('Balance too small to cover the consolidation fee.');
  }

  const prepared = prepareInputs(args.signer, args.utxos);   // verify ALL before building
  const tx = new btc.Transaction({ allowUnknownOutputs: false });
  const keyByHex = new Map<string, Uint8Array>();

  for (const p of prepared) {
    keyByHex.set(bytesToHex(p.priv), p.priv);
    tx.addInput({
      txid: p.u.txid, index: p.u.vout,
      witnessUtxo: { script: p.script, amount: p.u.value },
      tapInternalKey: p.xOnly,
    });
  }

  tx.addOutputAddress(args.destination, output, NET);

  signWithAll(tx, [...keyByHex.values()]);
  tx.finalize();
  assertAllSigned(tx);

  return {
    hex:          bytesToHex(tx.extract()),
    txid:         tx.id,
    feeGrains:    fee,
    changeGrains: 0n,
    inputCount:   args.utxos.length,
  };
}
