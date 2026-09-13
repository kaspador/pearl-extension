// Pearl wallet: BIP-39 mnemonic + BIP-86 Taproot derivation.

import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { base58check } from '@scure/base';
import { type PearlNetwork, getNetwork } from './network';
import { pubkeyToTaprootAddress } from './address';
import { bytesToHex, hexToBytes } from './bytes';

export interface WalletAccount {
  index:     number;
  chain:     0 | 1;
  address:   string;
  publicKey: string;
  path:      string;
}

// Which BIP-86 sub-tree to derive within a seed: coin type + account index.
// Wallets created in-app always use the network's coin type and account 0; a
// SECOND account is the same coin type at account 1, 2, …, and an IMPORTED seed
// may live under a different coin type (see pearl/import.ts smart detection).
export interface Derivation {
  coinType: number;
  account:  number;
}

export function defaultDerivation(network: PearlNetwork = 'mainnet'): Derivation {
  return { coinType: getNetwork(network).coinType, account: 0 };
}

function taprootPath(coinType: number, account: number, chain: 0 | 1, index: number): string {
  return `m/86'/${coinType}'/${account}'/${chain}/${index}`;
}

export function toXOnlyPubkey(pubkey: Uint8Array): Uint8Array {
  return pubkey.length === 33 ? pubkey.slice(1) : pubkey;
}

export function generateWalletMnemonic(words: 12 | 24 = 12): string {
  return generateMnemonic(wordlist, words === 24 ? 256 : 128);
}

// Accepts 12 or 24 words — @scure/bip39 validateMnemonic verifies the checksum
// for any standard BIP-39 length, so importers from 24-word wallets work too.
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim(), wordlist);
}

export async function mnemonicToHDKey(mnemonic: string): Promise<HDKey> {
  const seed = await mnemonicToSeed(mnemonic.trim());
  return HDKey.fromMasterSeed(seed);
}

export function deriveAddress(
  hd: HDKey, chain: 0 | 1, index: number, network: PearlNetwork = 'mainnet', deriv?: Derivation,
): WalletAccount {
  const d = deriv ?? defaultDerivation(network);
  const path  = taprootPath(d.coinType, d.account, chain, index);
  const child = hd.derive(path);
  if (!child.publicKey) throw new Error('No public key at ' + path);
  const xOnly = toXOnlyPubkey(child.publicKey);
  return {
    index, chain,
    address:   pubkeyToTaprootAddress(xOnly, network),
    publicKey: bytesToHex(child.publicKey),
    path,
  };
}

export function deriveAccount(
  hd: HDKey, index: number, network: PearlNetwork = 'mainnet', deriv?: Derivation,
): WalletAccount {
  return deriveAddress(hd, 0, index, network, deriv);
}

export function getPrivateKey(
  hd: HDKey, chain: 0 | 1, index: number, network: PearlNetwork = 'mainnet', deriv?: Derivation,
): Uint8Array {
  const d = deriv ?? defaultDerivation(network);
  const path  = taprootPath(d.coinType, d.account, chain, index);
  const child = hd.derive(path);
  if (!child.privateKey) throw new Error('No private key at ' + path);
  return child.privateKey;
}

// ── Single private-key import (no HD derivation) ──────────────────────────────
// A raw key maps to exactly one x-only pubkey → one Taproot address, so there's
// no derivation path to guess. Accepts 64-char hex (optional 0x) or WIF.

function assertValidScalar(k: Uint8Array): void {
  if (k.length !== 32 || !secp256k1.utils.isValidPrivateKey(k)) {
    throw new Error('Invalid private key value.');
  }
}

export function parsePrivateKey(input: string): Uint8Array {
  const s = (input ?? '').trim();
  if (!s) throw new Error('Empty private key.');

  // 64-char hex (with or without 0x prefix)
  const hex = s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    const k = hexToBytes(hex);
    assertValidScalar(k);
    return k;
  }

  // WIF (base58check): [version][32-byte key][optional 0x01 compression flag]
  try {
    const dec = base58check(sha256).decode(s);
    if (dec.length === 34 && dec[33] === 0x01) { const k = dec.slice(1, 33); assertValidScalar(k); return k; }
    if (dec.length === 33)                     { const k = dec.slice(1, 33); assertValidScalar(k); return k; }
  } catch { /* not valid base58check — fall through to the error below */ }

  throw new Error('Not a valid private key (expected 64-character hex or WIF).');
}

export function privateKeyToAddress(priv: Uint8Array, network: PearlNetwork = 'mainnet'): string {
  const xOnly = toXOnlyPubkey(secp256k1.getPublicKey(priv, true));
  return pubkeyToTaprootAddress(xOnly, network);
}
