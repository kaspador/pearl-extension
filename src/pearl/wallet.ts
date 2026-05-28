// Pearl wallet: BIP-39 mnemonic + BIP-86 Taproot derivation.

import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { type PearlNetwork, getNetwork } from './network';
import { pubkeyToTaprootAddress } from './address';
import { bytesToHex } from './bytes';

export interface WalletAccount {
  index:     number;
  chain:     0 | 1;
  address:   string;
  publicKey: string;
  path:      string;
}

function taprootPath(coinType: number, chain: 0 | 1, index: number): string {
  return `m/86'/${coinType}'/0'/${chain}/${index}`;
}

export function toXOnlyPubkey(pubkey: Uint8Array): Uint8Array {
  return pubkey.length === 33 ? pubkey.slice(1) : pubkey;
}

export function generateWalletMnemonic(): string {
  return generateMnemonic(wordlist, 128); // 12 words
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim(), wordlist);
}

export async function mnemonicToHDKey(mnemonic: string): Promise<HDKey> {
  const seed = await mnemonicToSeed(mnemonic);
  return HDKey.fromMasterSeed(seed);
}

export function deriveAddress(
  hd: HDKey, chain: 0 | 1, index: number, network: PearlNetwork = 'mainnet',
): WalletAccount {
  const { coinType } = getNetwork(network);
  const path  = taprootPath(coinType, chain, index);
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

export function deriveAccount(hd: HDKey, index: number, network: PearlNetwork = 'mainnet'): WalletAccount {
  return deriveAddress(hd, 0, index, network);
}

export function getPrivateKey(
  hd: HDKey, chain: 0 | 1, index: number, network: PearlNetwork = 'mainnet',
): Uint8Array {
  const { coinType } = getNetwork(network);
  const path  = taprootPath(coinType, chain, index);
  const child = hd.derive(path);
  if (!child.privateKey) throw new Error('No private key at ' + path);
  return child.privateKey;
}
