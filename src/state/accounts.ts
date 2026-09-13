// Resolves the *currently selected* account into the things the rest of the app
// needs: a wallet scan, a signer, and (for export) its private key. Bridges the
// vault's account descriptors with the in-session secrets — the master HD key
// for primary HD accounts, an opened imported seed for seed accounts, and the
// sealed key for imported single-key accounts.

import {
  selectedAccount, accountDerivation, getImportedKey, getSeedMnemonic,
  type HdAccountDescriptor,
} from '@/storage/vault';
import { getHD, getMnemonic } from './session';
import { scanWallet, scanSingleAddress, type WalletScan } from '@/pearl/hdwallet';
import { hdSigner, importedSigner, type AccountSigner } from '@/pearl/transaction';
import { mnemonicToHDKey, getPrivateKey, deriveAddress } from '@/pearl/wallet';
import { bytesToHex } from '@/pearl/bytes';
import type { HDKey } from '@scure/bip32';
import type { PearlNetwork } from '@/pearl/network';

// The HD key an HD account derives from: the in-session master, or an imported
// seed opened on demand with the master mnemonic.
async function hdForAccount(acc: HdAccountDescriptor): Promise<HDKey> {
  if (!acc.seedId) {
    const hd = getHD();
    if (!hd) throw new Error('Wallet is locked.');
    return hd;
  }
  const master = getMnemonic();
  if (!master) throw new Error('Wallet is locked.');
  const phrase = await getSeedMnemonic(acc.seedId, master);
  if (!phrase) throw new Error('Could not open the imported seed.');
  return mnemonicToHDKey(phrase);
}

export async function scanCurrentAccount(network: PearlNetwork): Promise<WalletScan> {
  const acc = await selectedAccount();
  if (!acc) throw new Error('No account selected.');
  if (acc.type === 'imported') return scanSingleAddress(acc.address);
  const hd = await hdForAccount(acc);
  return scanWallet(hd, network, accountDerivation(acc) ?? undefined);
}

export async function buildCurrentSigner(network: PearlNetwork): Promise<AccountSigner> {
  const acc = await selectedAccount();
  if (!acc) throw new Error('No account selected.');

  if (acc.type === 'hd') {
    const hd = await hdForAccount(acc);
    return hdSigner(hd, network, accountDerivation(acc) ?? undefined);
  }

  const mnemonic = getMnemonic();
  if (!mnemonic) throw new Error('Wallet is locked.');
  const priv = await getImportedKey(acc.id, mnemonic);
  if (!priv) throw new Error('Could not open the imported key.');
  return importedSigner(priv, network);
}

// Export the private key for the selected account. For an imported account
// that's its single key; for an HD account it's the key of its primary
// (receive #0) address — the recovery phrase still backs up every address.
export async function exportCurrentPrivateKey(network: PearlNetwork): Promise<{ address: string; hex: string }> {
  const acc = await selectedAccount();
  if (!acc) throw new Error('No account selected.');

  if (acc.type === 'imported') {
    const mnemonic = getMnemonic();
    if (!mnemonic) throw new Error('Wallet is locked.');
    const priv = await getImportedKey(acc.id, mnemonic);
    if (!priv) throw new Error('Could not open the imported key.');
    return { address: acc.address, hex: bytesToHex(priv) };
  }

  const hd    = await hdForAccount(acc);
  const deriv = accountDerivation(acc) ?? undefined;
  const priv  = getPrivateKey(hd, 0, 0, network, deriv);
  return { address: deriveAddress(hd, 0, 0, network, deriv).address, hex: bytesToHex(priv) };
}
