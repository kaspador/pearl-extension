// Wallet-at-rest. Mirrors the mobile design but on chrome.storage.local
// instead of expo-secure-store.
//
// Two layers of protection:
//  1. The master mnemonic is encrypted with AES-256-GCM via a key derived from
//     the user's password (PBKDF2 100k iters) — this is the real boundary.
//     Imported single keys are sealed with the MASTER MNEMONIC as the secret, so
//     unlocking the wallet (which yields the mnemonic) can open them without a
//     second password, and a password change never has to touch them.
//  2. chrome.storage.local is sandboxed to the extension origin (other web
//     pages can't read it). It's NOT encrypted at rest — that's why layer 1
//     is essential.
//
// v2 adds multiple accounts: one master seed can expose several BIP-86 HD
// accounts (account 0', 1', …) plus imported single keys, MetaMask-style.

import { sealWithPassword, openWithPassword, type SealedBox } from '@/pearl/crypto';
import { parsePrivateKey, privateKeyToAddress, defaultDerivation, mnemonicToHDKey, deriveAddress, type Derivation } from '@/pearl/wallet';
import { getNetwork } from '@/pearl/network';
import { bytesToHex, hexToBytes } from '@/pearl/bytes';

const WALLET_KEY   = 'pearlchain.wallet.v1';     // sealed master mnemonic
const META_KEY     = 'pearlchain.wallet.meta';
const IMPORTED_KEY = 'pearlchain.wallet.imported'; // { [accountId]: SealedBox(privHex) }
const SEEDS_KEY    = 'pearlchain.wallet.seeds';    // { [seedId]: SealedBox(mnemonic) } — imported seed phrases

type Network = 'mainnet' | 'testnet';

export type BackendMode = 'pearlchain' | 'blockbook';

// ── Account model ─────────────────────────────────────────────────────────────
export interface HdAccountDescriptor {
  id:       string;
  label:    string;
  type:     'hd';
  coinType: number;   // BIP-86 coin type (usually the network's; smart-import may differ)
  account:  number;   // BIP-86 account index (0, 1, 2, …)
  seedId?:  string;   // which seed this derives from; absent = the primary master mnemonic
}
export interface ImportedAccountDescriptor {
  id:      string;
  label:   string;
  type:    'imported';
  address: string;    // the single address this key controls (public — safe to store)
}
export type AccountDescriptor = HdAccountDescriptor | ImportedAccountDescriptor;

export function accountDerivation(acc: AccountDescriptor): Derivation | null {
  return acc.type === 'hd' ? { coinType: acc.coinType, account: acc.account } : null;
}

export interface WalletMeta {
  createdAt:         number;
  network:           Network;
  explorerUrl?:      string;
  explorerMode?:     BackendMode;
  autoLockMins?:     number;           // -1 = never, 0 = immediately, N min; default 5
  accounts:          AccountDescriptor[];
  selectedAccountId: string;
  version:           2;
}

interface StoredWallet { sealed: SealedBox; version: 1 }
type ImportedStore = Record<string, SealedBox>;
type SeedStore     = Record<string, SealedBox>;

function get<T>(key: string): Promise<T | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([key], (res) => resolve((res[key] as T) ?? null));
  });
}
function set<T>(key: string, value: T): Promise<void> {
  return new Promise(resolve => { chrome.storage.local.set({ [key]: value }, () => resolve()); });
}
function remove(...keys: string[]): Promise<void> {
  return new Promise(resolve => { chrome.storage.local.remove(keys, () => resolve()); });
}

function newId(): string {
  return (crypto.randomUUID?.() ?? `acct_${Date.now()}_${Math.random().toString(36).slice(2)}`);
}

export async function hasWallet(): Promise<boolean> {
  return !!(await get<{ version?: number }>(META_KEY));
}

