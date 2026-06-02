// Taproot key-path send. Mirrors mobile transaction.ts but Buffer-free.

import * as btc from '@scure/btc-signer';
import { secp256k1 } from '@noble/curves/secp256k1';
import { type HDKey } from '@scure/bip32';
import { decodeBech32m } from './address';
import { deriveAddress, getPrivateKey, toXOnlyPubkey } from './wallet';
import { type PearlNetwork, DUST_LIMIT } from './network';
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

// Return the private key that actually OWNS this UTXO's address. We can't blindly
// trust u.chain/u.index — if the send flow tagged a UTXO with the wrong path, the
// derived key won't match the Taproot output and btc-signer emits an EMPTY
// witness (node rejects: "witness program passed empty witness"). So we verify
// the recorded path derives this exact address, and if not, find the real path
// by matching the address across both chains.
function keyForUtxo(hd: HDKey, network: PearlNetwork, u: ScannedUtxo): Uint8Array {
  if (deriveAddress(hd, u.chain, u.index, network).address === u.address) {
    return getPrivateKey(hd, u.chain, u.index, network);
  }
  for (const chain of [0, 1] as const) {
    for (let i = 0; i < ADDR_SEARCH_MAX; i++) {
      if (deriveAddress(hd, chain, i, network).address === u.address) {
        return getPrivateKey(hd, chain, i, network);
      }
    }
  }
  throw new Error(`No signing key found for UTXO address ${u.address} — cannot sign.`);
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
  hd:           HDKey;
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
  const tx = new btc.Transaction({ allowUnknownOutputs: false });
  const keyByHex = new Map<string, Uint8Array>();
  for (const u of picked) {
    const priv  = keyForUtxo(args.hd, args.network, u);
    const xOnly = toXOnlyPubkey(secp256k1.getPublicKey(priv, true));
    keyByHex.set(bytesToHex(priv), priv);
    tx.addInput({
      txid: u.txid, index: u.vout,
      witnessUtxo: { script: addressToTaprootScript(u.address), amount: u.value },
      tapInternalKey: xOnly,
    });
  }
  tx.addOutputAddress(args.recipient, args.amount, NET);

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

export interface CompoundArgs {
  hd:          HDKey;
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

  const tx = new btc.Transaction({ allowUnknownOutputs: false });
  const keyByHex = new Map<string, Uint8Array>();

  for (const u of args.utxos) {
    const priv  = keyForUtxo(args.hd, args.network, u);
    const xOnly = toXOnlyPubkey(secp256k1.getPublicKey(priv, true));
    keyByHex.set(bytesToHex(priv), priv);
    tx.addInput({
      txid: u.txid, index: u.vout,
      witnessUtxo: { script: addressToTaprootScript(u.address), amount: u.value },
      tapInternalKey: xOnly,
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
