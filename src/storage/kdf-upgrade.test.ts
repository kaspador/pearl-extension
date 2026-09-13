// Password stretching went from 100k to 600k PBKDF2 iterations. These tests
// pin the migration: old vaults open, get upgraded only after a correct
// password, and never end up in a state that no longer opens.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import F from '@/golden/fixtures.json';
import {
  seal, open, sealWithPassword, sealWithSecret, boxIterations, PASSWORD_ITERS, type SealedBox,
} from '@/pearl/crypto';
import {
  createWallet, unlockMnemonic, changePassword, readSealed, importPrivateKeyAccount, getImportedKey,
} from './vault';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const WALLET_KEY = 'pearlchain.wallet.v1';

function installChromeStub(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: {
      get: (keys: string[], cb: (r: Record<string, unknown>) => void) =>
        cb(Object.fromEntries(keys.map(k => [k, store[k]]))),
      set: (obj: Record<string, unknown>, cb: () => void) => { Object.assign(store, obj); cb(); },
      remove: (keys: string[], cb: () => void) => { keys.forEach(k => delete store[k]); cb(); },
    } },
  };
  return store;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('box format', () => {
  it('password boxes are v2 at 600k; secret-keyed boxes keep the v1 shape', async () => {
    const p = await sealWithPassword('x', 'pw');
    expect(p.v).toBe(2);
    expect(boxIterations(p)).toBe(PASSWORD_ITERS);
    const s = await sealWithSecret('x', MNEMONIC);
    expect(s.v).toBe(1);
    expect(Object.keys(s).sort()).toEqual(['ct', 'iv', 'salt', 'v']);
  });

  it('rejects unknown versions and out-of-range iteration counts', async () => {
    const good = await seal('x', 'pw', 150_000) as Extract<SealedBox, { v: 2 }>;
    expect(await open(good, 'pw')).toBe('x');
    expect(await open({ ...good, it: 50_000 }, 'pw')).toBeNull();
    expect(await open({ ...good, it: 1e9 }, 'pw')).toBeNull();
    expect(await open({ ...good, v: 3 } as unknown as SealedBox, 'pw')).toBeNull();
    await expect(seal('x', 'pw', 10)).rejects.toThrow();
  });

  it('a wrong password or tampered ciphertext opens to null', async () => {
    const b = await sealWithPassword('secret', 'pw');
    expect(await open(b, 'nope')).toBeNull();
    const ct = b.ct.slice(0, -4) + (b.ct.endsWith('AAA=') ? 'BBB=' : 'AAA=');
    expect(await open({ ...b, ct }, 'pw')).toBeNull();
  });

  it('WebCrypto and the JS fallback derive the same key', async () => {
    const viaWebCrypto = await seal('same key', 'pw', 120_000);
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });   // no subtle
    expect(globalThis.crypto.subtle).toBeUndefined();
    expect(await open(viaWebCrypto, 'pw')).toBe('same key');
    const viaJs = await seal('other way', 'pw', 120_000);
    vi.unstubAllGlobals();
    expect(await open(viaJs, 'pw')).toBe('other way');
  });
});

describe('vault upgrade on unlock', () => {
  let store: Record<string, unknown>;
  beforeEach(() => {
    store = installChromeStub();
    store[WALLET_KEY] = { sealed: F.vault.box, version: 1 };   // exactly as 1.3.1 left it
  });

  it('a wrong password changes nothing', async () => {
    expect(await unlockMnemonic('wrong')).toBeNull();
    expect((store[WALLET_KEY] as { sealed: SealedBox }).sealed).toEqual(F.vault.box);
  });

  it('the right password opens the 1.3.1 vault and re-seals it at 600k', async () => {
    expect(await unlockMnemonic(F.vault.password)).toBe(F.vault.plaintext);
    const after = (await readSealed())!.sealed;
    expect(after.v).toBe(2);
    expect(boxIterations(after)).toBe(PASSWORD_ITERS);
    expect(await unlockMnemonic(F.vault.password)).toBe(F.vault.plaintext);   // still opens
    expect(await unlockMnemonic('wrong')).toBeNull();
  });

  it('an already upgraded vault is not rewritten on every unlock', async () => {
    await unlockMnemonic(F.vault.password);
    const first = JSON.stringify((await readSealed())!.sealed);
    await unlockMnemonic(F.vault.password);
    expect(JSON.stringify((await readSealed())!.sealed)).toBe(first);
  });
});

describe('vault flows on the new format', () => {
  beforeEach(() => installChromeStub());

  it('create, unlock, change password', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'first-pass', network: 'mainnet' });
    expect((await readSealed())!.sealed.v).toBe(2);
    expect(await unlockMnemonic('first-pass')).toBe(MNEMONIC);
    expect(await changePassword('bad', 'second-pass')).toBe(false);
    expect(await changePassword('first-pass', 'second-pass')).toBe(true);
    expect(await unlockMnemonic('first-pass')).toBeNull();
    expect(await unlockMnemonic('second-pass')).toBe(MNEMONIC);
  });

  it('imported keys still round-trip after an upgrade', async () => {
    await createWallet({ mnemonic: MNEMONIC, password: 'pw-123456', network: 'mainnet' });
    const acct = await importPrivateKeyAccount({ keyInput: '33'.repeat(32), mnemonic: MNEMONIC });
    expect(await getImportedKey(acct.id, MNEMONIC)).not.toBeNull();
  });
});