// Loads metadata, migrating a v1 record (single implicit account) to v2 in place.
// Migration is metadata-only (the default account is the network's standard
// BIP-86 account 0), so it needs no password and is fully transparent.
export async function loadMeta(): Promise<WalletMeta | null> {
  const raw = await get<Record<string, unknown>>(META_KEY);
  if (!raw) return null;
  if (raw.version === 2 && Array.isArray(raw.accounts)) return raw as unknown as WalletMeta;

  const network = (raw.network as Network) ?? 'mainnet';
  const primary: HdAccountDescriptor = {
    id: newId(), label: 'Account 1', type: 'hd',
    coinType: getNetwork(network).coinType, account: 0,
  };
  const next: WalletMeta = {
    createdAt:    (raw.createdAt as number) ?? Date.now(),
    network,
    explorerUrl:  raw.explorerUrl as string | undefined,
    explorerMode: raw.explorerMode as BackendMode | undefined,
    autoLockMins: (raw.autoLockMins as number | undefined) ?? 5,
    accounts:     [primary],
    selectedAccountId: primary.id,
    version: 2,
  };
  await set(META_KEY, next);
  return next;
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
  derivation?:   Derivation;     // from smart-import detection; defaults to the standard
}): Promise<void> {
  const network = args.network ?? 'mainnet';
  const deriv   = args.derivation ?? defaultDerivation(network);
  const sealed  = sealWithPassword(args.mnemonic, args.password);
  await set(WALLET_KEY, { sealed, version: 1 } satisfies StoredWallet);

  const primary: HdAccountDescriptor = {
    id: newId(), label: 'Account 1', type: 'hd', coinType: deriv.coinType, account: deriv.account,
  };
  const meta: WalletMeta = {
    createdAt:    Date.now(),
    network,
    explorerUrl:  args.explorerUrl,
    explorerMode: args.explorerMode,
    autoLockMins: 5,
    accounts:     [primary],
    selectedAccountId: primary.id,
    version: 2,
  };
  await set(META_KEY, meta);
  await remove(IMPORTED_KEY, SEEDS_KEY);   // fresh wallet — no imported keys/seeds
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
  // Imported keys are sealed with the mnemonic, not the password — untouched.
  return true;
}

export async function clearWallet(): Promise<void> {
  await remove(WALLET_KEY, META_KEY, IMPORTED_KEY, SEEDS_KEY);
}

// ── Account management ────────────────────────────────────────────────────────

export async function listAccounts(): Promise<AccountDescriptor[]> {
  return (await loadMeta())?.accounts ?? [];
}

export async function selectedAccount(): Promise<AccountDescriptor | null> {
  const meta = await loadMeta();
  if (!meta) return null;
  return meta.accounts.find(a => a.id === meta.selectedAccountId) ?? meta.accounts[0] ?? null;
}

export async function selectAccount(id: string): Promise<void> {
  const meta = await loadMeta();
  if (!meta || !meta.accounts.some(a => a.id === id)) return;
  await set(META_KEY, { ...meta, selectedAccountId: id });
}

export async function renameAccount(id: string, label: string): Promise<void> {
  const meta = await loadMeta();
  if (!meta) return;
  const accounts = meta.accounts.map(a => a.id === id ? { ...a, label: label.trim() || a.label } : a);
  await set(META_KEY, { ...meta, accounts });
}

// Add the next HD account (account index = max existing + 1) on the same coin
// type as the primary HD account. Derivation is public, so no secret needed.
export async function addHdAccount(label?: string): Promise<HdAccountDescriptor | null> {
  const meta = await loadMeta();
  if (!meta) return null;
  const hdAccts = meta.accounts.filter((a): a is HdAccountDescriptor => a.type === 'hd');
  const coinType = hdAccts[0]?.coinType ?? getNetwork(meta.network).coinType;
  const nextIndex = hdAccts.reduce((m, a) => Math.max(m, a.account), -1) + 1;
  const acct: HdAccountDescriptor = {
    id: newId(),
    label: (label?.trim()) || `Account ${meta.accounts.length + 1}`,
    type: 'hd', coinType, account: nextIndex,
  };
  await set(META_KEY, { ...meta, accounts: [...meta.accounts, acct], selectedAccountId: acct.id });
  return acct;
}

// How many addresses per chain to derive when checking whether an imported key
// already belongs to an existing HD account. Covers realistic low-index reuse.
const OWNERSHIP_SCAN_DEPTH = 20;

// Find an existing account that already controls `address`, if any: imported
// accounts by their stored address; HD accounts by deriving their first
// OWNERSHIP_SCAN_DEPTH receive + change addresses. Prevents importing a key (or
// the key you just exported) that the wallet already holds as a duplicate.
async function accountOwning(address: string, masterMnemonic: string, accounts: AccountDescriptor[], network: Network): Promise<AccountDescriptor | null> {
  for (const a of accounts) {
    if (a.type === 'imported') {
      if (a.address === address) return a;
      continue;
    }
    let phrase = masterMnemonic;
    if (a.seedId) {
      const m = await getSeedMnemonic(a.seedId, masterMnemonic);
      if (!m) continue;
      phrase = m;
    }
    const hd = await mnemonicToHDKey(phrase);
    const deriv = { coinType: a.coinType, account: a.account };
    for (const chain of [0, 1] as const) {
      for (let i = 0; i < OWNERSHIP_SCAN_DEPTH; i++) {
        if (deriveAddress(hd, chain, i, network, deriv).address === address) return a;
      }
    }
  }
  return null;
}

