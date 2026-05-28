// Browser-only hex / base64 helpers. Mobile uses Buffer (RN polyfill) — the
// extension doesn't have Buffer, so we use the standard browser APIs.
// Drop-in replacement for the `Buffer.from(b).toString('hex')` calls we port.

import { bytesToHex as nobleHex, hexToBytes as nobleFromHex } from '@noble/hashes/utils';

export const bytesToHex = nobleHex;
export const hexToBytes = nobleFromHex;

export function bytesToBase64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
