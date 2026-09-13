import { describe, it, expect, beforeEach } from 'vitest';
import { resolveProtectedCoins, protectedValue, outpointKey, type NameLookup } from './protectedCoins';

// Minimal chrome.storage.local stand-in.
const store: Record<string, unknown> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: {
      get: (keys: string[], cb: (r: Record<string, unknown>) => void) =>
        cb(Object.fromEntries(keys.filter(k => k in store).map(k => [k, store[k]]))),
      set: (obj: Record<string, unknown>, cb: () => void) => { Object.assign(store, obj); cb(); },
    } },
  };
});

const T = (c: string) => c.repeat(64);
const names: Record<string, { name: string; inscTxid: string; inscVout: number }[]> = {
  prl1a: [{ name: 'alpha', inscTxid: T('a'), inscVout: 0 }],
  prl1b: [{ name: 'beta', inscTxid: T('b'), inscVout: 2 }, { name: 'gamma', inscTxid: T('c'), inscVout: 1 }],
  prl1c: [],
};
const ok: NameLookup = async (a) => names[a] ?? [];

describe('resolveProtectedCoins', () => {
  it('collects every name coin when all lookups succeed, and saves them', async () => {
    const r = await resolveProtectedCoins('acc1', ['prl1a', 'prl1b', 'prl1c', 'prl1a'], ok);
    expect(r.verified).toBe(true);
    expect([...r.outpoints].sort()).toEqual([`${T('a')}:0`, `${T('b')}:2`, `${T('c')}:1`].sort());
    expect((store['pearlchain.protectedCoins.acc1'] as string[]).length).toBe(3);
  });

  it('on a failed lookup keeps the saved set, adds what succeeded, and reports unverified', async () => {
    await resolveProtectedCoins('acc1', ['prl1a', 'prl1b'], ok);
    const flaky: NameLookup = async (a) => (a === 'prl1b' ? null : ok(a));
    const r = await resolveProtectedCoins('acc1', ['prl1a', 'prl1b'], flaky);
    expect(r.verified).toBe(false);
    expect(r.outpoints.has(`${T('b')}:2`)).toBe(true);   // remembered from last time
    expect(r.outpoints.has(`${T('a')}:0`)).toBe(true);
  });

  it('treats a throwing lookup as a failure, not as "no names"', async () => {
    const boom: NameLookup = async () => { throw new Error('network'); };
    const r = await resolveProtectedCoins('acc2', ['prl1a'], boom);
    expect(r.verified).toBe(false);
  });

  it('does not overwrite the saved set while degraded', async () => {
    await resolveProtectedCoins('acc1', ['prl1b'], ok);
    await resolveProtectedCoins('acc1', ['prl1b'], async () => null);
    expect((store['pearlchain.protectedCoins.acc1'] as string[]).length).toBe(2);
  });

  it('keeps accounts separate', async () => {
    await resolveProtectedCoins('acc1', ['prl1b'], ok);
    const r = await resolveProtectedCoins('acc2', ['prl1b'], async () => null);
    expect(r.outpoints.size).toBe(0);
  });

  it('an account with no coins is verified with nothing protected', async () => {
    const r = await resolveProtectedCoins('acc3', [], async () => null);
    expect(r).toEqual({ outpoints: new Set(), verified: true });
  });
});

describe('protectedValue', () => {
  it('sums only protected coins', () => {
    const u = [
      { txid: T('a'), vout: 0, value: 600n },
      { txid: T('d'), vout: 0, value: 5_000_000n },
    ];
    expect(protectedValue(u, new Set([outpointKey(u[0])]))).toBe(600n);
    expect(protectedValue(u, new Set())).toBe(0n);
  });
});
