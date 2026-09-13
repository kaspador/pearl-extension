// Password-based encryption for wallet secrets. PBKDF2-HMAC-SHA256 → 32-byte
// key → AES-256-GCM with a random 16-byte salt and 12-byte nonce per box.
//
// Box versions:
//   v1  100,000 iterations, implied. Written by 1.3.1 and earlier.
//   v2  iteration count stored in the box. New password boxes use 600,000,
//       the OWASP 2023 figure for PBKDF2-HMAC-SHA256.
//
// Both open forever. The password-sealed master mnemonic is re-sealed as v2 on
// the next successful unlock (see storage/vault.ts). Boxes keyed by the master
// MNEMONIC (imported keys, extra seeds) stay at 100,000: their secret already
// has 128+ bits of entropy, so stretching adds nothing but unlock time.
//
// PBKDF2 runs in WebCrypto (native, several times faster than JS), with the
// noble implementation as a fallback. Both produce identical keys.

import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { bytesToBase64, base64ToBytes } from './bytes';

export const PASSWORD_ITERS = 600_000;
export const SECRET_ITERS   = 100_000;   // for high-entropy secrets (the mnemonic)
const V1_ITERS  = 100_000;
const MIN_ITERS = 100_000;
const MAX_ITERS = 10_000_000;            // refuse absurd values rather than hang the popup
const KEY_LEN   = 32;
const SALT_LEN  = 16;
const NONCE_LEN = 12;

export interface SealedBoxV1 { v: 1; salt: string; iv: string; ct: string }
export interface SealedBoxV2 { v: 2; kdf: 'pbkdf2-sha256'; it: number; salt: string; iv: string; ct: string }
export type SealedBox = SealedBoxV1 | SealedBoxV2;

async function deriveKey(secret: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const pw = new TextEncoder().encode(secret);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const base = await subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, KEY_LEN * 8,
      );
      return new Uint8Array(bits);
    } catch { /* fall through to the JS implementation */ }
  }
  return pbkdf2Async(sha256, pw, salt, { c: iterations, dkLen: KEY_LEN });
}

export function boxIterations(box: SealedBox): number | null {
  if (box?.v === 1) return V1_ITERS;
  if (box?.v === 2 && box.kdf === 'pbkdf2-sha256' && Number.isInteger(box.it)
      && box.it >= MIN_ITERS && box.it <= MAX_ITERS) return box.it;
  return null;
}

export async function seal(plaintext: string, secret: string, iterations: number): Promise<SealedBox> {
  if (!Number.isInteger(iterations) || iterations < MIN_ITERS || iterations > MAX_ITERS) {
    throw new Error('Invalid key-derivation iteration count.');
  }
  const salt  = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key   = await deriveKey(secret, salt, iterations);
  const ct    = gcm(key, nonce).encrypt(new TextEncoder().encode(plaintext));
  const b64   = { salt: bytesToBase64(salt), iv: bytesToBase64(nonce), ct: bytesToBase64(ct) };
  // 100k keeps the v1 shape, so older builds can still open mnemonic-keyed boxes.
  return iterations === V1_ITERS
    ? { v: 1, ...b64 }
    : { v: 2, kdf: 'pbkdf2-sha256', it: iterations, ...b64 };
}

export async function open(box: SealedBox, secret: string): Promise<string | null> {
  const iterations = boxIterations(box);
  if (iterations === null) return null;
  try {
    const key = await deriveKey(secret, base64ToBytes(box.salt), iterations);
    const pt  = gcm(key, base64ToBytes(box.iv)).decrypt(base64ToBytes(box.ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;   // wrong secret / tampered ciphertext
  }
}

/** Seal with a user-chosen password (strong stretching). */
export const sealWithPassword = (plaintext: string, password: string) => seal(plaintext, password, PASSWORD_ITERS);
/** Seal with a high-entropy secret such as the master mnemonic. */
export const sealWithSecret   = (plaintext: string, secret: string) => seal(plaintext, secret, SECRET_ITERS);
/** Open any box version. */
export const openWithPassword = open;
