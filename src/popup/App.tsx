import { useEffect, useState } from 'react';
import { Onboarding } from '@/screens/Onboarding';
import { Create }     from '@/screens/Create';
import { Import }     from '@/screens/Import';
import { Unlock }     from '@/screens/Unlock';
import { Dashboard, type TxClickArgs } from '@/screens/Dashboard';
import { Activity }   from '@/screens/Activity';
import { Send }       from '@/screens/Send';
import { Receive }    from '@/screens/Receive';
import { Settings }   from '@/screens/Settings';
import { AddAccount } from '@/screens/AddAccount';
import { ViewSeed }   from '@/screens/ViewSeed';
import { ExportKey }  from '@/screens/ExportKey';
import { TxDetail }   from '@/screens/TxDetail';
import { Addresses }  from '@/screens/Addresses';
import { Contacts }   from '@/screens/Contacts';
import { Names }      from '@/screens/Names';
import { TabBar, type Tab } from '@/ui/TabBar';
import { ToastHost, toast } from '@/ui/Toast';
import { hasWallet, loadMeta } from '@/storage/vault';
import { isUnlocked, restoreFromSession } from '@/state/session';
import { setBackend } from '@/api/client';

export type Screen =
  | 'loading'
  | 'onboarding' | 'create' | 'import' | 'unlock'
  | 'dashboard' | 'activity' | 'send' | 'receive' | 'settings' | 'add-account'
  | 'view-seed' | 'export-key' | 'tx-detail' | 'addresses' | 'contacts' | 'pick-contact' | 'names';

// Screens that participate in the bottom tab bar.
const TAB_SCREENS: Screen[] = ['dashboard', 'activity', 'settings'];

export function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [txArgs, setTxArgs] = useState<TxClickArgs | null>(null);
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

  const showTabBar = TAB_SCREENS.includes(screen);
  const activeTab: Tab = screen === 'activity' ? 'activity' : screen === 'settings' ? 'settings' : 'dashboard';

  return (
    <div className="popup-shell flex flex-col">
      {screen === 'loading' && (
        <div className="flex-1 flex items-center justify-center text-xs text-pearl-600">Loading…</div>
      )}

      {screen === 'onboarding' && (
        <Onboarding onCreate={() => setScreen('create')} onImport={() => setScreen('import')} />
      )}

      {screen === 'create' && (
        <Create onBack={() => setScreen('onboarding')} onDone={() => setScreen('dashboard')} />
      )}

      {screen === 'import' && (
        <Import onBack={() => setScreen('onboarding')} onDone={() => setScreen('dashboard')} />
      )}

      {screen === 'unlock' && (
        <Unlock onUnlocked={() => setScreen('dashboard')} />
      )}

      {screen === 'dashboard' && (
        <Dashboard
          onSend={() => { setSendPrefill({}); setScreen('send'); }}
          onReceive={() => setScreen('receive')}
          onLocked={() => setScreen('unlock')}
          onAddAccount={() => setScreen('add-account')}
        />
      )}

      {screen === 'activity' && (
        <Activity onOpenTx={(args) => { setTxArgs(args); setScreen('tx-detail'); }} />
      )}

      {screen === 'add-account' && (
        <AddAccount onBack={() => setScreen('dashboard')} onDone={() => setScreen('dashboard')} />
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
          onDeleted={() => setScreen('onboarding')}
          onViewSeed={() => setScreen('view-seed')}
          onExportKey={() => setScreen('export-key')}
          onAddresses={() => setScreen('addresses')}
          onContacts={() => setScreen('contacts')}
          onNames={() => setScreen('names')}
        />
      )}

      {screen === 'names' && (
        <Names onBack={() => setScreen('settings')} />
      )}

      {screen === 'view-seed' && (
        <ViewSeed onBack={() => setScreen('settings')} />
      )}

      {screen === 'export-key' && (
        <ExportKey onBack={() => setScreen('settings')} />
      )}

      {screen === 'tx-detail' && txArgs && (
        <TxDetail {...txArgs} onBack={() => setScreen('activity')} />
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

      {showTabBar && <TabBar active={activeTab} onChange={(t) => setScreen(t)} />}

      <ToastHost />
    </div>
  );
}
