// Address book. Doubles as a picker: when opened in picker mode, tapping
// a contact returns its address to the parent (Send screen). Otherwise
// it's a plain CRUD list.

import { useEffect, useState } from 'react';
import { getContacts, saveContact, deleteContact, type Contact } from '@/storage/addressBook';
import { isValidAddress } from '@/pearl/address';
import { shortAddr } from '@/ui/format';
import { toast } from '@/ui/Toast';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { PlusIcon, CloseIcon, ChevronRightIcon } from '@/ui/icons';

interface Props {
  onBack:   () => void;
  onPick?:  (address: string) => void;   // when set, picker mode
}

export function Contacts({ onBack, onPick }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [adding, setAdding]   = useState(false);
  const [label, setLabel]     = useState('');
  const [address, setAddr]    = useState('');
  const [err, setErr]         = useState<string | null>(null);
  const [confirmDel, setDel]  = useState<string | null>(null);

  const picking = !!onPick;

  useEffect(() => { (async () => setContacts(await getContacts()))(); }, []);

  async function onSave() {
    setErr(null);
    const a = address.trim();
    if (!isValidAddress(a)) { setErr('Not a valid Pearl address'); return; }
    if (!label.trim())      { setErr('Give this contact a name'); return; }
    setContacts(await saveContact({ address: a, label: label.trim() }));
    setLabel(''); setAddr(''); setAdding(false);
    toast('Contact saved');
  }

  async function paste() {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (t) setAddr(t);
    } catch {
      toast('Paste blocked by browser');
    }
  }

  async function onDelete(addr: string) {
    setContacts(await deleteContact(addr));
    setDel(null);
    toast('Contact removed');
  }

  return (
    <div className="flex-1 flex flex-col">
      <ScreenHeader title={picking ? 'Pick a contact' : 'Address book'} onBack={onBack} />

      <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
        {/* Add form */}
        {!picking && (
          adding ? (
            <div className="bg-ink-900 border border-ink-700 rounded-xl p-3 flex flex-col gap-2">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Name (e.g. Exchange, Alice)"
                className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pearl-700 text-pearl-200"
              />
              <div className="flex gap-2">
                <input
                  value={address}
                  onChange={(e) => { setAddr(e.target.value); setErr(null); }}
                  placeholder="prl1p… address"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  className="flex-1 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
                />
                <button onClick={paste} className="px-3 text-xs text-pearl-400 hover:text-pearl-200">Paste</button>
              </div>
              {err && <div className="text-xs text-rose-700 dark:text-rose-400">{err}</div>}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { setAdding(false); setErr(null); setLabel(''); setAddr(''); }}
                  className="flex-1 rounded-lg py-2 text-sm border border-ink-700 text-pearl-300 hover:bg-ink-800"
                >Cancel</button>
                <button
                  onClick={onSave}
                  className="pearl-btn flex-1 rounded-lg py-2 text-sm"
                >Save</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="pearl-card tap py-3 text-sm text-pearl-300 hover:bg-ink-800 flex items-center justify-center gap-1.5"
            >
              <PlusIcon size={16} /> Add contact
            </button>
          )
        )}

        {/* List */}
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-xs text-pearl-600">
            {picking ? 'No saved contacts to pick from.' : 'No contacts yet.'}
          </div>
        ) : (
          <div className="bg-ink-900 border border-ink-700 rounded-xl divide-y divide-ink-700 overflow-hidden">
            {contacts.map(c => (
              <div
                key={c.address}
                className="flex items-center gap-2 px-3 py-2.5 hover:bg-ink-800 transition-colors"
              >
                <button
                  onClick={() => picking ? onPick!(c.address) : navigator.clipboard.writeText(c.address).then(() => toast('Address copied'))}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="text-sm font-medium text-pearl-200 truncate">{c.label}</div>
                  <div className="text-xs font-mono text-pearl-500 truncate">{shortAddr(c.address, 14, 8)}</div>
                </button>
                {picking ? (
                  <ChevronRightIcon size={16} className="text-pearl-600 shrink-0" />
                ) : confirmDel === c.address ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => onDelete(c.address)}
                      className="text-xs font-medium text-rose-700 dark:text-rose-400 px-2 py-1 hover:bg-rose-500/10 rounded"
                    >Delete</button>
                    <button
                      onClick={() => setDel(null)}
                      className="icon-badge tap w-6 h-6 hover:text-pearl-200"
                      aria-label="Cancel"
                    ><CloseIcon size={12} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDel(c.address)}
                    className="icon-badge tap w-7 h-7 hover:text-rose-700 dark:hover:text-rose-400 shrink-0"
                    aria-label="Delete"
                  ><CloseIcon size={13} /></button>
                )}
              </div>
            ))}
          </div>
        )}

        {picking && (
          <p className="text-[11px] text-pearl-600 text-center mt-2">
            Tap a contact to use it as the recipient.
          </p>
        )}
      </div>
    </div>
  );
}
