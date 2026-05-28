// Local address book / contacts. Stored in chrome.storage.local as a single
// JSON blob (parity with mobile's expo-secure-store implementation).
// Contacts aren't secret, but the same storage backend is already in use.

const KEY = 'pearl.address_book';

export interface Contact { address: string; label: string }

let _cache: Contact[] | null = null;

function rawGet<T>(key: string): Promise<T | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([key], (res) => resolve((res[key] as T) ?? null));
  });
}

function rawSet<T>(key: string, value: T): Promise<void> {
  return new Promise(resolve => { chrome.storage.local.set({ [key]: value }, () => resolve()); });
}

export async function getContacts(): Promise<Contact[]> {
  if (_cache) return _cache;
  try {
    const parsed = (await rawGet<unknown>(KEY)) as unknown[] | null;
    _cache = Array.isArray(parsed)
      ? parsed.filter((c): c is Contact =>
          !!c && typeof (c as Contact).address === 'string' && typeof (c as Contact).label === 'string')
      : [];
  } catch {
    _cache = [];
  }
  return _cache;
}

async function persist(list: Contact[]) {
  _cache = list;
  await rawSet(KEY, list);
}

// Add or update by address (newest first; relabel overwrites).
export async function saveContact(c: Contact): Promise<Contact[]> {
  const label = c.label.trim() || 'Unnamed';
  const list = await getContacts();
  const without = list.filter((x) => x.address !== c.address);
  await persist([{ address: c.address, label }, ...without]);
  return _cache!;
}

export async function deleteContact(address: string): Promise<Contact[]> {
  const list = await getContacts();
  await persist(list.filter((c) => c.address !== address));
  return _cache!;
}

export async function labelFor(address: string): Promise<string | null> {
  const list = await getContacts();
  return list.find((c) => c.address === address)?.label ?? null;
}