// Import a single private key (hex or WIF) as a new account. The key is sealed
// with the master mnemonic so it can be opened whenever the wallet is unlocked.
export async function importPrivateKeyAccount(args: {
  keyInput: string; mnemonic: string; label?: string;
}): Promise<ImportedAccountDescriptor> {
  const meta = await loadMeta();
  if (!meta) throw new Error('No wallet.');

  const priv    = parsePrivateKey(args.keyInput);
  const address = privateKeyToAddress(priv, meta.network);

  const owner = await accountOwning(address, args.mnemonic, meta.accounts, meta.network);
  if (owner) {
    throw new Error(`That key already belongs to “${owner.label}”.`);
  }

  const store = (await get<ImportedStore>(IMPORTED_KEY)) ?? {};
  const acct: ImportedAccountDescriptor = {
    id: newId(),
    label: (args.label?.trim()) || `Imported ${meta.accounts.filter(a => a.type === 'imported').length + 1}`,
    type: 'imported', address,
  };
  store[acct.id] = sealWithPassword(bytesToHex(priv), args.mnemonic);
  await set(IMPORTED_KEY, store);
  await set(META_KEY, { ...meta, accounts: [...meta.accounts, acct], selectedAccountId: acct.id });
  return acct;
}

// Open an imported account's private key (needs the unlocked mnemonic).
export async function getImportedKey(id: string, mnemonic: string): Promise<Uint8Array | null> {
  const store = await get<ImportedStore>(IMPORTED_KEY);
  const box = store?.[id];
  if (!box) return null;
  const hex = openWithPassword(box, mnemonic);
  return hex ? hexToBytes(hex) : null;
}

// Import a SECOND recovery phrase as its own HD account. The phrase is sealed
// with the master mnemonic (openable whenever the wallet is unlocked) and the
// account descriptor records the seedId + the detected derivation. `derivation`
// should come from smart detection; defaults to the standard path.
export async function importSeedAccount(args: {
  mnemonic: string; masterMnemonic: string; label?: string; derivation?: Derivation;
}): Promise<HdAccountDescriptor> {
  const meta = await loadMeta();
  if (!meta) throw new Error('No wallet.');
  const deriv = args.derivation ?? defaultDerivation(meta.network);

  const seedId = newId();
  const seeds  = (await get<SeedStore>(SEEDS_KEY)) ?? {};
  seeds[seedId] = sealWithPassword(args.mnemonic.trim(), args.masterMnemonic);
  await set(SEEDS_KEY, seeds);

  const acct: HdAccountDescriptor = {
    id: newId(),
    label: (args.label?.trim()) || `Imported seed ${meta.accounts.filter(a => a.type === 'hd' && a.seedId).length + 1}`,
    type: 'hd', coinType: deriv.coinType, account: deriv.account, seedId,
  };
  await set(META_KEY, { ...meta, accounts: [...meta.accounts, acct], selectedAccountId: acct.id });
  return acct;
}

// Open an imported seed's mnemonic (needs the unlocked master mnemonic).
export async function getSeedMnemonic(seedId: string, masterMnemonic: string): Promise<string | null> {
  const seeds = await get<SeedStore>(SEEDS_KEY);
  const box = seeds?.[seedId];
  if (!box) return null;
  return openWithPassword(box, masterMnemonic);
}

// Remove an account (keeps at least one). Selecting falls back to the first
// remaining account. Imported keys are wiped from storage too.
export async function removeAccount(id: string): Promise<void> {
  const meta = await loadMeta();
  if (!meta || meta.accounts.length <= 1) return;
  const removed   = meta.accounts.find(a => a.id === id);
  const accounts  = meta.accounts.filter(a => a.id !== id);
  const selectedAccountId = meta.selectedAccountId === id ? accounts[0].id : meta.selectedAccountId;
  await set(META_KEY, { ...meta, accounts, selectedAccountId });
  if (removed?.type === 'imported') {
    const store = (await get<ImportedStore>(IMPORTED_KEY)) ?? {};
    delete store[id];
    await set(IMPORTED_KEY, store);
  }
  // Drop an imported seed once no remaining account derives from it.
  if (removed?.type === 'hd' && removed.seedId && !accounts.some(a => a.type === 'hd' && a.seedId === removed.seedId)) {
    const seeds = (await get<SeedStore>(SEEDS_KEY)) ?? {};
    delete seeds[removed.seedId];
    await set(SEEDS_KEY, seeds);
  }
}
