import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadMeta, createWallet, listAccounts, selectedAccount, selectAccount,
  addHdAccount, importPrivateKeyAccount, getImportedKey, removeAccount,
  importSeedAccount, getSeedMnemonic,
} from './vault';
import { privateKeyToAddress, parsePrivateKey, mnemonicToHDKey, getPrivateKey } from '@/pearl/wallet';
import { bytesToHex } from '@/pearl/bytes';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const KEY_HEX  = '3333333333333333333333333333333333333333333333333333333333333333';

// In-memory chrome.storage.local stub matching the vault's get/set/remove usage.
function installChromeStub(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: (keys: string[], cb: (r: Record<string, unknown>) => void) =>
          cb(Object.fromEntries(keys.map(k => [k, store[k]]))),
        set: (obj: Record<string, unknown>, cb: () => void) => { Object.assign(store, obj); cb(); },
        remove: (keys: string[], cb: () => void) => { keys.forEach(k => delete store[k]); cb(); },
      },
    },
  };
  return store;
}

describe('vault v1 → v2 migration', () => {
  it('synthesises a default account from a legacy v1 meta record', async () => {
    const store = installChromeStub();
    store['pearlchain.wallet.meta'] = { version: 1, network: 'mainnet', createdAt: 1, autoLockMins: 5 };

    const meta = await loadMeta();
    expect(meta?.version).toBe(2);
    expect(meta?.accounts).toHaveLength(1);
    const acc = meta!.accounts[0];
    expect(acc.type).toBe('hd');
    expect(acc.type === 'hd' && acc.coinType).toBe(808276);
    expect(acc.type === 'hd' && acc.account).toBe(0);
    expect(meta?.selectedAccountId).toBe(acc.id);
  });
});

describe('account management', () => {
  beforeEach(() => installChromeStub());

  it('createWallet seeds one HD account', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'password123', network: 'mainnet' });
    const accts = await listAccounts();
    expect(accts).toHaveLength(1);
    expect(accts[0].type).toBe('hd');
  });

  it('respects a smart-import derivation', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'password123', network: 'mainnet', derivation: { coinType: 0, account: 2 } });
    const acc = (await listAccounts())[0];
    expect(acc.type === 'hd' && acc.coinType).toBe(0);
    expect(acc.type === 'hd' && acc.account).toBe(2);
  });

  it('addHdAccount appends the next account index and selects it', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'password123', network: 'mainnet' });
    const added = await addHdAccount('Savings');
    expect(added?.account).toBe(1);
    const sel = await selectedAccount();
    expect(sel?.id).toBe(added?.id);
    expect(sel?.label).toBe('Savings');
  });

  it('imports a private key, round-trips it, and rejects duplicates', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'password123', network: 'mainnet' });
    const acc = await importPrivateKeyAccount({ keyInput: KEY_HEX, mnemonic: MNEMONIC });
    expect(acc.type).toBe('imported');
    expect(acc.address).toBe(privateKeyToAddress(parsePrivateKey(KEY_HEX), 'mainnet'));

    const opened = await getImportedKey(acc.id, MNEMONIC);
    expect(opened && bytesToHex(opened)).toBe(KEY_HEX);

    await expect(importPrivateKeyAccount({ keyInput: KEY_HEX, mnemonic: MNEMONIC })).rejects.toThrow();
  });

  it('rejects importing a private key already controlled by an HD account', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'password123', network: 'mainnet' });
    // The exported key of the primary HD account (receive #0) must not re-import.
    const hd  = await mnemonicToHDKey(MNEMONIC);
    const hex = bytesToHex(getPrivateKey(hd, 0, 0, 'mainnet'));
    await expect(importPrivateKeyAccount({ keyInput: hex, mnemonic: MNEMONIC })).rejects.toThrow();
    expect(await listAccounts()).toHaveLength(1);   // nothing added
  });

  it('imports a second recovery phrase as an HD account and round-trips it', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'password123', network: 'mainnet' });
    const SEED2 = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    const acc = await importSeedAccount({ mnemonic: SEED2, masterMnemonic: MNEMONIC, derivation: { coinType: 808276, account: 0 } });
    expect(acc.type).toBe('hd');
    expect(acc.seedId).toBeTruthy();
    expect((await selectedAccount())?.id).toBe(acc.id);
    expect(await getSeedMnemonic(acc.seedId!, MNEMONIC)).toBe(SEED2);
  });

  it('switches the selected account and removes one (keeping ≥1)', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'password123', network: 'mainnet' });
    const a = await listAccounts();
    const added = await addHdAccount();
    await selectAccount(a[0].id);
    expect((await selectedAccount())?.id).toBe(a[0].id);

    await removeAccount(added!.id);
    expect(await listAccounts()).toHaveLength(1);

    // Cannot remove the last remaining account.
    await removeAccount(a[0].id);
    expect(await listAccounts()).toHaveLength(1);
  });
});
