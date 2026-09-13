// bech32m + Taproot key-path derivation for Pearl. Ported from mobile,
// swapping Buffer for browser hex helpers.

import { sha256 } from '@noble/hashes/sha2';
import { secp256k1 } from '@noble/curves/secp256k1';
import { type PearlNetwork, getNetwork } from './network';
import { bytesToHex } from './bytes';

const CHARSET   = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32mPolymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GENERATOR[i];
  }
  return chk;
}

function bech32mHrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function convertBits(data: Uint8Array, from: number, to: number, pad = true): number[] | null {
  let acc = 0, bits = 0;
  const ret: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) { bits -= to; ret.push((acc >> bits) & maxv); }
  }
  if (pad) {
    if (bits > 0) ret.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
    // BIP-173: leftover must be under 5 bits and all zero. Anything else is a
    // non-canonical encoding and is rejected rather than silently truncated.
    return null;
  }
  return ret;
}

export function encodeBech32m(hrp: string, witnessVersion: number, witnessProgram: Uint8Array): string {
  const data = [witnessVersion, ...convertBits(witnessProgram, 8, 5)!];
  const checksum = bech32mPolymod([...bech32mHrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 0x2bc830a3;
  let result = hrp + '1';
  for (const d of data) result += CHARSET[d];
  for (let i = 0; i < 6; i++) result += CHARSET[(checksum >> (5 * (5 - i))) & 31];
  return result;
}

export function decodeBech32m(addr: string): { hrp: string; witnessVersion: number; witnessProgram: Uint8Array } | null {
  if (typeof addr !== 'string' || addr.length > 90) return null;
  // BIP-173: an address is all-lowercase or all-uppercase, never mixed.
  if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return null;
  const lower = addr.toLowerCase();
  const sep = lower.lastIndexOf('1');
  if (sep < 1 || sep + 7 > lower.length) return null;

  const hrp     = lower.slice(0, sep);
  const dataStr = lower.slice(sep + 1);
  const data: number[] = [];
  for (const c of dataStr) {
    const idx = CHARSET.indexOf(c);
    if (idx < 0) return null;
    data.push(idx);
  }
  const polymod = bech32mPolymod([...bech32mHrpExpand(hrp), ...data]);
  if (polymod !== 0x2bc830a3) return null;

  const payload  = data.slice(0, -6);
  if (payload.length < 1) return null;
  const wVersion = payload[0];
  if (wVersion > 16) return null;
  const decoded  = convertBits(new Uint8Array(payload.slice(1)), 5, 8, false);
  if (!decoded || decoded.length < 2 || decoded.length > 40) return null;
  return { hrp, witnessVersion: wVersion, witnessProgram: new Uint8Array(decoded) };
}

function taggedHash(tag: string, data: Uint8Array): Uint8Array {
  const tagHash = sha256(new TextEncoder().encode(tag));
  const m = new Uint8Array(tagHash.length * 2 + data.length);
  m.set(tagHash, 0);
  m.set(tagHash, tagHash.length);
  m.set(data,    tagHash.length * 2);
  return sha256(m);
}

function compressedFrom(xOnly: Uint8Array): Uint8Array {
  const c = new Uint8Array(33);
  c[0] = 0x02;
  c.set(xOnly, 1);
  return c;
}

export function taprootOutputKey(internalPubkeyX: Uint8Array): Uint8Array {
  const t = taggedHash('TapTweak', internalPubkeyX);
  const G = secp256k1.Point.BASE;
  const tPoint        = G.multiply(BigInt('0x' + bytesToHex(t)));
  const internalPoint = secp256k1.Point.fromBytes(compressedFrom(internalPubkeyX));
  const outputPoint   = internalPoint.add(tPoint);
  return outputPoint.toBytes(true).slice(1); // x-only
}

export function pubkeyToTaprootAddress(xOnlyPubkey: Uint8Array, network: PearlNetwork = 'mainnet'): string {
  const { hrp } = getNetwork(network);
  return encodeBech32m(hrp, 1, taprootOutputKey(xOnlyPubkey));
}

// Output types Pearl consensus defines for PAYING to (pearld
// node/txscript/standard.go):
//   v1  Taproot, P2TR                      32-byte x-only key   (prl1p...)
//   v2  Pay-to-Merkle-Root, P2MR (BIP 360) 32-byte merkle root  (prl1z...)
// Every other witness version is reserved for future soft forks, so an output
// to it is ANYONE-CAN-SPEND under today's consensus rules and any miner can
// take the coins. A v2 program of the wrong length is unspendable. Both are
// refused.
export function isPayableWitnessProgram(version: number, programLength: number): boolean {
  return (version === 1 || version === 2) && programLength === 32;
}

export function isValidAddress(addr: string, network: PearlNetwork = 'mainnet'): boolean {
  const { hrp } = getNetwork(network);
  const d = decodeBech32m(addr);
  if (!d || d.hrp !== hrp) return false;
  return isPayableWitnessProgram(d.witnessVersion, d.witnessProgram.length);
}
