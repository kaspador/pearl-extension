// Password-based encryption for the mnemonic. PBKDF2-HMAC-SHA256 → 32-byte
// key → AES-256-GCM with random 16-byte salt + 12-byte nonce per encryption.
// Ported from pearlchain-mobile/src/pearl/crypto.ts, swapping Buffer for
// browser base64 helpers.

import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { bytesToBase64, base64ToBytes } from './bytes';

// On desktop Chrome with pure JS noble, 100k iters of HMAC-SHA256 takes
// roughly ~600ms — fast enough that we don't need the mobile's 25k crutch.
const PBKDF2_ITERS = 100_000;
const KEY_LEN      = 32;
const SALT_LEN     = 16;
const NONCE_LEN    = 12;

export interface SealedBox {
  v:    1;          // schema version
  salt: string;     // base64
  iv:   string;     // base64 (nonce)
  ct:   string;     // base64 (ciphertext+tag)
}

function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, new TextEncoder().encode(password), salt, {
    c: PBKDF2_ITERS, dkLen: KEY_LEN,
  });
}

export function sealWithPassword(plaintext: string, password: string): SealedBox {
  const salt  = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key   = deriveKey(password, salt);
  const ct    = gcm(key, nonce).encrypt(new TextEncoder().encode(plaintext));
  return { v: 1, salt: bytesToBase64(salt), iv: bytesToBase64(nonce), ct: bytesToBase64(ct) };
}

export function openWithPassword(box: SealedBox, password: string): string | null {
  if (box.v !== 1) return null;
  try {
    const salt  = base64ToBytes(box.salt);
    const nonce = base64ToBytes(box.iv);
    const ct    = base64ToBytes(box.ct);
    const key   = deriveKey(password, salt);
    const pt    = gcm(key, nonce).decrypt(ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;   // wrong password / tampered ciphertext
  }
}
