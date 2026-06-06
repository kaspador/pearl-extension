// Resolves the *currently selected* account into the two things the rest of the
// app needs: a wallet scan (balance/utxos/addresses) and a signer. Bridges the
// vault's account descriptors with the in-session secrets (master HD key for HD
// accounts, the sealed key for imported accounts).

import { selectedAccount, accountDerivation, getImportedKey } from '@/storage/vault';
import { getHD, getMnemonic } from './session';
import { scanWallet, scanSingleAddress, type WalletScan } from '@/pearl/hdwallet';
import { hdSigner, importedSigner, type AccountSigner } from '@/pearl/transaction';
import type { PearlNetwork } from '@/pearl/network';

export async function scanCurrentAccount(network: PearlNetwork): Promise<WalletScan> {
  const acc = await selectedAccount();
  if (!acc) throw new Error('No account selected.');
  if (acc.type === 'imported') return scanSingleAddress(acc.address);

  const hd = getHD();
  if (!hd) throw new Error('Wallet is locked.');
  return scanWallet(hd, network, accountDerivation(acc) ?? undefined);
}

export async function buildCurrentSigner(network: PearlNetwork): Promise<AccountSigner> {
  const acc = await selectedAccount();
  if (!acc) throw new Error('No account selected.');

  if (acc.type === 'hd') {
    const hd = getHD();
    if (!hd) throw new Error('Wallet is locked.');
    return hdSigner(hd, network, accountDerivation(acc) ?? undefined);
  }

  const mnemonic = getMnemonic();
  if (!mnemonic) throw new Error('Wallet is locked.');
  const priv = await getImportedKey(acc.id, mnemonic);
  if (!priv) throw new Error('Could not open the imported key.');
  return importedSigner(priv, network);
}
