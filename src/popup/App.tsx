import { useEffect, useState } from 'react';
import { Onboarding } from '@/screens/Onboarding';
import { Import }     from '@/screens/Import';
import { Unlock }     from '@/screens/Unlock';
import { Dashboard, type TxClickArgs } from '@/screens/Dashboard';
import { Send }       from '@/screens/Send';
import { Receive }    from '@/screens/Receive';
import { Settings }   from '@/screens/Settings';
import { ViewSeed }   from '@/screens/ViewSeed';
import { TxDetail }   from '@/screens/TxDetail';
import { Addresses }  from '@/screens/Addresses';
import { Contacts }   from '@/screens/Contacts';
import { ToastHost, toast } from '@/ui/Toast';
import { hasWallet, loadMeta } from '@/storage/vault';
import { isUnlocked, restoreFromSession } from '@/state/session';
import { setBackend } from '@/api/client';

export type Screen =
  | 'loading'
  | 'onboarding' | 'import' | 'unlock'
  | 'dashboard' | 'send' | 'receive' | 'settings'
  | 'view-seed' | 'tx-detail' | 'addresses' | 'contacts' | 'pick-contact';

export function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  // Sticky state for the tx detail screen.
  const [txArgs, setTxArgs] = useState<TxClickArgs | null>(null);
  // Sticky state passed back into Send when returning from contact picker
  // or from re-entering Send mid-edit.
  const [sendPrefill, setSendPrefill] = useState<{ recipient?: string; amount?: string }>({});

  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'popup' });
    (async () => {
      const meta = await loadMeta();
      if (meta?.explorerUrl && meta?.explorerMode) {
        setBackend(meta.explorerUrl, meta.explorerMode);
      }
      const exists = await hasWallet();
      if (!exists) { setScreen('onboarding'); return; }
      const restored = isUnlocked() || (await restoreFromSession());
      setScreen(restored ? 'dashboard' : 'unlock');
    })();
    return () => { port.disconnect(); };
  }, []);

  return (
    <div className="popup-shell flex flex-col">
      {screen === 'loading' && (
        <div className="flex-1 flex items-center justify-center text-xs text-pearl-600">Loading…</div>
      )}

      {screen === 'onboarding' && (
        <Onboarding onImport={() => setScreen('import')} />
      )}

      {screen === 'import' && (
        <Import
          onBack={() => setScreen('onboarding')}
          onDone={() => setScreen('dashboard')}
        />
      )}

      {screen === 'unlock' && (
        <Unlock onUnlocked={() => setScreen('dashboard')} />
      )}

      {screen === 'dashboard' && (
        <Dashboard
          onSend={() => { setSendPrefill({}); setScreen('send'); }}
          onReceive={() => setScreen('receive')}
          onSettings={() => setScreen('settings')}
          onLocked={() => setScreen('unlock')}
          onOpenTx={(args) => { setTxArgs(args); setScreen('tx-detail'); }}
        />
      )}

      {screen === 'send' && (
        <Send
          onBack={() => setScreen('dashboard')}
          onSent={(txid) => { toast(`Sent: ${txid.slice(0, 10)}…`); setSendPrefill({}); setScreen('dashboard'); }}
          onPickContact={() => setScreen('pick-contact')}
          initialRecipient={sendPrefill.recipient}
          initialAmount={sendPrefill.amount}
        />
      )}

      {screen === 'receive' && (
        <Receive onBack={() => setScreen('dashboard')} />
      )}

      {screen === 'settings' && (
        <Settings
          onBack={() => setScreen('dashboard')}
          onLocked={() => setScreen('unlock')}
          onViewSeed={() => setScreen('view-seed')}
          onAddresses={() => setScreen('addresses')}
          onContacts={() => setScreen('contacts')}
        />
      )}

      {screen === 'view-seed' && (
        <ViewSeed onBack={() => setScreen('settings')} />
      )}

      {screen === 'tx-detail' && txArgs && (
        <TxDetail
          {...txArgs}
          onBack={() => setScreen('dashboard')}
        />
      )}

      {screen === 'addresses' && (
        <Addresses onBack={() => setScreen('settings')} />
      )}

      {screen === 'contacts' && (
        <Contacts onBack={() => setScreen('settings')} />
      )}

      {screen === 'pick-contact' && (
        <Contacts
          onBack={() => setScreen('send')}
          onPick={(address) => { setSendPrefill({ ...sendPrefill, recipient: address }); setScreen('send'); }}
        />
      )}

      <ToastHost />
    </div>
  );
}
