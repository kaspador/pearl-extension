// Wallet-at-rest. Mirrors the mobile design but on chrome.storage.local
// instead of expo-secure-store.
//
// Two layers of protection:
//  1. The mnemonic is encrypted with AES-256-GCM via a key derived from the
//     user's password (PBKDF2 100k iters) — this is the real boundary.
//  2. chrome.storage.local is sandboxed to the extension origin (other web
//     pages can't read it). It's NOT encrypted at rest — that's why layer 1
//     is essential.
//
// Web Extensions don't have an OS-level biometric primitive yet. We'll add
// WebAuthn (platform authenticator → unlock cached password) in v0.2.

import { sealWithPassword, openWithPassword, type SealedBox } from '@/pearl/crypto';

const WALLET_KEY   = 'pearlchain.wallet.v1';
const META_KEY     = 'pearlchain.wallet.meta';

type Network = 'mainnet' | 'testnet';

export type BackendMode = 'pearlchain' | 'blockbook';

export interface WalletMeta {
  createdAt:     number;
  network:       Network;
  explorerUrl?:  string;
  explorerMode?: BackendMode;
  autoLockMins?: number;           // -1 = never, 0 = immediately, N min; default 5
  version:       1;
}

interface StoredWallet { sealed: SealedBox; version: 1 }

function get<T>(key: string): Promise<T | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([key], (res) => {
      resolve((res[key] as T) ?? null);
    });
  });
}

function set<T>(key: string, value: T): Promise<void> {
  return new Promise(resolve => { chrome.storage.local.set({ [key]: value }, () => resolve()); });
}

function remove(...keys: string[]): Promise<void> {
  return new Promise(resolve => { chrome.storage.local.remove(keys, () => resolve()); });
}

export async function hasWallet(): Promise<boolean> {
  return !!(await get<WalletMeta>(META_KEY));
}

export async function loadMeta(): Promise<WalletMeta | null> {
  return get<WalletMeta>(META_KEY);
}

export async function updateMeta(patch: Partial<WalletMeta>): Promise<WalletMeta | null> {
  const meta = await loadMeta();
  if (!meta) return null;
  const next: WalletMeta = { ...meta, ...patch };
  await set(META_KEY, next);
  return next;
}

export async function createWallet(args: {
  mnemonic: string;
  password: string;
  network?: Network;
  explorerUrl?:  string;
  explorerMode?: BackendMode;
}): Promise<void> {
  const network = args.network ?? 'mainnet';
  const sealed = sealWithPassword(args.mnemonic, args.password);
  const stored: StoredWallet = { sealed, version: 1 };
  await set(WALLET_KEY, stored);
  const meta: WalletMeta = {
    createdAt:    Date.now(),
    network,
    explorerUrl:  args.explorerUrl,
    explorerMode: args.explorerMode,
    autoLockMins: 5,
    version: 1,
  };
  await set(META_KEY, meta);
}

export async function readSealed(): Promise<StoredWallet | null> {
  return get<StoredWallet>(WALLET_KEY);
}

export async function unlockMnemonic(password: string): Promise<string | null> {
  const wallet = await readSealed();
  if (!wallet) return null;
  return openWithPassword(wallet.sealed, password);
}

export async function changePassword(oldPw: string, newPw: string): Promise<boolean> {
  const wallet = await readSealed();
  if (!wallet) return false;
  const mnemonic = openWithPassword(wallet.sealed, oldPw);
  if (!mnemonic) return false;
  const sealed = sealWithPassword(mnemonic, newPw);
  await set(WALLET_KEY, { sealed, version: 1 } satisfies StoredWallet);
  return true;
}

export async function clearWallet(): Promise<void> {
  await remove(WALLET_KEY, META_KEY);
}
